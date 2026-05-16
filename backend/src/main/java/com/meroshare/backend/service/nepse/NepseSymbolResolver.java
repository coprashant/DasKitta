package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Resolves a NEPSE stock symbol (e.g. "NABIL") to its numeric security ID
 * by calling /api/nots/security?nonDelisted=true once and caching the result.
 *
 * The cache is refreshed lazily when a symbol is not found (new listing).
 */
@Component
public class NepseSymbolResolver {

    private static final Logger log = LoggerFactory.getLogger(NepseSymbolResolver.class);

    private final NepseClient   client;
    private final ObjectMapper  mapper = new ObjectMapper();
    private final ReentrantLock lock   = new ReentrantLock();

    private Map<String, Long> symbolIdMap = null;

    public NepseSymbolResolver(NepseClient client) {
        this.client = client;
    }

    /**
     * Resolves a symbol to its numeric security ID.
     * Returns Mono.error with an IllegalArgumentException if the symbol is unknown.
     */
    public Mono<Long> resolveSecurityId(String symbol) {
        return Mono.fromCallable(() -> {
            Map<String, Long> map = getOrLoadMap();
            Long id = map.get(symbol.toUpperCase());
            if (id == null) {
                // Try refreshing cache once (new listing)
                log.info("[NEPSE] Symbol '{}' not in cache, refreshing...", symbol);
                map = forceReload();
                id  = map.get(symbol.toUpperCase());
            }
            if (id == null) {
                throw new IllegalArgumentException("Unknown NEPSE symbol: " + symbol);
            }
            return id;
        });
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private Map<String, Long> getOrLoadMap() {
        if (symbolIdMap != null) return symbolIdMap;
        return forceReload();
    }

    private Map<String, Long> forceReload() {
        lock.lock();
        try {
            if (symbolIdMap != null) return symbolIdMap; // double-checked
            log.info("[NEPSE] Loading security symbol→ID map...");

            String json = client.getRaw("/api/nots/security?nonDelisted=true");
            JsonNode array = mapper.readTree(json);

            Map<String, Long> map = new HashMap<>();
            if (array.isArray()) {
                for (JsonNode node : array) {
                    String sym = node.has("symbol") ? node.get("symbol").asText() : null;
                    Long   id  = node.has("id")     ? node.get("id").asLong()     : null;
                    if (sym != null && id != null) {
                        map.put(sym.toUpperCase(), id);
                    }
                }
            }

            this.symbolIdMap = map;
            log.info("[NEPSE] Loaded {} securities into symbol map.", map.size());
            return map;

        } catch (Exception e) {
            log.error("[NEPSE] Failed to load security list: {}", e.getMessage());
            return symbolIdMap != null ? symbolIdMap : new HashMap<>();
        } finally {
            lock.unlock();
        }
    }
}