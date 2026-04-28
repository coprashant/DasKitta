package com.meroshare.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeroshareApiService {

    private static final String MERO_SHARE_BASE = "https://webbackend.cdsc.com.np/api/meroShare";
    private static final String PUBLIC_RESULT_URL = "https://iporesult.cdsc.com.np";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36";

    private static final long TOKEN_TTL_MS = 25 * 60 * 1000;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CdscHttpClient curlClient;

    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> loginLocks = new ConcurrentHashMap<>();

    private static class CachedToken {
        final String token;
        final long expiresAt;

        CachedToken(String token) {
            this.token = token;
            this.expiresAt = System.currentTimeMillis() + TOKEN_TTL_MS;
        }

        boolean isValid() {
            return System.currentTimeMillis() < expiresAt;
        }
    }

    private WebClient buildClient(String token) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(MERO_SHARE_BASE)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Encoding", "gzip, deflate, br")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader("Cache-Control", "no-cache")
                .defaultHeader("Connection", "keep-alive")
                .defaultHeader("Host", "webbackend.cdsc.com.np")
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Pragma", "no-cache")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-site")
                .defaultHeader("User-Agent", USER_AGENT)
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024));

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", token);
        }
        return builder.build();
    }

    private WebClient buildClient() {
        return buildClient(null);
    }

    private WebClient buildResultClient() {
        return WebClient.builder()
                .baseUrl(PUBLIC_RESULT_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Encoding", "gzip, deflate, br")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader("Cache-Control", "no-cache")
                .defaultHeader("Connection", "keep-alive")
                .defaultHeader("Origin", PUBLIC_RESULT_URL)
                .defaultHeader("Referer", PUBLIC_RESULT_URL + "/")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-origin")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024))
                .build();
    }

    public List<Map> getDpList() {
        String url = MERO_SHARE_BASE + "/capital/";
        try {
            String raw = buildClient().get().uri("/capital/")
                    .retrieve().bodyToMono(String.class).block();
            List<Map> result = parseJsonArray(raw, "DP_LIST");
            if (!result.isEmpty()) return result;
        } catch (Exception e) {
            log.warn("[DP_LIST] WebClient failed: {}", e.getMessage());
        }

        String curlRaw = curlClient.get(url, null);
        return parseJsonArray(curlRaw, "DP_LIST_CURL");
    }

    public String login(String dpId, String username, String password) {
        String cacheKey = dpId + ":" + username;

        CachedToken cached = tokenCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            log.debug("[LOGIN] Returning cached token for: {}", username);
            return cached.token;
        }

        ReentrantLock lock = loginLocks.computeIfAbsent(cacheKey, k -> new ReentrantLock());
        lock.lock();
        try {
            cached = tokenCache.get(cacheKey);
            if (cached != null && cached.isValid()) {
                return cached.token;
            }
            String token = doLogin(dpId, username, password);
            tokenCache.put(cacheKey, new CachedToken(token));
            return token;
        } finally {
            lock.unlock();
        }
    }

    public String loginFresh(String dpId, String username, String password) {
        String cacheKey = dpId + ":" + username;
        tokenCache.remove(cacheKey);
        log.info("[LOGIN] Forced fresh login for: {}", username);
        return login(dpId, username, password);
    }

    private String doLogin(String dpId, String username, String password) {
        int clientId;
        try {
            clientId = Integer.parseInt(dpId.trim());
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid DP ID format: " + dpId);
        }

        if (password == null || password.isBlank()) {
            throw new RuntimeException("Password is empty for user: " + username);
        }

        Map<String, Object> body = Map.of(
                "clientId", clientId,
                "username", username.trim(),
                "password", password
        );

        log.info("[LOGIN] Attempting user={} dpId={}", username, dpId);

        try {
            var response = buildClient().post()
                    .uri("/auth/")
                    .bodyValue(body)
                    .retrieve()
                    .toEntity(String.class)
                    .block();

            if (response != null) {
                String token = response.getHeaders().getFirst("Authorization");
                if (token != null && !token.isBlank()) {
                    validateLoginBody(response.getBody(), username);
                    log.info("[LOGIN] Token from Authorization header for: {}", username);
                    tokenCache.put(dpId + ":" + username, new CachedToken(token));
                    return token;
                }
                validateLoginBody(response.getBody(), username);
            }
        } catch (WebClientResponseException e) {
            String errBody = e.getResponseBodyAsString();
            log.error("[LOGIN] HTTP {}: {}", e.getStatusCode(), errBody);
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                throw new RuntimeException("Invalid credentials for: " + username + ". " + extractMessage(errBody));
            }
            log.warn("[LOGIN] WebClient HTTP error, trying curl");
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            log.warn("[LOGIN] WebClient failed: {}, trying curl", e.getMessage());
        }

        String curlRaw = curlClient.postJsonWithHeaders(MERO_SHARE_BASE + "/auth/", toJson(body), null);
        if (curlRaw != null && !isHtml(curlRaw)) {
            try {
                String token = curlClient.getLastResponseHeader("Authorization");
                if (token != null && !token.isBlank()) {
                    validateLoginBody(curlRaw, username);
                    log.info("[LOGIN] Token from curl Authorization header for: {}", username);
                    return token;
                }
                validateLoginBody(curlRaw, username);
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception e) {
                log.warn("[LOGIN] Curl response parse failed: {}", e.getMessage());
            }
        }

        throw new RuntimeException(
                "Login failed for user '" + username + "'. CDSC API may be unreachable. Please try again later.");
    }

    private void validateLoginBody(String body, String username) {
        if (body == null || isHtml(body)) return;
        try {
            JsonNode n = objectMapper.readTree(body);
            boolean passwordExpired = n.has("passwordExpired") && n.get("passwordExpired").asBoolean();
            boolean accountExpired = n.has("accountExpired") && n.get("accountExpired").asBoolean();
            boolean dematExpired = n.has("dematExpired") && n.get("dematExpired").asBoolean();

            if (passwordExpired || accountExpired || dematExpired) {
                String msg = n.has("message") ? n.get("message").asText("Account has expired issues") : "Account has expired issues";
                throw new RuntimeException("Meroshare account issue for '" + username + "': " + msg);
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception ignored) {}
    }

    public AccountDetails fetchAccountDetails(String token) {
        String url = MERO_SHARE_BASE + "/ownDetail/";
        String raw = null;

        try {
            raw = buildClient(token).get().uri("/ownDetail/")
                    .retrieve().bodyToMono(String.class).block();
        } catch (Exception e) {
            log.warn("[OWN_DETAIL] WebClient failed: {}", e.getMessage());
        }

        if (isHtml(raw)) {
            raw = curlClient.get(url, token);
        }

        if (isHtml(raw) || raw == null) {
            throw new RuntimeException("Could not fetch account details from CDSC. Please try again later.");
        }

        try {
            JsonNode node = objectMapper.readTree(raw);
            AccountDetails d = new AccountDetails();
            d.setFullName(getText(node, "name"));
            d.setBoid(getText(node, "boid"));
            d.setDemat(getText(node, "demat"));
            log.info("[OWN_DETAIL] name={} boid={}", d.getFullName(), d.getBoid());
            return d;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse account details: " + e.getMessage(), e);
        }
    }

    public BankDetails fetchBankDetails(String token, String bankId) {
        String url = MERO_SHARE_BASE + "/bank/" + bankId;
        String raw = null;

        try {
            raw = buildClient(token).get().uri("/bank/" + bankId)
                    .retrieve().bodyToMono(String.class).block();
        } catch (Exception e) {
            log.warn("[BANK_DETAIL] WebClient failed: {}", e.getMessage());
        }

        if (isHtml(raw)) {
            raw = curlClient.get(url, token);
        }

        if (isHtml(raw) || raw == null) {
            log.warn("[BANK_DETAIL] Could not fetch bank details for bankId={}", bankId);
            return null;
        }

        try {
            JsonNode node = objectMapper.readTree(raw);
            BankDetails d = new BankDetails();
            d.setBankId(String.valueOf(node.has("bankId") ? node.get("bankId").asInt() : 0));
            d.setAccountNumber(getText(node, "accountNumber"));
            d.setAccountBranchId(node.has("accountBranchId") ? String.valueOf(node.get("accountBranchId").asInt()) : null);
            d.setCustomerId(node.has("id") ? String.valueOf(node.get("id").asInt()) : null);
            d.setBranchName(getText(node, "branchName"));
            log.info("[BANK_DETAIL] bankId={} accountNumber={} customerId={}", d.getBankId(), d.getAccountNumber(), d.getCustomerId());
            return d;
        } catch (Exception e) {
            log.warn("[BANK_DETAIL] Parse failed: {}", e.getMessage());
            return null;
        }
    }

    public List<Map> getUserBanks(String token) {
        String url = MERO_SHARE_BASE + "/bank/";
        try {
            String raw = buildClient(token).get().uri("/bank/")
                    .retrieve().bodyToMono(String.class).block();
            List<Map> result = parseJsonArray(raw, "USER_BANKS");
            if (!result.isEmpty()) return result;
        } catch (Exception e) {
            log.warn("[USER_BANKS] WebClient failed: {}", e.getMessage());
        }
        String curlRaw = curlClient.get(url, token);
        return parseJsonArray(curlRaw, "USER_BANKS_CURL");
    }

    public List<Map> getOpenIpos(String token) {
        String url = MERO_SHARE_BASE + "/companyShare/currentIssue/";
        Map<String, Object> payload = buildOpenIpoPayload();

        try {
            String raw = buildClient(token).post().uri("/companyShare/currentIssue/")
                    .bodyValue(payload).retrieve().bodyToMono(String.class).block();
            List<Map> result = parseJsonResponse(raw, "OPEN_IPOS");
            if (!result.isEmpty()) return result;
        } catch (Exception e) {
            log.warn("[OPEN_IPOS] WebClient failed: {}", e.getMessage());
        }

        String curlRaw = curlClient.postJson(url, toJson(payload), token);
        return parseJsonResponse(curlRaw, "OPEN_IPOS_CURL");
    }

    private Map<String, Object> buildOpenIpoPayload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("page", 1);
        p.put("size", 20);
        p.put("searchRoleViewConstants", "VIEW_APPLICABLE_SHARE");
        p.put("filterFieldParams", List.of());
        p.put("filterDateParams", List.of());
        return p;
    }

    public List<Map> getApplicationHistory(String token) {
        String url = MERO_SHARE_BASE + "/applicantForm/active/search/";
        Map<String, Object> payload = buildAppHistoryPayload();

        try {
            String raw = buildClient(token).post().uri("/applicantForm/active/search/")
                    .bodyValue(payload).retrieve().bodyToMono(String.class).block();
            List<Map> result = parseJsonResponse(raw, "APP_HISTORY");
            if (!result.isEmpty()) return result;
        } catch (Exception e) {
            log.warn("[APP_HISTORY] WebClient failed: {}", e.getMessage());
        }

        String curlRaw = curlClient.postJson(url, toJson(payload), token);
        return parseJsonResponse(curlRaw, "APP_HISTORY_CURL");
    }

    private Map<String, Object> buildAppHistoryPayload() {
        LocalDate today = LocalDate.now();
        LocalDate twelveMonthsAgo = today.minusMonths(12);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("page", 1);
        p.put("size", 200);
        p.put("searchRoleViewConstants", "VIEW_APPLICANT_FORM_COMPLETE");
        p.put("filterFieldParams", List.of());
        p.put("filterDateParams", List.of(
                Map.of("key", "appliedDate",
                       "condition", "",
                       "alias", "",
                       "value", "BETWEEN '" + twelveMonthsAgo.format(fmt) + "' AND '" + today.format(fmt) + "'")
        ));
        return p;
    }

    public String applyIpo(String token, int companyShareId, String demat, String boid,
                            String accountNumber, String customerId, String accountBranchId,
                            String bankId, int kitta, String crn, String pin) {

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accountBranchId", Integer.parseInt(accountBranchId));
        body.put("accountNumber", accountNumber);
        body.put("appliedKitta", kitta);
        body.put("bankId", bankId);
        body.put("boid", boid);
        body.put("companyShareId", companyShareId);
        body.put("crnNumber", crn != null ? crn : "");
        body.put("customerId", Integer.parseInt(customerId));
        body.put("demat", demat);
        body.put("transactionPIN", pin != null ? pin : "");

        log.info("[APPLY_IPO] companyShareId={} boid={} kitta={}", companyShareId, boid, kitta);

        String applyUrl = MERO_SHARE_BASE + "/applicantForm/share/apply/";

        try {
            String raw = buildClient(token).post()
                    .uri("/applicantForm/share/apply/")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[APPLY_IPO] WebClient response: {}", snippet(raw));
            if (!isHtml(raw) && raw != null) {
                return extractApplyMessage(raw);
            }
        } catch (WebClientResponseException e) {
            String errBody = e.getResponseBodyAsString();
            log.warn("[APPLY_IPO] WebClient HTTP {}: {}", e.getStatusCode(), errBody);
            if (e.getStatusCode().value() == 400) {
                throw new RuntimeException(extractMessage(errBody));
            }
        } catch (Exception e) {
            log.warn("[APPLY_IPO] WebClient failed: {}, trying curl", e.getMessage());
        }

        String curlRaw = curlClient.postJson(applyUrl, toJson(body), token);
        log.info("[APPLY_IPO_CURL] Response: {}", snippet(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            return extractApplyMessage(curlRaw);
        }

        throw new RuntimeException("IPO application failed. Unable to reach CDSC API. Please try again later.");
    }

    private String extractApplyMessage(String raw) {
        try {
            JsonNode n = objectMapper.readTree(raw);
            if (n.has("status") && !"true".equalsIgnoreCase(n.get("status").asText(""))) {
                throw new RuntimeException(extractMessage(raw));
            }
            if (n.has("message")) {
                String msg = n.get("message").asText("");
                if (!msg.isBlank()) return msg;
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception ignored) {}
        return "Applied successfully";
    }

    public ResultInfo checkResultDetail(String token, String applicantFormId) {
        String url = MERO_SHARE_BASE + "/applicantForm/report/detail/" + applicantFormId;
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");

        try {
            String raw = buildClient(token).get()
                    .uri("/applicantForm/report/detail/" + applicantFormId)
                    .retrieve().bodyToMono(String.class).block();
            if (!isHtml(raw) && raw != null) return parseDetailResult(raw);
        } catch (Exception e) {
            log.warn("[RESULT_DETAIL] WebClient failed: {}", e.getMessage());
        }

        String curlRaw = curlClient.get(url, token);
        if (!isHtml(curlRaw) && curlRaw != null) return parseDetailResult(curlRaw);

        return result;
    }

    private ResultInfo parseDetailResult(String raw) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        try {
            JsonNode node = objectMapper.readTree(raw);
            result.setStatus(node.has("statusName") ? node.get("statusName").asText("UNKNOWN") : "UNKNOWN");
            result.setAllottedKitta(node.has("receivedKitta") ? node.get("receivedKitta").asInt(0) : 0);
        } catch (Exception e) {
            log.warn("[RESULT_DETAIL_PARSE] {}", e.getMessage());
        }
        return result;
    }

    public ResultInfo checkResultPublic(String boid, String shareId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");

        String url = "https://iporesult.cdsc.com.np/api/ipo-result/public/view/getResults/";
        Map<String, String> payload = Map.of("boid", boid, "companyShareId", shareId);

        log.info("[RESULT_PUBLIC] Checking boid={} shareId={}", boid, shareId);

        try {
            String raw = buildResultClient()
                    .post()
                    .uri(url)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[RESULT_PUBLIC] WebClient raw: {}", snippet300(raw));
            if (!isHtml(raw) && raw != null) {
                return parsePublicResult(objectMapper.readTree(raw));
            }
        } catch (Exception e) {
            log.warn("[RESULT_PUBLIC] WebClient: {}", e.getMessage());
        }

        String curlRaw = curlClient.postJson(url, toJson(payload), null);
        log.info("[RESULT_PUBLIC] Curl raw: {}", snippet300(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            try {
                return parsePublicResult(objectMapper.readTree(curlRaw));
            } catch (Exception e) {
                log.warn("[RESULT_PUBLIC_CURL] Parse error: {}", e.getMessage());
            }
        }

        return result;
    }

    private ResultInfo parsePublicResult(JsonNode root) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");

        JsonNode node = root;
        if (root.has("body") && root.get("body").isObject()) {
            node = root.get("body");
        }

        boolean success = root.has("success") && root.get("success").asBoolean();
        String statusCode = node.has("statusCode") ? node.get("statusCode").asText("") : "";
        if (statusCode.isBlank()) {
            statusCode = root.has("statusCode") ? root.get("statusCode").asText("") : "";
        }

        log.info("[RESULT_PUBLIC_PARSE] success={} statusCode='{}' node={}",
                success, statusCode, snippet300(node.toString()));

        if ("ALLOCATE".equalsIgnoreCase(statusCode)) {
            result.setStatus("ALLOTTED");
            result.setAllottedKitta(node.has("quantity") ? node.get("quantity").asInt(0) : 0);
        } else if ("NOT_ALLOTED".equalsIgnoreCase(statusCode)
                || "NOT_ALLOTTED".equalsIgnoreCase(statusCode)) {
            result.setStatus("NOT_ALLOTTED");
        } else if (!success && !statusCode.isBlank()) {
            result.setStatus("NOT_ALLOTTED");
        } else {
            String msg = "";
            if (node.has("message")) msg = node.get("message").asText("").toLowerCase();
            if (msg.isBlank() && root.has("message")) msg = root.get("message").asText("").toLowerCase();

            if (msg.contains("not allot")) {
                result.setStatus("NOT_ALLOTTED");
            } else if (msg.contains("allot")) {
                result.setStatus("ALLOTTED");
                if (node.has("quantity")) result.setAllottedKitta(node.get("quantity").asInt(0));
            } else if (msg.contains("not found") || msg.contains("no result") || msg.contains("no record")) {
                result.setStatus("NOT_PUBLISHED");
            } else if (success) {
                result.setStatus("NOT_PUBLISHED");
            }
        }

        log.info("[RESULT_PUBLIC_PARSE] final status={} kitta={}", result.getStatus(), result.getAllottedKitta());
        return result;
    }

    public List<Map> getPublicShareList() {
        String url = PUBLIC_RESULT_URL + "/result/companyShares/fileUploaded";

        try {
            String raw = buildResultClient().get()
                    .uri("/result/companyShares/fileUploaded")
                    .retrieve().bodyToMono(String.class).block();
            log.info("[SHARE_LIST] WebClient raw (first 300): {}", snippet300(raw));
            if (!isHtml(raw) && raw != null) {
                List<Map> r = parseShareList(raw, "SHARE_LIST");
                if (!r.isEmpty()) return r;
            }
        } catch (Exception e) {
            log.warn("[SHARE_LIST] WebClient: {}", e.getMessage());
        }

        String curlRaw = curlClient.get(url, null);
        log.info("[SHARE_LIST] Curl raw (first 300): {}", snippet300(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            return parseShareList(curlRaw, "SHARE_LIST_CURL");
        }

        return List.of();
    }

    private List<Map> parseShareList(String raw, String context) {
        if (isHtml(raw)) {
            log.warn("[{}] HTML/WAF block", context);
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (root.isArray()) {
                log.info("[{}] bare array, size={}", context, root.size());
                return nodeArrayToList(root);
            }
            if (root.has("body") && root.get("body").isObject()) {
                JsonNode body = root.get("body");
                String[] innerKeys = {"companyShareList", "object", "data", "list", "shares"};
                for (String key : innerKeys) {
                    if (body.has(key) && body.get(key).isArray()) {
                        log.info("[{}] found at body.{}, size={}", context, key, body.get(key).size());
                        return nodeArrayToList(body.get(key));
                    }
                }
            }
            String[] wrappers = {"object", "data", "result", "list", "shares", "companyShares", "companyShareList"};
            for (String key : wrappers) {
                if (root.has(key) && root.get(key).isArray()) {
                    log.info("[{}] wrapped under '{}', size={}", context, key, root.get(key).size());
                    return nodeArrayToList(root.get(key));
                }
            }
            log.warn("[{}] Could not find array in response. Shape: {}", context, snippet300(raw));
            return List.of();
        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
    }

    private String snippet300(String s) {
        if (s == null) return "null";
        return s.substring(0, Math.min(300, s.length())).replaceAll("\\s+", " ");
    }

    private boolean isHtml(String raw) {
        if (raw == null || raw.isBlank()) return true;
        String t = raw.stripLeading();
        return t.startsWith("<") || t.startsWith("<!DOCTYPE");
    }

    private List<Map> parseJsonArray(String raw, String context) {
        if (isHtml(raw)) {
            log.warn("[{}] HTML response or WAF block", context);
            return List.of();
        }
        try {
            JsonNode node = objectMapper.readTree(raw);
            if (node.isArray()) return nodeArrayToList(node);
            return List.of();
        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
    }

    private List<Map> parseJsonResponse(String raw, String context) {
        if (isHtml(raw)) {
            log.warn("[{}] HTML response or WAF block", context);
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (root.isArray()) return nodeArrayToList(root);
            if (root.has("object") && root.get("object").isArray())
                return nodeArrayToList(root.get("object"));
            if (root.has("data") && root.get("data").isArray())
                return nodeArrayToList(root.get("data"));
            log.warn("[{}] Unrecognised JSON shape: {}", context, snippet(raw));
            return List.of();
        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
    }

    private List<Map> nodeArrayToList(JsonNode arrayNode) {
        List<Map> result = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            result.add(objectMapper.convertValue(item, Map.class));
        }
        return result;
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    private String extractMessage(String raw) {
        if (raw == null || raw.isBlank() || isHtml(raw)) return "Unknown error from CDSC";
        try {
            JsonNode n = objectMapper.readTree(raw);
            if (n.has("message")) return n.get("message").asText(raw);
        } catch (Exception ignored) {}
        return raw.length() > 200 ? raw.substring(0, 200) + "..." : raw;
    }

    private String snippet(String s) {
        if (s == null) return "null";
        return s.substring(0, Math.min(200, s.length())).replaceAll("\\s+", " ");
    }

    private String getText(JsonNode node, String field) {
        return node.has(field) ? node.get(field).asText(null) : null;
    }

    @Data
    public static class AccountDetails {
        private String fullName;
        private String boid;
        private String demat;
    }

    @Data
    public static class BankDetails {
        private String bankId;
        private String accountNumber;
        private String accountBranchId;
        private String customerId;
        private String branchName;
    }

    @Data
    public static class ResultInfo {
        private String status;
        private int allottedKitta;
    }
}