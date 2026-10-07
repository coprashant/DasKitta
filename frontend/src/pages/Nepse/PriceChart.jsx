import {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    useId,
} from "react";
import {
    fmt,
    fmtCompact,
    fmtSigned,
    fmtClock,
    dirClass,
    buildSegments,
    SEG_RISE,
    SEG_FALL,
} from "./nepseUtils";
import { sma, ema, bollinger, rsi, niceTicks, groupBars } from "./nepseMath";

const PREF_KEY = "nepse_chart_prefs_v1";
const MIN_VISIBLE = 8;
const AXIS_H = 18;
const PAD_T = 8;
const GAP = 6;
const VOL_H = 54;
const RSI_H = 64;
const HOLD_MS = 380;
const DOUBLE_TAP_MS = 320;

const OVERLAYS = [
    { key: "sma20", label: "SMA20" },
    { key: "sma50", label: "SMA50" },
    { key: "ema20", label: "EMA20" },
    { key: "bb", label: "BB" },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function readPrefs() {
    try {
        const raw = JSON.parse(window.localStorage.getItem(PREF_KEY) || "{}");

        return {
            mode: raw.mode === "candle" ? "candle" : "line",
            ind: Array.isArray(raw.ind)
                ? raw.ind.filter((k) => typeof k === "string")
                : [],
        };
    } catch {
        return { mode: "line", ind: [] };
    }
}

function clampView(total, start, size) {
    if (!total) return { start: 0, size: 0 };

    const s = clamp(size, Math.min(total, MIN_VISIBLE), total);

    return { start: clamp(start, 0, total - s), size: s };
}

const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
});

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
});

function axisLabel(p, intraday, spanDays) {
    if (!p) return "";
    if (intraday) return fmtClock(p.t) ?? "";
    if (p.t == null) return p.d ?? "";

    return spanDays > 400 ? MONTH_FMT.format(p.t) : DAY_FMT.format(p.t);
}

function fullLabel(p, intraday) {
    if (!p) return "";
    if (intraday) return fmtClock(p.t) ?? "";

    return p.d ?? "";
}

function decimalsFor(span) {
    return span >= 200 ? 0 : span >= 20 ? 1 : 2;
}

function RO({ k, v, tone }) {
    return (
        <span className="pc-ro">
            <span className="pc-ro-k">{k}</span>
            <span className={tone ?? ""}>{v}</span>
        </span>
    );
}

export default function PriceChart({
                                       points,
                                       loading = false,
                                       baseline = null,
                                       baselineLabel = "prev close",
                                       intraday = false,
                                       derived = false,
                                       ranges = null,
                                       range = null,
                                       onRange = null,
                                       resetKey = "",
                                       label = "price chart",
                                   }) {
    const total = points.length;
    const clipId = useId().replace(/:/g, "");

    const wrapRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [prefs, setPrefs] = useState(readPrefs);
    const [vp, setVp] = useState({ start: 0, size: 0 });
    const [cross, setCross] = useState(null);

    const vpRef = useRef(vp);
    const keyRef = useRef(resetKey);
    const totalRef = useRef(0);
    const ptrs = useRef(new Map());
    const gesture = useRef(null);
    const holdRef = useRef(0);
    const lastTap = useRef({ t: 0, x: 0, y: 0 });
    const rafRef = useRef(0);
    const pendingX = useRef(null);
    const wheelRef = useRef(null);

    const candle = prefs.mode === "candle";
    const narrow = width < 420;
    const axisW = narrow ? 50 : 60;
    const plotW = Math.max(0, width - axisW);

    const hasVol = useMemo(() => points.some((p) => p.v != null), [points]);
    const showVol = prefs.ind.includes("vol") && hasVol;
    const showRsi = prefs.ind.includes("rsi") && total > 15;

    const priceH = clamp(Math.round(width * 0.375), 200, 400);
    const height = width
        ? PAD_T +
        priceH +
        (showVol ? GAP + VOL_H : 0) +
        (showRsi ? GAP + RSI_H : 0) +
        AXIS_H
        : 0;

    const geo = useRef({ plotW: 0, total: 0 });
    geo.current = { plotW, total };

    const setView = useCallback((next) => {
        vpRef.current = next;
        setVp(next);
    }, []);

    // save chart prefs
    useEffect(() => {
        try {
            window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
        } catch {
            // storage blocked ignore
        }
    }, [prefs]);

    // measure width
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;

        const measure = () => setWidth(Math.round(el.clientWidth));

        measure();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", measure);
            return () => window.removeEventListener("resize", measure);
        }

        const observer = new ResizeObserver(measure);
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    // keep the view in step with data changes
    useEffect(() => {
        const keyChanged = keyRef.current !== resetKey;
        const prev = totalRef.current;
        const cur = vpRef.current;

        keyRef.current = resetKey;
        totalRef.current = total;

        if (!total) {
            setView({ start: 0, size: 0 });
            setCross(null);
            return;
        }

        if (keyChanged || !prev || !cur.size) {
            setView({ start: 0, size: total });
            setCross(null);
            return;
        }

        if (total === prev) return;

        const wasFull = cur.size >= prev - 0.5;
        const atEnd = cur.start + cur.size >= prev - 0.5;
        const size = wasFull ? total : Math.min(cur.size, total);
        const start = atEnd ? total - size : cur.start;

        setView(clampView(total, start, size));
    }, [resetKey, total, setView]);

    useEffect(
        () => () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            window.clearTimeout(holdRef.current);
        },
        []
    );

    // touch outside clears a pinned crosshair
    const pinned = cross != null;

    useEffect(() => {
        if (!pinned) return undefined;

        const onDown = (e) => {
            if (e.pointerType !== "mouse" && !wrapRef.current?.contains(e.target)) {
                setCross(null);
            }
        };

        document.addEventListener("pointerdown", onDown);

        return () => document.removeEventListener("pointerdown", onDown);
    }, [pinned]);

    /* view actions */

    const zoomAt = useCallback(
        (factor, ratio = 0.5) => {
            const cur = vpRef.current;
            const n = geo.current.total;

            if (!n || !cur.size) return;

            const size = clamp(cur.size * factor, Math.min(n, MIN_VISIBLE), n);
            const focus = cur.start + cur.size * ratio;

            setView(clampView(n, focus - size * ratio, size));
        },
        [setView]
    );

    const panBy = useCallback(
        (indexDelta) => {
            const cur = vpRef.current;
            const n = geo.current.total;

            if (!n || !cur.size) return;

            setView(clampView(n, cur.start + indexDelta, cur.size));
        },
        [setView]
    );

    const resetView = useCallback(() => {
        const n = geo.current.total;

        setView(n ? { start: 0, size: n } : { start: 0, size: 0 });
        setCross(null);
    }, [setView]);

    const toPx = (clientX) => {
        const rect = wrapRef.current?.getBoundingClientRect();

        return rect
            ? clamp(clientX - rect.left, 0, geo.current.plotW)
            : 0;
    };

    const queueCross = (px) => {
        pendingX.current = px;

        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            setCross(pendingX.current);
        });
    };

    /* wheel needs a non passive listener to block page scroll */

    wheelRef.current = (e) => {
        const { plotW: w, total: n } = geo.current;
        const cur = vpRef.current;

        if (!n || !w || !cur.size) return;

        e.preventDefault();

        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            panBy(((e.deltaX || e.deltaY) / w) * cur.size);
            return;
        }

        const k = e.ctrlKey ? 0.01 : 0.0015;
        const factor = Math.exp(clamp(e.deltaY, -120, 120) * k);

        zoomAt(factor, toPx(e.clientX) / w);
    };

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;

        const handler = (e) => wheelRef.current?.(e);

        el.addEventListener("wheel", handler, { passive: false });

        return () => el.removeEventListener("wheel", handler);
    }, []);

    /* pointer gestures */

    const onPointerDown = (e) => {
        if (!geo.current.total) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;

        wrapRef.current?.setPointerCapture?.(e.pointerId);
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        window.clearTimeout(holdRef.current);

        if (ptrs.current.size === 2) {
            const [a, b] = [...ptrs.current.values()];
            const mid = (a.x + b.x) / 2;

            gesture.current = {
                type: "pinch",
                dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
                vp: vpRef.current,
                ratio: clamp(toPx(mid) / (geo.current.plotW || 1), 0, 1),
            };

            return;
        }

        if (ptrs.current.size !== 1) return;

        if (e.pointerType === "mouse") {
            gesture.current = {
                type: "pan",
                sx: e.clientX,
                vp: vpRef.current,
            };

            return;
        }

        gesture.current = {
            type: "pending",
            sx: e.clientX,
            sy: e.clientY,
            lastY: e.clientY,
        };

        // hold to inspect without moving the chart
        holdRef.current = window.setTimeout(() => {
            if (gesture.current?.type === "pending") {
                gesture.current = { type: "cross" };
                setCross(toPx(e.clientX));
                navigator.vibrate?.(8);
            }
        }, HOLD_MS);
    };

    const onPointerMove = (e) => {
        const p = ptrs.current.get(e.pointerId);

        // mouse hover without a pressed button
        if (!p) {
            if (e.pointerType === "mouse" && geo.current.total) {
                queueCross(toPx(e.clientX));
            }

            return;
        }

        p.x = e.clientX;
        p.y = e.clientY;

        const g = gesture.current;
        if (!g) return;

        const { plotW: w, total: n } = geo.current;

        if (g.type === "pinch" && ptrs.current.size === 2) {
            const [a, b] = [...ptrs.current.values()];
            const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
            const size = g.vp.size * (g.dist / dist);
            const focus = g.vp.start + g.vp.size * g.ratio;
            const ratioNow = clamp(toPx((a.x + b.x) / 2) / (w || 1), 0, 1);

            setView(clampView(n, focus - size * ratioNow, size));
            return;
        }

        if (g.type === "pan") {
            const shift = ((e.clientX - g.sx) / (w || 1)) * g.vp.size;

            setView(clampView(n, g.vp.start - shift, g.vp.size));

            if (e.pointerType === "mouse") queueCross(toPx(e.clientX));
            return;
        }

        if (g.type === "pending") {
            const dx = e.clientX - g.sx;
            const dy = e.clientY - g.sy;

            if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;

            window.clearTimeout(holdRef.current);

            if (Math.abs(dx) >= Math.abs(dy)) {
                gesture.current = {
                    type: "pan",
                    sx: e.clientX,
                    vp: vpRef.current,
                };
            } else {
                gesture.current = { type: "scroll", lastY: e.clientY };
            }

            return;
        }

        // vertical drags hand the scroll back to the page
        if (g.type === "scroll") {
            window.scrollBy(0, g.lastY - e.clientY);
            g.lastY = e.clientY;
            return;
        }

        if (g.type === "cross") queueCross(toPx(e.clientX));
    };

    const endPointer = (e) => {
        const g = gesture.current;

        window.clearTimeout(holdRef.current);

        if (g?.type === "pending" && e.type === "pointerup") {
            const now = Date.now();
            const tap = lastTap.current;
            const px = toPx(e.clientX);
            const near =
                Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30;

            if (now - tap.t < DOUBLE_TAP_MS && near) {
                zoomAt(0.5, px / (geo.current.plotW || 1));
                setCross(null);
                lastTap.current = { t: 0, x: 0, y: 0 };
            } else {
                setCross((prev) =>
                    prev != null && Math.abs(prev - px) < 8 ? null : px
                );
                lastTap.current = { t: now, x: e.clientX, y: e.clientY };
            }
        }

        ptrs.current.delete(e.pointerId);

        try {
            wrapRef.current?.releasePointerCapture?.(e.pointerId);
        } catch {
            // capture already released
        }

        if (ptrs.current.size === 1 && g?.type === "pinch") {
            const [rest] = [...ptrs.current.values()];

            gesture.current = {
                type: "pan",
                sx: rest.x,
                vp: vpRef.current,
            };
            return;
        }

        if (!ptrs.current.size) gesture.current = null;
    };

    const onPointerLeave = (e) => {
        if (e.pointerType === "mouse" && !ptrs.current.has(e.pointerId)) {
            pendingX.current = null;
            setCross(null);
        }
    };

    const onKeyDown = (e) => {
        const cur = vpRef.current;

        if (!cur.size) return;

        if (e.key === "ArrowLeft") panBy(-cur.size * 0.15);
        else if (e.key === "ArrowRight") panBy(cur.size * 0.15);
        else if (e.key === "+" || e.key === "=") zoomAt(0.7);
        else if (e.key === "-" || e.key === "_") zoomAt(1 / 0.7);
        else if (e.key === "0" || e.key === "Home") resetView();
        else if (e.key === "End") panBy(geo.current.total);
        else return;

        e.preventDefault();
    };

    /* derived chart data */

    const view = useMemo(() => {
        if (!total || !vp.size || !plotW) return null;

        const maxBars = candle
            ? Math.max(8, Math.floor(plotW / 5))
            : Math.max(8, Math.floor(plotW));

        return groupBars(points, vp.start, vp.size, maxBars);
    }, [points, vp, plotW, candle, total]);

    const ind = useMemo(() => {
        const on = new Set(prefs.ind);
        const closes = points.map((p) => p.c);

        return {
            sma20: on.has("sma20") ? sma(closes, 20) : null,
            sma50: on.has("sma50") ? sma(closes, 50) : null,
            ema20: on.has("ema20") ? ema(closes, 20) : null,
            bb: on.has("bb") ? bollinger(closes, 20, 2) : null,
            rsi: on.has("rsi") ? rsi(closes, 14) : null,
        };
    }, [points, prefs.ind]);

    const domain = useMemo(() => {
        if (!view) return null;

        let lo = Infinity;
        let hi = -Infinity;

        const take = (v) => {
            if (v == null) return;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        };

        for (const b of view.bars) {
            if (candle) {
                take(b.l);
                take(b.h);
            } else {
                take(b.c);
            }

            take(ind.sma20?.[b.e]);
            take(ind.sma50?.[b.e]);
            take(ind.ema20?.[b.e]);
            take(ind.bb?.up[b.e]);
            take(ind.bb?.low[b.e]);
        }

        if (baseline != null) take(baseline);
        if (!Number.isFinite(lo)) return null;

        if (hi === lo) {
            const pad = Math.abs(hi) * 0.01 || 1;
            lo -= pad;
            hi += pad;
        }

        const pad = (hi - lo) * 0.06;

        return { lo: lo - pad, hi: hi + pad };
    }, [view, ind, candle, baseline]);

    const lineModel = useMemo(() => {
        if (!view || !domain || candle || view.bars.length < 2) return null;

        const span = domain.hi - domain.lo || 1;
        const xAt = (b) =>
            (((b.s + b.e + 1) / 2 - vp.start) / vp.size) * plotW;
        const yAt = (v) => PAD_T + ((domain.hi - v) / span) * priceH;
        const coords = view.bars.map((b) => [xAt(b), yAt(b.c)]);
        const values = view.bars.map((b) => b.c);

        return {
            coords,
            area: coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
            segments: buildSegments(coords, values),
            positive: values[values.length - 1] >= values[0],
        };
    }, [view, domain, candle, vp, plotW, priceH]);

    /* hover and readout */

    const geometry = view && domain && plotW
        ? {
            span: domain.hi - domain.lo || 1,
        }
        : null;

    const xOf = (b) => (((b.s + b.e + 1) / 2 - vp.start) / vp.size) * plotW;
    const yOf = (v) =>
        PAD_T + ((domain.hi - v) / geometry.span) * priceH;

    let hoverBar = null;
    let hoverIdx = -1;

    if (view && cross != null) {
        let best = Infinity;

        view.bars.forEach((b, i) => {
            const dist = Math.abs(xOf(b) - cross);

            if (dist < best) {
                best = dist;
                hoverBar = b;
                hoverIdx = i;
            }
        });
    }

    const shownBar = hoverBar ?? view?.bars[view.bars.length - 1] ?? null;

    const changeOf = (b) => {
        if (!b) return null;

        if (intraday) {
            const ref = baseline ?? points[0]?.c;
            return ref ? (b.c / ref - 1) * 100 : null;
        }

        const prev = b.s > 0 ? points[b.s - 1].c : b.o;

        return prev ? (b.c / prev - 1) * 100 : null;
    };

    const shownChange = changeOf(shownBar);
    const decimals = domain ? decimalsFor(domain.hi - domain.lo) : 2;

    /* toolbar actions */

    const setMode = (mode) => setPrefs((p) => ({ ...p, mode }));

    const toggleInd = (key) =>
        setPrefs((p) => ({
            ...p,
            ind: p.ind.includes(key)
                ? p.ind.filter((k) => k !== key)
                : [...p.ind, key],
        }));

    const canDraw = !loading && total >= 2 && view && domain && geometry;

    /* svg pieces */

    let svgBody = null;

    if (canDraw) {
        const span = geometry.span;
        const priceBottom = PAD_T + priceH;
        const volTop = priceBottom + GAP;
        const rsiTop = priceBottom + (showVol ? GAP + VOL_H : 0) + GAP;
        const lastBottom = showRsi
            ? rsiTop + RSI_H
            : showVol
                ? volTop + VOL_H
                : priceBottom;

        const ticks = niceTicks(domain.lo, domain.hi, narrow ? 3 : 4);
        const bars = view.bars;

        const spanDays =
            bars.length > 1 && bars[0].t != null
                ? (bars[bars.length - 1].t - bars[0].t) / 864e5
                : 0;

        const labelCount = narrow ? 3 : 5;
        const xLabels = [];

        for (let k = 0; k < labelCount; k++) {
            const ratio = k / (labelCount - 1);
            const idx = clamp(
                Math.floor(vp.start + ratio * vp.size),
                0,
                total - 1
            );
            const text = axisLabel(points[idx], intraday, spanDays);

            if (text) {
                xLabels.push({
                    x: ratio * plotW,
                    text,
                    anchor: k === 0 ? "start" : k === labelCount - 1 ? "end" : "middle",
                });
            }
        }

        const overlayLine = (arr) =>
            bars
                .filter((b) => arr[b.e] != null)
                .map((b) => `${xOf(b).toFixed(1)},${yOf(arr[b.e]).toFixed(1)}`)
                .join(" ");

        const maxVol = showVol
            ? Math.max(1, ...bars.map((b) => b.v ?? 0))
            : 1;

        const rsiY = (v) => rsiTop + ((100 - v) / 100) * RSI_H;
        const barW = (b) =>
            Math.max(1, Math.round(((b.e - b.s + 1) / vp.size) * plotW * 0.7));

        const trend = lineModel?.positive ? SEG_RISE : SEG_FALL;

        svgBody = (
            <svg
                width={width}
                height={height}
                className="pc-svg"
                role="img"
                aria-label={`${label} with ${total} points`}
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect x="0" y="0" width={plotW} height={height} />
                    </clipPath>
                </defs>

                {ticks.map((tick) => {
                    const y = yOf(tick);

                    return (
                        <g key={tick}>
                            <line
                                x1="0"
                                x2={plotW}
                                y1={y}
                                y2={y}
                                className="pc-grid"
                            />
                            <text x={plotW + 6} y={y + 3} className="pc-axis">
                                {fmt(tick, decimals)}
                            </text>
                        </g>
                    );
                })}

                <g clipPath={`url(#${clipId})`}>
                    {baseline != null && (
                        <>
                            <line
                                x1="0"
                                x2={plotW}
                                y1={yOf(baseline)}
                                y2={yOf(baseline)}
                                className="term-ref-line"
                            />
                            {plotW >= 280 && (
                                <text
                                    x="4"
                                    y={yOf(baseline) - 4}
                                    className="pc-axis"
                                >
                                    {baselineLabel} {fmt(baseline)}
                                </text>
                            )}
                        </>
                    )}

                    {!candle && lineModel && (
                        <>
                            <polygon
                                points={`${lineModel.coords[0][0]},${priceBottom} ${lineModel.area} ${lineModel.coords[lineModel.coords.length - 1][0]},${priceBottom}`}
                                fill={trend}
                                fillOpacity="0.06"
                                stroke="none"
                            />

                            {lineModel.segments.runs.map((run, i) => (
                                <polyline
                                    key={i}
                                    points={run.points}
                                    fill="none"
                                    stroke={run.color}
                                    strokeWidth="1.6"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                            ))}
                        </>
                    )}

                    {candle &&
                        bars.map((b) => {
                            const up = b.c >= b.o;
                            const color = up ? SEG_RISE : SEG_FALL;
                            const x = Math.round(xOf(b)) + 0.5;
                            const w = barW(b);
                            const yo = yOf(b.o);
                            const yc = yOf(b.c);

                            return (
                                <g key={b.s}>
                                    <line
                                        x1={x}
                                        x2={x}
                                        y1={yOf(b.h)}
                                        y2={yOf(b.l)}
                                        stroke={color}
                                        strokeWidth="1"
                                    />
                                    <rect
                                        x={x - w / 2}
                                        y={Math.min(yo, yc)}
                                        width={w}
                                        height={Math.max(1, Math.abs(yo - yc))}
                                        fill={color}
                                    />
                                </g>
                            );
                        })}

                    {ind.bb && (
                        <>
                            <polyline
                                points={overlayLine(ind.bb.up)}
                                className="pc-ov pc-ov-bb"
                            />
                            <polyline
                                points={overlayLine(ind.bb.low)}
                                className="pc-ov pc-ov-bb"
                            />
                        </>
                    )}

                    {ind.sma20 && (
                        <polyline
                            points={overlayLine(ind.sma20)}
                            className="pc-ov pc-ov-sma20"
                        />
                    )}
                    {ind.sma50 && (
                        <polyline
                            points={overlayLine(ind.sma50)}
                            className="pc-ov pc-ov-sma50"
                        />
                    )}
                    {ind.ema20 && (
                        <polyline
                            points={overlayLine(ind.ema20)}
                            className="pc-ov pc-ov-ema20"
                        />
                    )}

                    {showVol && (
                        <>
                            <line
                                x1="0"
                                x2={plotW}
                                y1={volTop + VOL_H}
                                y2={volTop + VOL_H}
                                className="pc-grid"
                            />
                            {bars.map((b) => {
                                if (b.v == null) return null;

                                const h = Math.max(1, (b.v / maxVol) * (VOL_H - 4));
                                const w = barW(b);

                                return (
                                    <rect
                                        key={b.s}
                                        x={Math.round(xOf(b)) + 0.5 - w / 2}
                                        y={volTop + VOL_H - h}
                                        width={w}
                                        height={h}
                                        fill={b.c >= b.o ? SEG_RISE : SEG_FALL}
                                        fillOpacity="0.5"
                                    />
                                );
                            })}
                        </>
                    )}

                    {showRsi && ind.rsi && (
                        <>
                            <line
                                x1="0"
                                x2={plotW}
                                y1={rsiY(70)}
                                y2={rsiY(70)}
                                className="term-ref-line"
                            />
                            <line
                                x1="0"
                                x2={plotW}
                                y1={rsiY(30)}
                                y2={rsiY(30)}
                                className="term-ref-line"
                            />
                            <polyline
                                points={bars
                                    .filter((b) => ind.rsi[b.e] != null)
                                    .map(
                                        (b) =>
                                            `${xOf(b).toFixed(1)},${rsiY(ind.rsi[b.e]).toFixed(1)}`
                                    )
                                    .join(" ")}
                                className="pc-ov pc-ov-rsi"
                            />
                        </>
                    )}
                </g>

                {showVol && (
                    <>
                        <text x="4" y={volTop + 10} className="pc-axis">
                            VOL
                        </text>
                        <text x={plotW + 6} y={volTop + 10} className="pc-axis">
                            {fmtCompact(maxVol)}
                        </text>
                    </>
                )}

                {showRsi && (
                    <>
                        <text x="4" y={rsiTop + 10} className="pc-axis">
                            RSI 14
                        </text>
                        <text x={plotW + 6} y={rsiY(70) + 3} className="pc-axis">
                            70
                        </text>
                        <text x={plotW + 6} y={rsiY(30) + 3} className="pc-axis">
                            30
                        </text>
                    </>
                )}

                {xLabels.map((l) => (
                    <text
                        key={l.x}
                        x={l.x}
                        y={height - 5}
                        textAnchor={l.anchor}
                        className="pc-axis"
                    >
                        {l.text}
                    </text>
                ))}

                {hoverBar && (
                    <g>
                        <line
                            x1={xOf(hoverBar)}
                            x2={xOf(hoverBar)}
                            y1={PAD_T}
                            y2={lastBottom}
                            className="term-hover-line"
                        />
                        <line
                            x1="0"
                            x2={plotW}
                            y1={yOf(hoverBar.c)}
                            y2={yOf(hoverBar.c)}
                            className="term-hover-line"
                        />

                        {!candle && (
                            <circle
                                cx={xOf(hoverBar)}
                                cy={yOf(hoverBar.c)}
                                r="3.5"
                                className="term-hover-dot"
                                style={{
                                    fill:
                                        lineModel?.segments.colorAt[hoverIdx] ?? SEG_RISE,
                                }}
                            />
                        )}

                        <rect
                            x={plotW}
                            y={yOf(hoverBar.c) - 8}
                            width={axisW}
                            height="16"
                            className="pc-tag"
                        />
                        <text
                            x={plotW + 6}
                            y={yOf(hoverBar.c) + 3}
                            className="pc-tag-text"
                        >
                            {fmt(hoverBar.c, decimals)}
                        </text>
                    </g>
                )}
            </svg>
        );
    }

    const legend = [];

    if (canDraw && shownBar) {
        const at = (arr) => (arr ? arr[shownBar.e] : null);

        if (ind.sma20) legend.push(["sma20", "SMA20", at(ind.sma20)]);
        if (ind.sma50) legend.push(["sma50", "SMA50", at(ind.sma50)]);
        if (ind.ema20) legend.push(["ema20", "EMA20", at(ind.ema20)]);
        if (ind.bb) legend.push(["bb", "BB", at(ind.bb.mid)]);
        if (showRsi && ind.rsi) legend.push(["rsi", "RSI", at(ind.rsi)]);
    }

    const shownPoint = shownBar ? points[shownBar.e] : null;

    return (
        <div className="pc">
            {canDraw && shownBar && (
                <div className="pc-readout">
                    <span className="pc-ro-date">
                        {fullLabel(shownPoint, intraday) || "latest"}
                    </span>

                    {candle ? (
                        <>
                            <RO k="O" v={fmt(shownBar.o)} />
                            <RO k="H" v={fmt(shownBar.h)} />
                            <RO k="L" v={fmt(shownBar.l)} />
                            <RO k="C" v={fmt(shownBar.c)} />
                        </>
                    ) : (
                        <RO k="C" v={fmt(shownBar.c)} />
                    )}

                    {shownChange != null && (
                        <span className={`pc-ro-chg ${dirClass(shownChange)}`}>
                            {fmtSigned(shownChange)}%
                        </span>
                    )}

                    {shownBar.v != null && (
                        <RO k="V" v={fmtCompact(shownBar.v)} />
                    )}

                    {candle && derived && (
                        <span className="pc-note">close based</span>
                    )}
                </div>
            )}

            {legend.length > 0 && (
                <div className="pc-readout pc-legend">
                    {legend.map(([key, name, value]) => (
                        <span key={key} className={`pc-leg pc-leg-${key}`}>
                            {name} {value != null ? fmt(value) : "--"}
                        </span>
                    ))}
                </div>
            )}

            <div
                className="pc-wrap"
                ref={wrapRef}
                style={height ? { height } : undefined}
                tabIndex={canDraw ? 0 : -1}
                role="group"
                aria-label={`${label} drag to pan pinch or scroll to zoom`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onPointerLeave={onPointerLeave}
                onKeyDown={onKeyDown}
            >
                {loading || (total >= 2 && !canDraw) ? (
                    <div className="skel hero-skel" />
                ) : canDraw ? (
                    svgBody
                ) : (
                    <div className="hero-chart-empty">chart data unavailable</div>
                )}
            </div>

            {!loading && (
                <>
                    <div className="pc-toolbar">
                        <div className="pc-group" role="group" aria-label="Chart type">
                            {["line", "candle"].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    className={`pc-opt ${prefs.mode === mode ? "on" : ""}`}
                                    aria-pressed={prefs.mode === mode}
                                    onClick={() => setMode(mode)}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {ranges && onRange && (
                            <div className="pc-group" role="group" aria-label="Range">
                                {ranges.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        className={`pc-opt ${range === r ? "on" : ""}`}
                                        aria-pressed={range === r}
                                        onClick={() => onRange(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="pc-group pc-zoom" role="group" aria-label="Zoom">
                            <button
                                type="button"
                                className="pc-btn"
                                aria-label="Zoom out"
                                onClick={() => zoomAt(1 / 0.6)}
                            >
                                -
                            </button>
                            <button
                                type="button"
                                className="pc-btn"
                                aria-label="Zoom in"
                                onClick={() => zoomAt(0.6)}
                            >
                                +
                            </button>
                            <button
                                type="button"
                                className="pc-btn pc-btn-text"
                                onClick={resetView}
                            >
                                reset
                            </button>
                        </div>
                    </div>

                    <div className="pc-toolbar pc-indicators" role="group" aria-label="Indicators">
                        {OVERLAYS.map(({ key, label: text }) => (
                            <button
                                key={key}
                                type="button"
                                className={`pc-opt ${prefs.ind.includes(key) ? "on" : ""}`}
                                aria-pressed={prefs.ind.includes(key)}
                                onClick={() => toggleInd(key)}
                            >
                                {text}
                            </button>
                        ))}

                        {hasVol && (
                            <button
                                type="button"
                                className={`pc-opt ${prefs.ind.includes("vol") ? "on" : ""}`}
                                aria-pressed={prefs.ind.includes("vol")}
                                onClick={() => toggleInd("vol")}
                            >
                                VOL
                            </button>
                        )}

                        <button
                            type="button"
                            className={`pc-opt ${prefs.ind.includes("rsi") ? "on" : ""}`}
                            aria-pressed={prefs.ind.includes("rsi")}
                            onClick={() => toggleInd("rsi")}
                        >
                            RSI
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}