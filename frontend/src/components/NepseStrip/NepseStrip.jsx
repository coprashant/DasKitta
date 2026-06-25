import { useEffect, useState, useMemo } from "react";
import {
  getNepseIndex,
  getDailyNepseIndexGraph,
  isNepseOpen,
  getTopGainers,
  getTopLosers,
} from "../../api/nepse.js";
import "./NepseStrip.css";

function buildSparkline(rawPoints, width, height) {
  if (!rawPoints || rawPoints.length < 2) return null;
  const values = rawPoints.map((p) =>
      typeof p === "object" ? (p.value ?? p.close ?? p.index ?? Object.values(p)[1]) : p
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const isPositive = values[values.length - 1] >= values[0];
  return { points: points.join(" "), isPositive };
}

function Sparkline({ data, width = 340, height = 70 }) {
  const result = buildSparkline(data, width, height);
  if (!result) return <div className="skeleton-graph base-pulse" style={{ width: "100%", height }} />;
  const color = result.isPositive ? "var(--success)" : "var(--danger)";
  return (
      <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="sparkline-svg"
          style={{ width: "100%", height }}
      >
        <polyline
            points={result.points}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
        />
      </svg>
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
      } catch {
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
  if (Array.isArray(data)) return data[0];
  return data["NEPSE"] || Object.values(data)[0];
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
            <div className="skeleton-graph base-pulse" />
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
          <Sparkline data={graphData} width={340} height={70} />
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
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadMovers();
    return () => { alive = false; };
  }, []);

  const dummyArray = useMemo(() => Array(5).fill(0), []);

  return (
      <section className="nepse-strip">
        <div className="nepse-strip-inner">
          <div className="movers-grid">
            <div className="movers-col">
              <div className="movers-header up">Top Gainers Today</div>
              <div className="movers-list">
                {loading
                    ? dummyArray.map((_, i) => <TickerSkeletonRow key={i} />)
                    : gainers?.slice(0, 5).map((item, i) => (
                        <TickerRow key={i} item={item} type="gainer" />
                    ))}
              </div>
            </div>
            <div className="movers-col">
              <div className="movers-header down">Top Losers Today</div>
              <div className="movers-list">
                {loading
                    ? dummyArray.map((_, i) => <TickerSkeletonRow key={i} />)
                    : losers?.slice(0, 5).map((item, i) => (
                        <TickerRow key={i} item={item} type="loser" />
                    ))}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}