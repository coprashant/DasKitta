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

@Slf4j
@Service
@RequiredArgsConstructor
public class MeroshareApiService {

    @Value("${meroshare.api.base-url}")
    private String baseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CdscHttpClient curlClient;

    // ─── Token cache ──────────────────────────────────────────────────────────
    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();
    private static final long TOKEN_TTL_MS = 8 * 60 * 1000;

    private static class CachedToken {
        final String token;
        final long expiresAt;
        CachedToken(String token) {
            this.token = token;
            this.expiresAt = System.currentTimeMillis() + TOKEN_TTL_MS;
        }
        boolean isValid() { return System.currentTimeMillis() < expiresAt; }
    }

    // ─── WebClient (for non-WAF-sensitive endpoints) ──────────────────────────

    private WebClient buildClient(String token) {
        WebClient.Builder builder = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate, br")
                .defaultHeader("Accept-Language", "en-GB,en-US;q=0.9,en;q=0.8,ne;q=0.7")
                .defaultHeader("Connection", "keep-alive")
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .defaultHeader("Host", "webbackend.cdsc.com.np")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                .defaultHeader("sec-ch-ua",
                        "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
                .defaultHeader("sec-ch-ua-mobile", "?0")
                .defaultHeader("sec-ch-ua-platform", "\"Windows\"")
                .defaultHeader("Sec-Fetch-Dest", "empty")
                .defaultHeader("Sec-Fetch-Mode", "cors")
                .defaultHeader("Sec-Fetch-Site", "same-site")
                .defaultHeader("Cache-Control", "no-cache")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(8 * 1024 * 1024));

        if (token != null && !token.isBlank()) {
            builder.defaultHeader("Authorization", token);
            builder.defaultHeader("Cookie", "Authorization=" + token);
        }
        return builder.build();
    }

    private WebClient buildClient() { return buildClient(null); }

    private WebClient buildCdscResultClient() {
        return WebClient.builder()
                .baseUrl("https://iporesult.cdsc.com.np")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate, br")
                .defaultHeader("Accept-Language", "en-US,en;q=0.9")
                .defaultHeader("Connection", "keep-alive")
                .defaultHeader("Origin", "https://iporesult.cdsc.com.np")
                .defaultHeader("Referer", "https://iporesult.cdsc.com.np/")
                .defaultHeader("Host", "iporesult.cdsc.com.np")
                .defaultHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                .defaultHeader("sec-ch-ua",
                        "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"")
                .defaultHeader("sec-ch-ua-mobile", "?0")
                .defaultHeader("sec-ch-ua-platform", "\"Windows\"")
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
        if (isHtml(raw)) { log.warn("[{}] HTML response — WAF block", context); return List.of(); }
        try {
            JsonNode node = objectMapper.readTree(raw);
            if (node.isArray()) return nodeArrayToList(node);
            return List.of();
        } catch (Exception e) { log.warn("[{}] Parse error: {}", context, e.getMessage()); return List.of(); }
    }

    private List<Map> parseJsonResponse(String raw, String context) {
        if (isHtml(raw)) { log.warn("[{}] HTML response — WAF block", context); return List.of(); }
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
                    Iterator<Map.Entry<String, JsonNode>> f = body.fields();
                    while (f.hasNext()) {
                        Map.Entry<String, JsonNode> e = f.next();
                        if (e.getValue().isArray() && e.getValue().size() > 0)
                            return nodeArrayToList(e.getValue());
                    }
                }
            }
            log.warn("[{}] Unrecognised shape: {}", context,
                    raw.substring(0, Math.min(300, raw.length())));
            return List.of();
        } catch (Exception e) { log.warn("[{}] Parse error: {}", context, e.getMessage()); return List.of(); }
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); }
        catch (Exception e) { throw new RuntimeException("JSON serialization failed", e); }
    }

    private String extractMessage(String raw) {
        if (raw == null || raw.isBlank() || isHtml(raw)) return "Unknown error";
        try { JsonNode n = objectMapper.readTree(raw); if (n.has("message")) return n.get("message").asText(raw); }
        catch (Exception ignored) {}
        return raw;
    }

    // ─── DP List ──────────────────────────────────────────────────────────────

    public List<Map> getDpList() {
        try {
            String raw = buildClient().get().uri("/meroShare/capital/")
                    .retrieve().bodyToMono(String.class).block();
            return parseJsonArraySafely(raw, "DP_LIST");
        } catch (Exception e) { log.error("[DP_LIST] {}", e.getMessage()); return List.of(); }
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    public String login(String dpId, String username, String password) {
        String key = dpId + ":" + username;
        CachedToken c = tokenCache.get(key);
        if (c != null && c.isValid()) { log.info("[LOGIN] Cached token for: {}", username); return c.token; }
        String token = doLogin(dpId, username, password);
        tokenCache.put(key, new CachedToken(token));
        return token;
    }

    public String loginFresh(String dpId, String username, String password) {
        tokenCache.remove(dpId + ":" + username);
        return login(dpId, username, password);
    }

    private String doLogin(String dpId, String username, String password) {
        int clientId;
        try { clientId = Integer.parseInt(dpId.trim()); }
        catch (NumberFormatException e) { throw new RuntimeException("Invalid DP ID: " + dpId); }

        Map<String, Object> body = Map.of("clientId", clientId, "username", username.trim(), "password", password);
        log.info("[LOGIN] Attempting user={} dpId={}", username, dpId);

        try {
            var response = buildClient().post().uri("/meroShare/auth/")
                    .bodyValue(body).retrieve().toEntity(String.class).block();

            if (response == null) throw new RuntimeException("No response from Meroshare login API");
            String raw = response.getBody();
            log.info("[LOGIN] Status={} Body={}", response.getStatusCode(), raw);

            // Check for error
            if (!isHtml(raw)) {
                try {
                    JsonNode node = objectMapper.readTree(raw);
                    int sc = node.has("statusCode") ? node.get("statusCode").asInt(200) : 200;
                    String msg = node.has("message") ? node.get("message").asText("") : "";
                    if (sc != 200 && !msg.isBlank()) throw new RuntimeException("Meroshare login error: " + msg);
                } catch (RuntimeException re) { throw re; } catch (Exception ignored) {}
            }

            // Extract token: Set-Cookie → Authorization header → JSON body
            List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
            if (cookies != null) {
                for (String cookie : cookies) {
                    if (cookie.startsWith("Authorization=")) {
                        String t = cookie.split(";")[0].replace("Authorization=", "").trim();
                        if (!t.isBlank()) { log.info("[LOGIN] Token from Set-Cookie"); return t; }
                    }
                }
            }
            String authHeader = response.getHeaders().getFirst("Authorization");
            if (authHeader != null && !authHeader.isBlank()) { log.info("[LOGIN] Token from header"); return authHeader; }
            if (!isHtml(raw)) {
                try { JsonNode n = objectMapper.readTree(raw); String t = n.has("token") ? n.get("token").asText("") : ""; if (!t.isBlank()) return t; }
                catch (Exception ignored) {}
            }
            throw new RuntimeException("Login succeeded but no token received — verify credentials.");

        } catch (WebClientResponseException e) {
            log.error("[LOGIN] HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Meroshare login failed: " + extractMessage(e.getResponseBodyAsString()));
        } catch (RuntimeException re) { throw re; }
        catch (Exception e) { throw new RuntimeException("Meroshare login failed: " + e.getMessage()); }
    }

    // ─── Account details ──────────────────────────────────────────────────────

    public AccountDetails fetchAccountDetails(String token) {
        try {
            String raw = buildClient(token).get().uri("/meroShare/ownDetail/")
                    .retrieve().bodyToMono(String.class).block();
            log.info("[OWN_DETAIL] Raw: {}", raw);
            if (isHtml(raw)) throw new RuntimeException("WAF blocked ownDetail — bad session?");

            JsonNode node = objectMapper.readTree(raw);
            AccountDetails d = new AccountDetails();
            d.setFullName(node.has("name") ? node.get("name").asText(null) : null);
            d.setBoid(node.has("boid") ? node.get("boid").asText(null) : null);
            d.setDemat(node.has("demat") ? node.get("demat").asText(null) : null);
            log.info("[OWN_DETAIL] name={} boid={}", d.getFullName(), d.getBoid());
            fetchBankDetails(token, d);
            return d;
        } catch (RuntimeException e) { throw e; }
        catch (Exception e) { throw new RuntimeException("Failed to fetch account details: " + e.getMessage()); }
    }

    private void fetchBankDetails(String token, AccountDetails details) {
        try {
            List<Map> banks = parseJsonArraySafely(
                    buildClient(token).get().uri("/meroShare/bank/").retrieve().bodyToMono(String.class).block(),
                    "BANK");
            if (banks.isEmpty()) return;
            String bankId = String.valueOf(banks.get(0).get("id"));
            details.setBankId(bankId);
            List<Map> branches = parseJsonArraySafely(
                    buildClient(token).get().uri("/meroShare/bank/" + bankId).retrieve().bodyToMono(String.class).block(),
                    "BRANCH");
            if (!branches.isEmpty()) {
                Map<?, ?> b = branches.get(0);
                details.setAccountNumber(String.valueOf(b.get("accountNumber")));
                details.setAccountBranchId(String.valueOf(b.get("accountBranchId")));
                details.setAccountTypeId(String.valueOf(b.get("accountTypeId")));
                details.setCustomerId(String.valueOf(b.get("id")));
            }
        } catch (Exception e) { log.warn("[BANK/BRANCH] Failed: {}", e.getMessage()); }
    }

    // ─── Open IPOs ────────────────────────────────────────────────────────────

    /**
     * Fetches open IPOs. Tries WebClient GET, then WebClient POST, then curl POST.
     * The curl fallback bypasses TLS fingerprint WAF blocks.
     */
    public List<Map> getOpenIpos(String token) {
        String url = baseUrl + "/meroShare/companyShare/applicableIssue/";

        // 1. WebClient GET
        try {
            String raw = buildClient(token).get().uri("/meroShare/companyShare/applicableIssue/")
                    .retrieve().bodyToMono(String.class).block();
            log.info("[OPEN_IPOS_GET] Snippet: {}", snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "OPEN_IPOS_GET");
                if (!r.isEmpty()) { log.info("[OPEN_IPOS] {} via WebClient GET", r.size()); return r; }
            }
        } catch (Exception e) { log.warn("[OPEN_IPOS_GET] WebClient: {}", e.getMessage()); }

        // 2. WebClient POST
        try {
            Map<String, Object> payload = buildOpenIpoPayload();
            String raw = buildClient(token).post().uri("/meroShare/companyShare/applicableIssue/")
                    .bodyValue(payload).retrieve().bodyToMono(String.class).block();
            log.info("[OPEN_IPOS_POST] Snippet: {}", snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "OPEN_IPOS_POST");
                if (!r.isEmpty()) { log.info("[OPEN_IPOS] {} via WebClient POST", r.size()); return r; }
            }
        } catch (Exception e) { log.warn("[OPEN_IPOS_POST] WebClient: {}", e.getMessage()); }

        // 3. curl GET (bypasses TLS fingerprint WAF)
        String curlGetRaw = curlClient.get(url, token);
        log.info("[OPEN_IPOS_CURL_GET] Snippet: {}", snippet(curlGetRaw));
        if (!isHtml(curlGetRaw)) {
            List<Map> r = parseJsonResponse(curlGetRaw, "OPEN_IPOS_CURL_GET");
            if (!r.isEmpty()) { log.info("[OPEN_IPOS] {} via curl GET", r.size()); return r; }
        }

        // 4. curl POST
        String curlPostRaw = curlClient.postJson(url, toJson(buildOpenIpoPayload()), token);
        log.info("[OPEN_IPOS_CURL_POST] Snippet: {}", snippet(curlPostRaw));
        if (!isHtml(curlPostRaw)) {
            List<Map> r = parseJsonResponse(curlPostRaw, "OPEN_IPOS_CURL_POST");
            if (!r.isEmpty()) { log.info("[OPEN_IPOS] {} via curl POST", r.size()); return r; }
        }

        log.warn("[OPEN_IPOS] All approaches empty — no open IPOs or all blocked");
        return List.of();
    }

    private Map<String, Object> buildOpenIpoPayload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("page", 1); p.put("size", 20);
        p.put("searchRoleViewConstants", "VIEW_APPLICABLE_SHARE");
        p.put("filterFieldParams", List.of()); p.put("filterDateParams", List.of());
        return p;
    }

    // ─── Application Report ───────────────────────────────────────────────────

    public List<Map> getApplicationReport(String token) {
        String url = baseUrl + "/meroShare/applicantForm/active/search/";

        // 1. WebClient GET
        try {
            String raw = buildClient(token).get().uri("/meroShare/applicantForm/active/search/")
                    .retrieve().bodyToMono(String.class).block();
            log.info("[APP_REPORT_GET] Snippet: {}", snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "APP_REPORT_GET");
                if (!r.isEmpty()) { log.info("[APP_REPORT] {} via WebClient GET", r.size()); return r; }
            }
        } catch (Exception e) { log.warn("[APP_REPORT_GET] WebClient: {}", e.getMessage()); }

        Map<String, Object> postPayload = buildAppReportPayload();

        // 2. WebClient POST
        try {
            String raw = buildClient(token).post().uri("/meroShare/applicantForm/active/search/")
                    .bodyValue(postPayload).retrieve().bodyToMono(String.class).block();
            log.info("[APP_REPORT_POST] Snippet: {}", snippet(raw));
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "APP_REPORT_POST");
                if (!r.isEmpty()) { log.info("[APP_REPORT] {} via WebClient POST", r.size()); return r; }
            }
        } catch (Exception e) { log.warn("[APP_REPORT_POST] WebClient: {}", e.getMessage()); }

        // 3. curl GET
        String curlGetRaw = curlClient.get(url, token);
        log.info("[APP_REPORT_CURL_GET] Snippet: {}", snippet(curlGetRaw));
        if (!isHtml(curlGetRaw)) {
            List<Map> r = parseJsonResponse(curlGetRaw, "APP_REPORT_CURL_GET");
            if (!r.isEmpty()) { log.info("[APP_REPORT] {} via curl GET", r.size()); return r; }
        }

        // 4. curl POST
        String curlPostRaw = curlClient.postJson(url, toJson(postPayload), token);
        log.info("[APP_REPORT_CURL_POST] Snippet: {}", snippet(curlPostRaw));
        if (!isHtml(curlPostRaw)) {
            List<Map> r = parseJsonResponse(curlPostRaw, "APP_REPORT_CURL_POST");
            log.info("[APP_REPORT] {} via curl POST", r.size());
            return r;
        }

        log.warn("[APP_REPORT] All approaches empty — WAF blocking or no applications");
        return List.of();
    }

    private Map<String, Object> buildAppReportPayload() {
        LocalDate today = LocalDate.now();
        LocalDate twelveMonthsAgo = today.minusMonths(12);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("page", 1); p.put("size", 200);
        p.put("searchRoleViewConstants", "VIEW_APPLICANT_FORM_COMPLETE");
        p.put("filterFieldParams", List.of());
        p.put("filterDateParams", List.of(
                Map.of("key", "appliedDate", "condition", "", "alias", "",
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
        body.put("demat", demat); body.put("boid", boid);
        body.put("accountNumber", accountNumber); body.put("customerId", customerId);
        body.put("accountBranchId", accountBranchId); body.put("accountTypeId", accountTypeId);
        body.put("appliedKitta", String.valueOf(kitta));
        body.put("crnNumber", crn != null ? crn : "");
        body.put("transactionPIN", pin != null ? pin : "");
        body.put("companyShareId", companyShareId); body.put("bankId", bankId);

        log.info("[APPLY_IPO] companyShareId={} boid={} kitta={}", companyShareId, boid, kitta);

        // Try WebClient first
        try {
            String raw = buildClient(token).post().uri("/meroShare/applicantForm/share/apply")
                    .bodyValue(body).retrieve().bodyToMono(String.class).block();
            log.info("[APPLY_IPO] WebClient response: {}", raw);
            if (!isHtml(raw)) {
                try { JsonNode n = objectMapper.readTree(raw); if (n.has("message")) return n.get("message").asText("Applied"); }
                catch (Exception ignored) {}
            }
            return "Applied successfully";
        } catch (WebClientResponseException e) {
            log.warn("[APPLY_IPO] WebClient HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            // If WAF-blocked, try curl
            if (e.getStatusCode().value() == 403 || isHtml(e.getResponseBodyAsString())) {
                return applyIpoCurl(token, body);
            }
            throw new RuntimeException(extractMessage(e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.warn("[APPLY_IPO] WebClient failed: {}, trying curl", e.getMessage());
            return applyIpoCurl(token, body);
        }
    }

    private String applyIpoCurl(String token, Map<String, Object> body) {
        String url = baseUrl + "/meroShare/applicantForm/share/apply";
        String raw = curlClient.postJson(url, toJson(body), token);
        log.info("[APPLY_IPO_CURL] Response: {}", raw);
        if (!isHtml(raw) && raw != null) {
            try { JsonNode n = objectMapper.readTree(raw); if (n.has("message")) return n.get("message").asText("Applied"); }
            catch (Exception ignored) {}
            return "Applied successfully";
        }
        throw new RuntimeException("IPO application failed — unable to reach CDSC API.");
    }

    // ─── Result check (authenticated) ────────────────────────────────────────

    public ResultInfo checkResult(String token, String applicationFormId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        String url = baseUrl + "/meroShare/applicantForm/report/detail/" + applicationFormId;

        // WebClient
        try {
            String raw = buildClient(token).get()
                    .uri("/meroShare/applicantForm/report/detail/" + applicationFormId)
                    .retrieve().bodyToMono(String.class).block();
            log.info("[CHECK_RESULT_DETAIL] formId={} Raw: {}", applicationFormId, raw);
            if (!isHtml(raw)) return parseDetailResult(raw);
        } catch (Exception e) { log.warn("[CHECK_RESULT_DETAIL] WebClient failed: {}", e.getMessage()); }

        // curl fallback
        String curlRaw = curlClient.get(url, token);
        log.info("[CHECK_RESULT_DETAIL_CURL] formId={} Raw: {}", applicationFormId, curlRaw);
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
        } catch (Exception e) { log.warn("[PARSE_DETAIL] {}", e.getMessage()); }
        return result;
    }

    // ─── Result check (public/guest) ─────────────────────────────────────────

    public ResultInfo checkResultPublic(String boid, String shareId) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        String url = "https://iporesult.cdsc.com.np/result/result/check";
        String jsonBody = toJson(Map.of("boid", boid, "companyShareId", shareId));

        // WebClient
        try {
            String raw = buildCdscResultClient().post().uri("/result/result/check")
                    .bodyValue(Map.of("boid", boid, "companyShareId", shareId))
                    .retrieve().bodyToMono(String.class).block();
            log.info("[RESULT_PUBLIC] WebClient boid={} shareId={} Response: {}", boid, shareId, snippet(raw));
            if (!isHtml(raw)) return parsePublicResultNode(objectMapper.readTree(raw));
        } catch (Exception e) { log.warn("[RESULT_PUBLIC] WebClient: {}", e.getMessage()); }

        // curl fallback
        String curlRaw = curlClient.postJson(url, jsonBody, null);
        log.info("[RESULT_PUBLIC_CURL] boid={} shareId={} Response: {}", boid, shareId, snippet(curlRaw));
        if (!isHtml(curlRaw) && curlRaw != null) {
            try { return parsePublicResultNode(objectMapper.readTree(curlRaw)); }
            catch (Exception e) { log.warn("[RESULT_PUBLIC_CURL] Parse error: {}", e.getMessage()); }
        }

        log.warn("[RESULT_PUBLIC] All blocked for boid={} shareId={}", boid, shareId);
        return result;
    }

    private ResultInfo parsePublicResultNode(JsonNode node) {
        ResultInfo result = new ResultInfo();
        result.setStatus("UNKNOWN");
        String statusCode = node.has("statusCode") ? node.get("statusCode").asText("") : "";
        boolean success = node.has("success") && node.get("success").asBoolean();
        if ("ALLOCATE".equalsIgnoreCase(statusCode)) {
            result.setStatus("ALLOTED");
            if (node.has("quantity")) result.setAllottedKitta(node.get("quantity").asInt(0));
        } else if ("NOT_ALLOTED".equalsIgnoreCase(statusCode) || "NOT_ALLOTTED".equalsIgnoreCase(statusCode)
                || (!success && !statusCode.isBlank())) {
            result.setStatus("NOT ALLOTED");
        } else if (node.has("message")) {
            String msg = node.get("message").asText("").toLowerCase();
            if (msg.contains("not allot")) result.setStatus("NOT ALLOTED");
            else if (msg.contains("allot")) result.setStatus("ALLOTED");
        }
        return result;
    }

    // ─── Public share list ────────────────────────────────────────────────────

    public List<Map> getPublicShareList() {
        String url = "https://iporesult.cdsc.com.np/result/companyShares/fileUploaded";

        // WebClient
        try {
            String raw = buildCdscResultClient().get().uri("/result/companyShares/fileUploaded")
                    .retrieve().bodyToMono(String.class).block();
            log.info("[SHARE_LIST] Length={}", raw != null ? raw.length() : 0);
            if (!isHtml(raw)) {
                List<Map> r = parseJsonResponse(raw, "SHARE_LIST");
                if (!r.isEmpty()) { log.info("[SHARE_LIST] {} shares", r.size()); return r; }
            }
        } catch (Exception e) { log.warn("[SHARE_LIST] WebClient: {}", e.getMessage()); }

        // curl fallback
        String curlRaw = curlClient.get(url, null);
        if (!isHtml(curlRaw) && curlRaw != null) {
            List<Map> r = parseJsonResponse(curlRaw, "SHARE_LIST_CURL");
            if (!r.isEmpty()) { log.info("[SHARE_LIST] {} shares via curl", r.size()); return r; }
        }

        log.error("[SHARE_LIST] All approaches failed");
        return List.of();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String snippet(String s) {
        if (s == null) return "null";
        return s.substring(0, Math.min(150, s.length())).replaceAll("\\s+", " ");
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