import { useState, useEffect, useMemo } from "react";
import {
    getNepseIndex,
    getDailyNepseIndexGraph,
    isNepseOpen,
    getTopGainers,
    getTopLosers,
} from "../../api/nepse.js";
import { buildSparkline, useChartHover, tooltipAlign } from "../../pages/Nepse/nepseUtils.js";
import BullMascot from "./BullMascot.jsx";
import "./NepseStrip.css";

const MOVERS_ROW_COUNT = 5;

function SkeletonGraphSVG({ width = 340, height = 100 }) {
    return (
        <div className="skeleton-graph-wrap" style={{ width: "100%", height: "100%" }}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="sparkline-svg skeleton-svg-wave"
                style={{ width: "100%", height: "100%" }}
            >
                <path
                    d={`M 0 ${height * 0.7} Q ${width * 0.25} ${height * 0.2}, ${width * 0.5} ${height * 0.5} T ${width} ${height * 0.3}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                />
            </svg>
        </div>
    );
}

function Sparkline({ data, isOpen, pts, width = 340, height = 100 }) {
    const result = useMemo(
        () => buildSparkline(data, width, height),
        [data, width, height]
    );
    const { containerRef, index: hoverIndex, handlers } = useChartHover(result?.values.length ?? 0);

    if (!result) return <SkeletonGraphSVG width={width} height={height} />;

    const color = result.isPositive ? "var(--success)" : "var(--danger)";
    const hover = hoverIndex != null
        ? { x: result.coords[hoverIndex][0], y: result.coords[hoverIndex][1], value: result.values[hoverIndex] }
        : null;

    const coords = result.coords || [];
    const targetCoord = isOpen
        ? coords[0] || [0, height * 0.7]
        : coords[coords.length - 1] || [width, height * 0.5];

    const mascotPos = targetCoord
        ? { x: (targetCoord[0] / width) * 100, y: (targetCoord[1] / height) * 100 } // Percentage for Y keeps mascot positioned accurately on tall graphs
        : null;

    return (
        <div className="spark-wrap" ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "visible" }} {...handlers}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="sparkline-svg"
                style={{ width: "100%", height: "100%", overflow: "visible" }}
            >
                <polyline
                    points={result.points}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {hover && (
                    <g>
                        <line x1={hover.x} y1="0" x2={hover.x} y2={height} className="spark-hover-line" />
                        <circle cx={hover.x} cy={hover.y} r="4" className="spark-hover-dot" style={{ fill: color }} />
                    </g>
                )}
            </svg>

            <BullMascot isOpen={isOpen} pts={pts} position={mascotPos} />

            {hover && (
                <div
                    className={`spark-tooltip align-${tooltipAlign(hover.x / width)}`}
                    style={{ left: `${(hover.x / width) * 100}%`, top: `${(hover.y / height) * 100}%` }}
                >
                    {Number(hover.value).toLocaleString("en-NP", { minimumFractionDigits: 2 })}
                </div>
            )}
        </div>
    );
}

function useNepseIndex() {
    const [indexData, setIndexData] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const loadData = async () => {
            try {
                const [idx, opn, grf] = await Promise.all([
                    getNepseIndex(),
                    isNepseOpen(),
                    getDailyNepseIndexGraph()
                ]);
                if (!alive) return;
                setIndexData(idx.data);
                const rawOpen = opn.data;
                setIsOpen(typeof rawOpen === "object" ? rawOpen?.isOpen === "OPEN" : !!rawOpen);
                const rawGraph = grf.data;
                setGraphData(Array.isArray(rawGraph) ? rawGraph : (rawGraph?.data ?? Object.values(rawGraph)));
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn("Failed to load NEPSE hero data", error);
                }
            } finally {
                if (alive) setLoading(false);
            }
        };
        loadData();
        return () => { alive = false; };
    }, []);

    return { indexData, graphData, isOpen, loading };
}

function resolveNepseEntry(data) {
    if (!data) return null;

    if (data["NEPSE Index"]) return data["NEPSE Index"];
    if (data["NEPSE"]) return data["NEPSE"];

    if (Array.isArray(data)) {
        return data.find(item => item?.index === "NEPSE Index") || data[0];
    }

    return Object.values(data)[0];
}

export function NepseHeroCard() {
    const { indexData, graphData, isOpen, loading } = useNepseIndex();
    const entry = resolveNepseEntry(indexData);
    const val = entry?.currentValue ?? entry?.value ?? 0;
    const pts = entry?.change ?? 0;

    if (loading) {
        return (
            <div className="nepse-flat-hero">
                <div className="nepse-hero-header">
                    <span className="terminal-label">NEPSE MARKET INDEX</span>
                    <div className="skeleton-text skeleton-status base-pulse" />
                </div>
                <div className="nepse-hero-metrics">
                    <div className="skeleton-text skeleton-val base-pulse" />
                    <div className="skeleton-text skeleton-delta base-pulse" />
                </div>
                <div className="nepse-hero-graph">
                    <SkeletonGraphSVG width={340} height={100} />
                </div>
            </div>
        );
    }

    return (
        <div className="nepse-flat-hero">
            <div className="nepse-hero-header">
                <span className="terminal-label">NEPSE MARKET INDEX</span>
                <span className={`terminal-indicator ${isOpen ? "open" : "closed"}`}>
                    {isOpen ? "Market Open" : "Market Closed"}
                </span>
            </div>
            <div className="nepse-hero-metrics">
                <div className="nepse-hero-value">
                    {Number(val).toLocaleString("en-NP", { minimumFractionDigits: 2 })}
                </div>
                <div className={`nepse-hero-delta ${pts >= 0 ? "up" : "down"}`}>
                    {pts >= 0 ? "+" : ""} {pts.toFixed(2)}
                </div>
            </div>
            <div className="nepse-hero-graph">
                <Sparkline data={graphData} width={340} height={100} isOpen={isOpen} pts={pts} />
            </div>
        </div>
    );
}

function TickerRow({ item, type }) {
    const pct = item?.percentageChange ?? 0;
    const ltp = item?.ltp ?? item?.lastTradedPrice ?? 0;
    const sym = item?.symbol ?? "";

    return (
        <div className="ticker-flat-row">
            <span className="ticker-sym">{sym}</span>
            <div className="ticker-values">
                <span className="ticker-ltp">Rs. {Number(ltp).toLocaleString("en-NP")}</span>
                <span className={`ticker-pct ${type === "gainer" ? "up" : "down"}`}>
                    {pct >= 0 ? "+" : ""}{Number(pct).toFixed(2)}%
                </span>
            </div>
        </div>
    );
}

function TickerSkeletonRow() {
    return (
        <div className="ticker-flat-row">
            <div className="skeleton-text skeleton-sym base-pulse" />
            <div className="ticker-values">
                <div className="skeleton-text skeleton-price base-pulse" />
                <div className="skeleton-text skeleton-percent base-pulse" />
            </div>
        </div>
    );
}

function TickerEmptyState({ message }) {
    return <div className="ticker-empty-state">{message}</div>;
}

export default function NepseStrip() {
    const [gainers, setGainers] = useState(null);
    const [losers, setLosers] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        const loadMovers = async () => {
            try {
                const [gRes, lRes] = await Promise.all([getTopGainers(), getTopLosers()]);
                if (!alive) return;
                setGainers(Array.isArray(gRes.data) ? gRes.data : gRes.data?.data ?? []);
                setLosers(Array.isArray(lRes.data) ? lRes.data : lRes.data?.data ?? []);
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.warn("Failed to load NEPSE movers", error);
                }
            } finally {
                if (alive) setLoading(false);
            }
        };
        loadMovers();
        return () => { alive = false; };
    }, []);

    const dummyArray = useMemo(() => Array(MOVERS_ROW_COUNT).fill(0), []);
    const topGainers = gainers?.slice(0, MOVERS_ROW_COUNT) ?? [];
    const topLosers = losers?.slice(0, MOVERS_ROW_COUNT) ?? [];

    return (
        <section className="nepse-strip">
            <div className="nepse-strip-inner">
                <div className="movers-grid">
                    <div className="movers-col">
                        <div className="movers-header up">Top Gainers Today</div>
                        <div className="movers-list">
                            {loading
                                ? dummyArray.map((_, i) => <TickerSkeletonRow key={i} />)
                                : topGainers.length > 0
                                    ? topGainers.map((item, i) => (
                                        <TickerRow key={item?.symbol ?? `gainer-${i}`} item={item} type="gainer" />
                                    ))
                                    : <TickerEmptyState message="No gainers available right now." />}
                        </div>
                    </div>
                    <div className="movers-col">
                        <div className="movers-header down">Top Losers Today</div>
                        <div className="movers-list">
                            {loading
                                ? dummyArray.map((_, i) => <TickerSkeletonRow key={i} />)
                                : topLosers.length > 0
                                    ? topLosers.map((item, i) => (
                                        <TickerRow key={item?.symbol ?? `loser-${i}`} item={item} type="loser" />
                                    ))
                                    : <TickerEmptyState message="No losers available right now." />}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}