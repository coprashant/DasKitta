package com.meroshare.backend.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class MeroshareApiService {

    @Value("${meroshare.api.base-url}")
    private String baseUrl;

    private WebClient buildClient() {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Origin", "https://meroshare.cdsc.com.np")
                .defaultHeader("Referer", "https://meroshare.cdsc.com.np/")
                .build();
    }

    // Step 1: Login to CDSC and get auth token
    public String login(String dpId, String username, String password) {
        Map<String, String> body = new HashMap<>();
        body.put("clientId", dpId);
        body.put("username", username);
        body.put("password", password);

        Map response = buildClient().post()
                .uri("/meroShare/auth/loginWithClientId")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || !response.containsKey("token")) {
            throw new RuntimeException("Meroshare login failed for user: " + username);
        }

        return (String) response.get("token");
    }

    // Step 2: Fetch BOID, full name, bank ID after login
    public AccountDetails fetchAccountDetails(String token) {
        Map response = buildClient().get()
                .uri("/meroShare/ownDetail/")
                .header("Authorization", token)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null) {
            throw new RuntimeException("Failed to fetch account details");
        }

        AccountDetails details = new AccountDetails();
        details.setFullName((String) response.get("name"));
        details.setBoid((String) response.get("boid"));

        // Bank details are nested under demat
        fetchBankId(token, details);

        return details;
    }

    private void fetchBankId(String token, AccountDetails details) {
        try {
            List response = buildClient().get()
                    .uri("/bankRequest/")
                    .header("Authorization", token)
                    .retrieve()
                    .bodyToMono(List.class)
                    .block();

            if (response != null && !response.isEmpty()) {
                Map firstBank = (Map) response.get(0);
                details.setBankId(String.valueOf(firstBank.get("id")));
            }
        } catch (Exception e) {
            log.warn("Could not fetch bank ID: {}", e.getMessage());
        }
    }

    // Step 3: Get list of currently open IPOs
    public List<Map> getOpenIpos(String token) {
        List response = buildClient().get()
                .uri("/meroShare/active/")
                .header("Authorization", token)
                .retrieve()
                .bodyToMono(List.class)
                .block();

        return response != null ? response : List.of();
    }

    // Step 4: Apply for an IPO
    public String applyIpo(String token, String shareId, String boid, String bankId, int kitta) {
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

        try {
            Map response = buildClient().post()
                    .uri("/meroShare/applicant/")
                    .header("Authorization", token)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("message")) {
                return (String) response.get("message");
            }
            return "Applied successfully";
        } catch (Exception e) {
            throw new RuntimeException("IPO apply failed: " + e.getMessage());
        }
    }

    // Step 5: Check IPO result for a specific share
    public ResultInfo checkResult(String token, String boid, String shareId) {
        try {
            Map response = buildClient().post()
                    .uri("/meroShare/applicant/report/detail/")
                    .header("Authorization", token)
                    .bodyValue(Map.of("boid", boid, "shareId", shareId))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            ResultInfo result = new ResultInfo();
            if (response != null) {
                result.setStatus((String) response.get("status"));
                Object allotted = response.get("receivedKitta");
                result.setAllottedKitta(allotted != null ? Integer.parseInt(allotted.toString()) : 0);
            }
            return result;
        } catch (Exception e) {
            log.warn("Result check failed for boid {}: {}", boid, e.getMessage());
            ResultInfo result = new ResultInfo();
            result.setStatus("UNKNOWN");
            return result;
        }
    }

    // Inner classes to carry data between methods

    @Data
    public static class AccountDetails {
        private String fullName;
        private String boid;
        private String bankId;
    }

    @Data
    public static class ResultInfo {
        private String status;
        private int allottedKitta;
    }
}