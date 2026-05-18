package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Instant;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class NepseTokenManager {

    private static final Logger log = LoggerFactory.getLogger(NepseTokenManager.class);

    private static final String TOKEN_URL       = "/api/authenticate/prove";
    private static final int    MAX_TOKEN_AGE_S = 45;

    private static final int[] TABLE = {
        5, 8, 4, 7, 9, 4, 6, 9, 5, 5, 6, 5, 3, 5, 4, 4, 9, 6, 6, 8,
        8, 6, 8, 6, 5, 8, 4, 9, 5, 9, 8, 5, 3, 4, 7, 7, 4, 7, 3
    };

    private final WebClient     webClient;
    private final ObjectMapper  mapper    = new ObjectMapper();
    private final ReentrantLock lock      = new ReentrantLock();

    private String accessToken;
    private String refreshToken;
    private int[]  salts;
    private long   tokenTimestamp;

    public NepseTokenManager() {
        this.webClient = NepseHttpClientFactory.create();
    }

    public String getAccessToken() {
        if (!isTokenValid()) refresh();
        return accessToken;
    }

    public int[] getSalts() {
        if (!isTokenValid()) refresh();
        return salts;
    }

    public String authorizationHeader() {
        return "Salter " + getAccessToken();
    }

    // called from reactive pipeline so must not block the nio thread
    public Mono<String> authorizationHeaderAsync() {
        if (isTokenValid()) {
            return Mono.just("Salter " + accessToken);
        }
        return Mono.fromCallable(() -> {
            refresh();
            return "Salter " + accessToken;
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public void forceRefresh() {
        lock.lock();
        try {
            tokenTimestamp = 0;
        } finally {
            lock.unlock();
        }
        refresh();
    }

    // async version for use inside reactive pipelines
    public Mono<Void> forceRefreshAsync() {
        return Mono.fromRunnable(() -> {
            lock.lock();
            try { tokenTimestamp = 0; } finally { lock.unlock(); }
            refresh();
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }

    private boolean isTokenValid() {
        return accessToken != null &&
               (Instant.now().getEpochSecond() - tokenTimestamp) < MAX_TOKEN_AGE_S;
    }

    private void refresh() {
        lock.lock();
        try {
            if (isTokenValid()) return;

            log.info("[NEPSE] Refreshing token...");
            String json = webClient.get()
                    .uri(TOKEN_URL)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode node = mapper.readTree(json);

            int s1 = node.get("salt1").asInt();
            int s2 = node.get("salt2").asInt();
            int s3 = node.get("salt3").asInt();
            int s4 = node.get("salt4").asInt();
            int s5 = node.get("salt5").asInt();

            String rawAccess  = node.get("accessToken").asText();
            String rawRefresh = node.get("refreshToken").asText();

            int n = cdx(s1, s2, s3, s4, s5);
            int l = rdx(s1, s2, s4, s3, s5);
            int o = bdx(s1, s2, s4, s3, s5);
            int p = ndx(s1, s2, s4, s3, s5);
            int q = mdx(s1, s2, s4, s3, s5);

            int a = cdx(s2, s1, s3, s5, s4);
            int b = rdx(s2, s1, s3, s4, s5);
            int c = bdx(s2, s1, s4, s3, s5);
            int d = ndx(s2, s1, s4, s3, s5);
            int e = mdx(s2, s1, s4, s3, s5);

            this.accessToken    = removeIndices(rawAccess,  n, l, o, p, q);
            this.refreshToken   = removeIndices(rawRefresh, a, b, c, d, e);
            this.salts          = new int[]{s1, s2, s3, s4, s5};
            this.tokenTimestamp = node.get("serverTime").asLong() / 1000;

            log.info("[NEPSE] Token refreshed successfully.");

        } catch (Exception ex) {
            log.error("[NEPSE] Token refresh failed: {}", ex.getMessage());
            throw new RuntimeException("Failed to refresh NEPSE token", ex);
        } finally {
            lock.unlock();
        }
    }

    private static String removeIndices(String token, int n, int l, int o, int p, int q) {
        return token.substring(0, n)
             + token.substring(n + 1, l)
             + token.substring(l + 1, o)
             + token.substring(o + 1, p)
             + token.substring(p + 1, q)
             + token.substring(q + 1);
    }

    private static int finalIdx(int b) {
        return (b / 100) % 10 + (b / 10) % 10 + b % 10;
    }

    private static int cdx(int a, int b, int c, int d, int e) { return TABLE[finalIdx(b)] + 22; }
    private static int rdx(int a, int b, int c, int d, int e) { return (b / 100) % 10 + (b / 10) % 10 + TABLE[finalIdx(b)] + 32; }
    private static int bdx(int a, int b, int c, int d, int e) { return (b / 100) % 10 + (b / 10) % 10 + TABLE[finalIdx(b)] + 60; }
    private static int ndx(int a, int b, int c, int d, int e) { return (b / 10) % 10 + TABLE[finalIdx(b)] + 88; }
    private static int mdx(int a, int b, int c, int d, int e) { return (b / 100) % 10 + TABLE[finalIdx(b)] + 110; }
}