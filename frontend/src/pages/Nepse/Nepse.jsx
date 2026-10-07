import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    getNepseIndex,
    isNepseOpen,
    getSummary,
    getTopGainers,
    getTopLosers,
    getTopTurnover,
    getTopTrade,
    getTopTransaction,
    getSupplyDemand,
    getNepseSubIndices,
    getFloorsheet,
    getGovernmentBonds,
    getPromoterShares,
    getShareGroups,
    getDailyNepseIndexGraph,
    getDailyBankSubindexGraph,
    getDailyDevBankSubindexGraph,
    getDailyFinanceSubindexGraph,
    getDailyHotelTourismSubindexGraph,
    getDailyHydroPowerSubindexGraph,
    getDailyInvestmentSubindexGraph,
    getDailyLifeInsuranceSubindexGraph,
    getDailyManufacturingSubindexGraph,
    getDailyMicrofinanceSubindexGraph,
    getDailyMutualFundSubindexGraph,
    getDailyNonLifeInsuranceSubindexGraph,
    getDailyOthersSubindexGraph,
    getDailyTradingSubindexGraph,
    isNepseError,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import {
    Arrow,
    HeroChart,
    MiniSpark,
    TermSearch,
    EmptyRow,
    SkeletonRows,
    ScrollTicker,
    SymbolLink,
    WatchButton,
    BreadthBar,
    InlineNotice,
    TabStrip,
    Pagination,
    Field,
    Stat,
    StatGrid,
    AlertBanner,
    AlertManager,
} from "./nepseShared.jsx";
import {
    IconRefresh,
    IconArrowUp,
    IconArrowDown,
    IconChevronDown,
    ClearIcon,
} from "../../components/Icons.jsx";
import {
    fmt,
    fmtCompact,
    fmtSigned,
    dirClass,
    resolveHeroKey,
    downloadCsv,
    parseInput,
} from "./nepseUtils";
import { toNum, floorStats } from "./nepseMath";
import {
    useClock,
    usePriceVolume,
    useWatchlist,
    useAlerts,
    usePortfolio,
} from "./nepseHooks";
import SEO from "../../seo/SEO.jsx";
import { NEPSE_JSONLD } from "../../seo/jsonLd.js";
import "./Nepse.css";

const REFRESH_INTERVAL = 30000;
const PROMOTER_PAGE_SIZE = 20;
const GAINER_PAGE_SIZE = 5;
const LOSER_PAGE_SIZE = 5;
const BOND_PAGE_SIZE = 10;
const SCREENER_PAGE_SIZE = 12;
const CACHE_KEY = "nepse_cache_v1";

const SECTOR_GRAPH_RULES = [
    { test: /development|dev bank/i, fetch: getDailyDevBankSubindexGraph },
    { test: /\bbank/i, fetch: getDailyBankSubindexGraph },
    { test: /finance/i, fetch: getDailyFinanceSubindexGraph },
    { test: /hotel|tourism/i, fetch: getDailyHotelTourismSubindexGraph },
    { test: /hydro/i, fetch: getDailyHydroPowerSubindexGraph },
    { test: /investment/i, fetch: getDailyInvestmentSubindexGraph },
    { test: /non.?life/i, fetch: getDailyNonLifeInsuranceSubindexGraph },
    { test: /life insurance/i, fetch: getDailyLifeInsuranceSubindexGraph },
    { test: /manufactur/i, fetch: getDailyManufacturingSubindexGraph },
    { test: /microfinance/i, fetch: getDailyMicrofinanceSubindexGraph },
    { test: /mutual fund/i, fetch: getDailyMutualFundSubindexGraph },
    { test: /trading/i, fetch: getDailyTradingSubindexGraph },
];

const FLOOR_PAGE_SIZE = 12;
const QTY_FILTERS = [
    ["all", 0],
    ["100+", 100],
    ["1K+", 1000],
    ["5K+", 5000],
    ["10K+", 10000],
];

const FEEDS = [
    "Movers",
    "Stocks",
    "Portfolio",
    "Alerts",
    "Turnover",
    "Activity",
    "Sectors",
    "Bonds",
    "Promoters",
    "Floorsheet",
];

function toList(raw) {
    if (isNepseError(raw)) return [];
    if (Array.isArray(raw)) return raw;
    return raw?.data ?? Object.values(raw ?? {});
}

function toNamedList(raw) {
    if (isNepseError(raw)) return [];
    if (Array.isArray(raw)) return raw;

    return Object.entries(raw ?? {}).map(([name, value]) => ({
        name,
        ...value,
    }));
}

function matchSectorGraph(name = "") {
    return (
        SECTOR_GRAPH_RULES.find(({ test }) => test.test(name))?.fetch ??
        getDailyOthersSubindexGraph
    );
}

// offline cache helpers plain data only
function loadCache() {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveCache(data) {
    try {
        window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ...data, savedAt: Date.now() })
        );
    } catch {
        // storage unavailable or full ignore silently
    }
}

function timeAgo(ts) {
    if (!ts) return "";
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
}

function MoverRow({ item, tone }) {
    const pct = Number(item.percentageChange ?? 0);

    return (
        <div className="ledger-row ledger-row-movers">
            <SymbolLink symbol={item.symbol} />
            <span className="ledger-ltp">{fmt(item.ltp)}</span>

            <span className={`ledger-pct ${tone}`}>
                <Arrow up={tone === "up"} />
                {pct >= 0 ? "+" : ""}
                {fmt(pct)}%
            </span>
        </div>
    );
}

function TickerItems({ summary }) {
    return Object.entries(summary).map(([key, value]) => {
        // fix do not pass stringified objects into a numeric formatter
        const num =
            typeof value === "object" && value !== null
                ? value.value ?? value.currentValue ?? null
                : value;

        return (
            <span key={key} className="term-ticker-item">
                <span className="ledger-label">{key}</span>
                <span>{num != null ? fmtCompact(num) : "--"}</span>
            </span>
        );
    });
}

function GroupLegend({ groups, activeGroup, onSelect }) {
    if (!groups.length) return null;

    return (
        <div className="group-legend">
            <button
                type="button"
                className={`group-chip ${!activeGroup ? "active" : ""}`}
                aria-pressed={!activeGroup}
                onClick={() => onSelect(null)}
            >
                All
            </button>

            {groups.map((g) => (
                <button
                    key={g.id}
                    type="button"
                    className={`group-chip ${activeGroup === g.name ? "active" : ""}`}
                    title={g.description}
                    aria-pressed={activeGroup === g.name}
                    onClick={() =>
                        onSelect(activeGroup === g.name ? null : g.name)
                    }
                >
                    {g.name}
                </button>
            ))}
        </div>
    );
}

function StockRow({ row, watched, onToggle }) {
    const pct = Number(row.percentageChange);
    const hasPct = Number.isFinite(pct);
    const ltp = row.lastTradedPrice ?? row.closePrice;
    const volume = row.totalTradeQuantity ?? row.shareTraded ?? row.volume;

    return (
        <div className="ledger-row ledger-row-4">
            <span className="ledger-symwrap">
                <WatchButton
                    symbol={row.symbol}
                    active={watched}
                    onToggle={onToggle}
                />
                <SymbolLink symbol={row.symbol} />
            </span>

            <span className="ledger-ltp">{ltp != null ? fmt(ltp) : "--"}</span>

            {hasPct ? (
                <span className={`ledger-pct ${dirClass(pct)}`}>
                    <Arrow up={pct >= 0} flat={pct === 0} />
                    {pct > 0 ? "+" : ""}
                    {fmt(pct)}%
                </span>
            ) : (
                <span className="ledger-pct flat">--</span>
            )}

            <span className="ledger-num">
                {volume != null ? fmtCompact(volume) : "--"}
            </span>
        </div>
    );
}

const SCREENER_COLUMNS = [
    { key: "symbol", label: "Symbol", align: "left" },
    { key: "ltp", label: "LTP", align: "right" },
    { key: "change", label: "Chg", align: "right" },
    { key: "volume", label: "Vol", align: "right" },
];

function sortValue(row, key) {
    if (key === "symbol") return String(row.symbol ?? "");
    if (key === "ltp") return Number(row.lastTradedPrice ?? row.closePrice);
    if (key === "change") return Number(row.percentageChange);

    return Number(row.totalTradeQuantity ?? row.shareTraded ?? row.volume);
}

// every listed stock with scope switch search filters and sortable columns
function StocksFeed({ rows, loading, error, onRetry, watchlist }) {
    const [scope, setScope] = useState("all");
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState({ key: "volume", dir: "desc" });
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [minVol, setMinVol] = useState("");

    const source = useMemo(() => {
        if (scope === "watch") {
            const bySymbol = new Map(
                rows.map((row) => [String(row.symbol).toUpperCase(), row])
            );

            return watchlist.list.map(
                (symbol) => bySymbol.get(symbol) ?? { symbol }
            );
        }

        if (scope === "up") {
            return rows.filter((row) => Number(row.percentageChange) > 0);
        }

        if (scope === "down") {
            return rows.filter((row) => Number(row.percentageChange) < 0);
        }

        return rows;
    }, [scope, rows, watchlist.list]);

    const pMin = parseInput(minPrice);
    const pMax = parseInput(maxPrice);
    const vMin = parseInput(minVol);
    const activeFilters = [pMin, pMax, vMin].filter((v) => v != null).length;

    const visible = useMemo(() => {
        const q = query.trim().toUpperCase();

        const filtered = source.filter((row) => {
            if (
                q &&
                !row.symbol?.toUpperCase().includes(q) &&
                !row.securityName?.toUpperCase().includes(q)
            ) {
                return false;
            }

            if (pMin != null || pMax != null) {
                const ltp = sortValue(row, "ltp");

                if (pMin != null && !(ltp >= pMin)) return false;
                if (pMax != null && !(ltp <= pMax)) return false;
            }

            if (vMin != null && !(sortValue(row, "volume") >= vMin)) return false;

            return true;
        });

        const factor = sort.dir === "asc" ? 1 : -1;

        return [...filtered].sort((a, b) => {
            const av = sortValue(a, sort.key);
            const bv = sortValue(b, sort.key);

            if (sort.key === "symbol") return av.localeCompare(bv) * factor;

            const an = Number.isFinite(av) ? av : -Infinity;
            const bn = Number.isFinite(bv) ? bv : -Infinity;

            return (an - bn) * factor;
        });
    }, [source, query, sort, pMin, pMax, vMin]);

    const totalPages = Math.max(1, Math.ceil(visible.length / SCREENER_PAGE_SIZE));
    const pageSafe = Math.min(page, totalPages - 1);
    const pageRows = visible.slice(
        pageSafe * SCREENER_PAGE_SIZE,
        pageSafe * SCREENER_PAGE_SIZE + SCREENER_PAGE_SIZE
    );

    const changeSort = (key) => {
        setPage(0);
        setSort((current) =>
            current.key === key
                ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
                : { key, dir: key === "symbol" ? "asc" : "desc" }
        );
    };

    const pick = (next) => {
        setScope(next);
        setPage(0);
    };

    const exportCsv = () => {
        downloadCsv("nepse-stocks.csv", [
            ["symbol", "name", "ltp", "change_pct", "volume"],
            ...visible.map((row) => [
                row.symbol,
                row.securityName ?? "",
                sortValue(row, "ltp"),
                sortValue(row, "change"),
                sortValue(row, "volume"),
            ]),
        ]);
    };

    const emptyLabel = query || activeFilters
        ? "no stocks match"
        : scope === "watch"
            ? "star a stock to track it here"
            : "no stock data yet";

    const scopes = [
        ["all", "All"],
        ["watch", `Watchlist${watchlist.list.length ? ` ${watchlist.list.length}` : ""}`],
        ["up", "Gainers"],
        ["down", "Losers"],
    ];

    return (
        <>
            <div className="group-legend stocks-scope" role="group" aria-label="Stock list">
                {scopes.map(([key, name]) => (
                    <button
                        key={key}
                        type="button"
                        className={`group-chip ${scope === key ? "active" : ""}`}
                        aria-pressed={scope === key}
                        onClick={() => pick(key)}
                    >
                        {name}
                    </button>
                ))}
            </div>

            <input
                className="ledger-filter"
                type="search"
                placeholder="filter by symbol or name"
                aria-label="Filter stocks"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                }}
            />

            <div className="stocks-tools">
                <span className="ledger-label">{visible.length} stocks</span>

                <span className="stocks-tools-actions">
                    <button
                        type="button"
                        className="inline-retry"
                        aria-expanded={showFilters}
                        onClick={() => setShowFilters((v) => !v)}
                    >
                        filters{activeFilters ? ` ${activeFilters}` : ""}
                    </button>

                    <button
                        type="button"
                        className="inline-retry"
                        onClick={exportCsv}
                        disabled={!visible.length}
                    >
                        csv
                    </button>
                </span>
            </div>

            {showFilters && (
                <div className="calc-form">
                    <Field label="min price">
                        <input
                            className="ledger-filter"
                            inputMode="decimal"
                            value={minPrice}
                            onChange={(e) => {
                                setMinPrice(e.target.value);
                                setPage(0);
                            }}
                        />
                    </Field>

                    <Field label="max price">
                        <input
                            className="ledger-filter"
                            inputMode="decimal"
                            value={maxPrice}
                            onChange={(e) => {
                                setMaxPrice(e.target.value);
                                setPage(0);
                            }}
                        />
                    </Field>

                    <Field label="min volume">
                        <input
                            className="ledger-filter"
                            inputMode="numeric"
                            value={minVol}
                            onChange={(e) => {
                                setMinVol(e.target.value);
                                setPage(0);
                            }}
                        />
                    </Field>
                </div>
            )}

            {error && !rows.length && scope === "all" && (
                <InlineNotice message={error} onRetry={onRetry} busy={loading} />
            )}

            <div className="ledger-header ledger-row-4" role="row">
                {SCREENER_COLUMNS.map((col) => {
                    const on = sort.key === col.key;

                    return (
                        <span
                            key={col.key}
                            role="columnheader"
                            className={col.align}
                            aria-sort={
                                on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                            }
                        >
                            <button
                                type="button"
                                className={`ledger-sort ${on ? "active" : ""}`}
                                onClick={() => changeSort(col.key)}
                            >
                                {col.label}
                                {on && (
                                    <span className="sort-ico" aria-hidden="true">
                                        {sort.dir === "asc" ? <IconArrowUp /> : <IconArrowDown />}
                                    </span>
                                )}
                            </button>
                        </span>
                    );
                })}
            </div>

            {loading && !rows.length ? (
                <SkeletonRows count={8} columns={4} />
            ) : pageRows.length ? (
                <>
                    {pageRows.map((row) => (
                        <StockRow
                            key={row.symbol}
                            row={row}
                            watched={watchlist.has(row.symbol)}
                            onToggle={watchlist.toggle}
                        />
                    ))}

                    <Pagination
                        page={pageSafe}
                        totalPages={totalPages}
                        onChange={setPage}
                    />
                </>
            ) : error && !rows.length && scope === "all" ? null : (
                <EmptyRow label={emptyLabel} />
            )}
        </>
    );
}

// holdings with live profit and loss kept on this device
function PortfolioFeed({ rows, loading, portfolio }) {
    const [symbol, setSymbol] = useState("");
    const [qty, setQty] = useState("");
    const [cost, setCost] = useState("");
    const [msg, setMsg] = useState(null);

    const bySymbol = useMemo(
        () => new Map(rows.map((row) => [String(row.symbol).toUpperCase(), row])),
        [rows]
    );

    const holdings = useMemo(
        () =>
            portfolio.list.map((h) => {
                const row = bySymbol.get(h.symbol);
                const ltp = toNum(row?.lastTradedPrice ?? row?.closePrice);
                const prev = toNum(row?.previousClose);
                const invested = h.qty * h.cost;
                const value = ltp != null ? h.qty * ltp : null;
                const pl = value != null ? value - invested : null;

                return {
                    ...h,
                    ltp,
                    invested,
                    value,
                    pl,
                    plPct: pl != null && invested ? (pl / invested) * 100 : null,
                    day: ltp != null && prev != null ? h.qty * (ltp - prev) : null,
                };
            }),
        [portfolio.list, bySymbol]
    );

    const totals = useMemo(() => {
        let invested = 0;
        let value = 0;
        let day = 0;

        for (const h of holdings) {
            if (h.value == null) continue;

            invested += h.invested;
            value += h.value;
            day += h.day ?? 0;
        }

        const pl = value - invested;

        return {
            invested,
            value,
            day,
            pl,
            plPct: invested ? (pl / invested) * 100 : null,
        };
    }, [holdings]);

    const submit = (e) => {
        e.preventDefault();

        const sym = symbol.trim().toUpperCase();
        const q = parseInput(qty);
        const c = parseInput(cost);

        if (!sym) return setMsg("enter a symbol");

        if (rows.length && !bySymbol.has(sym)) return setMsg("unknown symbol");

        if (!(q > 0)) return setMsg("enter a quantity above zero");

        if (!(c >= 0)) return setMsg("enter your average cost");

        portfolio.add(sym, q, c);
        setSymbol("");
        setQty("");
        setCost("");
        setMsg(null);
    };

    return (
        <>
            <p className="ledger-heading">portfolio</p>

            {holdings.length > 0 && (
                <StatGrid>
                    <Stat label="invested" value={fmtCompact(totals.invested)} />
                    <Stat label="value" value={fmtCompact(totals.value)} />
                    <Stat
                        label="profit and loss"
                        value={`${fmtSigned(totals.pl, 0)}${
                            totals.plPct != null ? ` (${fmtSigned(totals.plPct)}%)` : ""
                        }`}
                        tone={dirClass(totals.pl)}
                    />
                    <Stat
                        label="today"
                        value={fmtSigned(totals.day, 0)}
                        tone={dirClass(totals.day)}
                    />
                </StatGrid>
            )}

            <form className="calc-form" onSubmit={submit}>
                <Field label="symbol">
                    <input
                        className="ledger-filter"
                        value={symbol}
                        autoCapitalize="characters"
                        autoComplete="off"
                        placeholder="NABIL"
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    />
                </Field>

                <Field label="quantity">
                    <input
                        className="ledger-filter"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                    />
                </Field>

                <Field label="average cost">
                    <input
                        className="ledger-filter"
                        inputMode="decimal"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                    />
                </Field>

                <div className="calc-actions">
                    <button type="submit" className="inline-retry">
                        add holding
                    </button>
                </div>
            </form>

            {msg && <p className="ledger-empty">{msg}</p>}

            {holdings.length ? (
                <>
                    <div className="ledger-header ledger-row-port">
                        <span>Symbol</span>
                        <span style={{ textAlign: "right" }}>LTP</span>
                        <span style={{ textAlign: "right" }}>P/L</span>
                        <span />
                    </div>

                    {holdings.map((h) => (
                        <div className="ledger-row ledger-row-port" key={h.symbol}>
                            <span className="ledger-stack">
                                <SymbolLink symbol={h.symbol} />
                                <span className="ledger-sub">
                                    {fmt(h.qty, 0)} at {fmt(h.cost)}
                                </span>
                            </span>

                            <span className="ledger-ltp">
                                {h.ltp != null ? fmt(h.ltp) : loading ? "..." : "--"}
                            </span>

                            <span
                                className={`ledger-pl ${h.pl != null ? dirClass(h.pl) : ""}`}
                            >
                                <span>
                                    {h.plPct != null ? `${fmtSigned(h.plPct)}%` : "--"}
                                </span>
                                <span className="ledger-sub">
                                    {h.pl != null ? fmtSigned(h.pl, 0) : ""}
                                </span>
                            </span>

                            <button
                                type="button"
                                className="term-search-clear"
                                onClick={() => portfolio.remove(h.symbol)}
                                aria-label={`Remove ${h.symbol} from portfolio`}
                            >
                                <ClearIcon />
                            </button>
                        </div>
                    ))}

                    <p className="ledger-empty">
                        profit and loss is before fees and tax. data stays on this device.
                    </p>
                </>
            ) : (
                <EmptyRow label="add a holding to track profit and loss" />
            )}
        </>
    );
}

// market wide floorsheet with filters and paging
function FloorFeed({ rows, loading, emptyRow }) {
    const [query, setQuery] = useState("");
    const [minQty, setMinQty] = useState(0);
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        const q = query.trim().toUpperCase();

        return rows.filter((row) => {
            if (minQty && (toNum(row.contractQuantity) ?? 0) < minQty) return false;

            if (!q) return true;

            return [row.stockSymbol, row.buyerMemberId, row.sellerMemberId].some(
                (v) => String(v ?? "").toUpperCase().includes(q)
            );
        });
    }, [rows, query, minQty]);

    const stats = useMemo(() => floorStats(filtered), [filtered]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / FLOOR_PAGE_SIZE));
    const pageSafe = Math.min(page, totalPages - 1);
    const pageRows = filtered.slice(
        pageSafe * FLOOR_PAGE_SIZE,
        pageSafe * FLOOR_PAGE_SIZE + FLOOR_PAGE_SIZE
    );

    return (
        <>
            <p className="ledger-heading">live contracts</p>

            <input
                className="ledger-filter"
                type="search"
                placeholder="filter by symbol or broker"
                aria-label="Filter contracts"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                }}
            />

            <div className="group-legend" role="group" aria-label="Minimum quantity">
                {QTY_FILTERS.map(([name, value]) => (
                    <button
                        key={name}
                        type="button"
                        className={`group-chip ${minQty === value ? "active" : ""}`}
                        aria-pressed={minQty === value}
                        onClick={() => {
                            setMinQty(value);
                            setPage(0);
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {stats.contracts > 0 && (
                <StatGrid>
                    <Stat label="contracts" value={fmt(stats.contracts, 0)} />
                    <Stat label="quantity" value={fmtCompact(stats.qty)} />
                    <Stat label="amount" value={fmtCompact(stats.amount)} />
                    <Stat label="largest" value={fmt(stats.largest, 0)} />
                </StatGrid>
            )}

            <div className="ledger-header ledger-row-3">
                <span>Symbol</span>
                <span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Rate</span>
            </div>

            {loading && !rows.length ? (
                <SkeletonRows count={6} columns={3} />
            ) : pageRows.length ? (
                <>
                    {pageRows.map((row, index) => (
                        <div
                            className="ledger-row ledger-row-3"
                            key={row.id ?? `${pageSafe}-${index}`}
                        >
                            <SymbolLink symbol={row.stockSymbol} />

                            <span className="ledger-num">
                                {fmt(row.contractQuantity, 0)}
                            </span>

                            <span className="ledger-ltp">{fmt(row.contractRate)}</span>
                        </div>
                    ))}

                    <Pagination
                        page={pageSafe}
                        totalPages={totalPages}
                        onChange={setPage}
                    />
                </>
            ) : rows.length ? (
                <EmptyRow label="no contracts match" />
            ) : (
                emptyRow
            )}
        </>
    );
}

export default function Nepse() {
    const clock = useClock();
    const cacheRef = useRef(loadCache());
    const initialCache = cacheRef.current;

    const [marketOpen, setMarketOpen] = useState(null);
    const [indices, setIndices] = useState(initialCache?.indices ?? null);
    const [summary, setSummary] = useState(null);
    const [graphData, setGraphData] = useState(
        initialCache?.graphData ?? []
    );
    const [loading, setLoading] = useState(!initialCache);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(
        initialCache?.savedAt ?? null
    );

    const [feed, setFeed] = useState("Movers");
    const [refreshing, setRefreshing] = useState(false);

    const {
        rows: priceRows,
        loading: priceLoading,
        error: priceError,
        refresh: refreshPrices,
    } = usePriceVolume(REFRESH_INTERVAL);
    const watchlist = useWatchlist();
    const alerts = useAlerts();
    const portfolio = usePortfolio();

    // check alerts whenever fresh prices arrive
    useEffect(() => {
        alerts.check(priceRows);
    }, [priceRows, alerts.check]);

    const [gainers, setGainers] = useState(initialCache?.gainers ?? []);
    const [losers, setLosers] = useState(initialCache?.losers ?? []);
    const [gainerPage, setGainerPage] = useState(0);
    const [loserPage, setLoserPage] = useState(0);

    const [turnover, setTurnover] = useState([]);
    const [topTrade, setTopTrade] = useState([]);
    const [topTransaction, setTopTransaction] = useState([]);
    const [supplyDemand, setSupplyDemand] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [bonds, setBonds] = useState([]);
    const [bondPage, setBondPage] = useState(0);
    const [floorsheet, setFloorsheet] = useState(null);
    const [floorUnavailable, setFloorUnavailable] = useState(false);
    const [feedLoading, setFeedLoading] = useState(true);
    const [feedErrors, setFeedErrors] = useState({});
    const [feedRetry, setFeedRetry] = useState(0);

    const promoterCacheRef = useRef({});
    const [promoterRows, setPromoterRows] = useState([]);
    const [promoterPage, setPromoterPage] = useState(0);
    const [promoterTotalPages, setPromoterTotalPages] = useState(1);
    const [promoterLoading, setPromoterLoading] = useState(false);
    const [shareGroups, setShareGroups] = useState([]);
    const [selectedPromoterGroup, setSelectedPromoterGroup] =
        useState(null);

    const [expandedSector, setExpandedSector] = useState(null);
    const [sectorGraphs, setSectorGraphs] = useState({});

    const fetchCore = useCallback(async ({ force = false } = {}) => {
        if (!force && document.visibilityState !== "visible") {
            return;
        }

        try {
            const results = await Promise.allSettled([
                isNepseOpen(),
                getNepseIndex(),
                getSummary(),
                getDailyNepseIndexGraph(),
                getTopGainers(),
                getTopLosers(),
            ]);

            if (results.every((r) => r.status === "rejected")) {
                throw new Error("offline");
            }

            // usable payload or null so one failure never wipes the page
            const pick = (r) =>
                r.status === "fulfilled" && !isNepseError(r.value?.data)
                    ? r.value.data
                    : null;

            const [open, index, summaryData, graphRaw, gainerRaw, loserRaw] =
                results.map(pick);

            const graphList = graphRaw ? toList(graphRaw) : [];
            const gainerList = gainerRaw ? toList(gainerRaw) : null;
            const loserList = loserRaw ? toList(loserRaw) : null;

            if (open !== null) setMarketOpen(open);
            if (index) setIndices(index);
            if (summaryData) setSummary(summaryData);
            if (graphList.length) setGraphData(graphList);
            if (gainerList) setGainers(gainerList);
            if (loserList) setLosers(loserList);

            setIsOffline(false);

            if (index) {
                const previous = loadCache() ?? {};

                saveCache({
                    ...previous,
                    indices: index,
                    graphData: graphList.length ? graphList : previous.graphData,
                    gainers: gainerList ? gainerList.slice(0, 5) : previous.gainers,
                    losers: loserList ? loserList.slice(0, 5) : previous.losers,
                });

                const now = Date.now();
                cacheRef.current = { savedAt: now };
                setLastUpdated(now);
            }

            const missing = [
                open === null && "market status",
                index === null && "indices",
                summaryData === null && "summary",
                !graphList.length && "chart",
            ].filter(Boolean);

            setError(
                missing.length
                    ? `Some data is unavailable (${missing.join(", ")})`
                    : null
            );
        } catch {
            setIsOffline(true);
            setError(
                cacheRef.current
                    ? "Connection unavailable, showing last saved data"
                    : "Data feed unavailable"
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);

        try {
            await Promise.allSettled([
                fetchCore({ force: true }),
                refreshPrices(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchCore, refreshPrices]);

    useEffect(() => {
        let intervalId = null;

        const clearPolling = () => {
            if (intervalId !== null) {
                window.clearInterval(intervalId);
                intervalId = null;
            }
        };

        const startPolling = () => {
            if (intervalId !== null || document.visibilityState !== "visible") {
                return;
            }

            intervalId = window.setInterval(() => {
                void fetchCore();
            }, REFRESH_INTERVAL);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void fetchCore({ force: true });
                startPolling();
                return;
            }

            clearPolling();
        };

        void fetchCore({ force: true });
        startPolling();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearPolling();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [fetchCore]);

    const fetchPromoterPage = useCallback(async (page) => {
        const cached = promoterCacheRef.current[page];

        if (cached) {
            setPromoterRows(cached);
            setPromoterPage(page);
            return;
        }

        setPromoterLoading(true);

        try {
            const response = await getPromoterShares(
                page,
                PROMOTER_PAGE_SIZE
            );
            const raw = response.data;

            if (isNepseError(raw)) throw new Error("unavailable");

            const rows = raw?.content ?? [];
            const total = raw?.totalElements ?? rows.length;

            promoterCacheRef.current[page] = rows;
            setPromoterRows(rows);
            setPromoterTotalPages(
                Math.max(1, Math.ceil(total / PROMOTER_PAGE_SIZE))
            );
            setPromoterPage(page);
            setFeedErrors((cur) => (cur.Promoters ? { ...cur, Promoters: null } : cur));
        } catch {
            // keep previously shown rows and surface the failure
            setFeedErrors((cur) => ({
                ...cur,
                Promoters: "Could not load promoter shares",
            }));
        } finally {
            setPromoterLoading(false);
        }
    }, []);

    useEffect(() => {
        let alive = true;

        const setFeedError = (message) => {
            if (!alive) return;

            setFeedErrors((cur) =>
                (cur[feed] ?? null) === message ? cur : { ...cur, [feed]: message }
            );
        };

        // request a list and store it or throw when the feed reports an error
        const loadList = async (request, setter) => {
            const response = await request();

            if (!alive) return;
            if (isNepseError(response.data)) throw new Error("unavailable");

            setter(toList(response.data));
        };

        const loadFeed = async () => {
            setFeedLoading(true);

            try {
                if (feed === "Turnover" && !turnover.length) {
                    setFeedError(null);
                    await loadList(getTopTurnover, setTurnover);
                }

                if (
                    feed === "Activity" &&
                    (!topTrade.length || !topTransaction.length)
                ) {
                    setFeedError(null);

                    const results = await Promise.allSettled([
                        getTopTrade(),
                        getTopTransaction(),
                        getSupplyDemand(),
                    ]);

                    if (!alive) return;

                    const pick = (r) =>
                        r.status === "fulfilled" && !isNepseError(r.value?.data)
                            ? r.value.data
                            : null;

                    const [trade, txn, demand] = results.map(pick);

                    if (trade) setTopTrade(toList(trade));
                    if (txn) setTopTransaction(toList(txn));
                    if (demand) setSupplyDemand(toList(demand));

                    if (!trade && !txn && !demand) {
                        throw new Error("unavailable");
                    }

                    if (!trade || !txn || !demand) {
                        setFeedError("Some activity data is unavailable");
                    }
                }

                if (feed === "Sectors" && !sectors.length) {
                    setFeedError(null);

                    const response = await getNepseSubIndices();

                    if (!alive) return;
                    if (isNepseError(response.data)) throw new Error("unavailable");

                    setSectors(toNamedList(response.data));
                }

                if (feed === "Bonds" && !bonds.length) {
                    setFeedError(null);
                    await loadList(getGovernmentBonds, setBonds);
                }

                if (feed === "Promoters" && !promoterRows.length) {
                    await fetchPromoterPage(0);
                }

                if (feed === "Promoters" && !shareGroups.length) {
                    try {
                        const response = await getShareGroups();

                        if (!alive) return;

                        setShareGroups(
                            isNepseError(response.data) ? [] : response.data ?? []
                        );
                    } catch {
                        // group filter is optional so the table still works
                    }
                }

                if (feed === "Floorsheet" && floorsheet === null) {
                    setFeedError(null);

                    const response = await getFloorsheet();

                    if (!alive) return;

                    if (isNepseError(response.data)) {
                        setFloorsheet([]);
                        setFloorUnavailable(true);
                    } else {
                        setFloorsheet(response.data);
                        setFloorUnavailable(false);
                    }
                }
            } catch {
                setFeedError("Could not load this section");
            } finally {
                if (alive) setFeedLoading(false);
            }
        };

        loadFeed();

        return () => {
            alive = false;
        };
    }, [
        feed,
        feedRetry,
        turnover.length,
        topTrade.length,
        topTransaction.length,
        sectors.length,
        bonds.length,
        promoterRows.length,
        shareGroups.length,
        fetchPromoterPage,
        floorsheet,
    ]);

    const retryFeed = useCallback(() => setFeedRetry((n) => n + 1), []);

    // hide the empty label when the section failed to load
    const feedError = feedErrors[feed] ?? null;
    const emptyRow = (label) =>
        feedError ? null : <EmptyRow label={label} />;

    const heroKey = resolveHeroKey(indices);
    const heroEntry = heroKey ? indices?.[heroKey] : null;

    const heroValue = heroEntry?.currentValue ?? heroEntry?.value ?? 0;
    const heroChange = heroEntry?.change ?? 0;

    const heroPct =
        heroEntry?.percentageChange ?? heroEntry?.perChange ?? 0;

    const heroPrev =
        Number(heroEntry?.previousClose) > 0
            ? Number(heroEntry.previousClose)
            : heroValue > 0
                ? heroValue - heroChange
                : null;

    const secondaryIndices = useMemo(
        () =>
            indices
                ? Object.entries(indices).filter(
                    ([name]) => name !== heroKey
                )
                : [],
        [indices, heroKey]
    );

    const openBool =
        typeof marketOpen === "object"
            ? marketOpen?.isOpen === "OPEN" || marketOpen?.isOpen === true
            : marketOpen === true || marketOpen === "OPEN";

    const floorRows = useMemo(() => {
        if (Array.isArray(floorsheet)) return floorsheet;

        return floorsheet?.floorsheets?.content ?? [];
    }, [floorsheet]);

    const sectorRows = useMemo(
        () =>
            sectors.filter((sector) => {
                if (!indices) return true;

                const name = sector.name ?? sector.index ?? "";

                return !Object.prototype.hasOwnProperty.call(
                    indices,
                    name
                );
            }),
        [sectors, indices]
    );

    const sectorMax = useMemo(
        () =>
            Math.max(
                0.01,
                ...sectorRows.map((sector) =>
                    Math.abs(
                        Number(
                            sector.percentageChange ??
                            sector.perChange ??
                            sector.change ??
                            0
                        ) || 0
                    )
                )
            ),
        [sectorRows]
    );

    const loadSectorGraph = useCallback(async (name) => {
        // clearing the entry shows the loading skeleton again
        setSectorGraphs((current) => {
            const next = { ...current };
            delete next[name];
            return next;
        });

        try {
            const response = await matchSectorGraph(name)();

            if (isNepseError(response.data)) throw new Error("unavailable");

            setSectorGraphs((current) => ({
                ...current,
                [name]: toList(response.data),
            }));
        } catch {
            // null marks a failed load so the retry button can show
            setSectorGraphs((current) => ({ ...current, [name]: null }));
        }
    }, []);

    const toggleSector = useCallback(
        (name) => {
            if (expandedSector === name) {
                setExpandedSector(null);
                return;
            }

            setExpandedSector(name);

            if (sectorGraphs[name]) return;

            void loadSectorGraph(name);
        },
        [expandedSector, sectorGraphs, loadSectorGraph]
    );

    // clamp pages so a shrinking dataset never leaves a page out of range
    const gainerTotalPages = Math.max(
        1,
        Math.ceil(gainers.length / GAINER_PAGE_SIZE)
    );
    const gainerPageSafe = Math.min(gainerPage, gainerTotalPages - 1);
    const gainerRows = gainers.slice(
        gainerPageSafe * GAINER_PAGE_SIZE,
        gainerPageSafe * GAINER_PAGE_SIZE + GAINER_PAGE_SIZE
    );

    const loserTotalPages = Math.max(
        1,
        Math.ceil(losers.length / LOSER_PAGE_SIZE)
    );
    const loserPageSafe = Math.min(loserPage, loserTotalPages - 1);
    const loserRows = losers.slice(
        loserPageSafe * LOSER_PAGE_SIZE,
        loserPageSafe * LOSER_PAGE_SIZE + LOSER_PAGE_SIZE
    );

    const bondTotalPages = Math.max(
        1,
        Math.ceil(bonds.length / BOND_PAGE_SIZE)
    );
    const bondPageSafe = Math.min(bondPage, bondTotalPages - 1);
    const bondRows = bonds.slice(
        bondPageSafe * BOND_PAGE_SIZE,
        bondPageSafe * BOND_PAGE_SIZE + BOND_PAGE_SIZE
    );

    const filteredPromoterRows = useMemo(() => {
        if (!selectedPromoterGroup) return promoterRows;

        return promoterRows.filter(
            (row) => row.shareGroupId?.name === selectedPromoterGroup
        );
    }, [promoterRows, selectedPromoterGroup]);

    return (
        <Layout>
            <SEO
                title="NEPSE Live Market Data"
                description="Live Nepal Stock Exchange (NEPSE) index, top gainers, losers, turnover, sector sub-indices, and individual stock prices. Updated every 30 seconds during market hours."
                canonical="/nepse"
                jsonLd={NEPSE_JSONLD}
            />
            <div className="term-shell">
                <header className="term-header">
                    <div className="term-brand">
                        <span className="term-brand-name">NEPSE</span>
                        <span className="term-brand-tag">
                            live market feed
                        </span>
                    </div>

                    <TermSearch />

                    <div className="term-header-right">
                        {lastUpdated && (
                            <span className="term-updated">
                                updated {timeAgo(lastUpdated)}
                            </span>
                        )}

                        <button
                            type="button"
                            className="term-refresh"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            aria-label="Refresh market data"
                            title="Refresh market data"
                        >
                            <IconRefresh spinning={refreshing} />
                        </button>

                        <span
                            className={`term-status ${
                                openBool ? "open" : "closed"
                            }`}
                        >
                            <span className="term-status-dot" />
                            {marketOpen === null
                                ? "connecting"
                                : openBool
                                    ? "market open"
                                    : "market closed"}
                        </span>

                        <span className="term-clock">
                            {clock.toLocaleTimeString("en-NP", {
                                hour12: false,
                            })}
                        </span>
                    </div>
                </header>

                <AlertBanner alerts={alerts} />

                {error && (
                    <div className="term-alert" role="alert">
                        <span className="term-alert-text">
                            {error}
                            {isOffline && lastUpdated && (
                                <span className="term-alert-time">
                                    {" "}
                                    last update {timeAgo(lastUpdated)}
                                </span>
                            )}
                        </span>

                        <button
                            type="button"
                            className="inline-retry"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <IconRefresh spinning={refreshing} />
                            retry
                        </button>
                    </div>
                )}

                <div className="term-grid">
                    <div className="term-primary">
                        <HeroChart
                            loading={loading}
                            data={graphData}
                            value={heroValue}
                            changeVal={heroChange}
                            changePct={heroPct}
                            baseline={heroPrev}
                        />

                        {summary && !loading && (
                            <ScrollTicker>
                                <TickerItems summary={summary} />
                            </ScrollTicker>
                        )}

                        {!priceLoading && <BreadthBar rows={priceRows} />}

                        <div className="index-strip">
                            {loading && !secondaryIndices.length
                                ? [1, 2, 3].map((key) => (
                                    <div
                                        key={key}
                                        className="skel index-skel"
                                    />
                                ))
                                : secondaryIndices.map(
                                    ([name, data]) => {
                                        const change =
                                            data.percentageChange ??
                                            data.perChange ??
                                            0;

                                        return (
                                            <div
                                                key={name}
                                                className="index-item"
                                            >
                                                <span className="index-name">
                                                    {name}
                                                </span>

                                                <span className="index-value">
                                                    {fmt(
                                                        data.currentValue ??
                                                        data.value
                                                    )}
                                                </span>

                                                <span
                                                    className={`index-change ${dirClass(
                                                        change
                                                    )}`}
                                                >
                                                    <Arrow
                                                        up={change >= 0}
                                                        flat={
                                                            change === 0
                                                        }
                                                    />
                                                    {change >= 0
                                                        ? "+"
                                                        : ""}
                                                    {fmt(change)}%
                                                </span>
                                            </div>
                                        );
                                    }
                                )}
                        </div>
                    </div>

                    <aside className="term-ledger">
                        <TabStrip
                            tabs={FEEDS}
                            active={feed}
                            onChange={setFeed}
                            label="Market sections"
                        />

                        <div className="ledger-body" role="tabpanel" aria-label={feed}>
                            {feedError && feed !== "Movers" && feed !== "Stocks" && (
                                <InlineNotice
                                    message={feedError}
                                    onRetry={retryFeed}
                                    busy={feedLoading || promoterLoading}
                                />
                            )}

                            {feed === "Movers" && (
                                <>
                                    <p className="ledger-heading up">
                                        gainers
                                    </p>

                                    <div className="ledger-header ledger-header-movers">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>LTP</span>
                                        <span style={{ textAlign: "right" }}>Change</span>
                                    </div>

                                    {loading && !gainers.length ? (
                                        <SkeletonRows count={5} />
                                    ) : gainers.length ? (
                                        <>
                                            {gainerRows.map((row) => (
                                                <MoverRow
                                                    key={row.symbol}
                                                    item={row}
                                                    tone="up"
                                                />
                                            ))}

                                            <Pagination
                                                page={gainerPageSafe}
                                                totalPages={
                                                    gainerTotalPages
                                                }
                                                onChange={setGainerPage}
                                            />
                                        </>
                                    ) : (
                                        <EmptyRow label="no gainers yet" />
                                    )}

                                    <p className="ledger-heading down">
                                        losers
                                    </p>

                                    <div className="ledger-header ledger-header-movers">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>LTP</span>
                                        <span style={{ textAlign: "right" }}>Change</span>
                                    </div>

                                    {loading && !losers.length ? (
                                        <SkeletonRows count={5} />
                                    ) : losers.length ? (
                                        <>
                                            {loserRows.map((row) => (
                                                <MoverRow
                                                    key={row.symbol}
                                                    item={row}
                                                    tone="down"
                                                />
                                            ))}

                                            <Pagination
                                                page={loserPageSafe}
                                                totalPages={
                                                    loserTotalPages
                                                }
                                                onChange={setLoserPage}
                                            />
                                        </>
                                    ) : (
                                        <EmptyRow label="no losers yet" />
                                    )}
                                </>
                            )}

                            {feed === "Stocks" && (
                                <StocksFeed
                                    rows={priceRows}
                                    loading={priceLoading}
                                    error={priceError}
                                    onRetry={refreshPrices}
                                    watchlist={watchlist}
                                />
                            )}

                            {feed === "Portfolio" && (
                                <PortfolioFeed
                                    rows={priceRows}
                                    loading={priceLoading}
                                    portfolio={portfolio}
                                />
                            )}

                            {feed === "Alerts" && (
                                <AlertManager alerts={alerts} rows={priceRows} />
                            )}

                            {feed === "Turnover" && (
                                <>
                                    <p className="ledger-heading">
                                        top turnover
                                    </p>

                                    <div className="ledger-header ledger-row-4">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>Turnover</span>
                                        <span style={{ textAlign: "right" }}>Shares</span>
                                        <span style={{ textAlign: "right" }}>LTP</span>
                                    </div>

                                    {feedLoading && !turnover.length ? (
                                        <SkeletonRows count={5} columns={4} />
                                    ) : turnover.length ? (
                                        turnover
                                            .slice(0, 10)
                                            .map((row) => (
                                                <div
                                                    className="ledger-row ledger-row-4"
                                                    key={row.symbol}
                                                >
                                                    <SymbolLink symbol={row.symbol} />
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.turnover
                                                        )}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.shareTraded
                                                        )}
                                                    </span>
                                                    <span className="ledger-ltp">
                                                        {fmt(row.ltp)}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        emptyRow("no turnover data yet")
                                    )}
                                </>
                            )}

                            {feed === "Activity" && (
                                <>
                                    <p className="ledger-heading">
                                        top trade by volume
                                    </p>

                                    <div className="ledger-header">
                                        <span>Symbol</span>
                                        <span style={{ marginLeft: "auto" }}>Volume</span>
                                    </div>

                                    {feedLoading && !topTrade.length ? (
                                        <SkeletonRows count={4} />
                                    ) : topTrade.length ? (
                                        topTrade
                                            .slice(0, 6)
                                            .map((row) => (
                                                <div
                                                    className="ledger-row"
                                                    key={row.symbol}
                                                >
                                                    <SymbolLink symbol={row.symbol} />
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.shareTraded ??
                                                            row.totalTradeQuantity
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        emptyRow("no trade data yet")
                                    )}

                                    <p className="ledger-heading">
                                        top by transactions
                                    </p>

                                    <div className="ledger-header">
                                        <span>Symbol</span>
                                        <span style={{ marginLeft: "auto" }}>Trades</span>
                                    </div>

                                    {feedLoading && !topTransaction.length ? (
                                        <SkeletonRows count={4} />
                                    ) : topTransaction.length ? (
                                        topTransaction
                                            .slice(0, 6)
                                            .map((row) => (
                                                <div
                                                    className="ledger-row"
                                                    key={row.symbol}
                                                >
                                                    <SymbolLink symbol={row.symbol} />
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.totalTrades ??
                                                            row.transactionCount
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        emptyRow("no transaction data yet")
                                    )}

                                    <p className="ledger-heading">
                                        supply demand imbalance
                                    </p>

                                    <div className="ledger-header ledger-row-3">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>Buy Qty</span>
                                        <span style={{ textAlign: "right" }}>Sell Qty</span>
                                    </div>

                                    {feedLoading && !supplyDemand.length ? (
                                        <SkeletonRows count={4} columns={3} />
                                    ) : supplyDemand.length ? (
                                        supplyDemand
                                            .slice(0, 6)
                                            .map((row, index) => {
                                                const buy =
                                                    row.buyQuantity ??
                                                    row.totalBuyQty ??
                                                    row.buyQty;

                                                const sell =
                                                    row.sellQuantity ??
                                                    row.totalSellQty ??
                                                    row.sellQty;

                                                return (
                                                    <div
                                                        className="ledger-row ledger-row-3"
                                                        key={
                                                            row.symbol ??
                                                            index
                                                        }
                                                    >
                                                        <span className="ledger-sym">
                                                            {row.symbol ??
                                                                row.securityName}
                                                        </span>

                                                        <span className="ledger-num">
                                                            {buy != null
                                                                ? fmtCompact(buy)
                                                                : "--"}
                                                        </span>

                                                        <span className="ledger-num">
                                                            {sell != null
                                                                ? fmtCompact(sell)
                                                                : "--"}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        emptyRow("no imbalance data yet")
                                    )}
                                </>
                            )}

                            {feed === "Sectors" && (
                                <>
                                    <p className="ledger-heading">
                                        sector sub indices
                                    </p>

                                    <div className="ledger-header">
                                        <span>Sector</span>
                                        <span style={{ marginLeft: "auto" }}>Change</span>
                                    </div>

                                    {feedLoading && !sectorRows.length ? (
                                        <SkeletonRows count={5} />
                                    ) : sectorRows.length ? (
                                        sectorRows.map((sector) => {
                                            const name =
                                                sector.name ??
                                                sector.index ??
                                                "sector";

                                            const change =
                                                sector.percentageChange ??
                                                sector.perChange ??
                                                sector.change ??
                                                0;

                                            const expanded =
                                                expandedSector === name;

                                            const barPct = Math.min(
                                                100,
                                                (Math.abs(Number(change) || 0) / sectorMax) * 100
                                            );

                                            return (
                                                <div
                                                    key={name}
                                                    className="sector-block"
                                                >
                                                    <div
                                                        className={`ledger-row sector-row depth-row depth-${
                                                            change >= 0 ? "up" : "down"
                                                        }`}
                                                        style={{ "--depth": barPct }}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-expanded={expanded}
                                                        onClick={() =>
                                                            toggleSector(
                                                                name
                                                            )
                                                        }
                                                        onKeyDown={(
                                                            event
                                                        ) => {
                                                            if (
                                                                event.key ===
                                                                "Enter" ||
                                                                event.key ===
                                                                " "
                                                            ) {
                                                                event.preventDefault();
                                                                toggleSector(
                                                                    name
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <span className="ledger-sym">
                                                            <span
                                                                className={`sector-chevron ${
                                                                    expanded ? "open" : ""
                                                                }`}
                                                                aria-hidden="true"
                                                            >
                                                                <IconChevronDown />
                                                            </span>
                                                            {name}
                                                        </span>

                                                        <span
                                                            className={`ledger-pct ${dirClass(
                                                                change
                                                            )}`}
                                                        >
                                                            <Arrow
                                                                up={
                                                                    change >= 0
                                                                }
                                                                flat={
                                                                    change === 0
                                                                }
                                                            />
                                                            {change >= 0
                                                                ? "+"
                                                                : ""}
                                                            {fmt(change)}%
                                                        </span>
                                                    </div>

                                                    {expanded && (
                                                        <div className="sector-expand">
                                                            {sectorGraphs[
                                                                name
                                                                ] ===
                                                            undefined ? (
                                                                <div className="skel mini-spark-skel" />
                                                            ) : sectorGraphs[name] === null ? (
                                                                <InlineNotice
                                                                    message="Trend unavailable"
                                                                    onRetry={() =>
                                                                        loadSectorGraph(name)
                                                                    }
                                                                />
                                                            ) : (
                                                                <MiniSpark
                                                                    data={
                                                                        sectorGraphs[
                                                                            name
                                                                            ]
                                                                    }
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        emptyRow("no sector data yet")
                                    )}
                                </>
                            )}

                            {feed === "Bonds" && (
                                <>
                                    <p className="ledger-heading">
                                        government bonds
                                    </p>

                                    <div className="ledger-header ledger-row-3">
                                        <span>Bond</span>
                                        <span style={{ textAlign: "right" }}>Coupon</span>
                                        <span style={{ textAlign: "right" }}>Maturity</span>
                                    </div>

                                    {feedLoading && !bonds.length ? (
                                        <SkeletonRows count={5} columns={3} />
                                    ) : bonds.length ? (
                                        <>
                                            {bondRows.map((bond) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={bond.id}
                                                >
                                                    <span className="ledger-sym">
                                                        {bond.bondName}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {bond.couponRate}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {bond.maturityDate}
                                                    </span>
                                                </div>
                                            ))}

                                            <Pagination
                                                page={bondPageSafe}
                                                totalPages={bondTotalPages}
                                                onChange={setBondPage}
                                            />
                                        </>
                                    ) : (
                                        emptyRow("no bond data yet")
                                    )}
                                </>
                            )}

                            {feed === "Promoters" && (
                                <>
                                    <p className="ledger-heading">
                                        promoter shares
                                    </p>

                                    <GroupLegend
                                        groups={shareGroups}
                                        activeGroup={selectedPromoterGroup}
                                        onSelect={setSelectedPromoterGroup}
                                    />

                                    <div className="ledger-header ledger-row-3">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>Group</span>
                                        <span style={{ textAlign: "right" }}>Listed</span>
                                    </div>

                                    {promoterLoading && !promoterRows.length ? (
                                        <SkeletonRows count={5} columns={3} />
                                    ) : filteredPromoterRows.length ? (
                                        <>
                                            {filteredPromoterRows.map((row) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={row.id}
                                                >
                                                    <SymbolLink symbol={row.symbol} />
                                                    <span className="ledger-num">
                                                        {row.shareGroupId?.name ?? "--"}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {row.listingDate ?? "--"}
                                                    </span>
                                                </div>
                                            ))}

                                            <Pagination
                                                page={promoterPage}
                                                totalPages={promoterTotalPages}
                                                onChange={fetchPromoterPage}
                                                loading={promoterLoading}
                                            />
                                        </>
                                    ) : (
                                        emptyRow(
                                            selectedPromoterGroup
                                                ? "no shares in this group on this page"
                                                : "no promoter share data yet"
                                        )
                                    )}
                                </>
                            )}

                            {feed === "Floorsheet" && (
                                <FloorFeed
                                    rows={floorRows}
                                    loading={feedLoading}
                                    emptyRow={emptyRow(
                                        floorUnavailable
                                            ? "floorsheet temporarily unavailable"
                                            : "no contracts yet"
                                    )}
                                />
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
}