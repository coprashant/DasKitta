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

// Resolves a NEPSE symbol e.g NABIL to its numeric security id
// Calls /api/nots/security?nonDelisted=true once and caches the result
// Handles both a plain array response and a paginated Page content wrapper
// since the exact shape of this endpoint is unconfirmed per api reference
// Cache refreshed lazily when a symbol is not found e.g new listing
@Component
public class NepseSymbolResolver {

    private static final Logger log = LoggerFactory.getLogger(NepseSymbolResolver.class);
    private static final String SECURITY_LIST_PATH = "/api/nots/security?nonDelisted=true";

    private final NepseClient   client;
    private final ObjectMapper  mapper = new ObjectMapper();
    private final ReentrantLock lock   = new ReentrantLock();

    private Map<String, Long> symbolIdMap = null;

    public NepseSymbolResolver(NepseClient client) {
        this.client = client;
    }

    // Resolves a symbol to its numeric security id
    // Errors with IllegalArgumentException if the symbol is unknown
    public Mono<Long> resolveSecurityId(String symbol) {
        return Mono.fromCallable(() -> {
            Map<String, Long> map = getOrLoadMap();
            Long id = map.get(symbol.toUpperCase());
            if (id == null) {
                log.info("[NEPSE] Symbol {} not in cache, refreshing", symbol);
                map = forceReload();
                id  = map.get(symbol.toUpperCase());
            }
            if (id == null) {
                throw new IllegalArgumentException("Unknown NEPSE symbol: " + symbol);
            }
            return id;
        });
    }

    // Internal

    private Map<String, Long> getOrLoadMap() {
        if (symbolIdMap != null) return symbolIdMap;
        return forceReload();
    }

    private Map<String, Long> forceReload() {
        lock.lock();
        try {
            if (symbolIdMap != null) return symbolIdMap;
            log.info("[NEPSE] Loading security symbol to id map");
            String json = client.getRaw(SECURITY_LIST_PATH);
            JsonNode root = mapper.readTree(json);
            Map<String, Long> map = new HashMap<>();
            populateFromNode(root, map);
            this.symbolIdMap = map;
            log.info("[NEPSE] Loaded {} securities into symbol map", map.size());
            return map;
        } catch (Exception e) {
            log.error("[NEPSE] Failed to load security list: {}", e.getMessage());
            return symbolIdMap != null ? symbolIdMap : new HashMap<>();
        } finally {
            lock.unlock();
        }
    }

    // Accepts a plain array root or a Page wrapper with a content array
    // Falls back to no op if neither shape is found so callers get an
    // empty map instead of a parse failure
    private void populateFromNode(JsonNode root, Map<String, Long> map) {
        JsonNode array;
        if (root.isArray()) {
            array = root;
        } else if (root.has("content") && root.get("content").isArray()) {
            array = root.get("content");
        } else {
            log.error("[NEPSE] Unrecognized security list shape, expected array or content array");
            return;
        }
        for (JsonNode node : array) {
            String sym = node.has("symbol") ? node.get("symbol").asText() : null;
            Long   id  = node.has("id")     ? node.get("id").asLong()     : null;
            if (sym != null && id != null) {
                map.put(sym.toUpperCase(), id);
            }
        }
    }
}