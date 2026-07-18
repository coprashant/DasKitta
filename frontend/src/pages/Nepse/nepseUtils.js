import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export const fmt = (n, dec = 2) =>
    n == null ? "--" : Number(n).toLocaleString("en-NP", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtCompact = (n) => {
    if (n == null) return "--";
    const num = Number(n);
    if (Number.isNaN(num)) return "--";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return String(num);
};

export const dirClass = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

export function tooltipAlign(ratio) {
    if (ratio < 0.15) return "start";
    if (ratio > 0.85) return "end";
    return "center";
}

// picks a numeric value out of a raw point, object or plain number
function pickValue(p) {
    return typeof p === "object" ? (p.value ?? p.close ?? p.index ?? Object.values(p)[1]) : p;
}

// full chart line plus filled area, used by hero and mini charts
export function buildChart(raw, width, height) {
    if (!raw || raw.length < 2) return null;
    const values = raw.map(pickValue).filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const coords = values.map((v, i) => [i * step, height - ((v - min) / range) * (height - 10) - 5]);
    const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `0,${height} ${line} ${width},${height}`;
    const positive = values[values.length - 1] >= values[0];
    return { line, area, positive, coords, values };
}

// plain polyline, no fill, used by the strip sparkline
export function buildSparkline(raw, width, height) {
    if (!raw || raw.length < 2) return null;
    const values = raw.map(pickValue).filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return [x, y];
    });
    const points = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const isPositive = values[values.length - 1] >= values[0];
    return { points, isPositive, coords, values };
}

export function resolveHeroKey(indices, preferred = ["NEPSE", "NEPSE Index"]) {
    if (!indices) return null;
    for (const key of preferred) {
        if (indices[key]) return key;
    }
    const keys = Object.keys(indices);
    return keys.length ? keys[0] : null;
}

// shared pointer tracking for any chart or sparkline hover
export function useChartHover(pointCount) {
    const containerRef = useRef(null);
    const activeIndex = useRef(null);
    const frame = useRef(null);
    const [index, setIndex] = useState(null);

    const locate = useCallback((clientX) => {
        const el = containerRef.current;
        if (!el || !pointCount) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const idx = Math.round(ratio * (pointCount - 1));
        if (idx !== activeIndex.current) {
            activeIndex.current = idx;
            setIndex(idx);
        }
    }, [pointCount]);

    const queueLocate = useCallback((clientX) => {
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            locate(clientX);
        });
    }, [locate]);

    const clear = useCallback(() => {
        if (activeIndex.current !== null) {
            activeIndex.current = null;
            setIndex(null);
        }
    }, []);

    useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

    const handlers = useMemo(() => ({
        onPointerDown: (e) => locate(e.clientX),
        onPointerMove: (e) => queueLocate(e.clientX),
        onPointerLeave: (e) => { if (e.pointerType === "mouse") clear(); },
    }), [locate, queueLocate, clear]);

    return { containerRef, index, handlers, clear };
}