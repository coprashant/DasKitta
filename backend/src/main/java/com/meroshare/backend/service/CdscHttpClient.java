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

@Slf4j
@Component
public class CdscHttpClient {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final int TIMEOUT_SECONDS = 15;

    private boolean curlAvailable = true; // cached after first check

    /**
     * POST JSON to a URL using curl. Returns the response body, or null on failure.
     */
    public String postJson(String url, String jsonBody, String authToken) {
        if (!curlAvailable) return null;
        try {
            List<String> cmd = buildBaseCommand(url, authToken);
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
            List<String> cmd = buildBaseCommand(url, authToken);
            return execute(cmd, url);
        } catch (Exception e) {
            log.warn("[CURL_GET] Failed for {}: {}", url, e.getMessage());
            return null;
        }
    }

    private List<String> buildBaseCommand(String url, String authToken) {
        List<String> cmd = new ArrayList<>();
        cmd.add("curl");
        cmd.add("-s");                    // silent
        cmd.add("--max-time"); cmd.add(String.valueOf(TIMEOUT_SECONDS));
        cmd.add("--compressed");          // handle gzip/br responses
        cmd.add("-L");                    // follow redirects

        // Headers matching a real browser
        cmd.add("-H"); cmd.add("Accept: application/json, text/plain, */*");
        cmd.add("-H"); cmd.add("Accept-Language: en-GB,en-US;q=0.9,en;q=0.8");
        cmd.add("-H"); cmd.add("Content-Type: application/json");
        cmd.add("-H"); cmd.add("User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        cmd.add("-H"); cmd.add("sec-ch-ua: \"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"");
        cmd.add("-H"); cmd.add("sec-ch-ua-mobile: ?0");
        cmd.add("-H"); cmd.add("sec-ch-ua-platform: \"Windows\"");
        cmd.add("-H"); cmd.add("Sec-Fetch-Dest: empty");
        cmd.add("-H"); cmd.add("Sec-Fetch-Mode: cors");

        // Domain-specific headers
        if (url.contains("webbackend.cdsc.com.np")) {
            cmd.add("-H"); cmd.add("Origin: https://meroshare.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://meroshare.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-site");
            if (authToken != null && !authToken.isBlank()) {
                cmd.add("-H"); cmd.add("Authorization: " + authToken);
                cmd.add("-H"); cmd.add("Cookie: Authorization=" + authToken);
            }
        } else if (url.contains("iporesult.cdsc.com.np")) {
            cmd.add("-H"); cmd.add("Origin: https://iporesult.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://iporesult.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-origin");
        }

        cmd.add(url);
        return cmd;
    }

    private String execute(List<String> cmd, String url) throws Exception {
        log.debug("[CURL] Executing: {}", String.join(" ", cmd)
                .replaceAll("(Authorization: |Cookie: Authorization=)[^\"]+", "$1***"));

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

        boolean finished = process.waitFor(TIMEOUT_SECONDS + 5, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            log.warn("[CURL] Timed out for: {}", url);
            return null;
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            // curl not found or other fatal error
            if (exitCode == 127) {
                log.warn("[CURL] curl not found in PATH — curl fallback disabled");
                curlAvailable = false;
            } else {
                log.warn("[CURL] Exit code {} for: {}", exitCode, url);
            }
            return null;
        }

        String result = output.toString().trim();
        log.debug("[CURL] Response for {}: {}", url, result.substring(0, Math.min(200, result.length())));
        return result.isEmpty() ? null : result;
    }
}