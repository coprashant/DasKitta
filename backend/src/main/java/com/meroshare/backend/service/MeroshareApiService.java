package com.meroshare.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class MeroshareApiService {

    @Value("${meroshare.api.base-url}")
    private String baseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private WebClient buildClient() {
        return buildClientWithToken(null);
    }

    private WebClient buildClientWithToken(String token) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Language", "en-GB,en;q=0.9,en-US;q=0.8")
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36 Edg/145.0.0.0")
                .defaultHeader("sec-ch-ua", "\"Not:A-Brand\";v=\"99\", \"Microsoft Edge\";v=\"145\", \"Chromium\";v=\"145\"")
                .defaultHeader("sec-ch-ua-mobile", "?1")
                .defaultHeader("sec-ch-ua-platform", "\"Android\"")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-site")
                .defaultHeader("Connection", "keep-alive")
                .codecs(config -> config.defaultCodecs().maxInMemorySize(2 * 1024 * 1024));

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", token)
                   .defaultHeader("Cookie", "Authorization=" + token);
        }

        return builder.build();
    }

    private Map parseJsonResponse(String raw, String context) {
        try {
            log.info("[{}] Raw response: {}", context, raw);
            if (raw == null || raw.isBlank()) {
                throw new RuntimeException("Empty response from CDSC");
            }
            if (raw.trim().startsWith("<")) {
                log.error("[{}] CDSC returned HTML instead of JSON: {}", context,
                        raw.substring(0, Math.min(500, raw.length())));
                throw new RuntimeException("CDSC returned an HTML error page. Check credentials or DP ID.");
            }
            return objectMapper.readValue(raw, Map.class);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse response: " + e.getMessage());
        }
    }

    public List<Map> getDpList() {
        try {
            String raw = buildClient().get()
                    .uri("/meroShare/capital/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[DP_LIST] Raw response: {}", raw);

            if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
                return List.of();
            }

            return objectMapper.readValue(raw,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
        } catch (Exception e) {
            log.error("[DP_LIST] Failed to fetch DP list: {}", e.getMessage());
            return List.of();
        }
    }

    public String login(String dpId, String username, String password) {
        Map<String, Object> body = new HashMap<>();
        body.put("clientId", Integer.parseInt(dpId));
        body.put("username", username);
        body.put("password", password);

        log.info("Attempting Meroshare login for user: {} dpId: {}", username, dpId);

        var response = buildClient().post()
                .uri("/meroShare/auth/")
                .bodyValue(body)
                .retrieve()
                .toEntity(String.class)
                .block();

        String raw = response.getBody();
        log.info("[LOGIN] Raw response: {}", raw);

        if (raw == null || raw.trim().startsWith("<")) {
            throw new RuntimeException("CDSC returned an HTML error page.");
        }

        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (cookies != null) {
            for (String cookie : cookies) {
                if (cookie.startsWith("Authorization=")) {
                    String token = cookie.split(";")[0].replace("Authorization=", "");
                    log.info("Login successful, token extracted from cookie for user: {}", username);
                    return token;
                }
            }
        }

        String authHeader = response.getHeaders().getFirst("Authorization");
        if (authHeader != null && !authHeader.isBlank()) {
            log.info("Login successful, token extracted from Authorization header for user: {}", username);
            return authHeader;
        }

        log.error("No token found in cookies or headers. Cookies: {}", cookies);
        throw new RuntimeException("Login succeeded but no token found.");
    }

    public AccountDetails fetchAccountDetails(String token) {
        String raw = buildClientWithToken(token).get()
                .uri("/meroShare/ownDetail/")
                .retrieve()
                .bodyToMono(String.class)
                .block();

        Map response = parseJsonResponse(raw, "OWN_DETAIL");

        AccountDetails details = new AccountDetails();
        details.setFullName((String) response.get("name"));
        details.setBoid((String) response.get("boid"));
        details.setDemat((String) response.get("demat"));

        log.info("Account details fetched: name={} boid={}", details.getFullName(), details.getBoid());

        fetchBankId(token, details);

        if (details.getBankId() == null && response.get("clientCode") != null) {
            details.setBankId(String.valueOf(response.get("clientCode")));
            log.info("Bank ID set from clientCode: {}", details.getBankId());
        }

        return details;
    }

    private void fetchBankId(String token, AccountDetails details) {
        try {
            String raw = buildClientWithToken(token).get()
                    .uri("/bankRequest/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[BANK] Raw response: {}", raw);

            if (raw != null && raw.trim().startsWith("[")) {
                List<Map> banks = objectMapper.readValue(raw,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
                if (!banks.isEmpty()) {
                    details.setBankId(String.valueOf(banks.get(0).get("id")));
                    log.info("Bank ID fetched: {}", details.getBankId());
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch bank ID: {}", e.getMessage());
        }
    }

    public List<Map> getOpenIpos(String token) {
        try {
            String raw = buildClientWithToken(token).get()
                    .uri("/meroShare/active/")
                    .retrieve()
                    .onStatus(status -> status.is5xxServerError(), response -> {
                        log.warn("[OPEN_IPOS] CDSC returned 5xx - no open IPOs available");
                        return reactor.core.publisher.Mono.empty();
                    })
                    .bodyToMono(String.class)
                    .block();

            if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
                log.info("[OPEN_IPOS] No open IPOs or empty response");
                return List.of();
            }

            log.info("[OPEN_IPOS] Raw response: {}", raw);
            return objectMapper.readValue(raw,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
        } catch (Exception e) {
            log.warn("[OPEN_IPOS] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    public List<Map> getClosedIpos(String token) {
        try {
            String raw = buildClientWithToken(token).get()
                    .uri("/meroShare/applicant/report/")
                    .retrieve()
                    .onStatus(status -> status.is5xxServerError(), response -> {
                        log.warn("[CLOSED_IPOS] CDSC returned 5xx");
                        return reactor.core.publisher.Mono.empty();
                    })
                    .bodyToMono(String.class)
                    .block();

            if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
                log.info("[CLOSED_IPOS] No closed IPOs or empty response");
                return List.of();
            }

            log.info("[CLOSED_IPOS] Raw response: {}", raw);
            return objectMapper.readValue(raw,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
        } catch (Exception e) {
            log.warn("[CLOSED_IPOS] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    public String applyIpo(String token, String shareId, String boid,
                           String bankId, int kitta) {
        Map<String, Object> body = new HashMap<>();
        body.put("accountBranchId", bankId);
        body.put("accountNumber", boid);
        body.put("appliedKitta", String.valueOf(kitta));
        body.put("crnNumber", "");
        body.put("customerId", boid);
        body.put("demat", boid);
        body.put("boid", boid);
        body.put("shareId", shareId);
        body.put("transactionPIN", "");

        log.info("Applying IPO shareId={} boid={} kitta={}", shareId, boid, kitta);

        String raw = buildClientWithToken(token).post()
                .uri("/meroShare/applicant/")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.info("[APPLY_IPO] Raw response: {}", raw);

        try {
            if (raw != null && !raw.trim().startsWith("<")) {
                Map response = objectMapper.readValue(raw, Map.class);
                if (response.containsKey("message")) {
                    return (String) response.get("message");
                }
            }
        } catch (Exception e) {
            log.warn("Could not parse apply response: {}", e.getMessage());
        }

        return "Applied successfully";
    }

    public ResultInfo checkResult(String token, String boid, String shareId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");

        try {
            String raw = buildClientWithToken(token).post()
                    .uri("/meroShare/applicant/report/detail/")
                    .bodyValue(Map.of("boid", boid, "shareId", shareId))
                    .retrieve()
                    .onStatus(status -> status.is5xxServerError(), response -> {
                        log.warn("[CHECK_RESULT] CDSC returned 5xx for boid={} shareId={}", boid, shareId);
                        return reactor.core.publisher.Mono.empty();
                    })
                    .bodyToMono(String.class)
                    .block();

            log.info("[CHECK_RESULT] Raw response: {}", raw);

            if (raw != null && !raw.trim().startsWith("<")) {
                Map response = objectMapper.readValue(raw, Map.class);
                result.setStatus((String) response.get("status"));
                Object allotted = response.get("receivedKitta");
                result.setAllottedKitta(
                        allotted != null ? Integer.parseInt(allotted.toString()) : 0);
            }
        } catch (Exception e) {
            log.warn("Result check failed for boid {}: {}", boid, e.getMessage());
        }

        return result;
    }

    @Data
    public static class AccountDetails {
        private String fullName;
        private String boid;
        private String demat;
        private String bankId;
    }

    @Data
    public static class ResultInfo {
        private String status;
        private int allottedKitta;
    }
}