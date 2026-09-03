package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.meroshare.backend.service.NepseService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanySectorSnapshotService {

    private static final String SOURCE_ENDPOINT = "/api/nots/security/classification";

    private final NepseService nepseService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${nepse.company-sectors.snapshot-file:data/nepse/company-sectors.json}")
    private String snapshotFile;

    @Value("${nepse.company-sectors.page-size:500}")
    private int pageSize;

    private final AtomicReference<SectorSnapshot> snapshotRef =
            new AtomicReference<>(SectorSnapshot.empty());

    @PostConstruct
    public void init() {
        loadSnapshotFromDisk();
        runBackgroundRefresh("startup");
    }

    // Monthly refresh first day of month at 03:00
    @Scheduled(cron = "${nepse.company-sectors.refresh-cron:0 0 3 1 * *}")
    public void refreshMonthlySnapshot() {
        runBackgroundRefresh("scheduled");
    }

    public Map<String, Object> getSectorMapPayload() {
        SectorSnapshot snapshot = snapshotRef.get();
        return snapshot.toPayload();
    }

    public Mono<Map<String, Object>> refreshSnapshotNow() {
        return refreshSnapshot("manual").map(snapshot -> snapshot.toPayload());
    }

        private void runBackgroundRefresh(String trigger) {
        refreshSnapshot(trigger)
            .doOnSuccess(snapshot -> log.info(
                "company sectors background refresh succeeded trigger {} totalScrips {}",
                trigger,
                snapshot.totalScrips()
            ))
            .doOnError(error -> log.warn(
                "company sectors background refresh failed trigger {} reason {}",
                trigger,
                error.getMessage()
            ))
            .onErrorResume(error -> Mono.empty())
            .subscribe(
                ignored -> {},
                error -> log.debug("company sectors background refresh terminal error ignored")
            );
        }

    private Mono<SectorSnapshot> refreshSnapshot(String trigger) {
        return fetchSectorMapFromClassification()
                .onErrorResume(error -> {
                    log.warn(
                            "company sectors classification refresh failed trigger {} reason {}",
                            trigger,
                            error.getMessage()
                    );

                    return fetchSectorMapFromCompanyList();
                })
                .map(map -> {
                    if (map.isEmpty()) {
                        throw new IllegalStateException("empty company sectors map");
                    }

                    SectorSnapshot snapshot = new SectorSnapshot(
                            Instant.now().toString(),
                            SOURCE_ENDPOINT,
                            pageSize,
                            map
                    );

                    snapshotRef.set(snapshot);
                    writeSnapshotToDisk(snapshot);

                    log.info(
                            "company sectors snapshot updated trigger {} scripCount {}",
                            trigger,
                            snapshot.totalScrips()
                    );

                    return snapshot;
                });
    }

    private Mono<LinkedHashMap<String, String>> fetchSectorMapFromClassification() {
        return nepseService.getCompanyClassification(0, pageSize)
                .flatMap(raw -> {
                    PageChunk first = parsePageChunk(raw);
                    int totalPages = Math.max(first.totalPages, 1);

                    if (totalPages == 1) {
                        return Mono.just(first.symbolSectorMap);
                    }

                    return Flux.range(1, totalPages - 1)
                            .concatMap(page -> nepseService.getCompanyClassification(page, pageSize)
                                    .map(this::parsePageChunk)
                                    .map(chunk -> chunk.symbolSectorMap))
                            .reduce(new LinkedHashMap<>(first.symbolSectorMap), (acc, pageMap) -> {
                                acc.putAll(pageMap);
                                return acc;
                            });
                });
    }

    private Mono<LinkedHashMap<String, String>> fetchSectorMapFromCompanyList() {
        return nepseService.getCompanyList().map(this::parseCompanyListSectors);
    }

    private void loadSnapshotFromDisk() {
        Path path = Path.of(snapshotFile);

        if (!Files.exists(path)) {
            log.info("company sectors snapshot file not found path {}", path.toAbsolutePath());
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(Files.readString(path));
            JsonNode sectorsNode = root.path("sectors");

            if (!sectorsNode.isObject()) {
                log.warn("company sectors snapshot file has no sectors object path {}", path.toAbsolutePath());
                return;
            }

            LinkedHashMap<String, String> sectors = new LinkedHashMap<>();
            sectorsNode.fieldNames().forEachRemaining(symbolKey -> {
                String symbol = safeText(symbolKey);
                String sector = safeText(sectorsNode.path(symbolKey).asText(null));

                if (!symbol.isBlank() && !sector.isBlank()) {
                    sectors.put(symbol, sector);
                }
            });

            if (sectors.isEmpty()) {
                log.warn("company sectors snapshot file parsed empty sectors path {}", path.toAbsolutePath());
                return;
            }

            String updatedAt = safeText(root.path("updatedAt").asText(null));
            String source = safeText(root.path("source").asText(null));
            int loadedPageSize = root.path("pageSize").asInt(pageSize);

            SectorSnapshot snapshot = new SectorSnapshot(
                    updatedAt.isBlank() ? Instant.now().toString() : updatedAt,
                    source.isBlank() ? SOURCE_ENDPOINT : source,
                    loadedPageSize,
                    sectors
            );

            snapshotRef.set(snapshot);
            log.info("company sectors snapshot loaded from disk totalScrips {}", snapshot.totalScrips());
        } catch (IOException error) {
            log.warn("company sectors snapshot load failed {}", error.getMessage());
        }
    }

    private void writeSnapshotToDisk(SectorSnapshot snapshot) {
        Path path = Path.of(snapshotFile);

        try {
            Path parent = path.getParent();

            if (parent != null) {
                Files.createDirectories(parent);
            }

            String json = objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(snapshot.toPayload());

            Files.writeString(path, json);
        } catch (IOException error) {
            log.warn("company sectors snapshot write failed {}", error.getMessage());
        }
    }

    private PageChunk parsePageChunk(Object raw) {
        JsonNode node = objectMapper.valueToTree(raw);

        if (node.path("error").asBoolean(false)) {
            throw new IllegalStateException("nepse classification endpoint returned error payload");
        }

        if (node.isNull() || node.isMissingNode() || (node.isObject() && node.isEmpty())) {
            throw new IllegalStateException("nepse classification endpoint returned empty payload");
        }

        JsonNode content = node.path("content");

        if (!content.isArray()) {
            if (node.isArray()) {
                content = node;
            } else {
                throw new IllegalStateException("unexpected company classification response shape");
            }
        }

        LinkedHashMap<String, String> symbolSectorMap = new LinkedHashMap<>();

        for (JsonNode row : content) {
            String symbol = safeText(row.path("symbol").asText(null));

            if (symbol.isBlank()) {
                continue;
            }

            String sector = safeText(
                    row.path("companyId").path("sectorMaster").path("sectorDescription").asText(null)
            );

            if (sector.isBlank()) {
                sector = safeText(row.path("sectorName").asText(null));
            }

            if (sector.isBlank()) {
                sector = safeText(row.path("sector").asText(null));
            }

            if (!sector.isBlank()) {
                symbolSectorMap.put(symbol.toUpperCase(), sector);
            }
        }

        int totalPages = node.path("totalPages").asInt(1);

        return new PageChunk(totalPages, symbolSectorMap);
    }

    private LinkedHashMap<String, String> parseCompanyListSectors(Object raw) {
        JsonNode node = objectMapper.valueToTree(raw);

        if (node.path("error").asBoolean(false)) {
            throw new IllegalStateException("nepse company list endpoint returned error payload");
        }

        if (!node.isArray()) {
            throw new IllegalStateException("unexpected company list response shape");
        }

        LinkedHashMap<String, String> symbolSectorMap = new LinkedHashMap<>();

        for (JsonNode row : node) {
            String symbol = safeText(row.path("symbol").asText(null));
            String sector = safeText(row.path("sectorName").asText(null));

            if (!symbol.isBlank() && !sector.isBlank()) {
                symbolSectorMap.put(symbol.toUpperCase(), sector);
            }
        }

        return symbolSectorMap;
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private record PageChunk(
            int totalPages,
            LinkedHashMap<String, String> symbolSectorMap
    ) {
    }

    private record SectorSnapshot(
            String updatedAt,
            String source,
            int pageSize,
            LinkedHashMap<String, String> sectors
    ) {
        static SectorSnapshot empty() {
            return new SectorSnapshot(
                    Instant.EPOCH.toString(),
                    SOURCE_ENDPOINT,
                    0,
                    new LinkedHashMap<>()
            );
        }

        int totalScrips() {
            return sectors.size();
        }

        Map<String, Object> toPayload() {
            LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
            payload.put("updatedAt", updatedAt);
            payload.put("source", source);
            payload.put("pageSize", pageSize);
            payload.put("totalScrips", totalScrips());
            payload.put("sectors", sectors);
            return payload;
        }
    }
}