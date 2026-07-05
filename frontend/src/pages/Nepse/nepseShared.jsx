import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getPriceVolume } from "../../api/nepse";
import { IconSearch } from "../../components/Icons.jsx";

// number formatting helpers shared by every nepse view
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

// tiny directional arrow used across the terminal
export function Arrow({ up, flat }) {
    if (flat) return <span className="arrow-flat">•</span>;
    return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"
             strokeLinecap="round" strokeLinejoin="round" className="arrow-icon">
            {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
        </svg>
    );
}

// live seconds clock for headers
export function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

// finds the primary entry across possible api shapes
export function resolveHeroKey(indices, preferred = ["NEPSE", "NEPSE Index"]) {
    if (!indices) return null;
    for (const key of preferred) {
        if (indices[key]) return key;
    }
    const keys = Object.keys(indices);
    return keys.length ? keys[0] : null;
}

// builds line and fill polygons from raw graph points
export function buildChart(raw, width, height) {
    if (!raw || raw.length < 2) return null;
    const values = raw.map((p) =>
        typeof p === "object" ? (p.value ?? p.close ?? p.index ?? Object.values(p)[1]) : p
    ).filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const coords = values.map((v, i) => [i * step, height - ((v - min) / range) * (height - 10) - 5]);
    const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `0,${height} ${line} ${width},${height}`;
    const positive = values[values.length - 1] >= values[0];
    return { line, area, positive };
}

// hero canvas with metrics floating over a line chart, used for the
// nepse index and for a single scrip on the company page
export function HeroChart({ loading, data, value, changeVal, changePct, eyebrow = "NEPSE INDEX" }) {
    const width = 1000;
    const height = 380;
    const chart = buildChart(data, width, height);
    const positive = changeVal >= 0;

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
                            {positive ? "+" : ""}{fmt(changeVal)}
                            <span className="hero-delta-pct">
                ({positive ? "+" : ""}{fmt(changePct)}%)
              </span>
                        </div>
                    </>
                )}
            </div>

            <div className="hero-chart-wrap">
                {loading ? (
                    <div className="skel hero-skel" />
                ) : chart ? (
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="hero-svg">
                        <defs>
                            <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chart.positive ? "var(--term-emerald)" : "var(--term-crimson)"} stopOpacity="0.20" />
                                <stop offset="100%" stopColor={chart.positive ? "var(--term-emerald)" : "var(--term-crimson)"} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polygon points={chart.area} fill="url(#heroFade)" stroke="none" />
                        <polyline
                            points={chart.line}
                            fill="none"
                            stroke={chart.positive ? "var(--term-emerald)" : "var(--term-crimson)"}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    </svg>
                ) : (
                    <div className="hero-chart-empty">no chart data</div>
                )}
                <div className="hero-baseline" />
            </div>
        </div>
    );
}

// compact inline sparkline for expandable rows
export function MiniSpark({ data, width = 280, height = 46 }) {
    const chart = buildChart(data, width, height);
    if (!chart) return <div className="mini-spark-empty">no trend data</div>;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mini-spark-svg">
            <polyline
                points={chart.line}
                fill="none"
                stroke={chart.positive ? "var(--term-emerald)" : "var(--term-crimson)"}
                strokeWidth="1.4"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

// borderless search that opens the full company page on pick
export function TermSearch({ placeholder = "search symbol or company" }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [allStocks, setAllStocks] = useState([]);
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        getPriceVolume().then((r) => setAllStocks(r.data ?? [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setOpen(false);
            return;
        }
        const q = query.toUpperCase();
        const filtered = allStocks
            .filter((s) => s.symbol?.toUpperCase().includes(q) || s.securityName?.toUpperCase().includes(q))
            .slice(0, 7);
        setResults(filtered);
        setOpen(filtered.length > 0);
    }, [query, allStocks]);

    useEffect(() => {
        const onClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
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
                    onFocus={() => results.length && setOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Enter" && results[0]) goToCompany(results[0]); }}
                />
                {query && (
                    <button className="term-search-clear" onClick={() => { setQuery(""); setOpen(false); }} aria-label="clear search">
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
                            onKeyDown={(e) => { if (e.key === "Enter") goToCompany(s); }}
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