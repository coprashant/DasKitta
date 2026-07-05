import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getCompanyDetails,
    getDailyScripPriceGraph,
    getMarketDepth,
    getPriceVolumeHistory,
    getFloorsheetOf,
    getPriceVolume,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import { fmt, fmtCompact, dirClass, Arrow, HeroChart, TermSearch } from "./nepseShared.jsx";
import "./Nepse.css";
import "./CompanyDetail.css";

function EmptyRow({ label }) {
    return <p className="ledger-empty">{label}</p>;
}

// nepse security payloads often nest reference fields as objects like
// instrumentType: {id, code, description, activeStatus} instead of plain text
function textOf(v) {
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") return v;
    if (typeof v === "object") return v.description ?? v.name ?? v.code ?? null;
    return null;
}

// pulls a readable name out of whichever shape the details api returns
function pickDetails(raw) {
    if (!raw) return {};
    const src = raw.security ?? raw.company ?? raw;
    return {
        name: textOf(src.securityName ?? src.companyName ?? src.name),
        sector: textOf(src.sectorName ?? src.sector),
        instrument: textOf(src.instrumentType ?? src.securityType),
        listedShares: src.listedShares ?? src.totalListedShares ?? null,
    };
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

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        Promise.all([getCompanyDetails(symbol), getDailyScripPriceGraph(symbol), getPriceVolume()])
            .then(([d, g, pv]) => {
                if (!alive) return;
                setDetails(d.data);
                const raw = g.data;
                setGraphData(Array.isArray(raw) ? raw : (raw?.data ?? Object.values(raw ?? {})));
                const rows = pv.data ?? [];
                const row = rows.find((r) => (r.symbol ?? "").toUpperCase() === symbol.toUpperCase());
                setQuote(row ?? null);
            })
            .catch(() => { if (alive) setError("could not load company data"); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [symbol]);

    useEffect(() => {
        let alive = true;
        setTabLoading(true);
        const load = async () => {
            try {
                if (tab === "Depth" && !depth) {
                    const r = await getMarketDepth(symbol);
                    if (alive) setDepth(r.data);
                }
                if (tab === "History" && !history.length) {
                    const r = await getPriceVolumeHistory(symbol);
                    if (alive) setHistory(Array.isArray(r.data) ? r.data : (r.data?.data ?? []));
                }
                if (tab === "Floorsheet" && !floor.length) {
                    const r = await getFloorsheetOf(symbol);
                    const rows = Array.isArray(r.data) ? r.data : (r.data?.floorsheets?.content ?? []);
                    if (alive) setFloor(rows);
                }
            } finally {
                if (alive) setTabLoading(false);
            }
        };
        load();
        return () => { alive = false; };
    }, [tab, symbol]);

    const info = pickDetails(details);
    const heroEntry = details?.security ?? details ?? {};
    const prevClose = quote?.previousClose ?? heroEntry.previousClose ?? null;
    const value = quote?.lastTradedPrice ?? quote?.closePrice ?? heroEntry.lastTradedPrice ?? heroEntry.closePrice ?? heroEntry.currentValue ?? 0;
    const change = quote?.change ?? heroEntry.change ?? (prevClose != null ? value - prevClose : 0);
    const pct = quote?.percentageChange ?? heroEntry.percentageChange ?? heroEntry.perChange
        ?? (prevClose ? (change / prevClose) * 100 : 0);

    const buyRows = depth?.buyMarketDepthList ?? depth?.bids ?? depth?.buy ?? [];
    const sellRows = depth?.sellMarketDepthList ?? depth?.asks ?? depth?.sell ?? [];

    const weekStats = useMemo(() => {
        if (!history.length) return null;
        const closes = history.map((h) => h.closePrice ?? h.close ?? h.lastTradedPrice).filter((v) => typeof v === "number");
        if (!closes.length) return null;
        return { high: Math.max(...closes), low: Math.min(...closes) };
    }, [history]);

    return (
        <Layout>
            <div className="term-shell">
                <header className="term-header">
                    <div className="term-brand">
                        <Link to="/nepse" className="term-back">back to market</Link>
                        <span className="term-brand-name">{symbol}</span>
                        {info.name && <span className="term-brand-tag">{info.name}</span>}
                    </div>

                    <TermSearch placeholder="jump to another company" />
                </header>

                {error && <div className="term-alert">{error}</div>}

                <div className="term-grid">
                    <div className="term-primary">
                        <HeroChart
                            loading={loading}
                            data={graphData}
                            value={value}
                            changeVal={change}
                            changePct={pct}
                            eyebrow={info.sector ? `${symbol} - ${info.sector}` : symbol}
                        />

                        {(info.instrument || info.listedShares || weekStats) && !loading && (
                            <div className="index-strip">
                                {info.instrument && (
                                    <div className="index-item">
                                        <span className="index-name">instrument</span>
                                        <span className="index-value index-value-sm">{info.instrument}</span>
                                    </div>
                                )}
                                {info.listedShares && (
                                    <div className="index-item">
                                        <span className="index-name">listed shares</span>
                                        <span className="index-value index-value-sm">{fmtCompact(info.listedShares)}</span>
                                    </div>
                                )}
                                {weekStats && (
                                    <div className="index-item">
                                        <span className="index-name">range</span>
                                        <span className="index-value index-value-sm">{fmt(weekStats.low)} - {fmt(weekStats.high)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <aside className="term-ledger">
                        <div className="ledger-tabs">
                            {["Depth", "History", "Floorsheet"].map((t) => (
                                <button
                                    key={t}
                                    className={`ledger-tab ${tab === t ? "active" : ""}`}
                                    onClick={() => setTab(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <div className="ledger-body">
                            {tab === "Depth" && (
                                <>
                                    <p className="ledger-heading up">bid</p>
                                    {tabLoading && !buyRows.length ? (
                                        [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                                    ) : buyRows.length ? (
                                        buyRows.slice(0, 6).map((r, i) => (
                                            <div className="ledger-row" key={i}>
                                                <span className="ledger-sym">{fmt(r.price ?? r.rate)}</span>
                                                <span className="ledger-num">{fmt(r.quantity ?? r.qty, 0)}</span>
                                            </div>
                                        ))
                                    ) : <EmptyRow label="no bid depth" />}

                                    <p className="ledger-heading down">ask</p>
                                    {tabLoading && !sellRows.length ? (
                                        [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                                    ) : sellRows.length ? (
                                        sellRows.slice(0, 6).map((r, i) => (
                                            <div className="ledger-row" key={i}>
                                                <span className="ledger-sym">{fmt(r.price ?? r.rate)}</span>
                                                <span className="ledger-num">{fmt(r.quantity ?? r.qty, 0)}</span>
                                            </div>
                                        ))
                                    ) : <EmptyRow label="no ask depth" />}
                                </>
                            )}

                            {tab === "History" && (
                                <>
                                    <p className="ledger-heading">recent sessions</p>
                                    {tabLoading && !history.length ? (
                                        [1, 2, 3, 4].map((i) => <div key={i} className="skel ledger-skel" />)
                                    ) : history.length ? (
                                        history.slice(0, 12).map((r, i) => (
                                            <div className="ledger-row ledger-row-3" key={i}>
                                                <span className="ledger-sym">{r.businessDate ?? r.date ?? "--"}</span>
                                                <span className="ledger-num">{fmt(r.closePrice ?? r.close ?? r.lastTradedPrice)}</span>
                                                <span className="ledger-num">{fmtCompact(r.totalTradeQuantity ?? r.totalTradedQuantity ?? r.volume)}</span>
                                            </div>
                                        ))
                                    ) : <EmptyRow label="no history yet" />}
                                </>
                            )}

                            {tab === "Floorsheet" && (
                                <>
                                    <p className="ledger-heading">recent contracts</p>
                                    {tabLoading && !floor.length ? (
                                        [1, 2, 3, 4].map((i) => <div key={i} className="skel ledger-skel" />)
                                    ) : floor.length ? (
                                        floor.slice(0, 14).map((r, i) => (
                                            <div className="ledger-row ledger-row-3" key={i}>
                                                <span className="ledger-sym">{fmt(r.contractQuantity, 0)}</span>
                                                <span className="ledger-num">{fmt(r.contractRate)}</span>
                                                <span className="ledger-ltp">{r.buyerMemberId ?? "--"}/{r.sellerMemberId ?? "--"}</span>
                                            </div>
                                        ))
                                    ) : <EmptyRow label="no contracts yet" />}
                                </>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </Layout>
    );
}