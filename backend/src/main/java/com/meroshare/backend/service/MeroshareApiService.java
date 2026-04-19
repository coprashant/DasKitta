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

/**
 * Service for all Meroshare / CDSC API calls.
 *
 * ── reCAPTCHA / WAF bypass strategy ──────────────────────────────────────────
 * CDSC uses Cloudflare Bot Management on the *web* frontend, but the mobile
 * endpoint (webbackend.cdsc.com.np) uses a lighter check based on:
 *   1. TLS fingerprint (JA3 hash) — Spring WebClient uses Java TLS which is
 *      fingerprinted differently than a browser.  The curl fallback sends a
 *      real OS TLS handshake, bypassing Java's JA3 signature.
 *   2. HTTP/2 fingerprint — curl uses HTTP/2 with the correct SETTINGS frame.
 *   3. User-Agent + header order — we mirror the official Android Meroshare app
 *      headers exactly (not a desktop browser).
 *
 * The Android app does NOT use reCAPTCHA v3.  reCAPTCHA is only injected by
 * the web frontend JS.  The API itself only validates the Authorization token
 * from the /meroShare/auth/ endpoint, which is plain username+password.
 *
 * So the correct approach (already in place) is:
 *   - Primary: WebClient (fast, fails on Cloudflare JA3 block)
 *   - Fallback: curl subprocess (real OS TLS, correct JA3, bypasses the block)
 *
 * If curl is also blocked (rare, IP-based ban), the user must re-authenticate
 * manually.  There is no free server-side solution beyond rotating IPs.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MeroshareApiService {

    @Value("${meroshare.api.base-url}")
    private String baseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CdscHttpClient curlClient;

    // ─── Token cache ──────────────────────────────────────────────────────────
    // Uses per-key locks to prevent the race condition where two threads both
    // see a cache miss and issue parallel logins (which causes CDSC 500 errors).

    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ReentrantLock> loginLocks = new ConcurrentHashMap<>();
    private static final long TOKEN_TTL_MS = 8 * 60 * 1000; // 8 minutes

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

    // ─── WebClient builders ───────────────────────────────────────────────────

    /**
     * Mirrors the official Meroshare Android app headers.
     * This is the key to bypassing reCAPTCHA — the mobile API endpoint
     * does not require reCAPTCHA tokens, only a valid login token.
     */
    private WebClient buildClient(String token) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl)
                // Header ORDER matters for HTTP/2 fingerprinting — keep this order
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate, br")
                .defaultHeader("Connection", "keep-alive")
                // Android Meroshare app User-Agent (not desktop browser)
                .defaultHeader("User-Agent",
                        "Meroshare/2.0.1 (Android; com.cdsc.meroshare)")
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .defaultHeader("Cache-Control", "no-cache")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024));

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", token);
            builder.defaultHeader("Cookie", "Authorization=" + token);
        }
        return builder.build();
    }

    private WebClient buildClient() {
        return buildClient(null);
    }

    private WebClient buildCdscResultClient() {
        return WebClient.builder()
                .baseUrl("https://iporesult.cdsc.com.np")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate, br")
                .defaultHeader("Connection", "keep-alive")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")
                .defaultHeader("Origin", "https://iporesult.cdsc.com.np")
                .defaultHeader("Referer", "https://iporesult.cdsc.com.np/")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-origin")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024))
                .build();
    }

    // ─── JSON helpers ─────────────────────────────────────────────────────────

    private boolean isHtml(String raw) {
        if (raw == null || raw.isBlank()) return true;
        String t = raw.stripLeading();
        return t.startsWith("<") || t.startsWith("<!") || t.startsWith("<!DOCTYPE");
    }

    private List<Map> nodeArrayToList(JsonNode arrayNode) {
        List<Map> result = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            result.add(objectMapper.convertValue(item, Map.class));
        }
        return result;
    }

    private List<Map> parseJsonArraySafely(String raw, String context) {
        if (isHtml(raw)) {
            log.warn("[{}] HTML response — WAF/Cloudflare block", context);
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
            log.warn("[{}] HTML response — WAF/Cloudflare block", context);
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (root.isArray()) return nodeArrayToList(root);
            if (root.has("object") && root.get("object").isArray())
                return nodeArrayToList(root.get("object"));
            if (root.has("data") && root.get("data").isArray())
                return nodeArrayToList(root.get("data"));
            if (root.has("body")) {
                JsonNode body = root.get("body");
                if (body.isArray()) return nodeArrayToList(body);
                if (body.isObject()) {
                    if (body.has("companyShareList") && body.get("companyShareList").isArray())
                        return nodeArrayToList(body.get("companyShareList"));
                    // Find any array field
                    Iterator<Map.Entry<String, JsonNode>> fields = body.fields();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        if (entry.getValue().isArray() && entry.getValue().size() > 0)
                            return nodeArrayToList(entry.getValue());
                    }
                }
            }
            log.warn("[{}] Unrecognised JSON shape: {}", context, snippet(raw));
            return List.of();
        } catch (Exception e) {
            log.warn("[{}] Parse error: {}", context, e.getMessage());
            return List.of();
        }
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

    // ─── DP List ──────────────────────────────────────────────────────────────

    public List<Map> getDpList() {
        try {
            String raw = buildClient().get()
                    .uri("/meroShare/capital/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            List<Map> result = parseJsonArraySafely(raw, "DP_LIST");
            if (!result.isEmpty()) return result;
        } catch (Exception e) {
            log.warn("[DP_LIST] WebClient failed: {}", e.getMessage());
        }

        // curl fallback
        String curlRaw = curlClient.get(baseUrl + "/meroShare/capital/", null);
        return parseJsonArraySafely(curlRaw, "DP_LIST_CURL");
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    /**
     * Thread-safe login with per-user locking to prevent parallel login storms.
     * Two threads for the same user will serialize: the second one will use
     * the token that the first one just cached.
     */
    public String login(String dpId, String username, String password) {
        String cacheKey = dpId + ":" + username;

        // Fast path — check cache without locking
        CachedToken cached = tokenCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            log.debug("[LOGIN] Returning cached token for: {}", username);
            return cached.token;
        }

        // Slow path — acquire per-user lock to prevent parallel logins
        ReentrantLock lock = loginLocks.computeIfAbsent(cacheKey, k -> new ReentrantLock());
        lock.lock();
        try {
            // Re-check after acquiring lock (another thread may have just logged in)
            cached = tokenCache.get(cacheKey);
            if (cached != null && cached.isValid()) {
                log.debug("[LOGIN] Token populated by concurrent thread for: {}", username);
                return cached.token;
            }

            String token = doLogin(dpId, username, password);
            tokenCache.put(cacheKey, new CachedToken(token));
            return token;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Forces a fresh login, bypassing the cache.
     * Only call this when you have strong evidence the token is stale
     * (e.g., a 401 response from a subsequent API call).
     */
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
            throw new RuntimeException("Invalid DP ID (must be numeric): " + dpId);
        }

        if (password == null || password.isBlank()) {
            throw new RuntimeException("Password is empty — cannot login for user: " + username);
        }

        Map<String, Object> body = Map.of(
                "clientId", clientId,
                "username", username.trim(),
                "password", password
        );

        log.info("[LOGIN] Attempting user={} dpId={}", username, dpId);

        // 1. Try WebClient
        try {
            var response = buildClient().post()
                    .uri("/meroShare/auth/")
                    .bodyValue(body)
                    .retrieve()
                    .toEntity(String.class)
                    .block();

            if (response != null) {
                String token = extractTokenFromResponse(response.getBody(),
                        response.getHeaders().get(HttpHeaders.SET_COOKIE),
                        response.getHeaders().getFirst("Authorization"),
                        username);
                if (token != null) return token;
            }
        } catch (WebClientResponseException e) {
            String errBody = e.getResponseBodyAsString();
            log.error("[LOGIN] HTTP {}: {}", e.getStatusCode(), errBody);
            // Don't retry on auth errors — wrong password should fail fast
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                throw new RuntimeException("Invalid credentials for user: " + username +
                        ". " + extractMessage(errBody));
            }
            // For other HTTP errors, fall through to curl
            log.warn("[LOGIN] WebClient HTTP error, trying curl fallback");
        } catch (Exception e) {
            log.warn("[LOGIN] WebClient failed: {}, trying curl", e.getMessage());
        }

        // 2. Curl fallback (bypasses Cloudflare JA3 fingerprint check)
        String curlRaw = curlClient.postJson(baseUrl + "/meroShare/auth/", toJson(body), null);
        if (curlRaw != null && !isHtml(curlRaw)) {
            try {
                JsonNode node = objectMapper.readTree(curlRaw);
                // Check for error message in curl response
                if (node.has("statusCode")) {
                    int sc = node.get("statusCode").asInt(200);
                    String msg = node.has("message") ? node.get("message").asText("") : "";
                    if (sc != 200 && !msg.isBlank()) {
                        throw new RuntimeException("Meroshare login error: " + msg);
                    }
                }
                String t = node.has("token") ? node.get("token").asText("") : "";
                if (!t.isBlank()) {
                    log.info("[LOGIN] Token from curl response body for: {}", username);
                    return t;
                }
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception e) {
                log.warn("[LOGIN] Curl response parse failed: {}", e.getMessage());
            }
        }

        throw new RuntimeException(
                "Login failed for user '" + username + "' — could not reach CDSC API. " +
                "This may be a temporary block. Please try again in a few minutes.");
    }

    private String extractTokenFromResponse(String body, List<String> setCookies,
                                             String authHeader, String username) {
        // Priority 1: Set-Cookie header
        if (setCookies != null) {
            for (String cookie : setCookies) {
                if (cookie.startsWith("Authorization=")) {
                    String t = cookie.split(";")[0].replace("Authorization=", "").trim();
                    if (!t.isBlank()) {
                        log.info("[LOGIN] Token from Set-Cookie for: {}", username);
                        return t;
                    }
                }
            }
        }

        // Priority 2: Authorization response header
        if (authHeader != null && !authHeader.isBlank()) {
            log.info("[LOGIN] Token from Authorization header for: {}", username);
            return authHeader;
        }

        // Priority 3: JSON body token field
        if (body != null && !isHtml(body)) {
            try {
                JsonNode n = objectMapper.readTree(body);
                // Check for error first
                if (n.has("statusCode") && n.get("statusCode").asInt(200) != 200) {
                    String msg = n.has("message") ? n.get("message").asText("Login failed") : "Login failed";
                    throw new RuntimeException("Meroshare login error: " + msg);
                }
                String t = n.has("token") ? n.get("token").asText("") : "";
                if (!t.isBlank()) {
                    log.info("[LOGIN] Token from JSON body for: {}", username);
                    return t;
                }
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception ignored) {}
        }

        return null;
    }

    // ─── Account details ──────────────────────────────────────────────────────

    public AccountDetails fetchAccountDetails(String token) {
        String raw = null;

        try {
            raw = buildClient(token).get()
                    .uri("/meroShare/ownDetail/")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.warn("[OWN_DETAIL] WebClient failed: {}", e.getMessage());
        }

        // Curl fallback
        if (isHtml(raw)) {
            raw = curlClient.get(baseUrl + "/meroShare/ownDetail/", token);
        }

        if (isHtml(raw) || raw == null) {
            throw new RuntimeException(
                    "Could not fetch account details — CDSC API is blocking requests. " +
                    "This is likely a Cloudflare block. Please try again later.");
        }

        log.info("[OWN_DETAIL] Raw: {}", snippet(raw));

        try {
            JsonNode node = objectMapper.readTree(raw);
            AccountDetails d = new AccountDetails();
            d.setFullName(getText(node, "name"));
            d.setBoid(getText(node, "boid"));
            d.setDemat(getText(node, "demat"));
            log.info("[OWN_DETAIL] name={} boid={} demat={}", d.getFullName(), d.getBoid(), d.getDemat());
            fetchBankDetails(token, d);
            return d;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse account details: " + e.getMessage(), e);
        }
    }

    private void fetchBankDetails(String token, AccountDetails details) {
        try {
            String bankRaw = null;
            try {
                bankRaw = buildClient(token).get().uri("/meroShare/bank/")
                        .retrieve().bodyToMono(String.class).block();
            } catch (Exception e) {
                log.warn("[BANK] WebClient failed: {}", e.getMessage());
            }
            if (isHtml(bankRaw)) {
                bankRaw = curlClient.get(baseUrl + "/meroShare/bank/", token);
            }

            List<Map> banks = parseJsonArraySafely(bankRaw, "BANK");
            if (banks.isEmpty()) {
                log.warn("[BANK] No banks found for account");
                return;
            }

            String bankId = String.valueOf(banks.get(0).get("id"));
            details.setBankId(bankId);

            String branchRaw = null;
            try {
                branchRaw = buildClient(token).get().uri("/meroShare/bank/" + bankId)
                        .retrieve().bodyToMono(String.class).block();
            } catch (Exception e) {
                log.warn("[BRANCH] WebClient failed: {}", e.getMessage());
            }
            if (isHtml(branchRaw)) {
                branchRaw = curlClient.get(baseUrl + "/meroShare/bank/" + bankId, token);
            }

            List<Map> branches = parseJsonArraySafely(branchRaw, "BRANCH");
            if (!branches.isEmpty()) {
                Map<?, ?> b = branches.get(0);
                details.setAccountNumber(safeStr(b.get("accountNumber")));
                details.setAccountBranchId(safeStr(b.get("accountBranchId")));
                details.setAccountTypeId(safeStr(b.get("accountTypeId")));
                details.setCustomerId(safeStr(b.get("id")));
                log.info("[BANK/BRANCH] bankId={} accountNumber={}", bankId, details.getAccountNumber());
            }
        } catch (Exception e) {
            log.warn("[BANK/BRANCH] Failed: {}", e.getMessage());
            // Non-fatal — account can still be saved without bank details
        }
    }

    // ─── Open IPOs ────────────────────────────────────────────────────────────

    public List<Map> getOpenIpos(String token) {
        String uri = "/meroShare/companyShare/applicableIssue/";
        String url = baseUrl + uri;
        Map<String, Object> payload = buildOpenIpoPayload();

        // 1. WebClient GET
        List<Map> result = tryWebClientGet(token, uri, "OPEN_IPOS_GET");
        if (!result.isEmpty()) return result;

        // 2. WebClient POST
        result = tryWebClientPost(token, uri, payload, "OPEN_IPOS_POST");
        if (!result.isEmpty()) return result;

        // 3. Curl GET
        result = tryCurlGet(token, url, "OPEN_IPOS_CURL_GET");
        if (!result.isEmpty()) return result;

        // 4. Curl POST
        result = tryCurlPost(token, url, payload, "OPEN_IPOS_CURL_POST");
        if (!result.isEmpty()) return result;

        log.warn("[OPEN_IPOS] All approaches returned empty — no open IPOs or all blocked");
        return List.of();
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

    // ─── Application Report ───────────────────────────────────────────────────

    public List<Map> getApplicationReport(String token) {
        String uri = "/meroShare/applicantForm/active/search/";
        String url = baseUrl + uri;
        Map<String, Object> payload = buildAppReportPayload();

        List<Map> result = tryWebClientGet(token, uri, "APP_REPORT_GET");
        if (!result.isEmpty()) return result;

        result = tryWebClientPost(token, uri, payload, "APP_REPORT_POST");
        if (!result.isEmpty()) return result;

        result = tryCurlGet(token, url, "APP_REPORT_CURL_GET");
        if (!result.isEmpty()) return result;

        result = tryCurlPost(token, url, payload, "APP_REPORT_CURL_POST");
        if (!result.isEmpty()) {
            log.info("[APP_REPORT] {} items via curl POST", result.size());
            return result;
        }

        log.warn("[APP_REPORT] All approaches empty — WAF blocking or no applications");
        return List.of();
    }

    private Map<String, Object> buildAppReportPayload() {
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

    // ─── Apply IPO ────────────────────────────────────────────────────────────

    public String applyIpo(String token, String companyShareId, String demat,
                           String boid, String accountNumber, String customerId,
                           String accountBranchId, String accountTypeId,
                           String bankId, int kitta, String crn, String pin) {

        Map<String, Object> body = new LinkedHashMap<>();
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

        // 1. WebClient POST
        try {
            String raw = buildClient(token).post()
                    .uri("/meroShare/applicantForm/share/apply")
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
            // Known business errors should not be retried
            if (e.getStatusCode().value() == 400) {
                throw new RuntimeException(extractMessage(errBody));
            }
            // 403/WAF → try curl
        } catch (Exception e) {
            log.warn("[APPLY_IPO] WebClient failed: {}, trying curl", e.getMessage());
        }

        // 2. Curl POST
        String curlRaw = curlClient.postJson(baseUrl + "/meroShare/applicantForm/share/apply",
                toJson(body), token);
        log.info("[APPLY_IPO_CURL] Response: {}", snippet(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            return extractApplyMessage(curlRaw);
        }

        throw new RuntimeException(
                "IPO application failed — unable to reach CDSC API after all attempts. " +
                "Please try again later.");
    }

    private String extractApplyMessage(String raw) {
        try {
            JsonNode n = objectMapper.readTree(raw);
            // Check for error response
            if (n.has("statusCode") && n.get("statusCode").asInt(200) != 200) {
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

    // ─── Result check (authenticated) ────────────────────────────────────────

    public ResultInfo checkResult(String token, String applicationFormId) {
        String uri = "/meroShare/applicantForm/report/detail/" + applicationFormId;
        String url = baseUrl + uri;

        // WebClient
        try {
            String raw = buildClient(token).get().uri(uri)
                    .retrieve().bodyToMono(String.class).block();
            log.info("[RESULT_DETAIL] formId={} raw: {}", applicationFormId, snippet(raw));
            if (!isHtml(raw) && raw != null) return parseDetailResult(raw);
        } catch (Exception e) {
            log.warn("[RESULT_DETAIL] WebClient failed: {}", e.getMessage());
        }

        // Curl fallback
        String curlRaw = curlClient.get(url, token);
        log.info("[RESULT_DETAIL_CURL] formId={} raw: {}", applicationFormId, snippet(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) return parseDetailResult(curlRaw);

        ResultInfo unknown = new ResultInfo();
        unknown.setStatus("UNKNOWN");
        return unknown;
    }

    private ResultInfo parseDetailResult(String raw) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        try {
            JsonNode node = objectMapper.readTree(raw);
            result.setStatus(node.has("statusName")
                    ? node.get("statusName").asText("UNKNOWN") : "UNKNOWN");
            result.setAllottedKitta(node.has("receivedKitta")
                    ? node.get("receivedKitta").asInt(0) : 0);
            log.info("[RESULT_DETAIL] Parsed status={} kitta={}", result.getStatus(), result.getAllottedKitta());
        } catch (Exception e) {
            log.warn("[RESULT_DETAIL_PARSE] {}", e.getMessage());
        }
        return result;
    }

    // ─── Result check (public/guest) ─────────────────────────────────────────

    public ResultInfo checkResultPublic(String boid, String shareId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        String url = "https://iporesult.cdsc.com.np/result/result/check";
        Map<String, String> payload = Map.of("boid", boid, "companyShareId", shareId);

        // WebClient
        try {
            String raw = buildCdscResultClient().post()
                    .uri("/result/result/check")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[RESULT_PUBLIC] WebClient boid={} shareId={}: {}", boid, shareId, snippet(raw));
            if (!isHtml(raw) && raw != null) {
                return parsePublicResultNode(objectMapper.readTree(raw));
            }
        } catch (Exception e) {
            log.warn("[RESULT_PUBLIC] WebClient: {}", e.getMessage());
        }

        // Curl fallback
        String curlRaw = curlClient.postJson(url, toJson(payload), null);
        log.info("[RESULT_PUBLIC_CURL] boid={} shareId={}: {}", boid, shareId, snippet(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            try {
                return parsePublicResultNode(objectMapper.readTree(curlRaw));
            } catch (Exception e) {
                log.warn("[RESULT_PUBLIC_CURL] Parse error: {}", e.getMessage());
            }
        }

        log.warn("[RESULT_PUBLIC] All approaches blocked for boid={} shareId={}", boid, shareId);
        return result;
    }

    private ResultInfo parsePublicResultNode(JsonNode node) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");

        String statusCode = node.has("statusCode") ? node.get("statusCode").asText("") : "";
        boolean success = node.has("success") && node.get("success").asBoolean();

        if ("ALLOCATE".equalsIgnoreCase(statusCode)) {
            result.setStatus("ALLOTED");
            result.setAllottedKitta(node.has("quantity") ? node.get("quantity").asInt(0) : 0);
        } else if ("NOT_ALLOTED".equalsIgnoreCase(statusCode)
                || "NOT_ALLOTTED".equalsIgnoreCase(statusCode)
                || (!success && !statusCode.isBlank())) {
            result.setStatus("NOT ALLOTED");
        } else if (node.has("message")) {
            String msg = node.get("message").asText("").toLowerCase();
            if (msg.contains("not allot") || msg.contains("not allotted")) {
                result.setStatus("NOT ALLOTED");
            } else if (msg.contains("allot")) {
                result.setStatus("ALLOTED");
            } else if (msg.contains("not found") || msg.contains("no result")) {
                result.setStatus("NOT_PUBLISHED");
            }
        }

        log.info("[RESULT_PUBLIC_PARSE] statusCode={} success={} → status={}",
                statusCode, success, result.getStatus());
        return result;
    }

    // ─── Public share list ────────────────────────────────────────────────────

    public List<Map> getPublicShareList() {
        String url = "https://iporesult.cdsc.com.np/result/companyShares/fileUploaded";

        try {
            String raw = buildCdscResultClient().get()
                    .uri("/result/companyShares/fileUploaded")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("[SHARE_LIST] WebClient length={}", raw != null ? raw.length() : 0);
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "SHARE_LIST");
                if (!r.isEmpty()) {
                    log.info("[SHARE_LIST] {} shares via WebClient", r.size());
                    return r;
                }
            }
        } catch (Exception e) {
            log.warn("[SHARE_LIST] WebClient: {}", e.getMessage());
        }

        String curlRaw = curlClient.get(url, null);
        if (!isHtml(curlRaw) && curlRaw != null) {
            List<Map> r = parseJsonResponse(curlRaw, "SHARE_LIST_CURL");
            if (!r.isEmpty()) {
                log.info("[SHARE_LIST] {} shares via curl", r.size());
                return r;
            }
        }

        log.error("[SHARE_LIST] All approaches failed");
        return List.of();
    }

    // ─── Shared HTTP helper methods ───────────────────────────────────────────

    private List<Map> tryWebClientGet(String token, String uri, String context) {
        try {
            String raw = buildClient(token).get().uri(uri)
                    .retrieve().bodyToMono(String.class).block();
            log.debug("[{}] snippet: {}", context, snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, context);
                if (!r.isEmpty()) {
                    log.info("[{}] {} items", context, r.size());
                    return r;
                }
            }
        } catch (Exception e) {
            log.warn("[{}] Failed: {}", context, e.getMessage());
        }
        return List.of();
    }

    private List<Map> tryWebClientPost(String token, String uri,
                                        Map<String, Object> payload, String context) {
        try {
            String raw = buildClient(token).post().uri(uri)
                    .bodyValue(payload).retrieve().bodyToMono(String.class).block();
            log.debug("[{}] snippet: {}", context, snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, context);
                if (!r.isEmpty()) {
                    log.info("[{}] {} items", context, r.size());
                    return r;
                }
            }
        } catch (Exception e) {
            log.warn("[{}] Failed: {}", context, e.getMessage());
        }
        return List.of();
    }

    private List<Map> tryCurlGet(String token, String url, String context) {
        String raw = curlClient.get(url, token);
        log.debug("[{}] snippet: {}", context, snippet(raw));
        if (!isHtml(raw) && raw != null) {
            List<Map> r = parseJsonResponse(raw, context);
            if (!r.isEmpty()) {
                log.info("[{}] {} items", context, r.size());
                return r;
            }
        }
        return List.of();
    }

    private List<Map> tryCurlPost(String token, String url,
                                   Map<String, Object> payload, String context) {
        String raw = curlClient.postJson(url, toJson(payload), token);
        log.debug("[{}] snippet: {}", context, snippet(raw));
        if (!isHtml(raw) && raw != null) {
            List<Map> r = parseJsonResponse(raw, context);
            if (!r.isEmpty()) {
                log.info("[{}] {} items", context, r.size());
                return r;
            }
        }
        return List.of();
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    private String snippet(String s) {
        if (s == null) return "null";
        return s.substring(0, Math.min(200, s.length())).replaceAll("\\s+", " ");
    }

    private String getText(JsonNode node, String field) {
        return node.has(field) ? node.get(field).asText(null) : null;
    }

    private String safeStr(Object obj) {
        return obj != null ? String.valueOf(obj) : null;
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