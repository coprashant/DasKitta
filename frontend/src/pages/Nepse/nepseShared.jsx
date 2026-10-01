import {
    useState,
    useEffect,
    useRef,
    useId,
    useMemo,
    useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    IconSearch,
    ClearIcon,
    ChevronLeft,
    ChevronRight,
    IconRefresh,
    IconStar,
    WarnIcon,
} from "../../components/Icons.jsx";

import {
    fmt,
    fmtSigned,
    fmtClock,
    dirClass,
    tooltipAlign,
    buildChart,
    buildSegments,
    useChartHover,
    SEG_RISE,
    SEG_FALL,
} from "./nepseUtils";
import { useDragScroll, usePriceVolume } from "./nepseHooks";

export function EmptyRow({ label }) {
    return <p className="ledger-empty">{label}</p>;
}

// count only bar or grid matched skeleton when columns is given
export function SkeletonRows({ count = 3, columns = 1 }) {
    if (columns <= 1) {
        return Array.from({ length: count }, (_, i) => (
            <div key={i} className="skel ledger-skel" />
        ));
    }

    const rowClass =
        columns === 4
            ? "ledger-row ledger-row-4"
            : columns === 3
                ? "ledger-row ledger-row-3"
                : "ledger-row";

    return Array.from({ length: count }, (_, i) => (
        <div className={rowClass} key={i}>
            {Array.from({ length: columns }, (_, j) => (
                <span key={j} className="skel ledger-skel-cell" />
            ))}
        </div>
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

// symbol that opens the company page
export function SymbolLink({ symbol }) {
    if (!symbol) return <span className="ledger-sym">--</span>;

    return (
        <Link
            className="ledger-sym ledger-sym-link"
            to={`/nepse/company/${encodeURIComponent(symbol)}`}
        >
            {symbol}
        </Link>
    );
}

// star toggle for the watchlist
export function WatchButton({ symbol, active, onToggle }) {
    return (
        <button
            type="button"
            className={`watch-btn ${active ? "on" : ""}`}
            aria-pressed={active}
            aria-label={
                active
                    ? `Remove ${symbol} from watchlist`
                    : `Add ${symbol} to watchlist`
            }
            title={active ? "Remove from watchlist" : "Add to watchlist"}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle(symbol);
            }}
        >
            <IconStar filled={active} />
        </button>
    );
}

// error or info line with an optional retry action
export function InlineNotice({ message, onRetry, busy = false }) {
    if (!message) return null;

    return (
        <div className="inline-notice" role="alert">
            <WarnIcon />

            <span className="inline-notice-text">{message}</span>

            {onRetry && (
                <button
                    type="button"
                    className="inline-retry"
                    onClick={onRetry}
                    disabled={busy}
                >
                    <IconRefresh spinning={busy} />
                    retry
                </button>
            )}
        </div>
    );
}

// scrollable tab list with edge fades and arrow key support
export function TabStrip({ tabs, active, onChange, label = "Sections" }) {
    const listRef = useRef(null);
    const [edge, setEdge] = useState({ left: false, right: false });

    const update = useCallback(() => {
        const el = listRef.current;
        if (!el) return;

        const left = el.scrollLeft > 2;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;

        setEdge((cur) =>
            cur.left === left && cur.right === right ? cur : { left, right }
        );
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return undefined;

        update();
        el.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);

        let observer = null;

        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(update);
            observer.observe(el);
        }

        return () => {
            el.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            if (observer) observer.disconnect();
        };
    }, [update, tabs.length]);

    // keep the active tab centered when it changes
    useEffect(() => {
        const el = listRef.current;
        const tab = el?.querySelector('[aria-selected="true"]');
        if (!el || !tab) return;

        const reduce =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        el.scrollTo({
            left: Math.max(0, tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2),
            behavior: reduce ? "auto" : "smooth",
        });
    }, [active]);

    const nudge = (dir) => {
        listRef.current?.scrollBy({
            left: dir * listRef.current.clientWidth * 0.6,
            behavior: "smooth",
        });
    };

    const onKeyDown = (e) => {
        const index = tabs.indexOf(active);
        let next = -1;

        if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;

        if (next < 0) return;

        e.preventDefault();
        onChange(tabs[next]);

        window.requestAnimationFrame(() => {
            listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
        });
    };

    return (
        <div
            className={`ledger-tabs-wrap ${edge.left ? "fade-left" : ""} ${
                edge.right ? "fade-right" : ""
            }`}
        >
            {edge.left && (
                <button
                    type="button"
                    className="tabs-nudge left"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => nudge(-1)}
                >
                    <ChevronLeft />
                </button>
            )}

            <div
                className="ledger-tabs"
                role="tablist"
                aria-label={label}
                ref={listRef}
                onKeyDown={onKeyDown}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={active === tab}
                        tabIndex={active === tab ? 0 : -1}
                        className={`ledger-tab ${active === tab ? "active" : ""}`}
                        onClick={() => onChange(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {edge.right && (
                <button
                    type="button"
                    className="tabs-nudge right"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => nudge(1)}
                >
                    <ChevronRight />
                </button>
            )}
        </div>
    );
}

// prev next page control
export function Pagination({ page, totalPages, onChange, loading = false }) {
    if (totalPages <= 1) return null;

    return (
        <div className="ledger-pagination" aria-label="Table pagination">
            <button
                type="button"
                className="page-btn page-btn-arrow"
                disabled={page === 0 || loading}
                onClick={() => onChange(page - 1)}
                aria-label="Previous page"
            >
                <ChevronLeft />
            </button>

            <span className="page-info" aria-live="polite">
                {page + 1}/{totalPages}
            </span>

            <button
                type="button"
                className="page-btn page-btn-arrow"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => onChange(page + 1)}
                aria-label="Next page"
            >
                <ChevronRight />
            </button>
        </div>
    );
}

// advancing declining and unchanged split for the whole market
export function BreadthBar({ rows }) {
    const stats = useMemo(() => {
        let up = 0;
        let down = 0;
        let flat = 0;

        for (const row of rows ?? []) {
            const pct = Number(row?.percentageChange);
            if (!Number.isFinite(pct)) continue;

            if (pct > 0) up += 1;
            else if (pct < 0) down += 1;
            else flat += 1;
        }

        return { up, down, flat, total: up + down + flat };
    }, [rows]);

    if (!stats.total) return null;

    return (
        <div
            className="breadth"
            role="img"
            aria-label={`Market breadth, ${stats.up} advancing, ${stats.down} declining, ${stats.flat} unchanged`}
        >
            <div className="breadth-head">
                <span className="ledger-label">breadth</span>

                <span className="breadth-counts">
                    <span className="up">
                        <Arrow up />
                        {stats.up}
                    </span>
                    <span className="flat">{stats.flat}</span>
                    <span className="down">
                        <Arrow up={false} />
                        {stats.down}
                    </span>
                </span>
            </div>

            <div className="breadth-bar" aria-hidden="true">
                <span className="breadth-seg up" style={{ flexGrow: stats.up }} />
                <span className="breadth-seg flat" style={{ flexGrow: stats.flat }} />
                <span className="breadth-seg down" style={{ flexGrow: stats.down }} />
            </div>
        </div>
    );
}

// low to high bar with a marker at the current price
export function RangeBar({ label, low, high, value }) {
    const lo = Number(low);
    const hi = Number(high);
    const v = Number(value);

    if (low == null || high == null) return null;
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;

    const pos =
        Number.isFinite(v) && v > 0
            ? Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
            : null;

    return (
        <div className="range-bar">
            <span className="ledger-label range-label">{label}</span>
            <span className="range-val">{fmt(lo)}</span>

            <span className="range-track">
                {pos !== null && (
                    <span
                        className="range-marker"
                        style={{ left: `${pos * 100}%` }}
                    />
                )}
            </span>

            <span className="range-val">{fmt(hi)}</span>
        </div>
    );
}

function getHover(chart, index, ref, detailed) {
    if (!chart || index == null) return null;

    const point = chart.coords[index];
    if (!point) return null;

    const [x, y] = point;
    const value = chart.values[index];

    let pct = null;

    if (detailed) {
        const base = ref ?? chart.values[0];
        if (base) pct = ((value - base) / base) * 100;
    }

    return {
        x,
        y,
        value,
        pct,
        color: chart.segments.colorAt[index],
        time: detailed ? fmtClock(chart.times[index]) : null,
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
            <span>{fmt(hover.value)}</span>

            {hover.time && (
                <span className="term-tooltip-sub">{hover.time}</span>
            )}

            {hover.pct != null && (
                <span
                    className={`term-tooltip-sub ${dirClass(hover.pct)}`}
                >
                    {fmtSigned(hover.pct)}%
                </span>
            )}
        </div>
    );
}

function ChartSvg({
                      chart,
                      width,
                      height,
                      hover,
                      gradientId,
                      label,
                      area = false,
                      radius = 5,
                      strokeWidth = 1.6,
                  }) {
    const trendColor = chart.positive ? SEG_RISE : SEG_FALL;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className={area ? "hero-svg" : "mini-spark-svg"}
            role="img"
            aria-label={label}
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
                            stopColor={trendColor}
                            stopOpacity="0.16"
                        />
                        <stop
                            offset="100%"
                            stopColor={trendColor}
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

            {area && chart.refY != null && (
                <line
                    x1="0"
                    y1={chart.refY}
                    x2={width}
                    y2={chart.refY}
                    className="term-ref-line"
                    vectorEffect="non-scaling-stroke"
                />
            )}

            {chart.segments.runs.map((run, i) => (
                <polyline
                    key={i}
                    points={run.points}
                    fill="none"
                    stroke={run.color}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            ))}

            <HoverMarker
                hover={hover}
                height={height}
                color={hover?.color}
                radius={radius}
            />
        </svg>
    );
}

// chart data with segment colors built once per data change
function useChartModel(data, width, height, ref) {
    return useMemo(() => {
        const chart = buildChart(data, width, height, ref);
        if (!chart) return null;

        return {
            ...chart,
            segments: buildSegments(chart.coords, chart.values),
        };
    }, [data, width, height, ref]);
}

export function HeroChart({
                              loading,
                              data,
                              value,
                              changeVal,
                              changePct,
                              baseline = null,
                              baselineLabel = "prev close",
                              eyebrow = "NEPSE INDEX",
                          }) {
    // fix useId returns colons so strip them to keep url ids safe
    const gradientId = useId().replace(/:/g, "");
    const width = 1000;
    const height = 380;
    const MIN_VISIBLE = 12;

    const ref =
        typeof baseline === "number" && Number.isFinite(baseline) && baseline > 0
            ? baseline
            : null;

    const [viewport, setViewport] = useState({ start: 0, size: 0 });
    const dragRef = useRef(null);
    const pinchRef = useRef(null);

    useEffect(() => {
        if (!Array.isArray(data) || !data.length) {
            setViewport({ start: 0, size: 0 });
            return;
        }

        setViewport((prev) => {
            const total = data.length;
            const nextSize = Math.max(MIN_VISIBLE, Math.min(total, prev.size || total));
            const windowed = clampChartWindow(total, prev.start || 0, nextSize, MIN_VISIBLE);

            return windowed.size === prev.size && windowed.start === prev.start
                ? prev
                : windowed;
        });
    }, [data]);

    const visibleData = useMemo(() => {
        if (!Array.isArray(data) || !data.length) return [];

        const total = data.length;
        const safeWindow = clampChartWindow(
            total,
            viewport.start,
            viewport.size || total,
            MIN_VISIBLE
        );

        return data.slice(safeWindow.start, safeWindow.start + safeWindow.size);
    }, [data, viewport]);

    const chart = useChartModel(visibleData, width, height, ref);

    const {
        containerRef,
        index: hoverIndex,
        handlers: hoverHandlers,
    } = useChartHover(chart?.values.length ?? 0);

    const hover = getHover(chart, hoverIndex, ref, true);
    const positive = changeVal >= 0;

    const applyZoom = useCallback((factor, ratio = 0.5) => {
        if (!Array.isArray(data) || !data.length) return;

        setViewport((prev) => {
            const total = data.length;
            const currentSize = Math.max(MIN_VISIBLE, prev.size || total);
            const nextSize = clampChartWindow(
                total,
                0,
                Math.round(currentSize * factor),
                MIN_VISIBLE
            ).size;
            const focus = (prev.start || 0) + currentSize * Math.min(1, Math.max(0, ratio));
            const nextStart = clampChartWindow(
                total,
                focus - nextSize * Math.min(1, Math.max(0, ratio)),
                nextSize,
                MIN_VISIBLE
            ).start;

            return clampChartWindow(total, nextStart, nextSize, MIN_VISIBLE);
        });
    }, [data]);

    const handleWheel = useCallback((event) => {
        event.preventDefault();
        if (!Array.isArray(data) || !data.length || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const factor = event.deltaY < 0 ? 0.8 : 1.2;

        applyZoom(factor, ratio);
    }, [applyZoom, containerRef, data]);

    const handlePointerDown = useCallback((event) => {
        if (!Array.isArray(data) || !data.length) return;

        dragRef.current = {
            x: event.clientX,
            start: viewport.start,
            size: viewport.size || data.length,
        };

        event.currentTarget?.setPointerCapture?.(event.pointerId);
        hoverHandlers.onPointerDown?.(event);
    }, [data, hoverHandlers, viewport]);

    const handlePointerMove = useCallback((event) => {
        if (!dragRef.current || !Array.isArray(data) || !data.length) {
            hoverHandlers.onPointerMove?.(event);
            return;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const delta = event.clientX - dragRef.current.x;
        const shift = Math.round((delta / rect.width) * dragRef.current.size);
        const nextStart = Math.min(
            Math.max(0, dragRef.current.start - shift),
            Math.max(0, data.length - dragRef.current.size)
        );

        setViewport((prev) => ({
            ...prev,
            start: nextStart,
        }));
    }, [containerRef, data, hoverHandlers]);

    const handlePointerUp = useCallback((event) => {
        dragRef.current = null;
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
        hoverHandlers.onPointerLeave?.(event);
    }, [hoverHandlers]);

    const getTouchDistance = useCallback((touchA, touchB) => {
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        return Math.hypot(dx, dy) || 1;
    }, []);

    const handleTouchStart = useCallback((event) => {
        if (!Array.isArray(data) || !data.length || event.touches.length !== 2) return;

        pinchRef.current = {
            distance: getTouchDistance(event.touches[0], event.touches[1]),
            start: viewport.start,
            size: viewport.size || data.length,
        };
    }, [data, getTouchDistance, viewport]);

    const handleTouchMove = useCallback((event) => {
        if (!pinchRef.current || !Array.isArray(data) || !data.length || event.touches.length !== 2) return;

        event.preventDefault();

        const rect = containerRef.current?.getBoundingClientRect();
        const distance = getTouchDistance(event.touches[0], event.touches[1]);
        const ratio = distance / pinchRef.current.distance;
        const total = data.length;
        const currentSize = pinchRef.current.size;
        const nextSize = clampChartWindow(total, 0, Math.round(currentSize / ratio), MIN_VISIBLE).size;

        if (!rect) return;

        const midpoint = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const focusRatio = Math.min(1, Math.max(0, (midpoint - rect.left) / rect.width));
        const focus = pinchRef.current.start + currentSize * focusRatio;
        const nextStart = clampChartWindow(
            total,
            focus - nextSize * focusRatio,
            nextSize,
            MIN_VISIBLE
        ).start;

        setViewport({ start: nextStart, size: nextSize });
    }, [containerRef, data, getTouchDistance]);

    const handleTouchEnd = useCallback(() => {
        pinchRef.current = null;
    }, []);

    const visibleRange =
        Array.isArray(data) && data.length
            ? `${Math.min(data.length, viewport.start + 1)}-${Math.min(data.length, viewport.start + (viewport.size || data.length))}/${data.length}`
            : "0/0";

    const mergedHandlers = {
        ...hoverHandlers,
        onWheel: handleWheel,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp,
        onPointerCancel: handlePointerUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
    };

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

            {!loading && chart && (
                <div className="hero-chart-toolbar">
                    <span className="hero-chart-range">{visibleRange}</span>

                    <div className="hero-chart-controls" aria-label="Chart controls">
                        <button type="button" className="hero-chart-btn" onClick={() => applyZoom(1.18, 0.5)} aria-label="Zoom out chart">-</button>
                        <button type="button" className="hero-chart-btn" onClick={() => applyZoom(0.82, 0.5)} aria-label="Zoom in chart">+</button>
                        <button type="button" className="hero-chart-btn hero-chart-btn-reset" onClick={() => setViewport({ start: 0, size: data.length })} aria-label="Reset chart view">reset</button>
                    </div>
                </div>
            )}

            <div
                className="hero-chart-wrap"
                ref={containerRef}
                {...(chart ? mergedHandlers : {})}
            >
                {loading ? (
                    <div className="skel hero-skel" />
                ) : chart ? (
                    <>
                        <ChartSvg
                            chart={chart}
                            width={width}
                            height={height}
                            hover={hover}
                            gradientId={gradientId}
                            label={`${eyebrow} price chart with ${chart.values.length} points`}
                            area
                        />

                        {chart.refY != null && (
                            <span
                                className="term-ref-label"
                                style={{
                                    top: `${(chart.refY / height) * 100}%`,
                                }}
                            >
                                {baselineLabel} {fmt(ref)}
                            </span>
                        )}

                        <HoverTooltip
                            hover={hover}
                            width={width}
                            height={height}
                        />
                    </>
                ) : (
                    <div className="hero-chart-empty">
                        chart data unavailable
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
    const chart = useChartModel(data, width, height, null);

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

    const hover = getHover(chart, hoverIndex, null, false);

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
                hover={hover}
                radius={3.5}
                strokeWidth={1.4}
                label={`Trend chart with ${chart.values.length} points`}
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
    const listId = useId().replace(/:/g, "");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    const { rows: allStocks, error: stocksError } = usePriceVolume();

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
            .sort((a, b) => {
                const aStarts = a.symbol?.toUpperCase().startsWith(q) ? 0 : 1;
                const bStarts = b.symbol?.toUpperCase().startsWith(q) ? 0 : 1;
                return aStarts - bStarts;
            })
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

    // slash key jumps to search from anywhere on the page
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;

            const tag = e.target?.tagName;
            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                e.target?.isContentEditable
            ) {
                return;
            }

            e.preventDefault();
            inputRef.current?.focus();
        };

        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const goToCompany = (stock) => {
        setOpen(false);
        setQuery("");
        // encode symbol in case it has special characters
        navigate(`/nepse/company/${encodeURIComponent(stock.symbol)}`);
    };

    const clear = () => {
        setQuery("");
        setOpen(false);
    };

    const onInputKeyDown = (e) => {
        if (e.key === "Enter" && results.length) {
            goToCompany(results[active] ?? results[0]);
            return;
        }

        if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, results.length - 1));
            return;
        }

        if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
            return;
        }

        if (e.key === "Escape") {
            setOpen(false);
            e.currentTarget.blur();
        }
    };

    const hasQuery = query.trim().length > 0;
    const showDrop = open && hasQuery;

    return (
        <div className="term-search" ref={wrapRef}>
            <div className="term-search-box">
                <IconSearch />

                <input
                    ref={inputRef}
                    className="term-search-input"
                    placeholder={placeholder}
                    value={query}
                    role="combobox"
                    aria-expanded={showDrop}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    onChange={(e) => {
                        const next = e.target.value;
                        setQuery(next);
                        setActive(0);
                        setOpen(next.trim().length > 0);
                    }}
                    onFocus={() =>
                        results.length && setOpen(true)
                    }
                    onKeyDown={onInputKeyDown}
                />

                {query ? (
                    <button
                        className="term-search-clear"
                        onClick={clear}
                        aria-label="clear search"
                    >
                        <ClearIcon />
                    </button>
                ) : (
                    <span className="term-search-kbd" aria-hidden="true">
                        /
                    </span>
                )}
            </div>

            {showDrop && (
                <div className="term-search-drop" id={listId} role="listbox">
                    {!results.length && (
                        <div className="term-search-note">
                            {stocksError ?? "no matching stock"}
                        </div>
                    )}

                    {results.map((stock, i) => (
                        <div
                            key={stock.symbol}
                            className={`term-search-row ${
                                i === active ? "is-active" : ""
                            }`}
                            role="option"
                            aria-selected={i === active}
                            tabIndex={0}
                            onMouseEnter={() => setActive(i)}
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