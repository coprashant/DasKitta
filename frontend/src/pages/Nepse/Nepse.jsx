import { useState, useEffect, useCallback, useMemo } from "react";
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

const FEEDS = ["Movers", "Turnover", "Activity", "Sectors", "Floorsheet"];

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

function MoverRow({ item, tone }) {
    const pct = Number(item.percentageChange ?? 0);

    return (
        <div className="ledger-row">
            <span className="ledger-sym">{item.symbol}</span>

            <span className="ledger-row-right">
                <span className="ledger-ltp">{fmt(item.ltp)}</span>

                <span className={`ledger-pct ${tone}`}>
                    <Arrow up={tone === "up"} />
                    {pct >= 0 ? "+" : ""}
                    {fmt(pct)}%
                </span>
            </span>
        </div>
    );
}

function LedgerLimitControls({
    total,
    limit,
    onMore,
    onReset,
}) {
    return (
        <div className="ledger-actions">
            {total > limit && (
                <button
                    className="ledger-action-btn up"
                    onClick={onMore}
                >
                    More <Arrow up={false} />
                </button>
            )}

            {limit > 5 && (
                <button
                    className="ledger-action-btn down"
                    onClick={onReset}
                >
                    Less <Arrow up={true} />
                </button>
            )}
        </div>
    );
}

function TickerItems({ summary }) {
    return Object.entries(summary).map(([key, value]) => (
        <span key={key} className="term-ticker-item">
            <span className="ledger-label">{key}</span>
            <span>
                {fmtCompact(
                    typeof value === "object"
                        ? JSON.stringify(value)
                        : value
                )}
            </span>
        </span>
    ));
}

export default function Nepse() {
    const clock = useClock();

    const [marketOpen, setMarketOpen] = useState(null);
    const [indices, setIndices] = useState(null);
    const [summary, setSummary] = useState(null);
    const [graphData, setGraphData] = useState([]);
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

    const fetchCore = useCallback(async () => {
        try {
            const [openRes, indexRes, summaryRes, graphRes] =
                await Promise.all([
                    isNepseOpen(),
                    getNepseIndex(),
                    getSummary(),
                    getDailyNepseIndexGraph(),
                ]);

            const open = safe(openRes.data);
            const index = safe(indexRes.data);
            const summaryData = safe(summaryRes.data);

            setMarketOpen(open);
            setIndices(index);
            setSummary(summaryData);
            setGraphData(toList(graphRes.data));

            setError(
                open == null || index == null || summaryData == null
                    ? "Some market data is temporarily unavailable"
                    : null
            );
        } catch {
            setError("Data feed unavailable");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const initialTimer = setTimeout(() => {
            void fetchCore();
        }, 0);

        const interval = setInterval(
            () => {
                void fetchCore();
            },
            REFRESH_INTERVAL
        );

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [fetchCore]);

    useEffect(() => {
        let alive = true;

        const loadFeed = async () => {
            setFeedLoading(true);

            try {
                if (feed === "Movers" && (!gainers.length || !losers.length)) {
                    const [gainerRes, loserRes] = await Promise.all([
                        getTopGainers(),
                        getTopLosers(),
                    ]);

                    if (!alive) return;

                    setGainers(
                        isNepseError(gainerRes.data)
                            ? []
                            : gainerRes.data ?? []
                    );

                    setLosers(
                        isNepseError(loserRes.data)
                            ? []
                            : loserRes.data ?? []
                    );
                }

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
        gainers.length,
        losers.length,
        turnover.length,
        topTrade.length,
        topTransaction.length,
        sectors.length,
        floorsheet,
    ]);

    const heroKey = resolveHeroKey(indices);
    const heroEntry = heroKey ? indices?.[heroKey] : null;

    const heroValue =
        heroEntry?.currentValue ??
        heroEntry?.value ??
        0;

    const heroChange = heroEntry?.change ?? 0;

    const heroPct =
        heroEntry?.percentageChange ??
        heroEntry?.perChange ??
        0;

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
            ? marketOpen?.isOpen === "OPEN" ||
            marketOpen?.isOpen === true
            : marketOpen === true ||
            marketOpen === "OPEN";

    const floorRows = useMemo(() => {
        if (Array.isArray(floorsheet)) return floorsheet;

        return floorsheet?.floorsheets?.content ?? [];
    }, [floorsheet]);

    const sectorRows = useMemo(
        () =>
            sectors.filter((sector) => {
                if (!indices) return true;

                const name =
                    sector.name ??
                    sector.index ??
                    "";

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
                const response =
                    await matchSectorGraph(name)();

                setSectorGraphs((current) => ({
                    ...current,
                    [name]: toList(response.data),
                }));
            } catch {
                setSectorGraphs((current) => ({
                    ...current,
                    [name]: [],
                }));
            }
        },
        [expandedSector, sectorGraphs]
    );

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
                        <span className="term-brand-name">
                            NEPSE
                        </span>
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
                            {loading
                                ? [1, 2, 3, 4].map((key) => (
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
                                        );
                                    }
                                )}
                        </div>
                    </div>

                    <aside className="term-ledger">
                        <div className="ledger-tabs ledger-tabs-feeds">
                            {FEEDS.map((item) => (
                                <button
                                    key={item}
                                    className={`ledger-tab ${
                                        feed === item
                                            ? "active"
                                            : ""
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

                                    {feedLoading &&
                                    !gainers.length ? (
                                        <SkeletonRows count={3} />
                                    ) : gainers.length ? (
                                        <>
                                            {gainers
                                                .slice(
                                                    0,
                                                    gainerLimit
                                                )
                                                .map((row) => (
                                                    <MoverRow
                                                        key={
                                                            row.symbol
                                                        }
                                                        item={row}
                                                        tone="up"
                                                    />
                                                ))}

                                            <LedgerLimitControls
                                                total={gainers.length}
                                                limit={gainerLimit}
                                                onMore={() =>
                                                    setGainerLimit(
                                                        (value) => value + 5
                                                    )
                                                }
                                                onReset={() => setGainerLimit(5)}
                                            />
                                        </>
                                    ) : (
                                        <EmptyRow label="no gainers yet" />
                                    )}

                                    <p className="ledger-heading down">
                                        losers
                                    </p>

                                    {feedLoading &&
                                    !losers.length ? (
                                        <SkeletonRows count={3} />
                                    ) : losers.length ? (
                                        <>
                                            {losers
                                                .slice(
                                                    0,
                                                    loserLimit
                                                )
                                                .map((row) => (
                                                    <MoverRow
                                                        key={
                                                            row.symbol
                                                        }
                                                        item={row}
                                                        tone="down"
                                                    />
                                                ))}

                                            <LedgerLimitControls
                                                total={losers.length}
                                                limit={loserLimit}
                                                onMore={() =>
                                                    setLoserLimit(
                                                        (value) => value + 5
                                                    )
                                                }
                                                onReset={() => setLoserLimit(5)}
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

                                    {feedLoading &&
                                    !turnover.length ? (
                                        <SkeletonRows count={4} />
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

                                    {feedLoading &&
                                    !topTrade.length ? (
                                        <SkeletonRows count={3} />
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

                                    {feedLoading &&
                                    !topTransaction.length ? (
                                        <SkeletonRows count={3} />
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

                                    {feedLoading &&
                                    !supplyDemand.length ? (
                                        <SkeletonRows count={3} />
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
                                                            {buy !=
                                                            null
                                                                ? fmtCompact(
                                                                    buy
                                                                )
                                                                : "--"}
                                                        </span>

                                                        <span className="ledger-num">
                                                            {sell !=
                                                            null
                                                                ? fmtCompact(
                                                                    sell
                                                                )
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

                                    {feedLoading &&
                                    !sectorRows.length ? (
                                        <SkeletonRows count={4} />
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
                                                expandedSector ===
                                                name;

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
                                                            {name}
                                                        </span>

                                                        <span
                                                            className={`ledger-pct ${dirClass(
                                                                change
                                                            )}`}
                                                        >
                                                            <Arrow
                                                                up={
                                                                    change >=
                                                                    0
                                                                }
                                                                flat={
                                                                    change ===
                                                                    0
                                                                }
                                                            />
                                                            {change >=
                                                            0
                                                                ? "+"
                                                                : ""}
                                                            {fmt(
                                                                change
                                                            )}
                                                            %
                                                        </span>
                                                    </div>

                                                    {expanded && (
                                                        <div className="sector-expand">
                                                            <MiniSpark
                                                                data={
                                                                    sectorGraphs[
                                                                        name
                                                                        ]
                                                                }
                                                            />
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
                                    <p className="ledger-heading">
                                        live contracts
                                    </p>

                                    {feedLoading &&
                                    !floorRows.length ? (
                                        <SkeletonRows count={4} />
                                    ) : floorRows.length ? (
                                        floorRows
                                            .slice(0, 14)
                                            .map((row, index) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={
                                                        row.id ??
                                                        index
                                                    }
                                                >
                                                    <span className="ledger-sym">
                                                        {
                                                            row.stockSymbol
                                                        }
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