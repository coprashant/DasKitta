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
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    private volatile boolean curlAvailable = true;
    private volatile boolean http2Supported = false;

    private final AtomicReference<String> lastAuthHeader = new AtomicReference<>(null);

    public CdscHttpClient() {
        probeHttp2();
    }

    private void probeHttp2() {
        try {
            ProcessBuilder pb = new ProcessBuilder("curl", "--version");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            String out;
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                out = r.lines().collect(java.util.stream.Collectors.joining(" "));
            }
            p.waitFor(5, TimeUnit.SECONDS);
            http2Supported = out.toLowerCase().contains("http2");
            log.info("[CURL] http2 support detected: {}", http2Supported);
        } catch (Exception e) {
            log.warn("[CURL] Could not probe curl version: {}", e.getMessage());
            http2Supported = false;
        }
    }

    public String getLastResponseHeader(String headerName) {
        if ("Authorization".equalsIgnoreCase(headerName)) {
            return lastAuthHeader.get();
        }
        return null;
    }

    public String postJsonWithSession(String seedUrl, String postUrl, String jsonBody) {
        if (!curlAvailable) return null;

        java.io.File cookieFile = null;
        try {
            cookieFile = java.io.File.createTempFile("cdsc_cookie_", ".txt");
            cookieFile.deleteOnExit();

            List<String> seedCmd = new ArrayList<>();
            seedCmd.add("curl"); seedCmd.add("-s");
            seedCmd.add("--max-time"); seedCmd.add("10");
            seedCmd.add("--compressed"); seedCmd.add("-L");
            seedCmd.add("-c"); seedCmd.add(cookieFile.getAbsolutePath());
            seedCmd.add("-H"); seedCmd.add("User-Agent: " + USER_AGENT);
            seedCmd.add("-H"); seedCmd.add("Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            seedCmd.add("-H"); seedCmd.add("Accept-Language: en-US,en;q=0.9");
            seedCmd.add("-H"); seedCmd.add("Accept-Encoding: gzip, deflate, br");
            seedCmd.add("-H"); seedCmd.add("Connection: keep-alive");
            seedCmd.add("-H"); seedCmd.add("Referer: https://iporesult.cdsc.com.np/");
            seedCmd.add(seedUrl);
            execute(seedCmd, seedUrl);

            List<String> postCmd = new ArrayList<>();
            postCmd.add("curl"); postCmd.add("-s");
            postCmd.add("--max-time"); postCmd.add(String.valueOf(TIMEOUT_SECONDS));
            postCmd.add("--compressed"); postCmd.add("-L");
            if (http2Supported) postCmd.add("--http2");
            postCmd.add("-b"); postCmd.add(cookieFile.getAbsolutePath());
            postCmd.add("-c"); postCmd.add(cookieFile.getAbsolutePath());
            postCmd.add("-X"); postCmd.add("POST");
            postCmd.add("-d"); postCmd.add(jsonBody);
            postCmd.add("-H"); postCmd.add("Content-Type: application/json");
            postCmd.add("-H"); postCmd.add("Accept: application/json, text/plain, */*");
            postCmd.add("-H"); postCmd.add("Accept-Language: en-US,en;q=0.9");
            postCmd.add("-H"); postCmd.add("Accept-Encoding: gzip, deflate, br");
            postCmd.add("-H"); postCmd.add("Cache-Control: no-cache");
            postCmd.add("-H"); postCmd.add("Connection: keep-alive");
            postCmd.add("-H"); postCmd.add("User-Agent: " + USER_AGENT);
            postCmd.add("-H"); postCmd.add("Origin: https://iporesult.cdsc.com.np");
            postCmd.add("-H"); postCmd.add("Referer: https://iporesult.cdsc.com.np/");
            postCmd.add("-H"); postCmd.add("Sec-Fetch-Dest: empty");
            postCmd.add("-H"); postCmd.add("Sec-Fetch-Mode: cors");
            postCmd.add("-H"); postCmd.add("Sec-Fetch-Site: same-origin");
            postCmd.add(postUrl);
            return execute(postCmd, postUrl);

        } catch (Exception e) {
            log.warn("[CURL_SESSION_POST] Failed for {}: {}", postUrl, e.getMessage());
            return null;
        } finally {
            if (cookieFile != null) cookieFile.delete();
        }
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
        if (http2Supported) {
            cmd.add("--http2");
        }

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