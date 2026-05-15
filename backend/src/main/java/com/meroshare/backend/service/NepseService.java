package com.meroshare.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Service
public class NepseService {

    private static final Logger logger = LoggerFactory.getLogger(NepseService.class);

    private final WebClient webClient;

    public NepseService(
            @Value("${nepse.api.base-url:http://localhost:8000}") String nepseBaseUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(nepseBaseUrl)
                .build();
    }

    // ── Live Market ───────────────────────────────────────────────────────────

    public Mono<Object> getLiveMarket() {
        return get("/LiveMarket");
    }

    public Mono<Object> getNepseIndex() {
        return get("/NepseIndex");
    }

    public Mono<Object> getNepseSubIndices() {
        return get("/NepseSubIndices");
    }

    public Mono<Object> getSummary() {
        return get("/Summary");
    }

    public Mono<Object> isNepseOpen() {
        return get("/IsNepseOpen");
    }

    // ── Top Gainers & Losers ─────────────────────────────────────────────────

    public Mono<Object> getTopGainers() {
        return get("/TopGainers");
    }

    public Mono<Object> getTopLosers() {
        return get("/TopLosers");
    }

    public Mono<Object> getTopTenTurnoverScrips() {
        return get("/TopTenTurnoverScrips");
    }

    public Mono<Object> getTopTenTradeScrips() {
        return get("/TopTenTradeScrips");
    }

    public Mono<Object> getTopTenTransactionScrips() {
        return get("/TopTenTransactionScrips");
    }

    public Mono<Object> getSupplyDemand() {
        return get("/SupplyDemand");
    }

    // ── Company Details / Price History ──────────────────────────────────────

    public Mono<Object> getCompanyList() {
        return get("/CompanyList");
    }

    public Mono<Object> getCompanyDetails(String symbol) {
        return get("/CompanyDetails?symbol=" + symbol);
    }

    public Mono<Object> getPriceVolume() {
        return get("/PriceVolume");
    }

    public Mono<Object> getPriceVolumeHistory(String symbol) {
        return get("/PriceVolumeHistory?symbol=" + symbol);
    }

    public Mono<Object> getDailyScripPriceGraph(String symbol) {
        return get("/DailyScripPriceGraph?symbol=" + symbol);
    }

    public Mono<Object> getMarketDepth(String symbol) {
        return get("/MarketDepth?symbol=" + symbol);
    }

    public Mono<Object> getSectorScrips() {
        return get("/SectorScrips");
    }

    public Mono<Object> getSecurityList() {
        return get("/SecurityList");
    }

    public Mono<Object> getTradeTurnoverTransactionSubindices() {
        return get("/TradeTurnoverTransactionSubindices");
    }

    // ── Floorsheet ────────────────────────────────────────────────────────────

    public Mono<Object> getFloorsheet() {
        return get("/Floorsheet");
    }

    public Mono<Object> getFloorsheetOf(String symbol) {
        return get("/FloorsheetOf?symbol=" + symbol);
    }

    // ── Index Graphs ──────────────────────────────────────────────────────────

    public Mono<Object> getDailyNepseIndexGraph() {
        return get("/DailyNepseIndexGraph");
    }

    public Mono<Object> getDailySensitiveIndexGraph() {
        return get("/DailySensitiveIndexGraph");
    }

    public Mono<Object> getDailyFloatIndexGraph() {
        return get("/DailyFloatIndexGraph");
    }

    public Mono<Object> getDailySensitiveFloatIndexGraph() {
        return get("/DailySensitiveFloatIndexGraph");
    }

    // ── Sector Subindex Graphs ────────────────────────────────────────────────

    public Mono<Object> getDailyBankSubindexGraph() {
        return get("/DailyBankSubindexGraph");
    }

    public Mono<Object> getDailyDevelopmentBankSubindexGraph() {
        return get("/DailyDevelopmentBankSubindexGraph");
    }

    public Mono<Object> getDailyFinanceSubindexGraph() {
        return get("/DailyFinanceSubindexGraph");
    }

    public Mono<Object> getDailyHotelTourismSubindexGraph() {
        return get("/DailyHotelTourismSubindexGraph");
    }

    public Mono<Object> getDailyHydroPowerSubindexGraph() {
        return get("/DailyHydroPowerSubindexGraph");
    }

    public Mono<Object> getDailyInvestmentSubindexGraph() {
        return get("/DailyInvestmentSubindexGraph");
    }

    public Mono<Object> getDailyLifeInsuranceSubindexGraph() {
        return get("/DailyLifeInsuranceSubindexGraph");
    }

    public Mono<Object> getDailyManufacturingProcessingSubindexGraph() {
        return get("/DailyManufacturingProcessingSubindexGraph");
    }

    public Mono<Object> getDailyMicrofinanceSubindexGraph() {
        return get("/DailyMicrofinanceSubindexGraph");
    }

    public Mono<Object> getDailyMutualFundSubindexGraph() {
        return get("/DailyMutualFundSubindexGraph");
    }

    public Mono<Object> getDailyNonLifeInsuranceSubindexGraph() {
        return get("/DailyNonLifeInsuranceSubindexGraph");
    }

    public Mono<Object> getDailyOthersSubindexGraph() {
        return get("/DailyOthersSubindexGraph");
    }

    public Mono<Object> getDailyTradingSubindexGraph() {
        return get("/DailyTradingSubindexGraph");
    }

    // ── Internal helper ───────────────────────────────────────────────────────

    private Mono<Object> get(String path) {
        return webClient.get()
                .uri(path)
                .retrieve()
                .bodyToMono(Object.class)
                .doOnError(WebClientResponseException.class, e ->
                        logger.error("NEPSE API error [{}]: {} - {}", path, e.getStatusCode(), e.getResponseBodyAsString()))
                .doOnError(Exception.class, e ->
                        logger.error("NEPSE API connection error [{}]: {}", path, e.getMessage()));
    }
}