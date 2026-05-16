package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.Map;

/**
 * Low-level HTTP client for nepalstock.com.
 *
 * GET endpoints  → requestGet(path)
 * POST endpoints → requestPost(path, payloadId)
 *
 * All requests attach  Authorization: Salter <token>  automatically.
 * On 401 the token is force-refreshed and the call is retried once.
 */
@Component
public class NepseClient {

    private static final Logger log = LoggerFactory.getLogger(NepseClient.class);
    private static final String BASE_URL = "https://www.nepalstock.com";

    private final WebClient       webClient;
    private final NepseTokenManager tokenManager;
    private final ObjectMapper    mapper = new ObjectMapper();

    public NepseClient(NepseTokenManager tokenManager) {
        this.tokenManager = tokenManager;
        this.webClient = NepseHttpClientFactory.create();
    }

    // ── GET ───────────────────────────────────────────────────────────────────

    public Mono<Object> get(String path) {
        return webClient.get()
                .uri(path)
                .header("Authorization", tokenManager.authorizationHeader())
                .retrieve()
                .bodyToMono(Object.class)
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on GET {}, refreshing token and retrying...", path);
                    tokenManager.forceRefresh();
                    return webClient.get()
                            .uri(path)
                            .header("Authorization", tokenManager.authorizationHeader())
                            .retrieve()
                            .bodyToMono(Object.class);
                })
                .doOnError(ex -> log.error("[NEPSE] GET {} failed: {}", path, ex.getMessage()));
    }

    // ── POST ──────────────────────────────────────────────────────────────────

    public Mono<Object> post(String path, long payloadId) {
        String body = "{\"id\":" + payloadId + "}";
        return webClient.post()
                .uri(path)
                .header("Authorization", tokenManager.authorizationHeader())
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Object.class)
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on POST {}, refreshing token and retrying...", path);
                    tokenManager.forceRefresh();
                    return webClient.post()
                            .uri(path)
                            .header("Authorization", tokenManager.authorizationHeader())
                            .header("Content-Type", "application/json")
                            .bodyValue(body)
                            .retrieve()
                            .bodyToMono(Object.class);
                })
                .doOnError(ex -> log.error("[NEPSE] POST {} failed: {}", path, ex.getMessage()));
    }

    // ── Raw GET (returns String, used internally) ─────────────────────────────

    public String getRaw(String path) {
        return webClient.get()
                .uri(path)
                .header("Authorization", tokenManager.authorizationHeader())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    // ── POST Payload ID calculation ───────────────────────────────────────────
    // Python equivalent:
    //   e = DUMMY_DATA[dummyId] + dummyId + 2 * date.today().day
    //   postPayloadId = e + salts[3 if e%10<5 else 1] * day - salts[(3 if e%10<5 else 1) - 1]

    public long getPostPayloadId(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        int[] salts = tokenManager.getSalts();
        long e = dummyValue + dummyId + 2L * day;
        int saltIndex = (e % 10 < 5) ? 3 : 1;
        return e + (long) salts[saltIndex] * day - salts[saltIndex - 1];
    }

    // Python equivalent for floorsheet:
    //   postPayloadId = e + salts[1 if e%10<4 else 3] * day - salts[(1 if e%10<4 else 3) - 1]
    public long getPostPayloadIdForFloorSheet(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        int[] salts = tokenManager.getSalts();
        long e = dummyValue + dummyId + 2L * day;
        int saltIndex = (e % 10 < 4) ? 1 : 3;
        return e + (long) salts[saltIndex] * day - salts[saltIndex - 1];
    }

    // Simple payload for scrip-level calls (no salt multiplication)
    public long getPostPayloadIdForScrips(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        return dummyValue + dummyId + 2L * day;
    }
}