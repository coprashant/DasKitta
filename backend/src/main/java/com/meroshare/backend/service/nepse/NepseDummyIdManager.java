package com.meroshare.backend.service.nepse;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class NepseDummyIdManager {

    private static final Logger log = LoggerFactory.getLogger(NepseDummyIdManager.class);

    private final List<Integer> dummyData;
    private final NepseClient   client;
    private final ReentrantLock lock   = new ReentrantLock();
    private final ObjectMapper  mapper = new ObjectMapper();

    private int       dummyId   = -1;
    private LocalDate dateStamp = null;

    public NepseDummyIdManager(NepseClient client) {
        this.client    = client;
        this.dummyData = loadDummyData();
    }

    public DummyEntry getDummyEntry() {
        ensurePopulated();
        int id    = dummyId;
        int value = dummyData.get(id % dummyData.size());
        return new DummyEntry(id, value);
    }

    public record DummyEntry(int id, int value) {}

    private void ensurePopulated() {
        LocalDate today = LocalDate.now();
        if (dummyId >= 0 && today.equals(dateStamp)) return;
        lock.lock();
        try {
            if (dummyId >= 0 && today.equals(dateStamp)) return;
            log.info("[NEPSE] Refreshing dummy ID...");
            fetchAndUpdate(today);
        } finally {
            lock.unlock();
        }
    }

    private void fetchAndUpdate(LocalDate today) {
        try {
            String   json     = client.getRaw("/api/nots/nepse-data/market-open");
            JsonNode node     = mapper.readTree(json);
            int      newId    = node.get("id").asInt();
            String   asOfStr  = node.has("asOf") ? node.get("asOf").asText() : null;

            if (asOfStr != null) {
                // truncate to seconds to handle any length of fractional seconds
                String truncated = asOfStr.length() > 19 ? asOfStr.substring(0, 19) : asOfStr;
                LocalDateTime asOf = LocalDateTime.parse(truncated);
                this.dateStamp = asOf.toLocalDate().equals(today) ? asOf.toLocalDate() : today;
            } else {
                this.dateStamp = today;
            }

            this.dummyId = newId;
            log.info("[NEPSE] Dummy ID updated to {} (stamp: {})", dummyId, dateStamp);

        } catch (Exception e) {
            log.error("[NEPSE] Failed to fetch dummy ID: {}. Using fallback id=1.", e.getMessage());
            this.dummyId   = 1;
            this.dateStamp = today;
        }
    }

    private List<Integer> loadDummyData() {
        try (InputStream is = getClass().getResourceAsStream("/nepse/DUMMY_DATA.json")) {
            if (is != null) {
                return new ObjectMapper().readValue(is, new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("[NEPSE] Error reading DUMMY_DATA.json: {}", e.getMessage());
        }
        log.warn("[NEPSE] Using hardcoded DUMMY_DATA");
        return List.of(
            147, 117, 239, 143, 157, 312, 161, 612, 512, 804,
            411, 527, 170, 511, 421, 667, 764, 621, 301, 106,
            133, 793, 411, 511, 312, 423, 344, 346, 653, 758,
            342, 222, 236, 811, 711, 611, 122, 447, 128, 199,
            183, 135, 489, 703, 800, 745, 152, 863, 134, 211,
            142, 564, 375, 793, 212, 153, 138, 153, 648, 611,
            151, 649, 318, 143, 117, 756, 119, 141, 717, 113,
            112, 146, 162, 660, 693, 261, 362, 354, 251, 641,
            157, 178, 631, 192, 734, 445, 192, 883, 187, 122,
            591, 731, 852, 384, 565, 596, 451, 772, 624, 691
        );
    }
}