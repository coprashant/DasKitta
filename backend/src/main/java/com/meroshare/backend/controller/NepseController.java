package com.meroshare.backend.controller;

import com.meroshare.backend.service.NepseService;
import com.meroshare.backend.service.nepse.CompanySectorSnapshotService;
import com.meroshare.backend.service.nepse.NepseSymbolResolver;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/nepse")
public class NepseController {

    private static final CacheControl LIVE_CACHE = CacheControl.maxAge(10, TimeUnit.SECONDS)
        .cachePublic();
    private static final CacheControl STATIC_CACHE = CacheControl.maxAge(1, TimeUnit.HOURS)
        .cachePublic();

    private final NepseService       nepseService;
    private final CompanySectorSnapshotService companySectorSnapshotService;
    private final NepseSymbolResolver symbolResolver;

    public NepseController(
            NepseService nepseService,
            CompanySectorSnapshotService companySectorSnapshotService,
            NepseSymbolResolver symbolResolver) {
        this.nepseService   = nepseService;
        this.companySectorSnapshotService = companySectorSnapshotService;
        this.symbolResolver = symbolResolver;
    }

    // Live Market

    private ResponseEntity<Object> liveResponse(Object body) {
        return ResponseEntity.ok()
                .cacheControl(LIVE_CACHE)
                .body(body);
    }

    private ResponseEntity<Object> staticResponse(Object body) {
        return ResponseEntity.ok()
                .cacheControl(STATIC_CACHE)
                .body(body);
    }

    @GetMapping("/live-market")
    public Mono<ResponseEntity<Object>> getLiveMarket() {
        return nepseService.getLiveMarket().map(this::liveResponse);
    }

    @GetMapping("/index")
    public Mono<ResponseEntity<Object>> getNepseIndex() {
        return nepseService.getNepseIndex().map(this::liveResponse);
    }

    @GetMapping("/sub-indices")
    public Mono<ResponseEntity<Object>> getNepseSubIndices() {
        return nepseService.getNepseSubIndices().map(this::liveResponse);
    }

    @GetMapping("/summary")
    public Mono<ResponseEntity<Object>> getSummary() {
        return nepseService.getSummary().map(this::liveResponse);
    }

    @GetMapping("/is-open")
    public Mono<ResponseEntity<Object>> isNepseOpen() {
        return nepseService.isNepseOpen().map(this::liveResponse);
    }

    // Gainers Losers Top scrips

    @GetMapping("/top-gainers")
    public Mono<ResponseEntity<Object>> getTopGainers() {
        return nepseService.getTopGainers().map(this::liveResponse);
    }

    @GetMapping("/top-losers")
    public Mono<ResponseEntity<Object>> getTopLosers() {
        return nepseService.getTopLosers().map(this::liveResponse);
    }

    @GetMapping("/top-turnover")
    public Mono<ResponseEntity<Object>> getTopTurnover() {
        return nepseService.getTopTenTurnoverScrips().map(this::liveResponse);
    }

    @GetMapping("/top-trade")
    public Mono<ResponseEntity<Object>> getTopTrade() {
        return nepseService.getTopTenTradeScrips().map(this::liveResponse);
    }

    @GetMapping("/top-transaction")
    public Mono<ResponseEntity<Object>> getTopTransaction() {
        return nepseService.getTopTenTransactionScrips().map(this::liveResponse);
    }

    @GetMapping("/supply-demand")
    public Mono<ResponseEntity<Object>> getSupplyDemand() {
        return nepseService.getSupplyDemand().map(this::liveResponse);
    }

    // Company Security

    @GetMapping("/companies")
    public Mono<ResponseEntity<Object>> getCompanyList() {
        return nepseService.getCompanyList().map(this::liveResponse);
    }

    @GetMapping("/price-volume")
    public Mono<ResponseEntity<Object>> getPriceVolume() {
        return nepseService.getPriceVolume().map(this::liveResponse);
    }

    @GetMapping("/security-list")
    public Mono<ResponseEntity<Object>> getSecurityList() {
        return nepseService.getSecurityList().map(this::staticResponse);
    }

    // Classification, share groups, promoter shares, government bonds

    @GetMapping("/company-classification")
    public Mono<ResponseEntity<Object>> getCompanyClassification(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size) {
        return nepseService.getCompanyClassification(page, size).map(this::staticResponse);
    }

    @GetMapping("/company-sectors")
    public ResponseEntity<Object> getCompanySectorsSnapshot() {
        return staticResponse(companySectorSnapshotService.getSectorMapPayload());
    }

    @PostMapping("/company-sectors/refresh")
    public Mono<ResponseEntity<Object>> refreshCompanySectorsSnapshot() {
        return companySectorSnapshotService.refreshSnapshotNow().map(ResponseEntity::ok);
    }

    @GetMapping("/share-groups")
    public Mono<ResponseEntity<Object>> getShareGroups() {
        return nepseService.getShareGroups().map(this::staticResponse);
    }

    @GetMapping("/promoter-shares")
    public Mono<ResponseEntity<Object>> getPromoterShares(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return nepseService.getPromoterShares(page, size).map(this::staticResponse);
    }

    @GetMapping("/bonds/government")
    public Mono<ResponseEntity<Object>> getGovernmentBonds() {
        return nepseService.getGovernmentBonds().map(this::staticResponse);
    }

    // Symbol based endpoints resolve symbol to numeric id first

    @GetMapping("/company/details")
    public Mono<ResponseEntity<Object>> getCompanyDetails(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getCompanyDetails)
                .map(this::liveResponse);
    }

    @GetMapping("/scrip-price-graph")
    public Mono<ResponseEntity<Object>> getDailyScripPriceGraph(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getDailyScripPriceGraph)
                .map(this::liveResponse);
    }

    @GetMapping("/price-volume-history")
    public Mono<ResponseEntity<Object>> getPriceVolumeHistory(
            @RequestParam String symbol,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String end   = endDate   != null ? endDate   : LocalDate.now().toString();
        String start = startDate != null ? startDate : LocalDate.now().minusDays(365).toString();
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(id -> nepseService.getCompanyPriceVolumeHistory(id, start, end))
            .map(this::liveResponse);
    }

    @GetMapping("/market-depth")
    public Mono<ResponseEntity<Object>> getMarketDepth(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getMarketDepth)
                .map(this::liveResponse);
    }

    // Floorsheet

    @GetMapping("/floorsheet")
    public Mono<ResponseEntity<Object>> getFloorsheet() {
        return nepseService.getFloorSheet().map(this::liveResponse);
    }

    @GetMapping("/floorsheet/company")
    public Mono<ResponseEntity<Object>> getFloorsheetOf(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getFloorSheetOf)
                .map(this::liveResponse);
    }

    // Index Graphs

    @GetMapping("/graph/nepse")
    public Mono<ResponseEntity<Object>> getDailyNepseIndexGraph() {
        return nepseService.getDailyNepseIndexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/sensitive")
    public Mono<ResponseEntity<Object>> getDailySensitiveIndexGraph() {
        return nepseService.getDailySensitiveIndexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/float")
    public Mono<ResponseEntity<Object>> getDailyFloatIndexGraph() {
        return nepseService.getDailyFloatIndexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/sensitive-float")
    public Mono<ResponseEntity<Object>> getDailySensitiveFloatIndexGraph() {
        return nepseService.getDailySensitiveFloatIndexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/bank")
    public Mono<ResponseEntity<Object>> getDailyBankSubindexGraph() {
        return nepseService.getDailyBankSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/dev-bank")
    public Mono<ResponseEntity<Object>> getDailyDevBankSubindexGraph() {
        return nepseService.getDailyDevelopmentBankSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/finance")
    public Mono<ResponseEntity<Object>> getDailyFinanceSubindexGraph() {
        return nepseService.getDailyFinanceSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/hotel-tourism")
    public Mono<ResponseEntity<Object>> getDailyHotelTourismSubindexGraph() {
        return nepseService.getDailyHotelTourismSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/hydro-power")
    public Mono<ResponseEntity<Object>> getDailyHydroPowerSubindexGraph() {
        return nepseService.getDailyHydroPowerSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/investment")
    public Mono<ResponseEntity<Object>> getDailyInvestmentSubindexGraph() {
        return nepseService.getDailyInvestmentSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/life-insurance")
    public Mono<ResponseEntity<Object>> getDailyLifeInsuranceSubindexGraph() {
        return nepseService.getDailyLifeInsuranceSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/manufacturing")
    public Mono<ResponseEntity<Object>> getDailyManufacturingSubindexGraph() {
        return nepseService.getDailyManufacturingProcessingSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/microfinance")
    public Mono<ResponseEntity<Object>> getDailyMicrofinanceSubindexGraph() {
        return nepseService.getDailyMicrofinanceSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/mutual-fund")
    public Mono<ResponseEntity<Object>> getDailyMutualFundSubindexGraph() {
        return nepseService.getDailyMutualFundSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/non-life-insurance")
    public Mono<ResponseEntity<Object>> getDailyNonLifeInsuranceSubindexGraph() {
        return nepseService.getDailyNonLifeInsuranceSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/others")
    public Mono<ResponseEntity<Object>> getDailyOthersSubindexGraph() {
        return nepseService.getDailyOthersSubindexGraph().map(this::liveResponse);
    }

    @GetMapping("/graph/trading")
    public Mono<ResponseEntity<Object>> getDailyTradingSubindexGraph() {
        return nepseService.getDailyTradingSubindexGraph().map(this::liveResponse);
    }
}