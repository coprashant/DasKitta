package com.meroshare.backend.service;

import com.meroshare.backend.service.nepse.NepseClient;
import com.meroshare.backend.service.nepse.NepseDummyIdManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDate;

/**
 * NEPSE market data service.
 * Calls nepalstock.com directly, no Python sidecar required.
 *
 * Base URL  : https://www.nepalstock.com
 * Auth      : Authorization: Salter <token>  (managed by NepseTokenManager)
 * GET calls : plain GET with auth header
 * POST calls: POST with JSON body {"id": <payloadId>} where payloadId is
 *             derived from salts + dummyId + today's date
 *
 * Responses are cached in Redis using a cache aside pattern. Most endpoints
 * use a short TTL since market data changes constantly. The security list
 * is closer to static metadata so it uses a much longer TTL.
 */
@Service
public class NepseService {

    // ── API endpoint paths ────────────────────────────────────────────────────
    private static final String PRICE_VOLUME_URL          = "/api/nots/securityDailyTradeStat/58";
    private static final String SUMMARY_URL               = "/api/nots/market-summary/";
    private static final String SUPPLY_DEMAND_URL         = "/api/nots/nepse-data/supplydemand";
    private static final String TOP_GAINERS_URL           = "/api/nots/top-ten/top-gainer";
    private static final String TOP_LOSERS_URL            = "/api/nots/top-ten/top-loser";
    private static final String TOP_TEN_TRADE_URL         = "/api/nots/top-ten/trade";
    private static final String TOP_TEN_TRANSACTION_URL   = "/api/nots/top-ten/transaction";
    private static final String TOP_TEN_TURNOVER_URL      = "/api/nots/top-ten/turnover";
    private static final String NEPSE_OPEN_URL            = "/api/nots/nepse-data/market-open";
    private static final String NEPSE_INDEX_URL           = "/api/nots/nepse-index";
    private static final String NEPSE_SUBINDICES_URL      = "/api/nots";
    private static final String COMPANY_LIST_URL          = "/api/nots/company/list";
    private static final String SECURITY_LIST_URL         = "/api/nots/security?nonDelisted=true";
    private static final String LIVE_MARKET_URL           = "/api/nots/lives-market";

    // Graph endpoints (POST)
    private static final String NEPSE_INDEX_GRAPH         = "/api/nots/graph/index/58";
    private static final String SENSITIVE_INDEX_GRAPH     = "/api/nots/graph/index/57";
    private static final String FLOAT_INDEX_GRAPH         = "/api/nots/graph/index/62";
    private static final String SENSITIVE_FLOAT_GRAPH     = "/api/nots/graph/index/63";
    private static final String BANK_SUBINDEX_GRAPH       = "/api/nots/graph/index/51";
    private static final String DEV_BANK_SUBINDEX_GRAPH   = "/api/nots/graph/index/55";
    private static final String FINANCE_SUBINDEX_GRAPH    = "/api/nots/graph/index/60";
    private static final String HOTEL_SUBINDEX_GRAPH      = "/api/nots/graph/index/52";
    private static final String HYDRO_SUBINDEX_GRAPH      = "/api/nots/graph/index/54";
    private static final String INVESTMENT_SUBINDEX_GRAPH = "/api/nots/graph/index/67";
    private static final String LIFE_INS_SUBINDEX_GRAPH   = "/api/nots/graph/index/65";
    private static final String MANUF_SUBINDEX_GRAPH      = "/api/nots/graph/index/56";
    private static final String MICROFINANCE_GRAPH        = "/api/nots/graph/index/64";
    private static final String MUTUAL_FUND_GRAPH         = "/api/nots/graph/index/66";
    private static final String NON_LIFE_INS_GRAPH        = "/api/nots/graph/index/59";
    private static final String OTHERS_SUBINDEX_GRAPH     = "/api/nots/graph/index/53";
    private static final String TRADING_SUBINDEX_GRAPH    = "/api/nots/graph/index/61";

    // Company-specific endpoints (POST, need company ID suffix)
    private static final String COMPANY_DAILY_GRAPH       = "/api/nots/market/graphdata/daily/";
    private static final String COMPANY_DETAILS           = "/api/nots/security/";
    private static final String COMPANY_PRICE_VOL_HIST    = "/api/nots/market/history/security/";
    private static final String COMPANY_FLOORSHEET        = "/api/nots/security/floorsheet/";
    private static final String FLOOR_SHEET               = "/api/nots/nepse-data/floorsheet";
    private static final String MARKET_DEPTH              = "/api/nots/nepse-data/marketdepth/";

    // Redis cache key prefix and namespaces
    private static final String CACHE_PREFIX = "nepse:";

    private final NepseClient         client;
    private final NepseDummyIdManager dummyIdManager;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper        mapper = new ObjectMapper();

    private final Duration liveTtl;
    private final Duration staticTtl;

    public NepseService(NepseClient client,
                        NepseDummyIdManager dummyIdManager,
                        ReactiveRedisTemplate<String, Object> redisTemplate,
                        @Value("${cache.nepse.live-ttl-seconds:10}") long liveTtlSeconds,
                        @Value("${cache.cdsc.static-ttl-hours:24}") long staticTtlHours) {
        this.client         = client;
        this.dummyIdManager = dummyIdManager;
        this.redisTemplate  = redisTemplate;
        this.liveTtl        = Duration.ofSeconds(liveTtlSeconds);
        this.staticTtl      = Duration.ofHours(staticTtlHours);
    }

    // ── Cache aside helper ───────────────────────────────────────────────────

    // Reads from redis first. On a miss, subscribes to the loader, stores the
    // result with the given ttl, then returns it
    private Mono<Object> cached(String cacheKey, Duration ttl, Mono<Object> loader) {
        String key = CACHE_PREFIX + cacheKey;
        return redisTemplate.opsForValue().get(key)
                .switchIfEmpty(Mono.defer(() -> loader.flatMap(value ->
                        redisTemplate.opsForValue().set(key, value, ttl).thenReturn(value))));
    }

    private Mono<Object> cachedLive(String cacheKey, Mono<Object> loader) {
        return cached(cacheKey, liveTtl, loader);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Mono<Object> postWithPayload(String path) {
        NepseDummyIdManager.DummyEntry e = dummyIdManager.getDummyEntry();
        return client.post(path, client.getPostPayloadId(e.id(), e.value()));
    }

    private Mono<Object> postWithScripPayload(String path) {
        NepseDummyIdManager.DummyEntry e = dummyIdManager.getDummyEntry();
        return client.post(path, client.getPostPayloadIdForScrips(e.id(), e.value()));
    }

    private Mono<Object> postWithFloorsheetPayload(String path) {
        NepseDummyIdManager.DummyEntry e = dummyIdManager.getDummyEntry();
        return client.post(path, client.getPostPayloadIdForFloorSheet(e.id(), e.value()));
    }

    // ── Live Market ───────────────────────────────────────────────────────────

    public Mono<Object> getLiveMarket() {
        return cachedLive("live-market", client.get(LIVE_MARKET_URL));
    }

    public Mono<Object> getNepseIndex() {
        return cachedLive("index", client.get(NEPSE_INDEX_URL).map(this::indexArrayToMap));
    }

    public Mono<Object> getNepseSubIndices() {
        return cachedLive("sub-indices", client.get(NEPSE_SUBINDICES_URL).map(this::indexArrayToMap));
    }

    public Mono<Object> getSummary() {
        return cachedLive("summary", client.get(SUMMARY_URL).map(this::summaryArrayToMap));
    }

    public Mono<Object> isNepseOpen() {
        return cachedLive("is-open", client.get(NEPSE_OPEN_URL));
    }

    // ── Gainers / Losers / Top scrips ─────────────────────────────────────────

    public Mono<Object> getTopGainers() {
        return cachedLive("top-gainers", client.get(TOP_GAINERS_URL));
    }

    public Mono<Object> getTopLosers() {
        return cachedLive("top-losers", client.get(TOP_LOSERS_URL));
    }

    public Mono<Object> getTopTenTurnoverScrips() {
        return cachedLive("top-turnover", client.get(TOP_TEN_TURNOVER_URL));
    }

    public Mono<Object> getTopTenTradeScrips() {
        return cachedLive("top-trade", client.get(TOP_TEN_TRADE_URL));
    }

    public Mono<Object> getTopTenTransactionScrips() {
        return cachedLive("top-transaction", client.get(TOP_TEN_TRANSACTION_URL));
    }

    public Mono<Object> getSupplyDemand() {
        return cachedLive("supply-demand", client.get(SUPPLY_DEMAND_URL));
    }

    // ── Company / Security ────────────────────────────────────────────────────

    public Mono<Object> getCompanyList() {
        return cachedLive("companies", client.get(COMPANY_LIST_URL));
    }

    // Security list is treated as static CDSC style metadata, long ttl
    public Mono<Object> getSecurityList() {
        return cached("security-list", staticTtl, client.get(SECURITY_LIST_URL));
    }

    public Mono<Object> getPriceVolume() {
        return cachedLive("price-volume", client.get(PRICE_VOLUME_URL));
    }

    public Mono<Object> getCompanyDetails(long companyId) {
        return cachedLive("company-details:" + companyId, postWithScripPayload(COMPANY_DETAILS + companyId));
    }

    public Mono<Object> getDailyScripPriceGraph(long companyId) {
        return cachedLive("scrip-price-graph:" + companyId, postWithScripPayload(COMPANY_DAILY_GRAPH + companyId));
    }

    public Mono<Object> getCompanyPriceVolumeHistory(long companyId, String startDate, String endDate) {
        String key = "price-volume-history:" + companyId + ":" + startDate + ":" + endDate;
        return cachedLive(key, client.get(COMPANY_PRICE_VOL_HIST + companyId
                + "?&size=500&startDate=" + startDate + "&endDate=" + endDate));
    }

    public Mono<Object> getMarketDepth(long companyId) {
        return cachedLive("market-depth:" + companyId, client.get(MARKET_DEPTH + companyId + "/"));
    }

    // ── Floorsheet ────────────────────────────────────────────────────────────

    public Mono<Object> getFloorSheet() {
        return cachedLive("floorsheet", postWithFloorsheetPayload(FLOOR_SHEET + "?&size=500&sort=contractId,desc"));
    }

    public Mono<Object> getFloorSheetOf(long companyId) {
        String today = LocalDate.now().toString();
        return cachedLive("floorsheet:" + companyId + ":" + today,
                postWithFloorsheetPayload(COMPANY_FLOORSHEET + companyId
                        + "?&businessDate=" + today + "&size=500&sort=contractid,desc"));
    }

    // ── Index graphs ──────────────────────────────────────────────────────────

    public Mono<Object> getDailyNepseIndexGraph() {
        return cachedLive("graph:nepse", postWithPayload(NEPSE_INDEX_GRAPH));
    }

    public Mono<Object> getDailySensitiveIndexGraph() {
        return cachedLive("graph:sensitive", postWithPayload(SENSITIVE_INDEX_GRAPH));
    }

    public Mono<Object> getDailyFloatIndexGraph() {
        return cachedLive("graph:float", postWithPayload(FLOAT_INDEX_GRAPH));
    }

    public Mono<Object> getDailySensitiveFloatIndexGraph() {
        return cachedLive("graph:sensitive-float", postWithPayload(SENSITIVE_FLOAT_GRAPH));
    }

    public Mono<Object> getDailyBankSubindexGraph() {
        return cachedLive("graph:bank", postWithPayload(BANK_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyDevelopmentBankSubindexGraph() {
        return cachedLive("graph:dev-bank", postWithPayload(DEV_BANK_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyFinanceSubindexGraph() {
        return cachedLive("graph:finance", postWithPayload(FINANCE_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyHotelTourismSubindexGraph() {
        return cachedLive("graph:hotel-tourism", postWithPayload(HOTEL_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyHydroPowerSubindexGraph() {
        return cachedLive("graph:hydro-power", postWithPayload(HYDRO_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyInvestmentSubindexGraph() {
        return cachedLive("graph:investment", postWithPayload(INVESTMENT_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyLifeInsuranceSubindexGraph() {
        return cachedLive("graph:life-insurance", postWithPayload(LIFE_INS_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyManufacturingProcessingSubindexGraph() {
        return cachedLive("graph:manufacturing", postWithPayload(MANUF_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyMicrofinanceSubindexGraph() {
        return cachedLive("graph:microfinance", postWithPayload(MICROFINANCE_GRAPH));
    }

    public Mono<Object> getDailyMutualFundSubindexGraph() {
        return cachedLive("graph:mutual-fund", postWithPayload(MUTUAL_FUND_GRAPH));
    }

    public Mono<Object> getDailyNonLifeInsuranceSubindexGraph() {
        return cachedLive("graph:non-life-insurance", postWithPayload(NON_LIFE_INS_GRAPH));
    }

    public Mono<Object> getDailyOthersSubindexGraph() {
        return cachedLive("graph:others", postWithPayload(OTHERS_SUBINDEX_GRAPH));
    }

    public Mono<Object> getDailyTradingSubindexGraph() {
        return cachedLive("graph:trading", postWithPayload(TRADING_SUBINDEX_GRAPH));
    }

    // ── Response transformers (mirror Python server's reshaping) ─────────────

    /** [{detail:"Total Turnover Rs:", value:123}, ...] converts to {"Total Turnover Rs:": 123, ...} */
    private Object summaryArrayToMap(Object raw) {
        try {
            JsonNode array = mapper.valueToTree(raw);
            ObjectNode result = mapper.createObjectNode();
            if (array.isArray()) {
                for (JsonNode item : array) {
                    String key = item.path("detail").asText();
                    JsonNode val = item.get("value");
                    if (!key.isEmpty() && val != null) result.set(key, val);
                }
            }
            return result;
        } catch (Exception e) { return raw; }
    }

    /** [{index:"NEPSE", ...}, ...] converts to {"NEPSE": {...}, ...} */
    private Object indexArrayToMap(Object raw) {
        try {
            JsonNode array = mapper.valueToTree(raw);
            ObjectNode result = mapper.createObjectNode();
            if (array.isArray()) {
                for (JsonNode item : array) {
                    String key = item.path("index").asText();
                    if (!key.isEmpty()) result.set(key, item);
                }
            }
            return result;
        } catch (Exception e) { return raw; }
    }
}