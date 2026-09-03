package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.LocalDate;

@Component
public class NepseClient {

    private static final Logger log = LoggerFactory.getLogger(NepseClient.class);

    private final WebClient         webClient;
    private final NepseTokenManager tokenManager;
    private final ObjectMapper      mapper = new ObjectMapper();

    public NepseClient(NepseTokenManager tokenManager) {
        this.tokenManager = tokenManager;
        this.webClient    = NepseHttpClientFactory.create();
    }

    // GET

    public Mono<Object> get(String path) {
        return doGet(path)
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on GET {}, refreshing token and retrying", path);
                    return tokenManager.forceRefreshAsync().then(doGet(path));
                })
                .onErrorResume(WebClientResponseException.class, ex -> {
                    logHttpError("GET", path, ex);
                    return Mono.just(fallback(path, ex));
                })
                .onErrorResume(Exception.class, ex -> {
                    logGenericError("GET", path, ex);
                    return Mono.just(fallback(path, ex));
                });
    }

    private Mono<Object> doGet(String path) {
        return tokenManager.authorizationHeaderAsync()
                .flatMap(auth -> webClient.get()
                        .uri(path)
                        .header("Authorization", auth)
                        .retrieve()
                        .bodyToMono(Object.class));
    }

    // POST

    public Mono<Object> post(String path, long payloadId) {
        String body = "{\"id\":" + payloadId + "}";
        return doPost(path, body)
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on POST {}, refreshing token and retrying", path);
                    return tokenManager.forceRefreshAsync().then(doPost(path, body));
                })
                .onErrorResume(WebClientResponseException.class, ex -> {
                    logHttpError("POST", path, ex);
                    return Mono.just(fallback(path, ex));
                })
                .onErrorResume(Exception.class, ex -> {
                    logGenericError("POST", path, ex);
                    return Mono.just(fallback(path, ex));
                });
    }

    private Mono<Object> doPost(String path, String body) {
        return tokenManager.authorizationHeaderAsync()
                .flatMap(auth -> webClient.post()
                        .uri(path)
                        .header("Authorization", auth)
                        .header("Content-Type", "application/json")
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(Object.class));
    }

    public String getRaw(String path) {
        return webClient.get()
                .uri(path)
                .header("Authorization", tokenManager.authorizationHeader())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    // Error handling helpers

    private void logHttpError(String method, String path, WebClientResponseException ex) {
        if (ex instanceof WebClientResponseException.Forbidden) {
            log.error("[NEPSE] {} {} -> 403 Forbidden likely upstream block. Body: {}",
                    method, path, safeBody(ex));
        } else {
            log.error("[NEPSE] {} {} failed: {} {} body: {}",
                    method, path, ex.getStatusCode().value(), ex.getStatusText(), safeBody(ex));
        }
    }

    private void logGenericError(String method, String path, Exception ex) {
        log.error("[NEPSE] {} {} failed with non http error: {}", method, path, ex.toString());
    }

    private String safeBody(WebClientResponseException ex) {
        try {
            String b = ex.getResponseBodyAsString();
            return (b == null || b.isBlank()) ? "empty" : b;
        } catch (Exception e) {
            return "unavailable";
        }
    }

    // Soft fail payload so callers get a predictable shape instead of a 500
    // frontend can check error field to show unavailable state
    private Object fallback(String path, Exception ex) {
        ObjectNode node = mapper.createObjectNode();
        node.put("error", true);
        node.put("path", path);
        node.put("timestamp", Instant.now().toString());
        if (ex instanceof WebClientResponseException wcre) {
            node.put("status", wcre.getStatusCode().value());
            node.put("message", wcre.getStatusText());
        } else {
            node.put("status", 0);
            node.put("message", ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
        }
        return node;
    }

    // Payload id formulas unchanged

    public long getPostPayloadId(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        int[] salts = tokenManager.getSalts();
        long e = dummyValue + dummyId + 2L * day;
        int saltIndex = (e % 10 < 5) ? 3 : 1;
        return e + (long) salts[saltIndex] * day - salts[saltIndex - 1];
    }

    public long getPostPayloadIdForFloorSheet(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        int[] salts = tokenManager.getSalts();
        long e = dummyValue + dummyId + 2L * day;
        int saltIndex = (e % 10 < 4) ? 1 : 3;
        return e + (long) salts[saltIndex] * day - salts[saltIndex - 1];
    }

    public long getPostPayloadIdForScrips(int dummyId, int dummyValue) {
        int day = LocalDate.now().getDayOfMonth();
        return dummyValue + dummyId + 2L * day;
    }
}