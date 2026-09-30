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
} from "./nepseShared.jsx";
import { fmt, fmtCompact, dirClass, minMax } from "./nepseUtils";
import { useWatchlist, loadPriceVolume } from "./nepseHooks";
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

const COMPANY_TABS = ["Depth", "History", "Floorsheet"];
const HISTORY_ROWS = 12;
const HISTORY_SPARK_POINTS = 60;

function toNum(v) {
    const n = Number(v);
    return v == null || v === "" || !Number.isFinite(n) ? null : n;
}

// sessions sorted newest first with change against the older session
// returns null when dates are missing so the raw order is kept
function buildSessions(history) {
    const rows = history
        .map((r) => ({
            raw: r,
            date: r.businessDate ?? r.date ?? null,
            close: toNum(r.closePrice ?? r.close ?? r.lastTradedPrice),
            volume: r.totalTradeQuantity ?? r.totalTradedQuantity ?? r.volume,
        }))
        .filter((r) => r.close !== null);

    const dated =
        rows.length > 1 &&
        rows.every(
            (r) => typeof r.date === "string" && !Number.isNaN(Date.parse(r.date))
        );

    if (!dated) return null;

    const ascending = [...rows].sort(
        (a, b) => Date.parse(a.date) - Date.parse(b.date)
    );

    const withChange = ascending.map((r, i) => {
        const prev = i > 0 ? ascending[i - 1].close : null;

        return {
            ...r,
            change: prev ? ((r.close - prev) / prev) * 100 : null,
        };
    });

    return {
        newestFirst: [...withChange].reverse(),
        closes: withChange.slice(-HISTORY_SPARK_POINTS).map((r) => r.close),
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
function OverviewItems({ info, weekStats, shareGroup }) {
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
        </>
    );
}

function DepthRow({ row }) {
    return (
        <div className="ledger-row">
            <span className="ledger-sym">
                {fmt(row.orderPrice ?? row.price ?? row.rate)}
            </span>

            <span className="ledger-num">
                {fmt(
                    row.orderQuantity ??
                    row.quantity ??
                    row.qty,
                    0
                )}
            </span>
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
    return (
        <>
            <p className={`ledger-heading ${headingTone}`}>
                {heading}
            </p>

            {loading && !rows.length ? (
                <SkeletonRows count={3} columns={2} />
            ) : rows.length ? (
                rows.slice(0, 6).map((row, index) => (
                    <DepthRow row={row} key={index} />
                ))
            ) : failed ? null : (
                <EmptyRow label={emptyLabel} />
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

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("Depth");
    const [tabLoading, setTabLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [tabError, setTabError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [tabRetry, setTabRetry] = useState(0);
    const [floorUnavailable, setFloorUnavailable] = useState(false);

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

                setGraphData(
                    rawGraph == null
                        ? null
                        : Array.isArray(rawGraph)
                            ? rawGraph
                            : rawGraph?.data ?? Object.values(rawGraph)
                );

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
                } else if (tab === "Floorsheet" && !floor.length) {
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
                        tab === "Floorsheet"
                            ? "Could not load the floorsheet"
                            : "Could not load market depth"
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

    const info = pickDetails(details);
    const heroEntry = details?.security ?? details ?? {};

    const prevClose =
        quote?.previousClose ??
        heroEntry.previousClose ??
        null;

    const value =
        quote?.lastTradedPrice ??
        quote?.closePrice ??
        heroEntry.lastTradedPrice ??
        heroEntry.closePrice ??
        heroEntry.currentValue ??
        0;

    const change =
        quote?.change ??
        heroEntry.change ??
        (prevClose != null ? value - prevClose : 0);

    const pct =
        quote?.percentageChange ??
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

    const weekStats = useMemo(() => {
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
    }, [history]);

    const sessions = useMemo(() => buildSessions(history), [history]);

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
                                                    .slice(0, HISTORY_ROWS)
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
                                    <>
                                        <p className="ledger-heading">
                                            recent contracts
                                        </p>

                                        {tabLoading && !floor.length ? (
                                            <SkeletonRows count={6} columns={3} />
                                        ) : floor.length ? (
                                            floor.slice(0, 14).map((r, i) => (
                                                <div
                                                    className="ledger-row ledger-row-3"
                                                    key={i}
                                                >
                                                <span className="ledger-sym">
                                                    {fmt(
                                                        r.contractQuantity ??
                                                        r.quantity,
                                                        0
                                                    )}
                                                </span>

                                                    <span className="ledger-num">
                                                    {fmt(
                                                        r.contractRate ??
                                                        r.rate
                                                    )}
                                                </span>

                                                    <span className="ledger-ltp">
                                                    {r.buyerMemberId ??
                                                        r.buyerBroker ??
                                                        "--"}
                                                        /
                                                        {r.sellerMemberId ??
                                                            r.sellerBroker ??
                                                            "--"}
                                                </span>
                                                </div>
                                            ))
                                        ) : (
                                            tabError ? null : (
                                                <EmptyRow
                                                    label={
                                                        floorUnavailable
                                                            ? "floorsheet temporarily unavailable"
                                                            : "no contracts yet"
                                                    }
                                                />
                                            )
                                        )}
                                    </>
                                )}
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </Layout>
    );
}