import {
    useState,
    useEffect,
    useRef,
    useId,
    useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { getPriceVolume, isNepseError } from "../../api/nepse";
import { IconSearch } from "../../components/Icons.jsx";

import {
    fmt,
    dirClass,
    tooltipAlign,
    buildChart,
    useChartHover,
} from "./nepseUtils";
import { useDragScroll } from "./nepseHooks";

export function EmptyRow({ label }) {
    return <p className="ledger-empty">{label}</p>;
}

export function SkeletonRows({ count = 3 }) {
    return Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel ledger-skel" />
    ));
}

export function Arrow({ up, flat }) {
    if (flat) {
        return <span className="arrow-icon arrow-flat">--</span>;
    }

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

function getHover(chart, index) {
    if (!chart || index == null) return null;

    const [x, y] = chart.coords[index];

    return {
        x,
        y,
        value: chart.values[index],
    };
}

function HoverMarker({
                         hover,
                         height,
                         color,
                         radius = 5,
                     }) {
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

function HoverTooltip({
                          hover,
                          width,
                          height,
                          small = false,
                      }) {
    if (!hover) return null;

    const ratio = hover.x / width;

    return (
        <div
            className={`term-tooltip ${
                small ? "term-tooltip-sm" : ""
            } align-${tooltipAlign(ratio)}`}
            style={{
                left: `${ratio * 100}%`,
                top: `${(hover.y / height) * 100}%`,
            }}
        >
            {fmt(hover.value)}
        </div>
    );
}

function ChartSvg({
                      chart,
                      width,
                      height,
                      color,
                      hover,
                      gradientId,
                      area = false,
                      radius = 5,
                      strokeWidth = 1.6,
                  }) {
    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className={area ? "hero-svg" : "mini-spark-svg"}
        >
            {area && (
                <defs>
                    <linearGradient
                        id={gradientId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor={color}
                            stopOpacity="0.20"
                        />
                        <stop
                            offset="100%"
                            stopColor={color}
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>
            )}

            {area && (
                <polygon
                    points={chart.area}
                    fill={`url(#${gradientId})`}
                    stroke="none"
                />
            )}

            <polyline
                points={chart.line}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            <HoverMarker
                hover={hover}
                height={height}
                color={color}
                radius={radius}
            />
        </svg>
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
    const gradientId = useId();
    const width = 1000;
    const height = 380;
    const chart = buildChart(data, width, height);

    const {
        containerRef,
        index: hoverIndex,
        handlers,
    } = useChartHover(chart?.values.length ?? 0);

    const hover = getHover(chart, hoverIndex);
    const positive = changeVal >= 0;

    const lineColor = chart?.positive
        ? "var(--term-emerald)"
        : "var(--term-crimson)";

    return (
        <div className="hero-canvas">
            <div className="hero-metrics">
                <span className="hero-eyebrow">
                    {eyebrow}
                </span>

                {loading ? (
                    <>
                        <div className="skel skel-value" />
                        <div className="skel skel-delta" />
                    </>
                ) : (
                    <>
                        <div className="hero-value">
                            {fmt(value)}
                        </div>

                        <div
                            className={`hero-delta ${dirClass(
                                changeVal
                            )}`}
                        >
                            <Arrow
                                up={positive}
                                flat={changeVal === 0}
                            />

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
                        <ChartSvg
                            chart={chart}
                            width={width}
                            height={height}
                            color={lineColor}
                            hover={hover}
                            gradientId={gradientId}
                            area
                        />

                        <HoverTooltip
                            hover={hover}
                            width={width}
                            height={height}
                        />
                    </>
                ) : (
                    <div className="hero-chart-empty">
                        no chart data
                    </div>
                )}

                <div className="hero-baseline" />
            </div>
        </div>
    );
}

export function MiniSpark({
                              data,
                              width = 280,
                              height = 46,
                          }) {
    const chart = buildChart(data, width, height);

    const {
        containerRef,
        index: hoverIndex,
        handlers,
    } = useChartHover(chart?.values.length ?? 0);

    if (!chart) {
        return (
            <div className="mini-spark-empty">
                no trend data
            </div>
        );
    }

    const hover = getHover(chart, hoverIndex);

    const lineColor = chart.positive
        ? "var(--term-emerald)"
        : "var(--term-crimson)";

    return (
        <div
            className="mini-spark-wrap"
            ref={containerRef}
            {...handlers}
        >
            <ChartSvg
                chart={chart}
                width={width}
                height={height}
                color={lineColor}
                hover={hover}
                radius={3.5}
                strokeWidth={1.4}
            />

            <HoverTooltip
                hover={hover}
                width={width}
                height={height}
                small
            />
        </div>
    );
}

export function TermSearch({
                               placeholder = "search symbol or company",
                           }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [allStocks, setAllStocks] = useState([]);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        let alive = true;

        getPriceVolume()
            .then((r) => {
                if (!alive) return;

                if (isNepseError(r.data)) {
                    setAllStocks([]);
                    return;
                }

                setAllStocks(Array.isArray(r.data) ? r.data : []);
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

    const results = useMemo(() => {
        const q = query.trim().toUpperCase();

        if (!q) return [];

        return allStocks
            .filter(
                (stock) =>
                    stock.symbol?.toUpperCase().includes(q) ||
                    stock.securityName
                        ?.toUpperCase()
                        .includes(q)
            )
            .slice(0, 7);
    }, [query, allStocks]);

    useEffect(() => {
        const onClick = (e) => {
            if (!wrapRef.current?.contains(e.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onClick);

        return () =>
            document.removeEventListener(
                "mousedown",
                onClick
            );
    }, []);

    const goToCompany = (stock) => {
        setOpen(false);
        setQuery("");
        navigate(`/nepse/company/${stock.symbol}`);
    };

    const clear = () => {
        setQuery("");
        setOpen(false);
    };

    return (
        <div className="term-search" ref={wrapRef}>
            <div className="term-search-box">
                <IconSearch />

                <input
                    className="term-search-input"
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => {
                        const next = e.target.value;
                        setQuery(next);
                        setOpen(next.trim().length > 0);
                    }}
                    onFocus={() =>
                        results.length && setOpen(true)
                    }
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter" &&
                            results[0]
                        ) {
                            goToCompany(results[0]);
                        }
                    }}
                />

                {query && (
                    <button
                        className="term-search-clear"
                        onClick={clear}
                        aria-label="clear search"
                    >
                        x
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="term-search-drop">
                    {results.map((stock) => (
                        <div
                            key={stock.symbol}
                            className="term-search-row"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                                goToCompany(stock)
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    goToCompany(stock);
                                }
                            }}
                        >
                            <span className="term-search-sym">
                                {stock.symbol}
                            </span>

                            <span className="term-search-name">
                                {stock.securityName}
                            </span>

                            <span
                                className={`term-search-ltp ${dirClass(
                                    stock.percentageChange
                                )}`}
                            >
                                {fmt(
                                    stock.lastTradedPrice ??
                                    stock.closePrice
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ScrollTicker({ children }) {
    const { ref, handlers } = useDragScroll();

    return (
        <div className="term-ticker" ref={ref} {...handlers}>
            <div className="term-ticker-track">{children}</div>

            <div
                className="term-ticker-track mobile-only-duplicate"
                aria-hidden="true"
            >
                {children}
            </div>
        </div>
    );
}