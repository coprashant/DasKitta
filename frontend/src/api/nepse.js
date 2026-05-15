import client from "./client";

// ── Live Market ───────────────────────────────────────────────────────────────

export const getLiveMarket = () => client.get("/nepse/live-market");

export const getNepseIndex = () => client.get("/nepse/index");

export const getNepseSubIndices = () => client.get("/nepse/sub-indices");

export const getSummary = () => client.get("/nepse/summary");

export const isNepseOpen = () => client.get("/nepse/is-open");

// ── Top Gainers & Losers ──────────────────────────────────────────────────────

export const getTopGainers = () => client.get("/nepse/top-gainers");

export const getTopLosers = () => client.get("/nepse/top-losers");

export const getTopTurnover = () => client.get("/nepse/top-turnover");

export const getTopTrade = () => client.get("/nepse/top-trade");

export const getTopTransaction = () => client.get("/nepse/top-transaction");

export const getSupplyDemand = () => client.get("/nepse/supply-demand");

// ── Company Details / Price History ──────────────────────────────────────────

export const getCompanyList = () => client.get("/nepse/companies");

export const getCompanyDetails = (symbol) =>
  client.get("/nepse/company/details", { params: { symbol } });

export const getPriceVolume = () => client.get("/nepse/price-volume");

export const getPriceVolumeHistory = (symbol) =>
  client.get("/nepse/price-volume-history", { params: { symbol } });

export const getDailyScripPriceGraph = (symbol) =>
  client.get("/nepse/scrip-price-graph", { params: { symbol } });

export const getMarketDepth = (symbol) =>
  client.get("/nepse/market-depth", { params: { symbol } });

export const getSectorScrips = () => client.get("/nepse/sector-scrips");

export const getSecurityList = () => client.get("/nepse/security-list");

export const getTradeTurnoverSubindices = () =>
  client.get("/nepse/trade-turnover-subindices");

// ── Floorsheet ────────────────────────────────────────────────────────────────

export const getFloorsheet = () => client.get("/nepse/floorsheet");

export const getFloorsheetOf = (symbol) =>
  client.get("/nepse/floorsheet/company", { params: { symbol } });

// ── Index Graphs ──────────────────────────────────────────────────────────────

export const getDailyNepseIndexGraph = () => client.get("/nepse/graph/nepse");

export const getDailySensitiveIndexGraph = () =>
  client.get("/nepse/graph/sensitive");

export const getDailyFloatIndexGraph = () => client.get("/nepse/graph/float");

export const getDailySensitiveFloatIndexGraph = () =>
  client.get("/nepse/graph/sensitive-float");

// ── Sector Subindex Graphs ────────────────────────────────────────────────────

export const getDailyBankSubindexGraph = () => client.get("/nepse/graph/bank");

export const getDailyDevBankSubindexGraph = () =>
  client.get("/nepse/graph/dev-bank");

export const getDailyFinanceSubindexGraph = () =>
  client.get("/nepse/graph/finance");

export const getDailyHotelTourismSubindexGraph = () =>
  client.get("/nepse/graph/hotel-tourism");

export const getDailyHydroPowerSubindexGraph = () =>
  client.get("/nepse/graph/hydro-power");

export const getDailyInvestmentSubindexGraph = () =>
  client.get("/nepse/graph/investment");

export const getDailyLifeInsuranceSubindexGraph = () =>
  client.get("/nepse/graph/life-insurance");

export const getDailyManufacturingSubindexGraph = () =>
  client.get("/nepse/graph/manufacturing");

export const getDailyMicrofinanceSubindexGraph = () =>
  client.get("/nepse/graph/microfinance");

export const getDailyMutualFundSubindexGraph = () =>
  client.get("/nepse/graph/mutual-fund");

export const getDailyNonLifeInsuranceSubindexGraph = () =>
  client.get("/nepse/graph/non-life-insurance");

export const getDailyOthersSubindexGraph = () =>
  client.get("/nepse/graph/others");

export const getDailyTradingSubindexGraph = () =>
  client.get("/nepse/graph/trading");