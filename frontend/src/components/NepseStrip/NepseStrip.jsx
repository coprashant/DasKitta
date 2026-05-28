import { useEffect, useState } from "react";
import {
  getNepseIndex,
  getDailyNepseIndexGraph,
  isNepseOpen,
  getTopGainers,
  getTopLosers,
} from "../../api/nepse.js";
import "./NepseStrip.css";

function buildSparkline(rawPoints, width, height, padding = 6) {
  if (!rawPoints || rawPoints.length < 2) return null;

  const values = rawPoints.map((p) =>
    typeof p === "object" ? (p.value ?? p.close ?? p.index ?? Object.values(p)[1]) : p
  );

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const isPositive = values[values.length - 1] >= values[0];
  return { points: points.join(" "), isPositive };
}

function Sparkline({ data, width = 120, height = 48, fluid = false }) {
  const VW = 600;
  const VH = height;
  const result = buildSparkline(data, fluid ? VW : width, VH);
  if (!result) return <div className="spark-placeholder skeleton" style={{ width: fluid ? "100%" : width, height }} />;
  const color = result.isPositive ? "var(--success)" : "var(--danger)";
  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${fluid ? VW : width} ${VH}`}
      preserveAspectRatio="none"
      className="sparkline-svg"
      aria-hidden="true"
    >
      <polyline
        points={result.points}
        fill="none"
        stroke={color}
        strokeWidth={fluid ? 4 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChangeChip({ value }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`change-chip ${positive ? "change-chip--up" : "change-chip--down"}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {positive ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

/* resolve NEPSE entry from any API shape */
function resolveNepseEntry(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return (
      data.find((d) => {
        const label = (d?.index ?? d?.name ?? d?.symbol ?? "").toString().toUpperCase();
        return label === "NEPSE" || label === "NEPSE INDEX";
      }) ?? data[0] ?? null
    );
  }
  const key = Object.keys(data).find((k) => {
    const u = k.toUpperCase();
    return u === "NEPSE INDEX" || u === "NEPSE";
  });
  return key ? data[key] : (Object.values(data)[0] ?? null);
}

/* shared data hook */
function useNepseIndex() {
  const [indexData, setIndexData] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadIndex = async () => {
      try {
        const idxRes = await getNepseIndex();
        if (!alive) return;
        setIndexData(idxRes.data);
      } catch {}
    };

    const loadOpen = async () => {
      try {
        const openRes = await isNepseOpen();
        if (!alive) return;
        const raw = openRes.data;
        const open = typeof raw === "object" ? raw?.isOpen === "OPEN" : !!raw;
        setIsOpen(open);
      } catch {}
    };

    const loadGraph = async () => {
      try {
        const res = await getDailyNepseIndexGraph();
        if (!alive) return;
        const raw = res.data;
        const arr = Array.isArray(raw) ? raw : (raw?.data ?? raw?.values ?? Object.values(raw));
        setGraphData(arr);
      } catch {}
    };

    loadIndex();
    loadOpen();
    loadGraph();
    return () => { alive = false; };
  }, []);

  return { indexData, graphData, isOpen };
}

/* hero card shown in Home */
export function NepseHeroCard() {
  const { indexData, graphData, isOpen } = useNepseIndex();

  const entry = resolveNepseEntry(indexData);
  const val = entry?.currentValue ?? entry?.value ?? entry?.index ?? 0;
  const pts = entry?.change ?? entry?.pointChange ?? entry?.percentageChange ?? 0;
  const pct = entry?.percentageChange ?? entry?.perChange ?? 0;

  return (
    <div className="nepse-hero-card">
      <div className="nepse-hero-header">
        <div className="nepse-hero-title-group">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="nepse-hero-label">NEPSE Index</span>
        </div>
        <span className={`market-badge ${isOpen ? "market-badge--open" : "market-badge--closed"}`}>
          <span className="market-dot" />
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>

      <div className="nepse-hero-body">
        {entry ? (
          <>
            <div className="nepse-hero-value">
              {Number(val).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="nepse-hero-sub">
              <span className={pts >= 0 ? "txt-up" : "txt-down"}>
                {pts >= 0 ? "+" : ""}{Number(pts).toFixed(2)} pts
              </span>
              <ChangeChip value={pct} />
            </div>
          </>
        ) : (
          <>
            <div className="skeleton" style={{ width: 140, height: 28, borderRadius: "var(--r)", marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 90, height: 14, borderRadius: "var(--r-sm)" }} />
          </>
        )}
      </div>

      <div className="nepse-hero-graph">
        <Sparkline data={graphData} height={110} fluid />
      </div>
    </div>
  );
}

function IndexPanel({ indexData, graphData, isOpen }) {
  if (!indexData) {
    return (
      <div className="index-panel">
        <div className="skeleton index-skeleton-val" />
        <div className="skeleton index-skeleton-sub" />
      </div>
    );
  }

  const entry = indexData["NEPSE"] ?? Object.values(indexData)[0];
  const val = entry?.currentValue ?? entry?.index ?? 0;
  const pts = entry?.percentageChange ?? entry?.change ?? 0;
  const pct = entry?.percentageChange ?? 0;

  return (
    <div className="index-panel">
      <div className="index-left">
        <div className="index-meta">
          <span className="index-label">NEPSE</span>
          <span className={`market-badge ${isOpen ? "market-badge--open" : "market-badge--closed"}`}>
            <span className="market-dot" />
            {isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <div className="index-value">
          {Number(val).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="index-sub">
          <span className={pts >= 0 ? "txt-up" : "txt-down"}>
            {pts >= 0 ? "+" : ""}{Number(pts).toFixed(2)} pts
          </span>
          <ChangeChip value={pct} />
        </div>
      </div>
      <div className="index-right">
        <Sparkline data={graphData} width={120} height={52} />
      </div>
    </div>
  );
}

function TickerRow({ item, type }) {
  const pct = item?.percentageChange ?? 0;
  const ltp = item?.ltp ?? item?.lastTradedPrice ?? 0;
  const sym = item?.symbol ?? item?.scrip ?? "";
  const name = item?.securityName ?? item?.companyName ?? sym;

  return (
    <div className="ticker-row">
      <div className="ticker-sym-group">
        <span className="ticker-sym">{sym}</span>
        <span className="ticker-name">{name}</span>
      </div>
      <div className="ticker-right">
        <span className="ticker-ltp">Rs {Number(ltp).toLocaleString("en-NP")}</span>
        <span className={`ticker-pct ${type === "gainer" ? "txt-up" : "txt-down"}`}>
          {pct >= 0 ? "+" : ""}{Number(pct).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* gainers and losers side by side */
function MoversPanel({ gainers, losers }) {
  const skeleton = [1, 2, 3, 4, 5].map((i) => (
    <div key={i} className="ticker-row">
      <div className="skeleton" style={{ width: "55%", height: 13, borderRadius: "var(--r-sm)" }} />
      <div className="skeleton" style={{ width: "25%", height: 13, borderRadius: "var(--r-sm)" }} />
    </div>
  ));

  return (
    <div className="movers-panel">
      <div className="movers-columns">
        <div className="movers-col">
          <div className="movers-col-header movers-col-header--up">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            Gainers
          </div>
          <div className="movers-list">
            {!gainers ? skeleton : gainers.slice(0, 5).map((item, i) => (
              <TickerRow key={i} item={item} type="gainer" />
            ))}
          </div>
        </div>

        <div className="movers-divider" aria-hidden="true" />

        <div className="movers-col">
          <div className="movers-col-header movers-col-header--down">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Losers
          </div>
          <div className="movers-list">
            {!losers ? skeleton : losers.slice(0, 5).map((item, i) => (
              <TickerRow key={i} item={item} type="loser" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NepseStrip() {
  const [gainers, setGainers] = useState(null);
  const [losers, setLosers] = useState(null);

  useEffect(() => {
    let alive = true;
    const loadMovers = async () => {
      try {
        const [gRes, lRes] = await Promise.all([getTopGainers(), getTopLosers()]);
        if (!alive) return;
        setGainers(Array.isArray(gRes.data) ? gRes.data : gRes.data?.data ?? []);
        setLosers(Array.isArray(lRes.data) ? lRes.data : lRes.data?.data ?? []);
      } catch {}
    };
    loadMovers();
    return () => { alive = false; };
  }, []);

  return (
    <section className="nepse-strip" aria-label="Live NEPSE market data">
      <div className="nepse-strip-inner">
        <MoversPanel gainers={gainers} losers={losers} />
      </div>
    </section>
  );
}