package com.meroshare.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class MeroshareApiService {

    @Value("${meroshare.api.base-url}")
    private String baseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ─── WebClient builders ──────────────────────────────────────────────────

    private WebClient buildClientWithToken(String token) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Language", "en-GB,en;q=0.9,en-US;q=0.8,ne;q=0.7")
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                .defaultHeader("sec-ch-ua",
                        "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
                .defaultHeader("sec-ch-ua-mobile", "?0")
                .defaultHeader("sec-ch-ua-platform", "\"Windows\"")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-site")
                .defaultHeader("Connection", "keep-alive")
                .codecs(config -> config.defaultCodecs().maxInMemorySize(4 * 1024 * 1024));

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", token)
                   .defaultHeader("Cookie", "Authorization=" + token);
        }
        return builder.build();
    }

    private WebClient buildClient() {
        return buildClientWithToken(null);
    }

    private WebClient buildCdscResultClient() {
        return WebClient.builder()
                .baseUrl("https://iporesult.cdsc.com.np")
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader("Origin", "https://iporesult.cdsc.com.np")
                .defaultHeader("Referer", "https://iporesult.cdsc.com.np/")
                .defaultHeader("Host", "iporesult.cdsc.com.np")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                .defaultHeader("sec-ch-ua",
                        "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
                .defaultHeader("sec-ch-ua-mobile", "?0")
                .defaultHeader("sec-ch-ua-platform", "\"Windows\"")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-origin")
                .defaultHeader("Connection", "keep-alive")
                .codecs(config -> config.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }

    // ─── JSON helpers ─────────────────────────────────────────────────────────

    private List<Map> nodeArrayToList(JsonNode arrayNode) {
        List<Map> result = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            result.add(objectMapper.convertValue(item, Map.class));
        }
        return result;
    }

    private List<Map> parseJsonArraySafely(String raw, String context) {
        if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
            log.info("[{}] Empty or HTML response", context);
            return List.of();
        }
        try {
            JsonNode node = objectMapper.readTree(raw);
            if (node.isArray()) return nodeArrayToList(node);
            log.info("[{}] Not a root array: {}", context, raw.substring(0, Math.min(200, raw.length())));
            return List.of();
        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
    }

    private List<Map> parseJsonResponse(String raw, String context) {
        if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
            log.info("[{}] Empty or HTML response", context);
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(raw);

            if (root.isArray()) return nodeArrayToList(root);

            if (root.has("object") && root.get("object").isArray())
                return nodeArrayToList(root.get("object"));

            if (root.has("body")) {
                JsonNode body = root.get("body");
                if (body.isArray()) return nodeArrayToList(body);
                if (body.isObject() && body.has("companyShareList")
                        && body.get("companyShareList").isArray())
                    return nodeArrayToList(body.get("companyShareList"));
            }

            log.warn("[{}] Unrecognised shape: {}", context,
                    raw.substring(0, Math.min(300, raw.length())));
            return List.of();

        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
    }

    private String extractMessageFromJson(String raw) {
        if (raw == null || raw.isBlank()) return "Unknown error";
        try {
            JsonNode node = objectMapper.readTree(raw);
            if (node.has("message")) return node.get("message").asText(raw);
        } catch (Exception ignored) {}
        return raw;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    public List<Map> getDpList() {
        try {
            String raw = buildClient().get()
                    .uri("/meroShare/capital/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            return parseJsonArraySafely(raw, "DP_LIST");
        } catch (Exception e) {
            log.error("[DP_LIST] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Logs in to Meroshare and returns the bearer token.
     * FIX: Removed the unreachable WebClientResponseException catch block that
     * was after the RuntimeException catch block — this caused a compile-time
     * Error at runtime (Unresolved compilation problem) because
     * WebClientResponseException is a RuntimeException subclass.
     */
    public String login(String dpId, String username, String password) {
        int clientId;
        try {
            clientId = Integer.parseInt(dpId.trim());
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid DP ID (must be numeric): " + dpId);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("clientId", clientId);
        body.put("username", username.trim());
        body.put("password", password);

        log.info("Attempting Meroshare login for user: {} dpId: {}", username, dpId);

        try {
            var response = buildClient().post()
                    .uri("/meroShare/auth/")
                    .bodyValue(body)
                    .retrieve()
                    .toEntity(String.class)
                    .block();

            if (response == null) {
                throw new RuntimeException("No response received from Meroshare login API");
            }

            String raw = response.getBody();
            log.info("[LOGIN] Status: {} Body: {}", response.getStatusCode(), raw);

            // Check for an error message in the body
            if (raw != null && !raw.isBlank() && !raw.trim().startsWith("<")) {
                try {
                    JsonNode node = objectMapper.readTree(raw);
                    if (node.has("message") && (node.has("status") || node.has("error"))) {
                        String msg = node.get("message").asText("");
                        if (!msg.isBlank() && !msg.equalsIgnoreCase("null")) {
                            throw new RuntimeException("Meroshare login error: " + msg);
                        }
                    }
                } catch (RuntimeException re) {
                    throw re;
                } catch (Exception ignored) { /* not JSON or no error */ }
            }

            // Primary: token in Set-Cookie header
            List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
            if (cookies != null) {
                for (String cookie : cookies) {
                    if (cookie.startsWith("Authorization=")) {
                        String token = cookie.split(";")[0].replace("Authorization=", "").trim();
                        if (!token.isBlank()) {
                            log.info("[LOGIN] Token from cookie for user: {}", username);
                            return token;
                        }
                    }
                }
            }

            // Fallback: Authorization response header
            String authHeader = response.getHeaders().getFirst("Authorization");
            if (authHeader != null && !authHeader.isBlank()) {
                log.info("[LOGIN] Token from header for user: {}", username);
                return authHeader;
            }

            // Fallback: token field in JSON body
            if (raw != null && !raw.isBlank() && !raw.trim().startsWith("<")) {
                try {
                    JsonNode node = objectMapper.readTree(raw);
                    if (node.has("token")) {
                        String token = node.get("token").asText("");
                        if (!token.isBlank()) return token;
                    }
                } catch (Exception ignored) {}
            }

            log.error("[LOGIN] No token found. Cookies: {}", cookies);
            throw new RuntimeException("Login succeeded but no token received. Please verify your credentials.");

        } catch (WebClientResponseException e) {
            // FIX: WebClientResponseException is caught BEFORE the generic Exception
            // so the compiler sees it as reachable. Order matters!
            log.error("[LOGIN] HTTP {} error: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Meroshare login failed: " + extractMessageFromJson(e.getResponseBodyAsString()));
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            log.error("[LOGIN] Unexpected error: {}", e.getMessage());
            throw new RuntimeException("Meroshare login failed: " + e.getMessage());
        }
    }

    // ─── Account details ──────────────────────────────────────────────────────

    public AccountDetails fetchAccountDetails(String token) {
        try {
            String raw = buildClientWithToken(token).get()
                    .uri("/meroShare/ownDetail/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[OWN_DETAIL] Raw: {}", raw);
            if (raw == null || raw.trim().startsWith("<")) {
                throw new RuntimeException("Invalid response from Meroshare account details API");
            }

            JsonNode node = objectMapper.readTree(raw);
            AccountDetails details = new AccountDetails();
            details.setFullName(node.has("name") ? node.get("name").asText(null) : null);
            details.setBoid(node.has("boid") ? node.get("boid").asText(null) : null);
            details.setDemat(node.has("demat") ? node.get("demat").asText(null) : null);

            log.info("Account: name={} boid={}", details.getFullName(), details.getBoid());
            fetchBankDetails(token, details);
            return details;

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch account details: " + e.getMessage());
        }
    }

    private void fetchBankDetails(String token, AccountDetails details) {
        try {
            String banksRaw = buildClientWithToken(token).get()
                    .uri("/meroShare/bank/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[BANK] Raw: {}", banksRaw);
            List<Map> banks = parseJsonArraySafely(banksRaw, "BANK");
            if (banks.isEmpty()) { log.warn("No banks found"); return; }

            String bankId = String.valueOf(banks.get(0).get("id"));
            details.setBankId(bankId);

            String branchRaw = buildClientWithToken(token).get()
                    .uri("/meroShare/bank/" + bankId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[BRANCH] Raw: {}", branchRaw);
            List<Map> branches = parseJsonArraySafely(branchRaw, "BRANCH");
            if (!branches.isEmpty()) {
                Map<?, ?> branch = branches.get(0);
                details.setAccountNumber(String.valueOf(branch.get("accountNumber")));
                details.setAccountBranchId(String.valueOf(branch.get("accountBranchId")));
                details.setAccountTypeId(String.valueOf(branch.get("accountTypeId")));
                details.setCustomerId(String.valueOf(branch.get("id")));
            }
        } catch (Exception e) {
            log.warn("Could not fetch bank/branch: {}", e.getMessage());
        }
    }

    // ─── IPO lists ────────────────────────────────────────────────────────────

    public List<Map> getOpenIpos(String token) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("filterFieldParams", List.of(
                    Map.of("key", "companyIssue.companyISIN.script", "alias", "Scrip"),
                    Map.of("key", "companyIssue.companyISIN.company.name", "alias", "Company Name"),
                    Map.of("key", "companyIssue.assignedToClient.name", "value", "", "alias", "Issue Manager")
            ));
            payload.put("filterDateParams", List.of(
                    Map.of("key", "minIssueOpenDate", "condition", "", "alias", "", "value", ""),
                    Map.of("key", "maxIssueCloseDate", "condition", "", "alias", "", "value", "")
            ));
            payload.put("page", 1);
            payload.put("size", 20);
            payload.put("searchRoleViewConstants", "VIEW_APPLICABLE_SHARE");

            String raw = buildClientWithToken(token).post()
                    .uri("/meroShare/companyShare/applicableIssue/")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            List<Map> result = parseJsonResponse(raw, "OPEN_IPOS");
            log.info("[OPEN_IPOS] Found {} open IPOs", result.size());
            return result;

        } catch (WebClientResponseException e) {
            log.warn("[OPEN_IPOS] HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return List.of();
        } catch (Exception e) {
            log.warn("[OPEN_IPOS] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    public List<Map> getClosedIpos(String token) {
        try {
            LocalDate today = LocalDate.now();
            LocalDate twoMonthsAgo = today.minusMonths(2);
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            Map<String, Object> payload = new HashMap<>();
            payload.put("filterFieldParams", List.of(
                    Map.of("key", "companyShare.companyIssue.companyISIN.script", "alias", "Scrip"),
                    Map.of("key", "companyShare.companyIssue.companyISIN.company.name", "alias", "Company Name")
            ));
            payload.put("page", 1);
            payload.put("size", 200);
            payload.put("searchRoleViewConstants", "VIEW_APPLICANT_FORM_COMPLETE");
            payload.put("filterDateParams", List.of(
                    Map.of("key", "appliedDate", "condition", "", "alias", "",
                            "value", "BETWEEN '" + twoMonthsAgo.format(fmt) + "' AND '" + today.format(fmt) + "'")
            ));

            String raw = buildClientWithToken(token).post()
                    .uri("/meroShare/applicantForm/active/search/")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseJsonResponse(raw, "CLOSED_IPOS");

        } catch (WebClientResponseException e) {
            log.warn("[CLOSED_IPOS] HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return List.of();
        } catch (Exception e) {
            log.warn("[CLOSED_IPOS] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ─── Apply ────────────────────────────────────────────────────────────────

    public String applyIpo(String token, String companyShareId, String demat,
                           String boid, String accountNumber, String customerId,
                           String accountBranchId, String accountTypeId,
                           String bankId, int kitta, String crn, String pin) {

        Map<String, Object> body = new HashMap<>();
        body.put("demat", demat);
        body.put("boid", boid);
        body.put("accountNumber", accountNumber);
        body.put("customerId", customerId);
        body.put("accountBranchId", accountBranchId);
        body.put("accountTypeId", accountTypeId);
        body.put("appliedKitta", String.valueOf(kitta));
        body.put("crnNumber", crn != null ? crn : "");
        body.put("transactionPIN", pin != null ? pin : "");
        body.put("companyShareId", companyShareId);
        body.put("bankId", bankId);

        log.info("[APPLY_IPO] companyShareId={} boid={} kitta={}", companyShareId, boid, kitta);

        try {
            String raw = buildClientWithToken(token).post()
                    .uri("/meroShare/applicantForm/share/apply")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[APPLY_IPO] Response: {}", raw);
            if (raw != null && !raw.trim().startsWith("<")) {
                try {
                    JsonNode node = objectMapper.readTree(raw);
                    if (node.has("message")) return node.get("message").asText("Applied successfully");
                } catch (Exception ignored) {}
            }
            return "Applied successfully";

        } catch (WebClientResponseException e) {
            log.error("[APPLY_IPO] HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException(extractMessageFromJson(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("[APPLY_IPO] Failed: {}", e.getMessage());
            throw new RuntimeException("Failed to apply IPO: " + e.getMessage());
        }
    }

    // ─── Result checking ──────────────────────────────────────────────────────

    public ResultInfo checkResult(String token, String applicationFormId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        try {
            String raw = buildClientWithToken(token).get()
                    .uri("/meroShare/applicantForm/report/detail/" + applicationFormId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[CHECK_RESULT] Raw: {}", raw);
            if (raw != null && !raw.trim().startsWith("<")) {
                JsonNode node = objectMapper.readTree(raw);
                result.setStatus(node.has("statusName") ? node.get("statusName").asText("UNKNOWN") : "UNKNOWN");
                result.setAllottedKitta(node.has("receivedKitta") ? node.get("receivedKitta").asInt(0) : 0);
            }
        } catch (Exception e) {
            log.warn("[CHECK_RESULT] Failed formId={}: {}", applicationFormId, e.getMessage());
        }
        return result;
    }

    public List<Map> getApplicationReport(String token) {
        try {
            LocalDate today = LocalDate.now();
            LocalDate twoMonthsAgo = today.minusMonths(2);
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            Map<String, Object> payload = new HashMap<>();
            payload.put("filterFieldParams", List.of(
                    Map.of("key", "companyShare.companyIssue.companyISIN.script", "alias", "Scrip"),
                    Map.of("key", "companyShare.companyIssue.companyISIN.company.name", "alias", "Company Name")
            ));
            payload.put("page", 1);
            payload.put("size", 200);
            payload.put("searchRoleViewConstants", "VIEW_APPLICANT_FORM_COMPLETE");
            payload.put("filterDateParams", List.of(
                    Map.of("key", "appliedDate", "condition", "", "alias", "",
                            "value", "BETWEEN '" + twoMonthsAgo.format(fmt) + "' AND '" + today.format(fmt) + "'")
            ));

            String raw = buildClientWithToken(token).post()
                    .uri("/meroShare/applicantForm/active/search/")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseJsonResponse(raw, "APP_REPORT");
        } catch (Exception e) {
            log.warn("[APP_REPORT] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ─── Public CDSC endpoints ────────────────────────────────────────────────

    public List<Map> getPublicShareList() {
        try {
            String raw = buildCdscResultClient().get()
                    .uri("/result/companyShares/fileUploaded")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[PUBLIC_SHARE_LIST] Response length: {}", raw != null ? raw.length() : 0);
            if (raw == null || raw.isBlank() || raw.trim().startsWith("<")) {
                log.error("[PUBLIC_SHARE_LIST] WAF block or empty response");
                return List.of();
            }

            List<Map> result = parseJsonResponse(raw, "PUBLIC_SHARE_LIST");
            log.info("[PUBLIC_SHARE_LIST] Parsed {} shares", result.size());
            return result;

        } catch (Exception e) {
            log.error("[PUBLIC_SHARE_LIST] Failed: {}", e.getMessage());
            return List.of();
        }
    }

    public ResultInfo checkResultPublic(String boid, String shareId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        try {
            String raw = buildCdscResultClient().post()
                    .uri("/result/result/check")
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(Map.of("boid", boid, "companyShareId", shareId))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("[CHECK_RESULT_PUBLIC] Response: {}", raw);
            if (raw != null && !raw.trim().startsWith("<")) {
                JsonNode node = objectMapper.readTree(raw);
                String statusCode = node.has("statusCode") ? node.get("statusCode").asText("") : "";
                boolean success = node.has("success") && node.get("success").asBoolean();

                if ("ALLOCATE".equalsIgnoreCase(statusCode)) {
                    result.setStatus("ALLOTED");
                    if (node.has("quantity")) result.setAllottedKitta(node.get("quantity").asInt(0));
                } else if ("NOT_ALLOTED".equalsIgnoreCase(statusCode) || !success) {
                    result.setStatus("NOT ALLOTED");
                } else if (!statusCode.isBlank()) {
                    result.setStatus(statusCode);
                }
            }
        } catch (Exception e) {
            log.warn("[CHECK_RESULT_PUBLIC] Failed boid={} shareId={}: {}", boid, shareId, e.getMessage());
        }
        return result;
    }

    // ─── Inner classes ────────────────────────────────────────────────────────

    @Data
    public static class AccountDetails {
        private String fullName;
        private String boid;
        private String demat;
        private String bankId;
        private String accountNumber;
        private String accountBranchId;
        private String accountTypeId;
        private String customerId;
    }

    @Data
    public static class ResultInfo {
        private String status;
        private int allottedKitta;
    }
}