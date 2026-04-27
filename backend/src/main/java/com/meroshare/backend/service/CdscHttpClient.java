package com.meroshare.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Component
public class CdscHttpClient {

    private static final int TIMEOUT_SECONDS = 20;
    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36";

    private volatile boolean curlAvailable = true;

    private final AtomicReference<String> lastAuthHeader = new AtomicReference<>(null);

    public String getLastResponseHeader(String headerName) {
        if ("Authorization".equalsIgnoreCase(headerName)) {
            return lastAuthHeader.get();
        }
        return null;
    }

    public String postJsonWithHeaders(String url, String jsonBody, String authToken) {
        if (!curlAvailable) return null;
        try {
            List<String> cmd = buildCommand(url, authToken);
            cmd.add("-X"); cmd.add("POST");
            cmd.add("-d"); cmd.add(jsonBody);
            cmd.add("-D"); cmd.add("-");
            return executeAndParseHeaders(cmd, url);
        } catch (Exception e) {
            log.warn("[CURL_POST_H] Failed for {}: {}", url, e.getMessage());
            return null;
        }
    }

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
        cmd.add("-s");
        cmd.add("--max-time"); cmd.add(String.valueOf(TIMEOUT_SECONDS));
        cmd.add("--compressed");
        cmd.add("-L");
        cmd.add("--http2");

        cmd.add("-H"); cmd.add("Content-Type: application/json");
        cmd.add("-H"); cmd.add("Accept: application/json, text/plain, */*");
        cmd.add("-H"); cmd.add("Accept-Language: en-US,en;q=0.9");
        cmd.add("-H"); cmd.add("Accept-Encoding: gzip, deflate, br");
        cmd.add("-H"); cmd.add("Cache-Control: no-cache");
        cmd.add("-H"); cmd.add("Pragma: no-cache");
        cmd.add("-H"); cmd.add("Connection: keep-alive");

        if (url.contains("webbackend.cdsc.com.np")) {
            cmd.add("-H"); cmd.add("Host: webbackend.cdsc.com.np");
            cmd.add("-H"); cmd.add("User-Agent: " + USER_AGENT);
            cmd.add("-H"); cmd.add("Origin: https://meroshare.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://meroshare.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Dest: empty");
            cmd.add("-H"); cmd.add("Sec-Fetch-Mode: cors");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-site");

            if (authToken != null && !authToken.isBlank()) {
                cmd.add("-H"); cmd.add("Authorization: " + authToken);
            }
        } else if (url.contains("iporesult.cdsc.com.np")) {
            cmd.add("-H"); cmd.add("User-Agent: " + USER_AGENT);
            cmd.add("-H"); cmd.add("Origin: https://iporesult.cdsc.com.np");
            cmd.add("-H"); cmd.add("Referer: https://iporesult.cdsc.com.np/");
            cmd.add("-H"); cmd.add("Sec-Fetch-Dest: empty");
            cmd.add("-H"); cmd.add("Sec-Fetch-Mode: cors");
            cmd.add("-H"); cmd.add("Sec-Fetch-Site: same-origin");
        } else {
            cmd.add("-H"); cmd.add("User-Agent: " + USER_AGENT);
        }

        cmd.add(url);
        return cmd;
    }

    private String executeAndParseHeaders(List<String> cmd, String url) throws Exception {
        if (log.isDebugEnabled()) {
            String safe = String.join(" ", cmd)
                    .replaceAll("(Authorization: )\\S+", "$1***");
            log.debug("[CURL] {}", safe);
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            boolean headersEnded = false;
            while ((line = reader.readLine()) != null) {
                if (!headersEnded) {
                    if (line.isEmpty() || line.equals("\r")) {
                        headersEnded = true;
                        continue;
                    }
                    if (line.toLowerCase().startsWith("authorization:")) {
                        String token = line.substring("authorization:".length()).trim();
                        if (!token.isBlank()) {
                            lastAuthHeader.set(token);
                            log.info("[CURL] Captured Authorization header from response");
                        }
                    }
                } else {
                    output.append(line).append("\n");
                }
            }
        }

        boolean finished = process.waitFor(TIMEOUT_SECONDS + 5L, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            log.warn("[CURL] Timed out for: {}", url);
            return null;
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            if (exitCode == 127) {
                log.warn("[CURL] curl not found in PATH");
                curlAvailable = false;
            } else {
                log.warn("[CURL] Exit code={} for: {}", exitCode, url);
            }
            return null;
        }

        String result = output.toString().trim();
        return result.isEmpty() ? null : result;
    }

    private String execute(List<String> cmd, String url) throws Exception {
        if (log.isDebugEnabled()) {
            String safe = String.join(" ", cmd)
                    .replaceAll("(Authorization: )\\S+", "$1***");
            log.debug("[CURL] {}", safe);
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        StringBuilder errOutput = new StringBuilder();
        try (BufferedReader errReader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
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
                log.warn("[CURL] curl not found in PATH, disabling curl fallback");
                curlAvailable = false;
            } else {
                log.warn("[CURL] Exit code={} for: {} | stderr: {}",
                        exitCode, url, errOutput.toString().trim());
            }
            return null;
        }

        String result = output.toString().trim();
        if (log.isDebugEnabled()) {
            log.debug("[CURL] Response for {}: {}", url,
                    result.substring(0, Math.min(200, result.length())));
        }
        return result.isEmpty() ? null : result;
    }
}