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
} from "./nepseShared.jsx";
import {
    fmt,
    fmtCompact,
    dirClass,
    resolveHeroKey,
} from "./nepseUtils";
import { useClock } from "./nepseHooks";
import SEO from "../../seo/SEO.jsx";
import { NEPSE_JSONLD } from "../../seo/jsonLd.js";
import "./Nepse.css";

const REFRESH_INTERVAL = 30000;
const PROMOTER_PAGE_SIZE = 20;
const GAINER_PAGE_SIZE = 5;
const LOSER_PAGE_SIZE = 5;
const BOND_PAGE_SIZE = 10;
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

const FEEDS = [
    "Movers",
    "Turnover",
    "Activity",
    "Sectors",
    "Bonds",
    "Promoters",
    "Floorsheet",
];

function safe(raw) {
    return isNepseError(raw) ? null : raw;
}

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

// offline cache helpers, plain data only
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
        // storage unavailable or full, ignore silently
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
            <span className="ledger-sym">{item.symbol}</span>
            <span className="ledger-ltp">{fmt(item.ltp)}</span>

            <span className={`ledger-pct ${tone}`}>
                <Arrow up={tone === "up"} />
                {pct >= 0 ? "+" : ""}
                {fmt(pct)}%
            </span>
        </div>
    );
}

// generic prev next page control, replaces old more less buttons
function Pagination({ page, totalPages, onChange, loading = false }) {
    if (totalPages <= 1) return null;

    return (
        <div className="ledger-pagination" aria-label="Table pagination">
            <button
                className="page-btn page-btn-arrow"
                disabled={page === 0 || loading}
                onClick={() => onChange(page - 1)}
                aria-label="Previous page"
            >
                <span aria-hidden="true">‹</span>
            </button>

            <span className="page-info">
                {page + 1}/{totalPages}
            </span>

            <button
                className="page-btn page-btn-arrow"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => onChange(page + 1)}
                aria-label="Next page"
            >
                <span aria-hidden="true">›</span>
            </button>
        </div>
    );
}

function TickerItems({ summary }) {
    return Object.entries(summary).map(([key, value]) => {
        // fix: do not pass stringified objects into a numeric formatter
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

    const fetchCore = useCallback(async () => {
        try {
            const [
                openRes,
                indexRes,
                summaryRes,
                graphRes,
                gainerRes,
                loserRes,
            ] = await Promise.all([
                isNepseOpen(),
                getNepseIndex(),
                getSummary(),
                getDailyNepseIndexGraph(),
                getTopGainers(),
                getTopLosers(),
            ]);

            const open = safe(openRes.data);
            const index = safe(indexRes.data);
            const summaryData = safe(summaryRes.data);
            const graphList = toList(graphRes.data);
            const gainerList = isNepseError(gainerRes.data)
                ? []
                : gainerRes.data ?? [];
            const loserList = isNepseError(loserRes.data)
                ? []
                : loserRes.data ?? [];

            setMarketOpen(open);
            setIndices(index);
            setSummary(summaryData);
            setGraphData(graphList);
            setGainers(gainerList);
            setLosers(loserList);
            setIsOffline(false);

            if (index) {
                saveCache({
                    indices: index,
                    graphData: graphList,
                    gainers: gainerList.slice(0, 5),
                    losers: loserList.slice(0, 5),
                });
                const now = Date.now();
                cacheRef.current = { savedAt: now };
                setLastUpdated(now);
            }

            setError(
                open == null || index == null || summaryData == null
                    ? "Some market data is temporarily unavailable"
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

    useEffect(() => {
        void fetchCore();

        const interval = setInterval(() => {
            void fetchCore();
        }, REFRESH_INTERVAL);

        return () => clearInterval(interval);
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

            if (isNepseError(raw)) return;

            const rows = raw?.content ?? [];
            const total = raw?.totalElements ?? rows.length;

            promoterCacheRef.current[page] = rows;
            setPromoterRows(rows);
            setPromoterTotalPages(
                Math.max(1, Math.ceil(total / PROMOTER_PAGE_SIZE))
            );
            setPromoterPage(page);
        } catch {
            // keep previously shown rows on error
        } finally {
            setPromoterLoading(false);
        }
    }, []);

    useEffect(() => {
        let alive = true;

        const loadFeed = async () => {
            setFeedLoading(true);

            try {
                if (feed === "Turnover" && !turnover.length) {
                    const response = await getTopTurnover();

                    if (!alive) return;

                    setTurnover(
                        isNepseError(response.data)
                            ? []
                            : response.data ?? []
                    );
                }

                if (
                    feed === "Activity" &&
                    (!topTrade.length || !topTransaction.length)
                ) {
                    const [tradeRes, transactionRes] =
                        await Promise.all([
                            getTopTrade(),
                            getTopTransaction(),
                        ]);

                    if (!alive) return;

                    setTopTrade(
                        isNepseError(tradeRes.data)
                            ? []
                            : tradeRes.data ?? []
                    );

                    setTopTransaction(
                        isNepseError(transactionRes.data)
                            ? []
                            : transactionRes.data ?? []
                    );

                    try {
                        const response = await getSupplyDemand();

                        if (!alive) return;

                        setSupplyDemand(toList(response.data));
                    } catch {
                        if (alive) setSupplyDemand([]);
                    }
                }

                if (feed === "Sectors" && !sectors.length) {
                    const response = await getNepseSubIndices();

                    if (!alive) return;

                    setSectors(toNamedList(response.data));
                }

                if (feed === "Bonds" && !bonds.length) {
                    const response = await getGovernmentBonds();

                    if (!alive) return;

                    setBonds(toList(response.data));
                }

                if (feed === "Promoters" && !promoterRows.length) {
                    await fetchPromoterPage(0);
                }

                if (feed === "Promoters" && !shareGroups.length) {
                    const response = await getShareGroups();

                    if (!alive) return;

                    setShareGroups(
                        isNepseError(response.data)
                            ? []
                            : response.data ?? []
                    );
                }

                if (feed === "Floorsheet" && floorsheet === null) {
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

    const heroKey = resolveHeroKey(indices);
    const heroEntry = heroKey ? indices?.[heroKey] : null;

    const heroValue = heroEntry?.currentValue ?? heroEntry?.value ?? 0;
    const heroChange = heroEntry?.change ?? 0;

    const heroPct =
        heroEntry?.percentageChange ?? heroEntry?.perChange ?? 0;

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

    const toggleSector = useCallback(
        async (name) => {
            if (expandedSector === name) {
                setExpandedSector(null);
                return;
            }

            setExpandedSector(name);

            if (sectorGraphs[name]) return;

            try {
                const response = await matchSectorGraph(name)();

                setSectorGraphs((current) => ({
                    ...current,
                    [name]: toList(response.data),
                }));
            } catch {
                setSectorGraphs((current) => ({
                    ...current,
                    [name]: current[name] ?? [],
                }));
            }
        },
        [expandedSector, sectorGraphs]
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

                {error && (
                    <div className="term-alert">
                        {error}
                        {isOffline && lastUpdated && (
                            <span className="term-alert-time">
                                {" "}
                                last update {timeAgo(lastUpdated)}
                            </span>
                        )}
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
                        />

                        {summary && !loading && (
                            <ScrollTicker>
                                <TickerItems summary={summary} />
                            </ScrollTicker>
                        )}

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
                        <div className="ledger-tabs">
                            {FEEDS.map((item) => (
                                <button
                                    key={item}
                                    className={`ledger-tab ${
                                        feed === item ? "active" : ""
                                    }`}
                                    onClick={() => setFeed(item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>

                        <div className="ledger-body">
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
                                                    <span className="ledger-sym">
                                                        {row.symbol}
                                                    </span>
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
                                        <EmptyRow label="no turnover data yet" />
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
                                                    <span className="ledger-sym">
                                                        {row.symbol}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.shareTraded ??
                                                            row.totalTradeQuantity
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        <EmptyRow label="no trade data yet" />
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
                                                    <span className="ledger-sym">
                                                        {row.symbol}
                                                    </span>
                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            row.totalTrades ??
                                                            row.transactionCount
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        <EmptyRow label="no transaction data yet" />
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
                                        <EmptyRow label="no imbalance data yet" />
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

                                            return (
                                                <div
                                                    key={name}
                                                    className="sector-block"
                                                >
                                                    <div
                                                        className="ledger-row sector-row"
                                                        role="button"
                                                        tabIndex={0}
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
                                                            <span className="sector-chevron">
                                                                {expanded ? "\u25be " : "\u25b8 "}
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
                                        <EmptyRow label="no sector data yet" />
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
                                        <EmptyRow label="no bond data yet" />
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
                                                    <span className="ledger-sym">
                                                        {row.symbol}
                                                    </span>
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
                                        <EmptyRow
                                            label={
                                                selectedPromoterGroup
                                                    ? "no shares in this group on this page"
                                                    : "no promoter share data yet"
                                            }
                                        />
                                    )}
                                </>
                            )}

                            {feed === "Floorsheet" && (
                                <>
                                    <p className="ledger-heading">
                                        live contracts
                                    </p>

                                    <div className="ledger-header ledger-row-3">
                                        <span>Symbol</span>
                                        <span style={{ textAlign: "right" }}>Qty</span>
                                        <span style={{ textAlign: "right" }}>Rate</span>
                                    </div>

                                    {feedLoading && !floorRows.length ? (
                                        <SkeletonRows count={6} columns={3} />
                                    ) : floorRows.length ? (
                                        floorRows
                                            .slice(0, 14)
                                            .map((row, index) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={row.id ?? index}
                                                >
                                                    <span className="ledger-sym">
                                                        {row.stockSymbol}
                                                    </span>

                                                    <span className="ledger-num">
                                                        {fmt(
                                                            row.contractQuantity,
                                                            0
                                                        )}
                                                    </span>

                                                    <span className="ledger-ltp">
                                                        {fmt(
                                                            row.contractRate
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        <EmptyRow
                                            label={
                                                floorUnavailable
                                                    ? "floorsheet temporarily unavailable"
                                                    : "no contracts yet"
                                            }
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
}