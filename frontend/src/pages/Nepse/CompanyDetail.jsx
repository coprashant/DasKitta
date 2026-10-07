import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getCompanyDetails,
    getDailyScripPriceGraph,
    getMarketDepth,
    getPriceVolumeHistory,
    getFloorsheetOf,
    getCompanyClassification,
    isNepseError,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import {
    Arrow,
    HeroChart,
    MiniSpark,
    RangeBar,
    TermSearch,
    EmptyRow,
    SkeletonRows,
    ScrollTicker,
    WatchButton,
    InlineNotice,
    TabStrip,
    Pagination,
    Field,
    Stat,
    StatGrid,
    InfoRow,
    AlertBanner,
    AlertManager,
} from "./nepseShared.jsx";
import {
    fmt,
    fmtCompact,
    fmtSigned,
    dirClass,
    minMax,
    parseInput,
} from "./nepseUtils";
import {
    toNum,
    pointsFromHistory,
    computeStats,
    aggregateBrokers,
    floorStats,
    tradeResult,
    breakEven,
    buyCost,
} from "./nepseMath";
import {
    useWatchlist,
    usePriceVolume,
    loadPriceVolume,
    useAlerts,
} from "./nepseHooks";
import { IconRefresh } from "../../components/Icons.jsx";
import SEO from "../../seo/SEO.jsx";
import { companyDetailJsonLd } from "../../seo/jsonLd.js";
import "./Nepse.css";
import "./CompanyDetail.css";

function textOf(v) {
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object") return v.description ?? v.name ?? v.code ?? null;
    return null;
}

function pickDetails(raw) {
    if (!raw) return {};

    const src = raw.security ?? raw.company ?? raw;
    const daily = raw.securityDailyTradeDto ?? {};

    return {
        name: textOf(src.securityName ?? src.companyName ?? src.name),
        sector: textOf(src.sectorName ?? src.sector),
        instrument: textOf(src.instrumentType ?? src.securityType),
        listedShares: src.listedShares ?? src.totalListedShares ?? null,
        faceValue: src.faceValue ?? null,
        marketCap: raw.marketCapitalization ?? null,
        publicShares: raw.publicShares ?? null,
        promoterShares: raw.promoterShares ?? null,
        open: daily.openPrice ?? null,
        high: daily.highPrice ?? null,
        low: daily.lowPrice ?? null,
    };
}

// Finds this symbol in a classification Page response and returns its group name
function pickShareGroup(raw, symbol) {
    if (isNepseError(raw)) return null;

    const list = Array.isArray(raw) ? raw : raw?.content ?? [];
    const match = list.find(
        (row) => (row.symbol ?? "").toUpperCase() === symbol.toUpperCase()
    );

    return match?.shareGroupId?.name ?? null;
}

function toGraphList(raw) {
    if (raw == null) return null;
    if (Array.isArray(raw)) return raw;

    return raw?.data ?? Object.values(raw);
}

const COMPANY_TABS = ["Depth", "History", "Floorsheet", "Brokers", "Levels", "Calc"];
const HISTORY_ROWS = 12;
const HISTORY_SPARK_POINTS = 60;
const FLOOR_ROWS = 12;
const LIVE_REFRESH_MS = 30000;
const QTY_FILTERS = [
    ["all", 0],
    ["100+", 100],
    ["1K+", 1000],
    ["5K+", 5000],
    ["10K+", 10000],
];

// sessions sorted newest first with change against the older session
function buildSessions(points) {
    if (points.length < 2) return null;

    const rows = points.map((p, i) => ({
        date: p.d,
        close: p.c,
        volume: p.v,
        change:
            i > 0 && points[i - 1].c ? (p.c / points[i - 1].c - 1) * 100 : null,
    }));

    return {
        newestFirst: [...rows].reverse(),
        closes: rows.slice(-HISTORY_SPARK_POINTS).map((r) => r.close),
    };
}

function OverviewTickerItem({ label, value }) {
    return (
        <span className="term-ticker-item">
            <span className="ledger-label">{label}</span>
            <span>{value}</span>
        </span>
    );
}

/* overview items shared between the primary and duplicate scroll tracks */
function OverviewItems({ info, weekStats, shareGroup, stats }) {
    return (
        <>
            {info.open != null && (
                <OverviewTickerItem label="open" value={fmt(info.open)} />
            )}
            {info.high != null && (
                <OverviewTickerItem label="high" value={fmt(info.high)} />
            )}
            {info.low != null && (
                <OverviewTickerItem label="low" value={fmt(info.low)} />
            )}
            {info.instrument && (
                <OverviewTickerItem label="instrument" value={info.instrument} />
            )}
            {shareGroup && (
                <OverviewTickerItem label="group" value={shareGroup} />
            )}
            {info.marketCap != null && (
                <OverviewTickerItem label="market cap" value={fmtCompact(info.marketCap)} />
            )}
            {info.listedShares && (
                <OverviewTickerItem label="listed shares" value={fmtCompact(info.listedShares)} />
            )}
            {info.faceValue != null && (
                <OverviewTickerItem label="face value" value={fmt(info.faceValue)} />
            )}
            {info.publicShares != null && (
                <OverviewTickerItem label="public shares" value={fmtCompact(info.publicShares)} />
            )}
            {info.promoterShares != null && (
                <OverviewTickerItem label="promoter shares" value={fmtCompact(info.promoterShares)} />
            )}
            {weekStats && (
                <OverviewTickerItem
                    label="range"
                    value={`${fmt(weekStats.low)} - ${fmt(weekStats.high)}`}
                />
            )}
            {stats?.rsi != null && (
                <OverviewTickerItem label="rsi 14" value={fmt(stats.rsi, 1)} />
            )}
            {stats?.returns?.["1M"] != null && (
                <OverviewTickerItem
                    label="1m"
                    value={`${fmtSigned(stats.returns["1M"])}%`}
                />
            )}
            {stats?.avgVol != null && (
                <OverviewTickerItem label="avg vol 20d" value={fmtCompact(stats.avgVol)} />
            )}
        </>
    );
}

/* depth */

const depthPrice = (row) => toNum(row.orderPrice ?? row.price ?? row.rate);
const depthQty = (row) =>
    toNum(row.orderQuantity ?? row.quantity ?? row.qty) ?? 0;

function DepthRow({ row, max, tone }) {
    const pct = max ? Math.min(100, (depthQty(row) / max) * 100) : 0;

    return (
        <div
            className={`ledger-row depth-row depth-${tone}`}
            style={{ "--depth": pct }}
        >
            <span className="ledger-sym">{fmt(depthPrice(row))}</span>

            <span className="ledger-num">{fmt(depthQty(row), 0)}</span>
        </div>
    );
}

function DepthSection({
                          heading,
                          headingTone,
                          rows,
                          loading,
                          emptyLabel,
                          failed = false,
                      }) {
    const shown = rows.slice(0, 6);
    const max = Math.max(0, ...shown.map(depthQty));

    return (
        <>
            <p className={`ledger-heading ${headingTone}`}>{heading}</p>

            {loading && !rows.length ? (
                <SkeletonRows count={3} columns={2} />
            ) : rows.length ? (
                shown.map((row, index) => (
                    <DepthRow row={row} key={index} max={max} tone={headingTone} />
                ))
            ) : failed ? null : (
                <EmptyRow label={emptyLabel} />
            )}
        </>
    );
}

// total bid against total ask for the shown depth
function DepthSummary({ bids, asks }) {
    const bidTotal = bids.slice(0, 6).reduce((a, r) => a + depthQty(r), 0);
    const askTotal = asks.slice(0, 6).reduce((a, r) => a + depthQty(r), 0);

    if (!bidTotal && !askTotal) return null;

    const bidPrices = bids.map(depthPrice).filter((v) => v != null);
    const askPrices = asks.map(depthPrice).filter((v) => v != null);
    const spread =
        bidPrices.length && askPrices.length
            ? Math.min(...askPrices) - Math.max(...bidPrices)
            : null;

    return (
        <div className="breadth">
            <div className="breadth-head">
                <span className="ledger-label">order book</span>

                <span className="breadth-counts">
                    <span className="up">bid {fmtCompact(bidTotal)}</span>
                    {spread != null && (
                        <span className="flat">spread {fmt(spread)}</span>
                    )}
                    <span className="down">ask {fmtCompact(askTotal)}</span>
                </span>
            </div>

            <div className="breadth-bar" aria-hidden="true">
                <span className="breadth-seg up" style={{ flexGrow: bidTotal }} />
                <span className="breadth-seg down" style={{ flexGrow: askTotal }} />
            </div>
        </div>
    );
}

/* floorsheet */

function FloorsheetPanel({ rows, loading, tabError, unavailable }) {
    const [minQty, setMinQty] = useState(0);
    const [page, setPage] = useState(0);

    const filtered = useMemo(
        () =>
            minQty
                ? rows.filter(
                    (r) => (toNum(r.contractQuantity ?? r.quantity) ?? 0) >= minQty
                )
                : rows,
        [rows, minQty]
    );

    const stats = useMemo(() => floorStats(filtered), [filtered]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / FLOOR_ROWS));
    const pageSafe = Math.min(page, totalPages - 1);
    const pageRows = filtered.slice(
        pageSafe * FLOOR_ROWS,
        pageSafe * FLOOR_ROWS + FLOOR_ROWS
    );

    return (
        <>
            <p className="ledger-heading">recent contracts</p>

            {rows.length > 0 && (
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
            )}

            {stats.contracts > 0 && (
                <StatGrid>
                    <Stat label="contracts" value={fmt(stats.contracts, 0)} />
                    <Stat label="quantity" value={fmtCompact(stats.qty)} />
                    <Stat label="vwap" value={fmt(stats.vwap)} />
                    <Stat label="largest" value={fmt(stats.largest, 0)} />
                </StatGrid>
            )}

            {loading && !rows.length ? (
                <SkeletonRows count={6} columns={3} />
            ) : pageRows.length ? (
                <>
                    <div className="ledger-header ledger-row-3">
                        <span>Qty</span>
                        <span style={{ textAlign: "right" }}>Rate</span>
                        <span style={{ textAlign: "right" }}>Buy/Sell</span>
                    </div>

                    {pageRows.map((r, i) => (
                        <div className="ledger-row ledger-row-3" key={i}>
                            <span className="ledger-sym">
                                {fmt(r.contractQuantity ?? r.quantity, 0)}
                            </span>

                            <span className="ledger-num">
                                {fmt(r.contractRate ?? r.rate)}
                            </span>

                            <span className="ledger-ltp">
                                {r.buyerMemberId ?? r.buyerBroker ?? "--"}/
                                {r.sellerMemberId ?? r.sellerBroker ?? "--"}
                            </span>
                        </div>
                    ))}

                    <Pagination
                        page={pageSafe}
                        totalPages={totalPages}
                        onChange={setPage}
                    />
                </>
            ) : tabError ? null : (
                <EmptyRow
                    label={
                        unavailable
                            ? "floorsheet temporarily unavailable"
                            : rows.length
                                ? "no contracts match"
                                : "no contracts yet"
                    }
                />
            )}
        </>
    );
}

/* brokers */

function BrokerRows({ list }) {
    return list.map((b) => (
        <div className="ledger-row ledger-row-4" key={b.id}>
            <span className="ledger-sym">{b.id}</span>
            <span className="ledger-num">{fmtCompact(b.buy)}</span>
            <span className="ledger-num">{fmtCompact(b.sell)}</span>
            <span className={`ledger-num ${dirClass(b.net)}`}>
                {b.net > 0 ? "+" : ""}
                {fmtCompact(b.net)}
            </span>
        </div>
    ));
}

function BrokersPanel({ rows, loading, tabError, unavailable }) {
    const model = useMemo(() => {
        const all = aggregateBrokers(rows);
        if (!all.length) return null;

        const buyTotal = all.reduce((a, b) => a + b.buy, 0);
        const sellTotal = all.reduce((a, b) => a + b.sell, 0);
        const byBuy = [...all].sort((a, b) => b.buy - a.buy);
        const bySell = [...all].sort((a, b) => b.sell - a.sell);
        const share = (list, key, total) =>
            total
                ? (list.slice(0, 3).reduce((a, b) => a + b[key], 0) / total) * 100
                : null;

        return {
            count: all.length,
            buyers: [...all].filter((b) => b.net > 0).sort((a, b) => b.net - a.net).slice(0, 6),
            sellers: [...all].filter((b) => b.net < 0).sort((a, b) => a.net - b.net).slice(0, 6),
            topBuy: share(byBuy, "buy", buyTotal),
            topSell: share(bySell, "sell", sellTotal),
        };
    }, [rows]);

    if (loading && !rows.length) return <SkeletonRows count={6} columns={4} />;

    if (!model) {
        return tabError ? null : (
            <EmptyRow
                label={
                    unavailable
                        ? "floorsheet temporarily unavailable"
                        : "no broker data yet"
                }
            />
        );
    }

    return (
        <>
            <StatGrid>
                <Stat label="brokers" value={fmt(model.count, 0)} />
                <Stat label="contracts" value={fmt(rows.length, 0)} />
                <Stat
                    label="top 3 buy share"
                    value={model.topBuy != null ? `${fmt(model.topBuy, 1)}%` : "--"}
                />
                <Stat
                    label="top 3 sell share"
                    value={model.topSell != null ? `${fmt(model.topSell, 1)}%` : "--"}
                />
            </StatGrid>

            <p className="ledger-heading up">net buyers</p>

            <div className="ledger-header ledger-row-4">
                <span>Broker</span>
                <span style={{ textAlign: "right" }}>Buy</span>
                <span style={{ textAlign: "right" }}>Sell</span>
                <span style={{ textAlign: "right" }}>Net</span>
            </div>

            {model.buyers.length ? (
                <BrokerRows list={model.buyers} />
            ) : (
                <EmptyRow label="no net buyers" />
            )}

            <p className="ledger-heading down">net sellers</p>

            {model.sellers.length ? (
                <BrokerRows list={model.sellers} />
            ) : (
                <EmptyRow label="no net sellers" />
            )}

            <p className="ledger-empty">based on the contracts loaded for today</p>
        </>
    );
}

/* levels */

function rsiState(v) {
    if (v == null) return "";
    if (v >= 70) return "overbought";
    if (v <= 30) return "oversold";

    return "neutral";
}

function pctTone(v) {
    return v == null ? "" : dirClass(v);
}

function LevelsPanel({ stats, symbol, price, alerts, rows }) {
    const pivotNames = [
        ["r3", "R3"],
        ["r2", "R2"],
        ["r1", "R1"],
        ["p", "Pivot"],
        ["s1", "S1"],
        ["s2", "S2"],
        ["s3", "S3"],
    ];

    return (
        <>
            {stats ? (
                <>
                    <p className="ledger-heading">trend and momentum</p>

                    <InfoRow
                        label="rsi 14"
                        value={`${fmt(stats.rsi, 1)} ${rsiState(stats.rsi)}`}
                    />
                    <InfoRow
                        label="vs sma 20"
                        value={
                            stats.sma20
                                ? `${fmtSigned((stats.last.c / stats.sma20 - 1) * 100)}%`
                                : "--"
                        }
                        tone={stats.sma20 ? dirClass(stats.last.c - stats.sma20) : ""}
                    />
                    <InfoRow
                        label="vs sma 50"
                        value={
                            stats.sma50
                                ? `${fmtSigned((stats.last.c / stats.sma50 - 1) * 100)}%`
                                : "--"
                        }
                        tone={stats.sma50 ? dirClass(stats.last.c - stats.sma50) : ""}
                    />
                    <InfoRow
                        label="atr 14"
                        value={
                            stats.atr != null
                                ? `${fmt(stats.atr)} (${fmt(stats.atrPct, 1)}%)`
                                : "--"
                        }
                    />
                    <InfoRow
                        label="daily volatility"
                        value={stats.vol != null ? `${fmt(stats.vol)}%` : "--"}
                    />
                    <InfoRow
                        label="from period high"
                        value={`${fmtSigned(stats.fromHigh)}%`}
                        tone={pctTone(stats.fromHigh)}
                    />
                    <InfoRow
                        label="from period low"
                        value={`${fmtSigned(stats.fromLow)}%`}
                        tone={pctTone(stats.fromLow)}
                    />

                    <p className="ledger-heading">returns</p>

                    {Object.entries(stats.returns).map(([name, value]) => (
                        <InfoRow
                            key={name}
                            label={name}
                            value={value != null ? `${fmtSigned(value)}%` : "--"}
                            tone={pctTone(value)}
                        />
                    ))}

                    <p className="ledger-heading">
                        pivot levels from {stats.last.d ?? "last session"}
                    </p>

                    {pivotNames.map(([key, name]) => {
                        const level = stats.pivots[key];
                        const away = price ? (level / price - 1) * 100 : null;

                        return (
                            <div className="ledger-row ledger-row-3" key={key}>
                                <span className="ledger-label">{name}</span>
                                <span className="ledger-num">{fmt(level)}</span>
                                <span className={`ledger-num ${pctTone(away)}`}>
                                    {away != null ? `${fmtSigned(away)}%` : "--"}
                                </span>
                            </div>
                        );
                    })}
                </>
            ) : (
                <EmptyRow label="not enough history for levels" />
            )}

            <AlertManager alerts={alerts} symbol={symbol} rows={rows} />
        </>
    );
}

/* trade calculator */

function CalcPanel({ price }) {
    const [qty, setQty] = useState("10");
    const [buy, setBuy] = useState("");
    const [sell, setSell] = useState("");
    const [stop, setStop] = useState("");
    const [long, setLong] = useState(false);

    const q = parseInput(qty);
    const buyV = buy === "" ? toNum(price) : parseInput(buy);
    const sellV = parseInput(sell);
    const stopV = parseInput(stop);

    const ready = q > 0 && buyV > 0;
    const cost = ready ? buyCost(buyV, q) : null;
    const even = ready ? breakEven(buyV, q) : null;
    const target = ready && sellV > 0 ? tradeResult({ buy: buyV, sell: sellV, qty: q, long }) : null;
    const risk = ready && stopV > 0 ? tradeResult({ buy: buyV, sell: stopV, qty: q, long }) : null;

    const rewardRisk =
        target && risk && risk.net < 0 && target.net > 0
            ? target.net / -risk.net
            : null;

    return (
        <>
            <p className="ledger-heading">position calculator</p>

            <div className="calc-form">
                <Field label="quantity">
                    <input
                        className="ledger-filter"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                    />
                </Field>

                <Field label="buy price">
                    <input
                        className="ledger-filter"
                        inputMode="decimal"
                        value={buy}
                        placeholder={price != null ? fmt(price) : "price"}
                        onChange={(e) => setBuy(e.target.value)}
                    />
                </Field>

                <Field label="target price">
                    <input
                        className="ledger-filter"
                        inputMode="decimal"
                        value={sell}
                        placeholder="optional"
                        onChange={(e) => setSell(e.target.value)}
                    />
                </Field>

                <Field label="stop price">
                    <input
                        className="ledger-filter"
                        inputMode="decimal"
                        value={stop}
                        placeholder="optional"
                        onChange={(e) => setStop(e.target.value)}
                    />
                </Field>

                <div className="calc-actions">
                    <div className="pc-group" role="group" aria-label="Holding period">
                        <button
                            type="button"
                            className={`pc-opt ${!long ? "on" : ""}`}
                            aria-pressed={!long}
                            onClick={() => setLong(false)}
                        >
                            under 1y
                        </button>
                        <button
                            type="button"
                            className={`pc-opt ${long ? "on" : ""}`}
                            aria-pressed={long}
                            onClick={() => setLong(true)}
                        >
                            over 1y
                        </button>
                    </div>
                </div>
            </div>

            {cost ? (
                <>
                    <p className="ledger-heading">buy side</p>

                    <InfoRow label="amount" value={fmt(cost.amt)} />
                    <InfoRow label="commission" value={fmt(cost.comm)} />
                    <InfoRow label="sebon fee" value={fmt(cost.sebon)} />
                    <InfoRow label="total cost" value={fmt(cost.total)} />
                    <InfoRow label="cost per share" value={fmt(cost.perShare)} />
                    <InfoRow label="break even sell" value={even != null ? fmt(even) : "--"} />

                    {target && (
                        <>
                            <p className="ledger-heading up">at target</p>

                            <InfoRow label="sell proceeds" value={fmt(target.s.net)} />
                            <InfoRow label="capital gains tax" value={fmt(target.cgt)} />
                            <InfoRow
                                label="net profit"
                                value={`${fmtSigned(target.net)} (${fmtSigned(target.roi)}%)`}
                                tone={dirClass(target.net)}
                            />
                        </>
                    )}

                    {risk && (
                        <>
                            <p className="ledger-heading down">at stop</p>

                            <InfoRow
                                label="net result"
                                value={`${fmtSigned(risk.net)} (${fmtSigned(risk.roi)}%)`}
                                tone={dirClass(risk.net)}
                            />
                        </>
                    )}

                    {rewardRisk != null && (
                        <InfoRow label="reward to risk" value={`${fmt(rewardRisk, 2)} to 1`} />
                    )}

                    <p className="ledger-empty">
                        estimates only. rates can differ by broker.
                    </p>
                </>
            ) : (
                <EmptyRow label="enter a quantity and price" />
            )}
        </>
    );
}

export default function CompanyDetail() {
    const { symbol } = useParams();

    const [details, setDetails] = useState(null);
    const [quote, setQuote] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [depth, setDepth] = useState(null);
    const [history, setHistory] = useState([]);
    const [floor, setFloor] = useState([]);
    const [shareGroup, setShareGroup] = useState(null);
    const watchlist = useWatchlist();
    const alerts = useAlerts();
    const { rows: priceRows } = usePriceVolume(LIVE_REFRESH_MS);

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("Depth");
    const [tabLoading, setTabLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [tabError, setTabError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [tabRetry, setTabRetry] = useState(0);
    const [floorUnavailable, setFloorUnavailable] = useState(false);
    const [histPage, setHistPage] = useState(0);

    // check alerts whenever fresh prices arrive
    useEffect(() => {
        alerts.check(priceRows);
    }, [priceRows, alerts.check]);

    // range stat needs history so fetch it up front not only on tab click
    useEffect(() => {
        let alive = true;

        setDetails(null);
        setQuote(null);
        setGraphData(null);
        setDepth(null);
        setHistory([]);
        setFloor([]);
        setShareGroup(null);
        setFloorUnavailable(false);
        setHistPage(0);
        setLoading(true);
        setError(null);
        setNotice(null);
        setTabError(null);

        const load = async () => {
            try {
                // only the company details are required the rest degrade
                const [dR, gR, pvR, clsR, histR] = await Promise.allSettled([
                    getCompanyDetails(symbol),
                    getDailyScripPriceGraph(symbol),
                    loadPriceVolume(),
                    getCompanyClassification(),
                    getPriceVolumeHistory(symbol),
                ]);

                if (!alive) return;

                const usable = (r) =>
                    r.status === "fulfilled" && !isNepseError(r.value?.data)
                        ? r.value.data
                        : null;

                const d = usable(dR);

                if (!d) {
                    setError(
                        dR.status === "rejected"
                            ? "Could not reach the server"
                            : "No data available for this symbol"
                    );
                    return;
                }

                setDetails(d);

                const rawGraph = usable(gR);

                setGraphData(toGraphList(rawGraph));

                const rows = pvR.status === "fulfilled" ? pvR.value : [];

                const row = rows.find(
                    (r) => (r.symbol ?? "").toUpperCase() === symbol.toUpperCase()
                );

                setQuote(row ?? null);

                const cls = usable(clsR);
                setShareGroup(cls ? pickShareGroup(cls, symbol) : null);

                const rawHist = usable(histR);

                setHistory(
                    rawHist == null
                        ? []
                        : Array.isArray(rawHist)
                            ? rawHist
                            : rawHist?.data ?? []
                );

                const missing = [
                    rawGraph == null && "chart",
                    pvR.status !== "fulfilled" && "live quote",
                    rawHist == null && "history",
                ].filter(Boolean);

                if (missing.length) {
                    setNotice(`Some data is unavailable (${missing.join(", ")})`);
                }
            } catch {
                if (alive) setError("Could not load company data");
            } finally {
                if (alive) setLoading(false);
            }
        };

        load();

        return () => {
            alive = false;
        };
    }, [symbol, reloadKey]);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            setTabLoading(true);
            setTabError(null);

            try {
                if (tab === "Depth" && !depth) {
                    const r = await getMarketDepth(symbol);

                    if (alive) {
                        setDepth(
                            isNepseError(r.data)
                                ? { unavailable: true }
                                : r.data
                        );
                    }
                } else if (
                    (tab === "Floorsheet" || tab === "Brokers") &&
                    !floor.length
                ) {
                    const r = await getFloorsheetOf(symbol);

                    if (alive) {
                        if (isNepseError(r.data)) {
                            setFloor([]);
                            setFloorUnavailable(true);
                        } else {
                            const rows = Array.isArray(r.data)
                                ? r.data
                                : r.data?.floorsheets?.content ?? [];

                            setFloor(rows);
                            setFloorUnavailable(false);
                        }
                    }
                }
            } catch {
                if (alive) {
                    setTabError(
                        tab === "Depth"
                            ? "Could not load market depth"
                            : "Could not load the floorsheet"
                    );
                }
            } finally {
                if (alive) setTabLoading(false);
            }
        };

        load();

        return () => {
            alive = false;
        };
    }, [tab, symbol, depth, floor.length, tabRetry]);

    // quiet refresh of the intraday line and depth while the page is open
    useEffect(() => {
        if (loading || error) return undefined;

        let alive = true;

        const tick = async () => {
            if (document.visibilityState !== "visible") return;

            try {
                const g = await getDailyScripPriceGraph(symbol);
                const list = isNepseError(g.data) ? null : toGraphList(g.data);

                if (alive && list?.length) setGraphData(list);
            } catch {
                // keep the last chart on a failed refresh
            }

            if (tab !== "Depth") return;

            try {
                const r = await getMarketDepth(symbol);

                if (alive && !isNepseError(r.data)) setDepth(r.data);
            } catch {
                // keep the last depth on a failed refresh
            }
        };

        const id = window.setInterval(tick, LIVE_REFRESH_MS);

        return () => {
            alive = false;
            window.clearInterval(id);
        };
    }, [symbol, loading, error, tab]);

    const info = pickDetails(details);
    const heroEntry = details?.security ?? details ?? {};

    // live row from the refreshing price list wins over the first load
    const liveRow = useMemo(
        () =>
            priceRows.find(
                (r) => (r.symbol ?? "").toUpperCase() === symbol.toUpperCase()
            ) ?? null,
        [priceRows, symbol]
    );

    const quoteNow = liveRow ?? quote;

    const prevClose =
        quoteNow?.previousClose ??
        heroEntry.previousClose ??
        null;

    const value =
        quoteNow?.lastTradedPrice ??
        quoteNow?.closePrice ??
        heroEntry.lastTradedPrice ??
        heroEntry.closePrice ??
        heroEntry.currentValue ??
        0;

    const change =
        quoteNow?.change ??
        heroEntry.change ??
        (prevClose != null ? value - prevClose : 0);

    const pct =
        quoteNow?.percentageChange ??
        heroEntry.percentageChange ??
        heroEntry.perChange ??
        (prevClose ? (change / prevClose) * 100 : 0);

    const buyRows =
        depth?.buyMarketDepthList ??
        depth?.bids ??
        depth?.buy ??
        [];

    const sellRows =
        depth?.sellMarketDepthList ??
        depth?.asks ??
        depth?.sell ??
        [];

    const hist = useMemo(() => pointsFromHistory(history), [history]);
    const stats = useMemo(() => computeStats(hist.points), [hist]);

    const weekStats = useMemo(() => {
        if (stats) return { high: stats.hi, low: stats.lo };

        if (!history.length) return null;

        const closes = history
            .map(
                (h) =>
                    h.closePrice ??
                    h.close ??
                    h.lastTradedPrice
            )
            .filter(
                (v) =>
                    typeof v === "number" &&
                    !isNaN(v)
            );

        if (!closes.length) return null;

        const [low, high] = minMax(closes);

        return { high, low };
    }, [history, stats]);

    const sessions = useMemo(() => buildSessions(hist.points), [hist]);

    const sessionPages = sessions
        ? Math.max(1, Math.ceil(sessions.newestFirst.length / HISTORY_ROWS))
        : 1;
    const sessionPageSafe = Math.min(histPage, sessionPages - 1);

    const hasOverview =
        info.open != null ||
        info.high != null ||
        info.low != null ||
        info.instrument ||
        info.listedShares ||
        info.marketCap != null ||
        info.faceValue != null ||
        info.publicShares != null ||
        info.promoterShares != null ||
        shareGroup ||
        weekStats;

    return (
        <Layout>
            <SEO
                title={info.name ? `${info.name} (${symbol}) Stock Price` : `${symbol} Stock Price`}
                description={`Live stock price, market depth, price-volume history, and floorsheet for ${info.name || symbol} (${symbol}) listed on the Nepal Stock Exchange (NEPSE).`}
                canonical={`/nepse/company/${symbol}`}
                jsonLd={companyDetailJsonLd(symbol, info.name)}
            />
            <div className="term-shell">
                <header className="term-header">
                    <div className="term-brand">
                        <Link to="/nepse" className="term-back">
                            back to market
                        </Link>

                        <span className="term-brand-line">
                            <span className="term-brand-name">
                                {symbol}
                            </span>

                            <WatchButton
                                symbol={symbol}
                                active={watchlist.has(symbol)}
                                onToggle={watchlist.toggle}
                            />
                        </span>

                        {info.name && (
                            <span className="term-brand-tag">
                                {info.name}
                            </span>
                        )}
                    </div>

                    <TermSearch placeholder="jump to another company" />
                </header>

                <AlertBanner alerts={alerts} />

                {error && !loading && (
                    <div className="term-empty-state" role="alert">
                        <p className="term-empty-title">
                            Could not load {symbol}
                        </p>

                        <p className="term-empty-text">
                            {error}. Check the symbol or try again.
                        </p>

                        <div className="term-empty-actions">
                            <button
                                type="button"
                                className="inline-retry"
                                onClick={() => setReloadKey((n) => n + 1)}
                            >
                                <IconRefresh />
                                retry
                            </button>

                            <Link to="/nepse" className="inline-retry">
                                back to market
                            </Link>
                        </div>
                    </div>
                )}

                {notice && !error && (
                    <InlineNotice
                        message={notice}
                        onRetry={() => setReloadKey((n) => n + 1)}
                        busy={loading}
                    />
                )}

                {!error && (
                    <div className="term-grid">
                        <div className="term-primary">
                            <HeroChart
                                loading={loading}
                                data={graphData}
                                historyPoints={hist.points}
                                historyDerived={hist.derived}
                                value={value}
                                changeVal={change}
                                changePct={pct}
                                baseline={toNum(prevClose)}
                                eyebrow={
                                    info.sector
                                        ? `${symbol} - ${info.sector}`
                                        : symbol
                                }
                            />

                            {hasOverview && !loading && (
                                <ScrollTicker>
                                    <OverviewItems
                                        info={info}
                                        weekStats={weekStats}
                                        shareGroup={shareGroup}
                                        stats={stats}
                                    />
                                </ScrollTicker>
                            )}

                            {!loading && (
                                <div className="range-stack">
                                    <RangeBar
                                        label="day range"
                                        low={info.low}
                                        high={info.high}
                                        value={value}
                                    />

                                    {weekStats && (
                                        <RangeBar
                                            label="history range"
                                            low={weekStats.low}
                                            high={weekStats.high}
                                            value={value}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        <aside className="term-ledger">
                            <TabStrip
                                tabs={COMPANY_TABS}
                                active={tab}
                                onChange={setTab}
                                label="Company sections"
                            />

                            <div className="ledger-body" role="tabpanel" aria-label={tab}>
                                {tabError && (
                                    <InlineNotice
                                        message={tabError}
                                        onRetry={() => setTabRetry((n) => n + 1)}
                                        busy={tabLoading}
                                    />
                                )}

                                {tab === "Depth" && (
                                    <>
                                        <DepthSummary bids={buyRows} asks={sellRows} />

                                        <DepthSection
                                            heading="bid"
                                            headingTone="up"
                                            rows={buyRows}
                                            loading={tabLoading}
                                            failed={Boolean(tabError)}
                                            emptyLabel={depth?.unavailable ? "depth unavailable" : "no bid depth"}
                                        />

                                        <DepthSection
                                            heading="ask"
                                            headingTone="down"
                                            rows={sellRows}
                                            loading={tabLoading}
                                            failed={Boolean(tabError)}
                                            emptyLabel={depth?.unavailable ? "depth unavailable" : "no ask depth"}
                                        />
                                    </>
                                )}

                                {tab === "History" && (
                                    <>
                                        <p className="ledger-heading">
                                            recent sessions
                                        </p>

                                        {loading && !history.length ? (
                                            <SkeletonRows count={6} columns={3} />
                                        ) : sessions ? (
                                            <>
                                                <MiniSpark data={sessions.closes} />

                                                <div className="ledger-header ledger-row-4">
                                                    <span>Date</span>
                                                    <span style={{ textAlign: "right" }}>Close</span>
                                                    <span style={{ textAlign: "right" }}>Chg</span>
                                                    <span style={{ textAlign: "right" }}>Vol</span>
                                                </div>

                                                {sessions.newestFirst
                                                    .slice(
                                                        sessionPageSafe * HISTORY_ROWS,
                                                        sessionPageSafe * HISTORY_ROWS + HISTORY_ROWS
                                                    )
                                                    .map((r, i) => (
                                                        <div
                                                            className="ledger-row ledger-row-4"
                                                            key={r.date ?? i}
                                                        >
                                                            <span className="ledger-sym">
                                                                {r.date}
                                                            </span>

                                                            <span className="ledger-num">
                                                                {fmt(r.close)}
                                                            </span>

                                                            <span
                                                                className={`ledger-pct ${
                                                                    r.change == null
                                                                        ? ""
                                                                        : dirClass(r.change)
                                                                }`}
                                                            >
                                                                {r.change == null ? (
                                                                    "--"
                                                                ) : (
                                                                    <>
                                                                        <Arrow
                                                                            up={r.change >= 0}
                                                                            flat={r.change === 0}
                                                                        />
                                                                        {r.change > 0 ? "+" : ""}
                                                                        {fmt(r.change)}%
                                                                    </>
                                                                )}
                                                            </span>

                                                            <span className="ledger-num">
                                                                {fmtCompact(r.volume)}
                                                            </span>
                                                        </div>
                                                    ))}

                                                <Pagination
                                                    page={sessionPageSafe}
                                                    totalPages={sessionPages}
                                                    onChange={setHistPage}
                                                />
                                            </>
                                        ) : history.length ? (
                                            history.slice(0, HISTORY_ROWS).map((r, i) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={i}
                                                >
                                                    <span className="ledger-sym">
                                                        {r.businessDate ??
                                                            r.date ??
                                                            "--"}
                                                    </span>

                                                    <span className="ledger-num">
                                                        {fmt(
                                                            r.closePrice ??
                                                            r.close ??
                                                            r.lastTradedPrice
                                                        )}
                                                    </span>

                                                    <span className="ledger-num">
                                                        {fmtCompact(
                                                            r.totalTradeQuantity ??
                                                            r.totalTradedQuantity ??
                                                            r.volume
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <EmptyRow label="no history yet" />
                                        )}
                                    </>
                                )}

                                {tab === "Floorsheet" && (
                                    <FloorsheetPanel
                                        key={symbol}
                                        rows={floor}
                                        loading={tabLoading}
                                        tabError={tabError}
                                        unavailable={floorUnavailable}
                                    />
                                )}

                                {tab === "Brokers" && (
                                    <BrokersPanel
                                        rows={floor}
                                        loading={tabLoading}
                                        tabError={tabError}
                                        unavailable={floorUnavailable}
                                    />
                                )}

                                {tab === "Levels" && (
                                    <LevelsPanel
                                        stats={stats}
                                        symbol={symbol}
                                        price={toNum(value)}
                                        alerts={alerts}
                                        rows={priceRows}
                                    />
                                )}

                                {tab === "Calc" && (
                                    <CalcPanel key={symbol} price={toNum(value)} />
                                )}
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </Layout>
    );
}