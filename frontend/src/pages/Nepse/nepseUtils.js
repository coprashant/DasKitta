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

    // fix compare magnitude so negative values pick a unit too
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

// read a timestamp in ms when the point carries one
function pickTime(point) {
    if (point == null || typeof point !== "object") return null;

    const raw = Array.isArray(point)
        ? point[0]
        : point.time ??
        point.timestamp ??
        point.datetime ??
        point.date ??
        point.businessDate;

    let ms = null;

    if (typeof raw === "number" && Number.isFinite(raw)) {
        ms = raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : null;
    } else if (typeof raw === "string") {
        const parsed = Date.parse(raw);
        ms = Number.isNaN(parsed) ? null : parsed;
    }

    if (ms == null) return null;

    const year = new Date(ms).getUTCFullYear();
    return year >= 2000 && year <= 2100 ? ms : null;
}

function getSeries(raw) {
    if (!Array.isArray(raw) || raw.length < 2) return null;

    const values = [];
    const times = [];

    for (const point of raw) {
        const v = pickValue(point);

        if (typeof v === "number" && !Number.isNaN(v)) {
            values.push(v);
            times.push(pickTime(point));
        }
    }

    return values.length >= 2 ? { values, times } : null;
}

// fix loop instead of Math min max values a big intraday series
// can blow the call stack when spread as arguments
export function minMax(values) {
    let min = Infinity;
    let max = -Infinity;

    for (const v of values) {
        if (v < min) min = v;
        if (v > max) max = v;
    }

    return [min, max];
}

function buildPoints(values, width, height, padding = 0, ref = null) {
    const [dataMin, dataMax] = minMax(values);
    const hasRef = typeof ref === "number" && Number.isFinite(ref);
    const min = hasRef ? Math.min(dataMin, ref) : dataMin;
    const max = hasRef ? Math.max(dataMax, ref) : dataMax;
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const usableHeight = height - padding * 2;
    const toY = (value) =>
        height - ((value - min) / range) * usableHeight - padding;

    return {
        coords: values.map((value, i) => [i * step, toY(value)]),
        refY: hasRef ? toY(ref) : null,
    };
}

function pointsToString(points) {
    return points
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" ");
}

function buildLine(raw, width, height, padding = 0, ref = null) {
    const series = getSeries(raw);
    if (!series) return null;

    const { values, times } = series;
    const { coords, refY } = buildPoints(values, width, height, padding, ref);

    return {
        coords,
        values,
        times,
        refY,
        positive: values.at(-1) >= values[0],
        line: pointsToString(coords),
    };
}

// segment colors live in css variables
export const SEG_RISE = "var(--seg-up, var(--success))";
export const SEG_FALL = "var(--seg-down, var(--danger))";
export const SEG_FLAT = "var(--seg-flat, var(--text-3))";

// color each step by comparing a point with the one before it
// rise is green and fall is red and flat keeps the previous color
export function buildSegments(coords, values) {
    const runs = [];
    const colorAt = new Array(values.length).fill(SEG_FLAT);

    if (!coords || !values || values.length < 2) {
        return { runs, colorAt };
    }

    let lastColor = SEG_FLAT;

    for (let i = 1; i < values.length; i++) {
        const prev = Number(values[i - 1]);
        const curr = Number(values[i]);

        const color =
            curr > prev ? SEG_RISE : curr < prev ? SEG_FALL : lastColor;

        const lastRun = runs[runs.length - 1];

        if (lastRun && lastRun.color === color) {
            lastRun.coords.push(coords[i]);
        } else {
            runs.push({ color, coords: [coords[i - 1], coords[i]] });
        }

        colorAt[i] = color;
        lastColor = color;
    }

    colorAt[0] = colorAt[1];

    return {
        runs: runs.map((run) => ({
            color: run.color,
            points: pointsToString(run.coords),
        })),
        colorAt,
    };
}

const TIME_FORMAT = (() => {
    try {
        return new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Asia/Kathmandu",
        });
    } catch {
        return null;
    }
})();

export function fmtClock(ms) {
    if (ms == null || !TIME_FORMAT) return null;

    try {
        return TIME_FORMAT.format(new Date(ms));
    } catch {
        return null;
    }
}

export const fmtSigned = (n, dec = 2) =>
    n == null || Number.isNaN(Number(n))
        ? "--"
        : `${Number(n) >= 0 ? "+" : ""}${fmt(n, dec)}`;

export function buildChart(raw, width, height, ref = null) {
    const chart = buildLine(raw, width, height, 5, ref);

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