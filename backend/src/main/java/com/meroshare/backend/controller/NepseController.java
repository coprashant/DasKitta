package com.meroshare.backend.controller;

import com.meroshare.backend.service.NepseService;
import com.meroshare.backend.service.nepse.NepseSymbolResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/nepse")
public class NepseController {

    private final NepseService       nepseService;
    private final NepseSymbolResolver symbolResolver;

    public NepseController(NepseService nepseService, NepseSymbolResolver symbolResolver) {
        this.nepseService   = nepseService;
        this.symbolResolver = symbolResolver;
    }

    // ── Live Market ───────────────────────────────────────────────────────────

    @GetMapping("/live-market")
    public Mono<ResponseEntity<Object>> getLiveMarket() {
        return nepseService.getLiveMarket().map(ResponseEntity::ok);
    }

    @GetMapping("/index")
    public Mono<ResponseEntity<Object>> getNepseIndex() {
        return nepseService.getNepseIndex().map(ResponseEntity::ok);
    }

    @GetMapping("/sub-indices")
    public Mono<ResponseEntity<Object>> getNepseSubIndices() {
        return nepseService.getNepseSubIndices().map(ResponseEntity::ok);
    }

    @GetMapping("/summary")
    public Mono<ResponseEntity<Object>> getSummary() {
        return nepseService.getSummary().map(ResponseEntity::ok);
    }

    @GetMapping("/is-open")
    public Mono<ResponseEntity<Object>> isNepseOpen() {
        return nepseService.isNepseOpen().map(ResponseEntity::ok);
    }

    // ── Gainers / Losers / Top scrips ─────────────────────────────────────────

    @GetMapping("/top-gainers")
    public Mono<ResponseEntity<Object>> getTopGainers() {
        return nepseService.getTopGainers().map(ResponseEntity::ok);
    }

    @GetMapping("/top-losers")
    public Mono<ResponseEntity<Object>> getTopLosers() {
        return nepseService.getTopLosers().map(ResponseEntity::ok);
    }

    @GetMapping("/top-turnover")
    public Mono<ResponseEntity<Object>> getTopTurnover() {
        return nepseService.getTopTenTurnoverScrips().map(ResponseEntity::ok);
    }

    @GetMapping("/top-trade")
    public Mono<ResponseEntity<Object>> getTopTrade() {
        return nepseService.getTopTenTradeScrips().map(ResponseEntity::ok);
    }

    @GetMapping("/top-transaction")
    public Mono<ResponseEntity<Object>> getTopTransaction() {
        return nepseService.getTopTenTransactionScrips().map(ResponseEntity::ok);
    }

    @GetMapping("/supply-demand")
    public Mono<ResponseEntity<Object>> getSupplyDemand() {
        return nepseService.getSupplyDemand().map(ResponseEntity::ok);
    }

    // ── Company / Security ────────────────────────────────────────────────────

    @GetMapping("/companies")
    public Mono<ResponseEntity<Object>> getCompanyList() {
        return nepseService.getCompanyList().map(ResponseEntity::ok);
    }

    @GetMapping("/price-volume")
    public Mono<ResponseEntity<Object>> getPriceVolume() {
        return nepseService.getPriceVolume().map(ResponseEntity::ok);
    }

    @GetMapping("/security-list")
    public Mono<ResponseEntity<Object>> getSecurityList() {
        return nepseService.getSecurityList().map(ResponseEntity::ok);
    }

    // Symbol-based endpoints: resolve symbol → numeric ID first

    @GetMapping("/company/details")
    public Mono<ResponseEntity<Object>> getCompanyDetails(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getCompanyDetails)
                .map(ResponseEntity::ok);
    }

    @GetMapping("/scrip-price-graph")
    public Mono<ResponseEntity<Object>> getDailyScripPriceGraph(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getDailyScripPriceGraph)
                .map(ResponseEntity::ok);
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
                .map(ResponseEntity::ok);
    }

    @GetMapping("/market-depth")
    public Mono<ResponseEntity<Object>> getMarketDepth(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getMarketDepth)
                .map(ResponseEntity::ok);
    }

    // ── Floorsheet ────────────────────────────────────────────────────────────

    @GetMapping("/floorsheet")
    public Mono<ResponseEntity<Object>> getFloorsheet() {
        return nepseService.getFloorSheet().map(ResponseEntity::ok);
    }

    @GetMapping("/floorsheet/company")
    public Mono<ResponseEntity<Object>> getFloorsheetOf(@RequestParam String symbol) {
        return symbolResolver.resolveSecurityId(symbol.toUpperCase())
                .flatMap(nepseService::getFloorSheetOf)
                .map(ResponseEntity::ok);
    }

    // ── Index Graphs ──────────────────────────────────────────────────────────

    @GetMapping("/graph/nepse")
    public Mono<ResponseEntity<Object>> getDailyNepseIndexGraph() {
        return nepseService.getDailyNepseIndexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/sensitive")
    public Mono<ResponseEntity<Object>> getDailySensitiveIndexGraph() {
        return nepseService.getDailySensitiveIndexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/float")
    public Mono<ResponseEntity<Object>> getDailyFloatIndexGraph() {
        return nepseService.getDailyFloatIndexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/sensitive-float")
    public Mono<ResponseEntity<Object>> getDailySensitiveFloatIndexGraph() {
        return nepseService.getDailySensitiveFloatIndexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/bank")
    public Mono<ResponseEntity<Object>> getDailyBankSubindexGraph() {
        return nepseService.getDailyBankSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/dev-bank")
    public Mono<ResponseEntity<Object>> getDailyDevBankSubindexGraph() {
        return nepseService.getDailyDevelopmentBankSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/finance")
    public Mono<ResponseEntity<Object>> getDailyFinanceSubindexGraph() {
        return nepseService.getDailyFinanceSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/hotel-tourism")
    public Mono<ResponseEntity<Object>> getDailyHotelTourismSubindexGraph() {
        return nepseService.getDailyHotelTourismSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/hydro-power")
    public Mono<ResponseEntity<Object>> getDailyHydroPowerSubindexGraph() {
        return nepseService.getDailyHydroPowerSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/investment")
    public Mono<ResponseEntity<Object>> getDailyInvestmentSubindexGraph() {
        return nepseService.getDailyInvestmentSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/life-insurance")
    public Mono<ResponseEntity<Object>> getDailyLifeInsuranceSubindexGraph() {
        return nepseService.getDailyLifeInsuranceSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/manufacturing")
    public Mono<ResponseEntity<Object>> getDailyManufacturingSubindexGraph() {
        return nepseService.getDailyManufacturingProcessingSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/microfinance")
    public Mono<ResponseEntity<Object>> getDailyMicrofinanceSubindexGraph() {
        return nepseService.getDailyMicrofinanceSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/mutual-fund")
    public Mono<ResponseEntity<Object>> getDailyMutualFundSubindexGraph() {
        return nepseService.getDailyMutualFundSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/non-life-insurance")
    public Mono<ResponseEntity<Object>> getDailyNonLifeInsuranceSubindexGraph() {
        return nepseService.getDailyNonLifeInsuranceSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/others")
    public Mono<ResponseEntity<Object>> getDailyOthersSubindexGraph() {
        return nepseService.getDailyOthersSubindexGraph().map(ResponseEntity::ok);
    }

    @GetMapping("/graph/trading")
    public Mono<ResponseEntity<Object>> getDailyTradingSubindexGraph() {
        return nepseService.getDailyTradingSubindexGraph().map(ResponseEntity::ok);
    }
}