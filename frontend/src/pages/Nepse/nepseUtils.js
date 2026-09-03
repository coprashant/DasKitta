import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export const fmt = (n, dec = 2) =>
    n == null || n === ""
        ? "--"
        : Number(n).toLocaleString("en-NP", {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec,
        });

export const fmtCompact = (n) => {
    if (n == null || n === "") return "--";

    const num = Number(n);
    if (Number.isNaN(num)) return "--";

    // fix: compare magnitude so negative values pick a unit too
    const abs = Math.abs(num);

    const units = [
        [1e12, "T"],
        [1e9, "B"],
        [1e6, "M"],
        [1e3, "K"],
    ];

    const unit = units.find(([size]) => abs >= size);
    return unit
        ? `${(num / unit[0]).toFixed(2)}${unit[1]}`
        : String(num);
};

export const dirClass = (n) =>
    n > 0 ? "up" : n < 0 ? "down" : "flat";

export const tooltipAlign = (ratio) =>
    ratio < 0.15 ? "start" : ratio > 0.85 ? "end" : "center";

function pickValue(point) {
    if (typeof point !== "object") return point;

    return (
        point.value ??
        point.close ??
        point.index ??
        point.currentValue ??
        point.y ??
        Object.values(point)[1]
    );
}

function getValues(raw) {
    if (!Array.isArray(raw) || raw.length < 2) return null;

    const values = raw
        .map(pickValue)
        .filter((v) => typeof v === "number" && !Number.isNaN(v));

    return values.length >= 2 ? values : null;
}

// fix: loop instead of Math.min/max(...values), a big intraday series
// can blow the call stack when spread as arguments
function minMax(values) {
    let min = Infinity;
    let max = -Infinity;

    for (const v of values) {
        if (v < min) min = v;
        if (v > max) max = v;
    }

    return [min, max];
}

function buildPoints(values, width, height, padding = 0) {
    const [min, max] = minMax(values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const usableHeight = height - padding * 2;

    return values.map((value, i) => [
        i * step,
        height -
        ((value - min) / range) * usableHeight -
        padding,
    ]);
}

function pointsToString(points) {
    return points
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");
}

function buildLine(raw, width, height, padding = 0) {
    const values = getValues(raw);
    if (!values) return null;

    const coords = buildPoints(values, width, height, padding);

    return {
        coords,
        values,
        positive: values.at(-1) >= values[0],
        line: pointsToString(coords),
    };
}

export function buildChart(raw, width, height) {
    const chart = buildLine(raw, width, height, 5);

    if (!chart) return null;

    return {
        ...chart,
        area: `0,${height} ${chart.line} ${width},${height}`,
    };
}

export function buildSparkline(raw, width, height) {
    const chart = buildLine(raw, width, height);

    if (!chart) return null;

    return {
        points: chart.line,
        isPositive: chart.positive,
        coords: chart.coords,
        values: chart.values,
    };
}

export function resolveHeroKey(
    indices,
    preferred = ["NEPSE", "NEPSE Index"]
) {
    if (!indices) return null;

    for (const key of preferred) {
        if (indices[key]) return key;
    }

    return Object.keys(indices)[0] ?? null;
}

export function useChartHover(pointCount) {
    const containerRef = useRef(null);
    const activeIndex = useRef(null);
    const frame = useRef(null);
    const [index, setIndex] = useState(null);

    const locate = useCallback(
        (clientX) => {
            const el = containerRef.current;

            if (!el || !pointCount) return;

            const { left, width } = el.getBoundingClientRect();
            const ratio = Math.min(
                1,
                Math.max(0, (clientX - left) / width)
            );

            const next = Math.round(ratio * (pointCount - 1));

            if (next !== activeIndex.current) {
                activeIndex.current = next;
                setIndex(next);
            }
        },
        [pointCount]
    );

    const queueLocate = useCallback(
        (clientX) => {
            if (frame.current) return;

            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                locate(clientX);
            });
        },
        [locate]
    );

    const clear = useCallback(() => {
        if (activeIndex.current === null) return;

        activeIndex.current = null;
        setIndex(null);
    }, []);

    useEffect(
        () => () => {
            if (frame.current) cancelAnimationFrame(frame.current);
        },
        []
    );

    const handlers = useMemo(
        () => ({
            onPointerDown: (e) => locate(e.clientX),
            onPointerMove: (e) => queueLocate(e.clientX),
            onPointerLeave: (e) => {
                if (e.pointerType === "mouse") clear();
            },
        }),
        [locate, queueLocate, clear]
    );

    return {
        containerRef,
        index,
        handlers,
        clear,
    };
}