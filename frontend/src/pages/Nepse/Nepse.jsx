import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
    fmt,
    fmtCompact,
    dirClass,
    Arrow,
    useClock,
    resolveHeroKey,
    HeroChart,
    MiniSpark,
    TermSearch,
    EmptyRow,
    SkeletonRows,
} from "./nepseShared.jsx";
import "./Nepse.css";

const REFRESH_INTERVAL = 30000;

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

function matchSectorGraph(name = "") {
    const rule = SECTOR_GRAPH_RULES.find((r) => r.test.test(name));
    return rule ? rule.fetch : getDailyOthersSubindexGraph;
}

function toList(raw) {
    if (isNepseError(raw)) return [];
    return Array.isArray(raw) ? raw : raw?.data ?? Object.values(raw ?? {});
}

function toNamedList(raw) {
    if (isNepseError(raw)) return [];
    return Array.isArray(raw)
        ? raw
        : Object.entries(raw ?? {}).map(([name, v]) => ({ name, ...v }));
}

// Returns data as is, or null if it is the error fallback shape
function safe(raw) {
    return isNepseError(raw) ? null : raw;
}

function MoverRow({ item, tone }) {
    const pct = item.percentageChange ?? 0;
    return (
        <div className="ledger-row">
            <span className="ledger-sym">{item.symbol}</span>
            <span className="ledger-row-right">
        <span className="ledger-ltp">{fmt(item.ltp)}</span>
        <span className={`ledger-pct ${tone}`}>
          <Arrow up={tone === "up"} /> {pct >= 0 ? "+" : ""}
            {fmt(pct)}%
        </span>
      </span>
        </div>
    );
}

function TickerItems({ summary, dupSuffix = "" }) {
    return Object.entries(summary).map(([k, v]) => (
        <span key={`${k}${dupSuffix}`} className="term-ticker-item">
      <span className="ledger-label">{k}</span>
      <span>{fmtCompact(typeof v === "object" ? JSON.stringify(v) : v)}</span>
    </span>
    ));
}

export default function Nepse() {
    const clock = useClock();

    const [marketOpen, setMarketOpen] = useState(null);
    const [indices, setIndices] = useState(null);
    const [summary, setSummary] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [feed, setFeed] = useState("Movers");
    const [gainerLimit, setGainerLimit] = useState(5);
    const [loserLimit, setLoserLimit] = useState(5);
    const [gainers, setGainers] = useState([]);
    const [losers, setLosers] = useState([]);
    const [turnover, setTurnover] = useState([]);
    const [topTrade, setTopTrade] = useState([]);
    const [topTransaction, setTopTransaction] = useState([]);
    const [supplyDemand, setSupplyDemand] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [floorsheet, setFloorsheet] = useState(null);
    const [floorUnavailable, setFloorUnavailable] = useState(false);
    const [feedLoading, setFeedLoading] = useState(true);

    const [expandedSector, setExpandedSector] = useState(null);
    const [sectorGraphs, setSectorGraphs] = useState({});

    const tickerRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    // Mouse/Touch Drag Controls using Pointer Events (Prevents Stuck Dragging)
    const handlePointerDown = (e) => {
        isDragging.current = true;
        startX.current = e.pageX - tickerRef.current.offsetLeft;
        scrollLeft.current = tickerRef.current.scrollLeft;
        tickerRef.current.setPointerCapture(e.pointerId);
    };

    const handlePointerUpOrCancel = (e) => {
        isDragging.current = false;
        try {
            tickerRef.current.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if pointer capture was already released
        }
    };

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        const x = e.pageX - tickerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        tickerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // Safe Core Fetching
    const fetchCore = useCallback(async () => {
        try {
            const [openRes, indexRes, summaryRes, graphRes] = await Promise.all([
                isNepseOpen(),
                getNepseIndex(),
                getSummary(),
                getDailyNepseIndexGraph(),
            ]);

            const open = safe(openRes.data);
            const idx = safe(indexRes.data);
            const summ = safe(summaryRes.data);
            const graph = toList(graphRes.data);

            setMarketOpen(open);
            setIndices(idx);
            setSummary(summ);
            setGraphData(graph);

            // Core feed partly or fully unavailable upstream
            if (open == null || idx == null || summ == null) {
                setError("Some market data is temporarily unavailable");
            } else {
                setError(null);
            }
        } catch (e) {
            setError("Data feed unavailable");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCore();
        const id = setInterval(fetchCore, REFRESH_INTERVAL);
        return () => clearInterval(id);
    }, [fetchCore]);

    // Safe Tab Data Fetching with Cancellation Handling
    useEffect(() => {
        let alive = true;
        setFeedLoading(true);

        const load = async () => {
            try {
                if (feed === "Movers" && !gainers.length) {
                    const [g, l] = await Promise.all([getTopGainers(), getTopLosers()]);
                    if (!alive) return;
                    setGainers(isNepseError(g.data) ? [] : g.data ?? []);
                    setLosers(isNepseError(l.data) ? [] : l.data ?? []);
                } else if (feed === "Turnover" && !turnover.length) {
                    const t = await getTopTurnover();
                    if (!alive) return;
                    setTurnover(isNepseError(t.data) ? [] : t.data ?? []);
                } else if (feed === "Activity" && !topTrade.length) {
                    const [t, tr] = await Promise.all([
                        getTopTrade(),
                        getTopTransaction(),
                    ]);
                    if (!alive) return;
                    setTopTrade(isNepseError(t.data) ? [] : t.data ?? []);
                    setTopTransaction(isNepseError(tr.data) ? [] : tr.data ?? []);
                    try {
                        const sd = await getSupplyDemand();
                        if (!alive) return;
                        setSupplyDemand(toList(sd.data));
                    } catch {
                        // Non-critical endpoint ignore
                    }
                } else if (feed === "Sectors" && !sectors.length) {
                    const s = await getNepseSubIndices();
                    if (!alive) return;
                    setSectors(toNamedList(s.data));
                } else if (feed === "Floorsheet" && !floorsheet) {
                    const f = await getFloorsheet();
                    if (!alive) return;
                    if (isNepseError(f.data)) {
                        setFloorsheet(null);
                        setFloorUnavailable(true);
                    } else {
                        setFloorsheet(f.data);
                        setFloorUnavailable(false);
                    }
                }
            } finally {
                if (alive) {
                    setFeedLoading(false);
                }
            }
        };

        load();
        return () => {
            alive = false;
        };
    }, [feed, gainers.length, turnover.length, topTrade.length, sectors.length, floorsheet]);

    const heroKey = resolveHeroKey(indices);
    const heroEntry = heroKey ? indices?.[heroKey] : null;
    const heroValue = heroEntry?.currentValue ?? heroEntry?.value ?? 0;
    const heroChange = heroEntry?.change ?? 0;
    const heroPct = heroEntry?.percentageChange ?? heroEntry?.perChange ?? 0;

    const secondaryIndices = useMemo(
        () => (indices ? Object.entries(indices).filter(([name]) => name !== heroKey) : []),
        [indices, heroKey]
    );

    const openBool =
        typeof marketOpen === "object"
            ? marketOpen?.isOpen === "OPEN"
            : marketOpen === true || marketOpen === "OPEN";

    const floorRows = useMemo(
        () => (Array.isArray(floorsheet) ? floorsheet : floorsheet?.floorsheets?.content ?? []),
        [floorsheet]
    );

    const sectorRows = useMemo(
        () =>
            sectors.filter(
                (s) =>
                    !indices ||
                    !Object.prototype.hasOwnProperty.call(indices, s.name ?? s.index ?? "")
            ),
        [sectors, indices]
    );

    const toggleSector = async (name) => {
        if (expandedSector === name) {
            setExpandedSector(null);
            return;
        }
        setExpandedSector(name);
        if (!sectorGraphs[name]) {
            try {
                const fetcher = matchSectorGraph(name);
                const res = await fetcher();
                setSectorGraphs((prev) => ({ ...prev, [name]: toList(res.data) }));
            } catch {
                setSectorGraphs((prev) => ({ ...prev, [name]: [] }));
            }
        }
    };

    return (
        <Layout>
            <div className="term-shell">
                {/* Header */}
                <header className="term-header">
                    <div className="term-brand">
                        <span className="term-brand-name">NEPSE</span>
                        <span className="term-brand-tag">live market feed</span>
                    </div>

                    <TermSearch />

                    <div className="term-header-right">
            <span className={`term-status ${openBool ? "open" : "closed"}`}>
              <span className="term-status-dot" />
                {marketOpen === null
                    ? "connecting"
                    : openBool
                        ? "market open"
                        : "market closed"}
            </span>
                        <span className="term-clock">
              {clock.toLocaleTimeString("en-NP", { hour12: false })}
            </span>
                    </div>
                </header>

                {error && <div className="term-alert">{error}</div>}

                {/* Main Canvas */}
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
                            <div
                                className="term-ticker"
                                ref={tickerRef}
                                onPointerDown={handlePointerDown}
                                onPointerUp={handlePointerUpOrCancel}
                                onPointerCancel={handlePointerUpOrCancel}
                                onPointerMove={handlePointerMove}
                            >
                                <div className="term-ticker-track">
                                    <TickerItems summary={summary} />
                                </div>
                                <div
                                    className="term-ticker-track mobile-only-duplicate"
                                    aria-hidden="true"
                                >
                                    <TickerItems summary={summary} dupSuffix="-dup" />
                                </div>
                            </div>
                        )}

                        <div className="index-strip">
                            {loading
                                ? [1, 2, 3, 4].map((i) => <div key={i} className="skel index-skel" />)
                                : secondaryIndices.map(([name, d]) => {
                                    const change = d.percentageChange ?? d.perChange ?? 0;
                                    return (
                                        <div key={name} className="index-item">
                                            <span className="index-name">{name}</span>
                                            <span className="index-value">
                          {fmt(d.currentValue ?? d.value)}
                        </span>
                                            <span className={`index-change ${dirClass(change)}`}>
                          <Arrow up={change >= 0} flat={change === 0} />
                                                {change >= 0 ? "+" : ""}
                                                {fmt(change)}%
                        </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Ledger Sidebar */}
                    <aside className="term-ledger">
                        <div className="ledger-tabs">
                            {["Movers", "Turnover", "Activity", "Sectors", "Floorsheet"].map(
                                (tab) => (
                                    <button
                                        key={tab}
                                        className={`ledger-tab ${feed === tab ? "active" : ""}`}
                                        onClick={() => setFeed(tab)}
                                    >
                                        {tab}
                                    </button>
                                )
                            )}
                        </div>

                        <div className="ledger-body">
                            {feed === "Movers" && (
                                <>
                                    <p className="ledger-heading up">gainers</p>
                                    {feedLoading && !gainers.length ? (
                                        <SkeletonRows count={3} />
                                    ) : gainers.length ? (
                                        <>
                                            {gainers.slice(0, gainerLimit).map((r) => (
                                                <MoverRow key={r.symbol} item={r} tone="up" />
                                            ))}
                                            <div className="ledger-actions">
                                                {gainers.length > gainerLimit && (
                                                    <button
                                                        className="ledger-action-btn up"
                                                        onClick={() => setGainerLimit((prev) => prev + 5)}
                                                    >
                                                        More <Arrow up={false} />
                                                    </button>
                                                )}
                                                {gainerLimit > 5 && (
                                                    <button
                                                        className="ledger-action-btn down"
                                                        onClick={() => setGainerLimit(5)}
                                                    >
                                                        Less <Arrow up={true} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <EmptyRow label="no gainers yet" />
                                    )}

                                    <p className="ledger-heading down">losers</p>
                                    {feedLoading && !losers.length ? (
                                        <SkeletonRows count={3} />
                                    ) : losers.length ? (
                                        <>
                                            {losers.slice(0, loserLimit).map((r) => (
                                                <MoverRow key={r.symbol} item={r} tone="down" />
                                            ))}
                                            <div className="ledger-actions">
                                                {losers.length > loserLimit && (
                                                    <button
                                                        className="ledger-action-btn up"
                                                        onClick={() => setLoserLimit((prev) => prev + 5)}
                                                    >
                                                        More <Arrow up={false} />
                                                    </button>
                                                )}
                                                {loserLimit > 5 && (
                                                    <button
                                                        className="ledger-action-btn down"
                                                        onClick={() => setLoserLimit(5)}
                                                    >
                                                        Less <Arrow up={true} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <EmptyRow label="no losers yet" />
                                    )}
                                </>
                            )}

                            {feed === "Turnover" && (
                                <>
                                    <p className="ledger-heading">top turnover</p>
                                    {feedLoading && !turnover.length ? (
                                        <SkeletonRows count={4} />
                                    ) : turnover.length ? (
                                        turnover.slice(0, 10).map((r) => (
                                            <div className="ledger-row ledger-row-4" key={r.symbol}>
                                                <span className="ledger-sym">{r.symbol}</span>
                                                <span className="ledger-num">{fmtCompact(r.turnover)}</span>
                                                <span className="ledger-num">{fmtCompact(r.shareTraded)}</span>
                                                <span className="ledger-ltp">{fmt(r.ltp)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <EmptyRow label="no turnover data yet" />
                                    )}
                                </>
                            )}

                            {feed === "Activity" && (
                                <>
                                    <p className="ledger-heading">top trade by volume</p>
                                    {feedLoading && !topTrade.length ? (
                                        <SkeletonRows count={3} />
                                    ) : topTrade.length ? (
                                        topTrade.slice(0, 6).map((r) => (
                                            <div className="ledger-row" key={r.symbol}>
                                                <span className="ledger-sym">{r.symbol}</span>
                                                <span className="ledger-num">
                          {fmtCompact(r.shareTraded ?? r.totalTradeQuantity)}
                        </span>
                                            </div>
                                        ))
                                    ) : (
                                        <EmptyRow label="no trade data yet" />
                                    )}

                                    <p className="ledger-heading">top by transactions</p>
                                    {feedLoading && !topTransaction.length ? (
                                        <SkeletonRows count={3} />
                                    ) : topTransaction.length ? (
                                        topTransaction.slice(0, 6).map((r) => (
                                            <div className="ledger-row" key={r.symbol}>
                                                <span className="ledger-sym">{r.symbol}</span>
                                                <span className="ledger-num">
                          {fmtCompact(r.totalTrades ?? r.transactionCount)}
                        </span>
                                            </div>
                                        ))
                                    ) : (
                                        <EmptyRow label="no transaction data yet" />
                                    )}

                                    <p className="ledger-heading">supply demand imbalance</p>
                                    {feedLoading && !supplyDemand.length ? (
                                        <SkeletonRows count={3} />
                                    ) : supplyDemand.length ? (
                                        supplyDemand.slice(0, 6).map((r, i) => {
                                            const buy =
                                                r.buyQuantity ?? r.totalBuyQty ?? r.buyQty ?? null;
                                            const sell =
                                                r.sellQuantity ?? r.totalSellQty ?? r.sellQty ?? null;
                                            return (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={r.symbol ?? i}
                                                >
                          <span className="ledger-sym">
                            {r.symbol ?? r.securityName}
                          </span>
                                                    <span className="ledger-num">
                            {buy != null ? fmtCompact(buy) : "--"}
                          </span>
                                                    <span className="ledger-num">
                            {sell != null ? fmtCompact(sell) : "--"}
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
                                    <p className="ledger-heading">sector sub indices</p>
                                    {feedLoading && !sectorRows.length ? (
                                        <SkeletonRows count={4} />
                                    ) : sectorRows.length ? (
                                        sectorRows.map((s) => {
                                            const name = s.name ?? s.index ?? "sector";
                                            const change =
                                                s.percentageChange ?? s.perChange ?? s.change ?? 0;
                                            const expanded = expandedSector === name;
                                            return (
                                                <div key={name} className="sector-block">
                                                    <div
                                                        className="ledger-row sector-row"
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleSector(name)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                toggleSector(name);
                                                            }
                                                        }}
                                                    >
                                                        <span className="ledger-sym">{name}</span>
                                                        <span className={`ledger-pct ${dirClass(change)}`}>
                              <Arrow up={change >= 0} flat={change === 0} />
                                                            {change >= 0 ? "+" : ""}
                                                            {fmt(change)}%
                            </span>
                                                    </div>
                                                    {expanded && (
                                                        <div className="sector-expand">
                                                            <MiniSpark data={sectorGraphs[name]} />
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

                            {feed === "Floorsheet" && (
                                <>
                                    <p className="ledger-heading">live contracts</p>
                                    {feedLoading && !floorRows.length ? (
                                        <SkeletonRows count={4} />
                                    ) : floorRows.length ? (
                                        floorRows.slice(0, 14).map((r, i) => (
                                            <div className="ledger-row ledger-row-3" key={i}>
                                                <span className="ledger-sym">{r.stockSymbol}</span>
                                                <span className="ledger-num">
                          {fmt(r.contractQuantity, 0)}
                        </span>
                                                <span className="ledger-ltp">
                          {fmt(r.contractRate)}
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