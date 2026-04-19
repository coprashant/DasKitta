package com.meroshare.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client using curl subprocess as a fallback when Spring WebClient is
 * blocked by Cloudflare's WAF / Bot Management.
 *
 * Why curl works when WebClient doesn't:
 * ──────────────────────────────────────
 * Cloudflare Bot Management (Enterprise tier, used by CDSC) inspects:
 *
 *  1. JA3 TLS fingerprint — Java's TLS stack (JSSE) has a well-known JA3 hash
 *     that is trivially identified as non-browser. The system curl binary uses
 *     the OS TLS library (OpenSSL/LibreSSL on Linux), which has a JA3 hash
 *     indistinguishable from a real browser on the same OS.
 *
 *  2. HTTP/2 SETTINGS frame — Java's Reactor Netty sends different HTTP/2
 *     SETTINGS than Chrome/curl. curl with HTTP/2 enabled sends settings that
 *     match a real browser.
 *
 *  3. Header order — HTTP/2 header ordering is part of the fingerprint.
 *     curl sends headers in a consistent, browser-like order.
 *
 * reCAPTCHA v3 is injected by the *web frontend JS* — it runs in the browser
 * and generates a token that the web JS sends to the backend. The mobile API
 * endpoint (webbackend.cdsc.com.np) does NOT require a reCAPTCHA token — it
 * only uses the Authorization token from /meroShare/auth/. So there is no
 * reCAPTCHA to bypass at the API level, only Cloudflare's bot detection at
 * the network level, which curl handles.
 *
 * If curl is also blocked (IP-level block), there is no free server-side
 * solution. The only options would be:
 *   - Rotate outbound IPs (paid, e.g. residential proxies)
 *   - Use the official Meroshare mobile app session (requires device)
 */
@Slf4j
@Component
public class CdscHttpClient {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final int TIMEOUT_SECONDS = 20;
    private volatile boolean curlAvailable = true;

    /**
     * POST JSON to a URL using curl. Returns the response body, or null on failure.
     */
    public String postJson(String url, String jsonBody, String authToken) {
        if (!curlAvailable) return null;
        try {
            List<String> cmd = buildCommand(url, authToken);
            cmd.add("-X"); cmd.add("POST");
            cmd.add("-d"); cmd.add(jsonBody);
            return execute(cmd, url);
        } catch (Exception e) {
            log.warn("[CURL_POST] Failed for {}: {}", url, e.getMessage());
            return null;
        }
    }

    /**
     * GET a URL using curl. Returns the response body, or null on failure.
     */
    public String get(String url, String authToken) {
        if (!curlAvailable) return null;
        try {
            List<String> cmd = buildCommand(url, authToken);
            return execute(cmd, url);
        } catch (Exception e) {
            log.warn("[CURL_GET] Failed for {}: {}", url, e.getMessage());
            return null;
        }
    }

    private List<String> buildCommand(String url, String authToken) {
        List<String> cmd = new ArrayList<>();
        cmd.add("curl");
        cmd.add("-s");                              // silent (no progress)
        cmd.add("--max-time"); cmd.add(String.valueOf(TIMEOUT_SECONDS));
        cmd.add("--compressed");                   // accept gzip/br
        cmd.add("-L");                             // follow redirects
        cmd.add("--http2");                        // force HTTP/2 (key for fingerprint)

        // ── Core headers ──────────────────────────────────────────────────────
        // Order matters for HTTP/2 HPACK fingerprinting — keep this exact order
        // which mirrors what Chrome 124 sends to the Meroshare mobile endpoint.
        cmd.add("-H"); cmd.add("Content-Type: application/json");
        cmd.add("-H"); cmd.add("Accept: application/json, text/plain, */*");
        cmd.add("-H"); cmd.add("Accept-Language: en-US,en;q=0.9");
        cmd.add("-H"); cmd.add("Accept-Encoding: gzip, deflate, br");

        // ── Domain-specific headers ───────────────────────────────────────────
        if (url.contains("webbackend.cdsc.com.np")) {
            // Meroshare mobile API — use Android app User-Agent to avoid browser checks
            cmd.add("-H"); cmd.add("User-Agent: Meroshare/2.0.1 (Android; com.cdsc.meroshare)");
            cmd.add("-H"); cmd.add("Origin: https://meroshare.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://meroshare.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Dest: empty");
            cmd.add("-H"); cmd.add("Sec-Fetch-Mode: cors");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-site");

            if (authToken != null && !authToken.isBlank()) {
                cmd.add("-H"); cmd.add("Authorization: " + authToken);
                cmd.add("-H"); cmd.add("Cookie: Authorization=" + authToken);
            }
        } else if (url.contains("iporesult.cdsc.com.np")) {
            // IPO result portal — use mobile Chrome UA (this site checks more headers)
            cmd.add("-H"); cmd.add("User-Agent: Mozilla/5.0 (Linux; Android 11; Pixel 5) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
            cmd.add("-H"); cmd.add("Origin: https://iporesult.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://iporesult.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Dest: empty");
            cmd.add("-H"); cmd.add("Sec-Fetch-Mode: cors");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-origin");
        } else {
            // Generic fallback
            cmd.add("-H"); cmd.add("User-Agent: Mozilla/5.0 (Linux; Android 11; Pixel 5) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
        }

        cmd.add(url);
        return cmd;
    }

    private String execute(List<String> cmd, String url) throws Exception {
        // Log command but redact auth tokens
        if (log.isDebugEnabled()) {
            String safe = String.join(" ", cmd)
                    .replaceAll("(Authorization: |Cookie: Authorization=)\\S+", "$1***");
            log.debug("[CURL] {}", safe);
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        // Read stderr for diagnostics (don't merge with stdout)
        StringBuilder errOutput = new StringBuilder();
        try (BufferedReader errReader = new BufferedReader(
                new InputStreamReader(process.getErrorStream()))) {
            String line;
            while ((line = errReader.readLine()) != null) {
                errOutput.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(TIMEOUT_SECONDS + 5L, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            log.warn("[CURL] Timed out after {}s for: {}", TIMEOUT_SECONDS, url);
            return null;
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            if (exitCode == 127) {
                log.warn("[CURL] curl not found in PATH — curl fallback disabled");
                curlAvailable = false;
            } else {
                log.warn("[CURL] Exit code={} for: {} | stderr: {}",
                        exitCode, url, errOutput.toString().trim());
            }
            return null;
        }

        String result = output.toString().trim();
        if (log.isDebugEnabled()) {
            log.debug("[CURL] Response for {}: {}",
                    url, result.substring(0, Math.min(200, result.length())));
        }
        return result.isEmpty() ? null : result;
    }
}