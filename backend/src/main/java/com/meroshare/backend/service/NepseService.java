package com.meroshare.backend.service;

import com.meroshare.backend.service.nepse.NepseClient;
import com.meroshare.backend.service.nepse.NepseDummyIdManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

/**
 * NEPSE market data service.
 * Calls nepalstock.com directly — no Python sidecar required.
 *
 * Base URL  : https://www.nepalstock.com
 * Auth      : Authorization: Salter <token>  (managed by NepseTokenManager)
 * GET calls : plain GET with auth header
 * POST calls: POST with JSON body {"id": <payloadId>} where payloadId is
 *             derived from salts + dummyId + today's date
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

    private final NepseClient         client;
    private final NepseDummyIdManager dummyIdManager;
    private final ObjectMapper        mapper = new ObjectMapper();

    public NepseService(NepseClient client, NepseDummyIdManager dummyIdManager) {
        this.client         = client;
        this.dummyIdManager = dummyIdManager;
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

    public Mono<Object> getLiveMarket()      { return client.get(LIVE_MARKET_URL); }
    public Mono<Object> getNepseIndex()      { return client.get(NEPSE_INDEX_URL).map(this::indexArrayToMap); }
    public Mono<Object> getNepseSubIndices() { return client.get(NEPSE_SUBINDICES_URL).map(this::indexArrayToMap); }
    public Mono<Object> getSummary()         { return client.get(SUMMARY_URL).map(this::summaryArrayToMap); }
    public Mono<Object> isNepseOpen()        { return client.get(NEPSE_OPEN_URL); }

    // ── Gainers / Losers / Top scrips ─────────────────────────────────────────

    public Mono<Object> getTopGainers()            { return client.get(TOP_GAINERS_URL); }
    public Mono<Object> getTopLosers()             { return client.get(TOP_LOSERS_URL); }
    public Mono<Object> getTopTenTurnoverScrips()  { return client.get(TOP_TEN_TURNOVER_URL); }
    public Mono<Object> getTopTenTradeScrips()     { return client.get(TOP_TEN_TRADE_URL); }
    public Mono<Object> getTopTenTransactionScrips(){ return client.get(TOP_TEN_TRANSACTION_URL); }
    public Mono<Object> getSupplyDemand()          { return client.get(SUPPLY_DEMAND_URL); }

    // ── Company / Security ────────────────────────────────────────────────────

    public Mono<Object> getCompanyList()  { return client.get(COMPANY_LIST_URL); }
    public Mono<Object> getSecurityList() { return client.get(SECURITY_LIST_URL); }
    public Mono<Object> getPriceVolume()  { return client.get(PRICE_VOLUME_URL); }

    public Mono<Object> getCompanyDetails(long companyId) {
        return postWithScripPayload(COMPANY_DETAILS + companyId);
    }

    public Mono<Object> getDailyScripPriceGraph(long companyId) {
        return postWithScripPayload(COMPANY_DAILY_GRAPH + companyId);
    }

    public Mono<Object> getCompanyPriceVolumeHistory(long companyId, String startDate, String endDate) {
        return client.get(COMPANY_PRICE_VOL_HIST + companyId
                + "?&size=500&startDate=" + startDate + "&endDate=" + endDate);
    }

    public Mono<Object> getMarketDepth(long companyId) {
        return client.get(MARKET_DEPTH + companyId + "/");
    }

    // ── Floorsheet ────────────────────────────────────────────────────────────

    public Mono<Object> getFloorSheet() {
        return postWithFloorsheetPayload(FLOOR_SHEET + "?&size=500&sort=contractId,desc");
    }

    public Mono<Object> getFloorSheetOf(long companyId) {
        String today = LocalDate.now().toString();
        return postWithFloorsheetPayload(COMPANY_FLOORSHEET + companyId
                + "?&businessDate=" + today + "&size=500&sort=contractid,desc");
    }

    // ── Index graphs ──────────────────────────────────────────────────────────

    public Mono<Object> getDailyNepseIndexGraph()                    { return postWithPayload(NEPSE_INDEX_GRAPH); }
    public Mono<Object> getDailySensitiveIndexGraph()                { return postWithPayload(SENSITIVE_INDEX_GRAPH); }
    public Mono<Object> getDailyFloatIndexGraph()                    { return postWithPayload(FLOAT_INDEX_GRAPH); }
    public Mono<Object> getDailySensitiveFloatIndexGraph()           { return postWithPayload(SENSITIVE_FLOAT_GRAPH); }
    public Mono<Object> getDailyBankSubindexGraph()                  { return postWithPayload(BANK_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyDevelopmentBankSubindexGraph()       { return postWithPayload(DEV_BANK_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyFinanceSubindexGraph()               { return postWithPayload(FINANCE_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyHotelTourismSubindexGraph()          { return postWithPayload(HOTEL_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyHydroPowerSubindexGraph()            { return postWithPayload(HYDRO_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyInvestmentSubindexGraph()            { return postWithPayload(INVESTMENT_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyLifeInsuranceSubindexGraph()         { return postWithPayload(LIFE_INS_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyManufacturingProcessingSubindexGraph(){ return postWithPayload(MANUF_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyMicrofinanceSubindexGraph()          { return postWithPayload(MICROFINANCE_GRAPH); }
    public Mono<Object> getDailyMutualFundSubindexGraph()            { return postWithPayload(MUTUAL_FUND_GRAPH); }
    public Mono<Object> getDailyNonLifeInsuranceSubindexGraph()      { return postWithPayload(NON_LIFE_INS_GRAPH); }
    public Mono<Object> getDailyOthersSubindexGraph()                { return postWithPayload(OTHERS_SUBINDEX_GRAPH); }
    public Mono<Object> getDailyTradingSubindexGraph()               { return postWithPayload(TRADING_SUBINDEX_GRAPH); }

    // ── Response transformers (mirror Python server's reshaping) ─────────────

    /** [{detail:"Total Turnover Rs:", value:123}, ...] → {"Total Turnover Rs:": 123, ...} */
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

    /** [{index:"NEPSE", ...}, ...] → {"NEPSE": {...}, ...} */
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