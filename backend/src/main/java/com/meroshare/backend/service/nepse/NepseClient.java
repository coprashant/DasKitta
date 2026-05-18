package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

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

    public Mono<Object> get(String path) {
        return tokenManager.authorizationHeaderAsync()
                .flatMap(auth -> webClient.get()
                        .uri(path)
                        .header("Authorization", auth)
                        .retrieve()
                        .bodyToMono(Object.class))
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on GET {}, refreshing token and retrying...", path);
                    return tokenManager.forceRefreshAsync()
                            .then(tokenManager.authorizationHeaderAsync())
                            .flatMap(auth -> webClient.get()
                                    .uri(path)
                                    .header("Authorization", auth)
                                    .retrieve()
                                    .bodyToMono(Object.class));
                })
                .doOnError(ex -> log.error("[NEPSE] GET {} failed: {}", path, ex.getMessage()));
    }

    public Mono<Object> post(String path, long payloadId) {
        String body = "{\"id\":" + payloadId + "}";
        return tokenManager.authorizationHeaderAsync()
                .flatMap(auth -> webClient.post()
                        .uri(path)
                        .header("Authorization", auth)
                        .header("Content-Type", "application/json")
                        .bodyValue(body)
                        .retrieve()
                        .bodyToMono(Object.class))
                .onErrorResume(WebClientResponseException.Unauthorized.class, e -> {
                    log.warn("[NEPSE] 401 on POST {}, refreshing token and retrying...", path);
                    return tokenManager.forceRefreshAsync()
                            .then(tokenManager.authorizationHeaderAsync())
                            .flatMap(auth -> webClient.post()
                                    .uri(path)
                                    .header("Authorization", auth)
                                    .header("Content-Type", "application/json")
                                    .bodyValue(body)
                                    .retrieve()
                                    .bodyToMono(Object.class));
                })
                .doOnError(ex -> log.error("[NEPSE] POST {} failed: {}", path, ex.getMessage()));
    }

    public String getRaw(String path) {
        return webClient.get()
                .uri(path)
                .header("Authorization", tokenManager.authorizationHeader())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

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