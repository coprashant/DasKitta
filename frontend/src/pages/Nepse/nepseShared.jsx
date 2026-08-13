import { useState, useEffect, useRef, useId } from "react";
import { useNavigate } from "react-router-dom";
import { getPriceVolume } from "../../api/nepse";
import { IconSearch } from "../../components/Icons.jsx";

import {
    fmt,
    fmtCompact,
    dirClass,
    tooltipAlign,
    buildChart,
    resolveHeroKey,
    useChartHover,
} from "./nepseUtils";

// Re-exported so pages can pull everything NEPSE-related from one place
export { fmt, fmtCompact, dirClass, resolveHeroKey };

// Live clock hook for terminal headers
export function useClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return now;
}

// Single-line placeholder shown when a ledger section has no rows
export function EmptyRow({ label }) {
    return <p className="ledger-empty">{label}</p>;
}

// Row of pulsing skeleton bars, used while a ledger section is loading
export function SkeletonRows({ count = 3 }) {
    return Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel ledger-skel" />
    ));
}

// Small up or down chevron, dims out when the change is flat
export function Arrow({ up, flat }) {
    if (flat) return <span className="arrow-icon arrow-flat">--</span>;
    return (
        <svg
            className="arrow-icon"
            width="9"
            height="9"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
        >
            <path
                d={up ? "M5 1 L9 7 L1 7 Z" : "M5 9 L9 3 L1 3 Z"}
                fill="currentColor"
            />
        </svg>
    );
}

// Shared SVG marker for the hovered point on a chart or sparkline
function HoverMarker({ hover, height, color, radius = "5" }) {
    if (!hover) return null;
    return (
        <g>
            <line
                x1={hover.x}
                y1="0"
                x2={hover.x}
                y2={height}
                className="term-hover-line"
            />
            <circle
                cx={hover.x}
                cy={hover.y}
                r={radius}
                className="term-hover-dot"
                style={{ fill: color }}
            />
        </g>
    );
}

// Shared floating value label for the hovered point
function HoverTooltip({ hover, width, height, small = false }) {
    if (!hover) return null;
    return (
        <div
            className={`term-tooltip ${
                small ? "term-tooltip-sm" : ""
            } align-${tooltipAlign(hover.x / width)}`}
            style={{
                left: `${(hover.x / width) * 100}%`,
                top: `${(hover.y / height) * 100}%`,
            }}
        >
            {fmt(hover.value)}
        </div>
    );
}

export function HeroChart({
                              loading,
                              data,
                              value,
                              changeVal,
                              changePct,
                              eyebrow = "NEPSE INDEX",
                          }) {
    const gradientId = useId(); // Prevents SVG gradient ID conflicts
    const width = 1000;
    const height = 380;
    const chart = buildChart(data, width, height);
    const positive = changeVal >= 0;
    const { containerRef, index: hoverIndex, handlers } = useChartHover(
        chart?.values.length ?? 0
    );

    const hover =
        chart && hoverIndex != null
            ? {
                x: chart.coords[hoverIndex][0],
                y: chart.coords[hoverIndex][1],
                value: chart.values[hoverIndex],
            }
            : null;

    const lineColor = chart?.positive
        ? "var(--term-emerald)"
        : "var(--term-crimson)";

    return (
        <div className="hero-canvas">
            <div className="hero-metrics">
                <span className="hero-eyebrow">{eyebrow}</span>
                {loading ? (
                    <>
                        <div className="skel skel-value" />
                        <div className="skel skel-delta" />
                    </>
                ) : (
                    <>
                        <div className="hero-value">{fmt(value)}</div>
                        <div className={`hero-delta ${dirClass(changeVal)}`}>
                            <Arrow up={positive} flat={changeVal === 0} />
                            {positive ? "+" : ""}
                            {fmt(changeVal)}
                            <span className="hero-delta-pct">
                ({positive ? "+" : ""}
                                {fmt(changePct)}%)
              </span>
                        </div>
                    </>
                )}
            </div>

            <div
                className="hero-chart-wrap"
                ref={containerRef}
                {...(chart ? handlers : {})}
            >
                {loading ? (
                    <div className="skel hero-skel" />
                ) : chart ? (
                    <>
                        <svg
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                            className="hero-svg"
                        >
                            <defs>
                                <linearGradient
                                    id={gradientId}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.20" />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polygon
                                points={chart.area}
                                fill={`url(#${gradientId})`}
                                stroke="none"
                            />
                            <polyline
                                points={chart.line}
                                fill="none"
                                stroke={lineColor}
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            <HoverMarker
                                hover={hover}
                                height={height}
                                color={lineColor}
                                radius="5"
                            />
                        </svg>
                        <HoverTooltip hover={hover} width={width} height={height} />
                    </>
                ) : (
                    <div className="hero-chart-empty">no chart data</div>
                )}
                <div className="hero-baseline" />
            </div>
        </div>
    );
}

export function MiniSpark({ data, width = 280, height = 46 }) {
    const chart = buildChart(data, width, height);
    const { containerRef, index: hoverIndex, handlers } = useChartHover(
        chart?.values.length ?? 0
    );

    if (!chart) return <div className="mini-spark-empty">no trend data</div>;

    const hover =
        hoverIndex != null
            ? {
                x: chart.coords[hoverIndex][0],
                y: chart.coords[hoverIndex][1],
                value: chart.values[hoverIndex],
            }
            : null;
    const lineColor = chart.positive
        ? "var(--term-emerald)"
        : "var(--term-crimson)";

    return (
        <div className="mini-spark-wrap" ref={containerRef} {...handlers}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="mini-spark-svg"
            >
                <polyline
                    points={chart.line}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                <HoverMarker
                    hover={hover}
                    height={height}
                    color={lineColor}
                    radius="3.5"
                />
            </svg>
            <HoverTooltip hover={hover} width={width} height={height} small />
        </div>
    );
}

// Borderless search that opens the full company page on selection
export function TermSearch({ placeholder = "search symbol or company" }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [allStocks, setAllStocks] = useState([]);
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        let alive = true;
        getPriceVolume()
            .then((r) => {
                if (alive) setAllStocks(r.data ?? []);
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setOpen(false);
            return;
        }
        const q = query.toUpperCase();
        const filtered = allStocks
            .filter(
                (s) =>
                    s.symbol?.toUpperCase().includes(q) ||
                    s.securityName?.toUpperCase().includes(q)
            )
            .slice(0, 7);
        setResults(filtered);
        setOpen(filtered.length > 0);
    }, [query, allStocks]);

    useEffect(() => {
        const onClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const goToCompany = (stock) => {
        setOpen(false);
        setQuery("");
        navigate(`/nepse/company/${stock.symbol}`);
    };

    return (
        <div className="term-search" ref={wrapRef}>
            <div className="term-search-box">
                <IconSearch />
                <input
                    className="term-search-input"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && results[0]) goToCompany(results[0]);
                    }}
                />
                {query && (
                    <button
                        className="term-search-clear"
                        onClick={() => {
                            setQuery("");
                            setOpen(false);
                        }}
                        aria-label="clear search"
                    >
                        x
                    </button>
                )}
            </div>

            {open && (
                <div className="term-search-drop">
                    {results.map((s) => (
                        <div
                            key={s.symbol}
                            className="term-search-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => goToCompany(s)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") goToCompany(s);
                            }}
                        >
                            <span className="term-search-sym">{s.symbol}</span>
                            <span className="term-search-name">{s.securityName}</span>
                            <span className={`term-search-ltp ${dirClass(s.percentageChange)}`}>
                {fmt(s.lastTradedPrice ?? s.closePrice)}
              </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}