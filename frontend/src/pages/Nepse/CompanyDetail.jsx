import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getCompanyDetails,
    getDailyScripPriceGraph,
    getMarketDepth,
    getPriceVolumeHistory,
    getFloorsheetOf,
    getPriceVolume,
    isNepseError,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import {
    HeroChart,
    TermSearch,
    EmptyRow,
    SkeletonRows,
    ScrollTicker,
} from "./nepseShared.jsx";
import { fmt, fmtCompact } from "./nepseUtils";
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

const COMPANY_TABS = ["Depth", "History", "Floorsheet"];

function OverviewTickerItem({ label, value }) {
    return (
        <span className="term-ticker-item">
            <span className="ledger-label">{label}</span>
            <span>{value}</span>
        </span>
    );
}

/* overview items shared between the primary and duplicate scroll tracks */
function OverviewItems({ info, weekStats }) {
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
}) {
    return (
        <>
            <p className={`ledger-heading ${headingTone}`}>
                {heading}
            </p>

            {loading && !rows.length ? (
                <SkeletonRows count={3} />
            ) : rows.length ? (
                rows.slice(0, 6).map((row, index) => (
                    <DepthRow row={row} key={index} />
                ))
            ) : (
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

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("Depth");
    const [tabLoading, setTabLoading] = useState(true);
    const [error, setError] = useState(null);
    const [floorUnavailable, setFloorUnavailable] = useState(false);

    useEffect(() => {
        let alive = true;

        const initialTimer = setTimeout(() => {
            if (!alive) return;

            setDetails(null);
            setQuote(null);
            setGraphData(null);
            setDepth(null);
            setHistory([]);
            setFloor([]);
            setFloorUnavailable(false);
            setLoading(true);
            setError(null);

            Promise.all([
                getCompanyDetails(symbol),
                getDailyScripPriceGraph(symbol),
                getPriceVolume(),
            ])
                .then(([d, g, pv]) => {
                    if (!alive) return;

                    if (isNepseError(d.data)) {
                        setError("Company data is temporarily unavailable");
                        return;
                    }

                    setDetails(d.data);

                    const rawGraph = g.data;

                    if (isNepseError(rawGraph)) {
                        setGraphData([]);
                    } else {
                        setGraphData(
                            Array.isArray(rawGraph)
                                ? rawGraph
                                : rawGraph?.data ?? Object.values(rawGraph ?? {})
                        );
                    }

                    const rows = isNepseError(pv.data) ? [] : pv.data ?? [];

                    const row = rows.find(
                        (r) => (r.symbol ?? "").toUpperCase() === symbol.toUpperCase()
                    );

                    setQuote(row ?? null);
                })
                .catch(() => {
                    if (alive) setError("Could not load company data");
                })
                .finally(() => {
                    if (alive) setLoading(false);
                });
        }, 0);

        return () => {
            alive = false;
            clearTimeout(initialTimer);
        };
    }, [symbol]);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            setTabLoading(true);

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
                } else if (tab === "History" && !history.length) {
                    const r = await getPriceVolumeHistory(symbol);

                    if (alive) {
                        if (isNepseError(r.data)) {
                            setHistory([]);
                        } else {
                            setHistory(
                                Array.isArray(r.data)
                                    ? r.data
                                    : r.data?.data ?? []
                            );
                        }
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
                if (alive && tab === "Floorsheet") {
                    setFloor([]);
                    setFloorUnavailable(true);
                }
            } finally {
                if (alive) setTabLoading(false);
            }
        };

        load();

        return () => {
            alive = false;
        };
    }, [tab, symbol, depth, history.length, floor.length]);

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

        return {
            high: Math.max(...closes),
            low: Math.min(...closes),
        };
    }, [history]);

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

                        <span className="term-brand-name">
                            {symbol}
                        </span>

                        {info.name && (
                            <span className="term-brand-tag">
                                {info.name}
                            </span>
                        )}
                    </div>

                    <TermSearch placeholder="jump to another company" />
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
                            value={value}
                            changeVal={change}
                            changePct={pct}
                            eyebrow={
                                info.sector
                                    ? `${symbol} - ${info.sector}`
                                    : symbol
                            }
                        />

                        {hasOverview && !loading && (
                            <ScrollTicker>
                                <OverviewItems info={info} weekStats={weekStats} />
                            </ScrollTicker>
                        )}
                    </div>

                    <aside className="term-ledger">
                        <div className="ledger-tabs">
                            {COMPANY_TABS.map((t) => (
                                <button
                                    key={t}
                                    className={`ledger-tab ${
                                        tab === t ? "active" : ""
                                    }`}
                                    onClick={() => setTab(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="ledger-body">
                            {tab === "Depth" && (
                                <>
                                    <DepthSection
                                        heading="bid"
                                        headingTone="up"
                                        rows={buyRows}
                                        loading={tabLoading}
                                        emptyLabel="no bid depth"
                                    />

                                    <DepthSection
                                        heading="ask"
                                        headingTone="down"
                                        rows={sellRows}
                                        loading={tabLoading}
                                        emptyLabel="no ask depth"
                                    />
                                </>
                            )}

                            {tab === "History" && (
                                <>
                                    <p className="ledger-heading">
                                        recent sessions
                                    </p>

                                    {tabLoading && !history.length ? (
                                        <SkeletonRows count={4} />
                                    ) : history.length ? (
                                        history.slice(0, 12).map((r, i) => (
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
                                        <SkeletonRows count={4} />
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