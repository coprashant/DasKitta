import { useState, useEffect, useCallback } from "react";
import {
  getNepseIndex,
  isNepseOpen,
  getSummary,
  getTopGainers,
  getTopLosers,
  getTopTurnover,
  getFloorsheet,
  getPriceVolume,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import "./Nepse.css";

const REFRESH_INTERVAL = 30000;

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const IconDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const Skeleton = ({ h = 16, w = "100%" }) => (
  <div className="skeleton" style={{ height: h, width: w }} />
);

const fmt = (n, dec = 2) =>
  n == null ? "—" : Number(n).toLocaleString("en-NP", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtCompact = (n) => {
  if (n == null) return "—";
  const num = Number(n);
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9)  return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6)  return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3)  return (num / 1e3).toFixed(2) + "K";
  return String(num);
};

const getValClass = (n) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "");

function MarketBadge({ isOpen }) {
  if (isOpen === null) return <div className="badge badge-muted"><span className="badge-dot" />···</div>;
  const open = typeof isOpen === "object"
    ? isOpen?.isOpen === "OPEN"
    : isOpen === true || isOpen === "OPEN";
  return (
    <div className={`badge ${open ? "badge-success" : "badge-muted"}`}>
      <span className={`badge-dot ${open ? "badge-dot-success" : ""}`} />
      {open ? "Market Open" : "Market Closed"}
    </div>
  );
}

function IndexCard({ name, data }) {
  if (!data) return null;
  const val = data.currentValue ?? data.value;
  const change = data.percentageChange ?? data.perChange ?? data.change ?? 0;
  return (
    <div className="stat-card anim-fade-up">
      <p className="stat-label">
        {change >= 0 ? <IconUp /> : <IconDown />} {name}
      </p>
      <p className="stat-value">{fmt(val)}</p>
      <p className={`stat-meta ${getValClass(change)}`}>
        {change >= 0 ? "+" : ""}{fmt(change)}%
      </p>
    </div>
  );
}

function StockSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [allStocks, setAllStocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getPriceVolume().then(r => setAllStocks(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const q = query.toUpperCase();
    const filtered = allStocks
      .filter(s => s.symbol?.toUpperCase().includes(q) || s.securityName?.toUpperCase().includes(q))
      .slice(0, 8);
    setResults(filtered);
    setOpen(filtered.length > 0);
  }, [query, allStocks]);

  const select = (stock) => {
    setSelected(stock);
    setQuery(stock.symbol);
    setOpen(false);
  };

  return (
    <div className="stock-search-wrap">
      <div className="stock-search-box">
        <IconSearch />
        <input
          className="stock-search-input"
          placeholder="Search symbol or company…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          onFocus={() => results.length && setOpen(true)}
        />
        {query && (
          <button className="stock-search-clear" onClick={() => { setQuery(""); setSelected(null); setOpen(false); }}>×</button>
        )}
      </div>

      {open && (
        <div className="stock-search-dropdown">
          {results.map(s => (
            <div key={s.symbol} className="stock-search-item" onClick={() => select(s)}>
              <span className="cell-primary">{s.symbol}</span>
              <span className="cell-dim stock-search-name">{s.securityName}</span>
              <span className={`stock-search-ltp ${getValClass(s.percentageChange)}`}>
                {fmt(s.lastTradedPrice ?? s.closePrice)}
              </span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="stock-detail-pill">
          <div className="stock-detail-row">
            <div>
              <span className="cell-primary">{selected.symbol}</span>
              <span className="cell-dim" style={{ marginLeft: 8, fontSize: 12 }}>{selected.securityName}</span>
            </div>
            <span className={getValClass(selected.percentageChange)}>
              {selected.percentageChange >= 0 ? "+" : ""}{fmt(selected.percentageChange)}%
            </span>
          </div>
          <div className="stock-detail-stats">
            <div className="stock-stat"><span className="summary-key">LTP</span><span className="summary-val">{fmt(selected.lastTradedPrice ?? selected.closePrice)}</span></div>
            <div className="stock-stat"><span className="summary-key">Prev Close</span><span className="summary-val">{fmt(selected.previousClose)}</span></div>
            <div className="stock-stat"><span className="summary-key">Volume</span><span className="summary-val">{fmt(selected.totalTradeQuantity, 0)}</span></div>
            <div className="stock-stat"><span className="summary-key">% Change</span><span className={`summary-val ${getValClass(selected.percentageChange)}`}>{fmt(selected.percentageChange)}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Nepse() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [marketOpen, setMarketOpen] = useState(null);
  const [indices, setIndices] = useState(null);
  const [summary, setSummary] = useState(null);
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [turnover, setTurnover] = useState([]);
  const [floorsheet, setFloorsheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCore = useCallback(async () => {
    try {
      const [openRes, indexRes, summaryRes] = await Promise.all([
        isNepseOpen(),
        getNepseIndex(),
        getSummary(),
      ]);
      setMarketOpen(openRes.data);
      setIndices(indexRes.data);
      setSummary(summaryRes.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError("Data service unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCore();
    const itv = setInterval(fetchCore, REFRESH_INTERVAL);
    return () => clearInterval(itv);
  }, [fetchCore]);

  useEffect(() => {
    if (activeTab === "Gainers & Losers" && !gainers.length) {
      getTopGainers().then(r => setGainers(r.data ?? []));
      getTopLosers().then(r => setLosers(r.data ?? []));
    }
    if (activeTab === "Turnover" && !turnover.length) {
      getTopTurnover().then(r => setTurnover(r.data ?? []));
    }
    if (activeTab === "Floorsheet" && !floorsheet) {
      getFloorsheet().then(r => setFloorsheet(r.data));
    }
  }, [activeTab, gainers.length, turnover.length, floorsheet]);

  const KEY_INDICES = ["NEPSE", "Sensitive", "Float", "Sensitive Float"];

  return (
    <Layout>
      <div className="page">
        {/* Header */}
        <div className="dash-header nepse-header-row">
          <div>
            <h1 className="page-title">Market Overview</h1>
            {lastUpdated && (
              <p className="page-subtitle nepse-update-text">
                <IconClock /> Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="nepse-header-right">
            <StockSearch />
            <MarketBadge isOpen={marketOpen} />
          </div>
        </div>

        {error && <div className="badge badge-danger nepse-err-banner">{error}</div>}

        {/* Index stat cards */}
        <div className="dash-stats">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="stat-card">
                <Skeleton h={10} w="40%" />
                <Skeleton h={24} w="70%" />
              </div>
            ))
          ) : (
            KEY_INDICES.map(name =>
              indices?.[name] ? <IndexCard key={name} name={name} data={indices[name]} /> : null
            )
          )}
        </div>

        {/* Summary bar */}
        {summary && !loading && (
          <div className="dash-account-pill nepse-summary-bar">
            {Object.entries(summary).map(([k, v]) => (
              <div key={k} className="summary-col">
                <span className="summary-key">{k}</span>
                <span className="summary-val">
                  {fmtCompact(typeof v === "object" ? JSON.stringify(v) : v)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="nepse-tabs">
          {["Overview", "Gainers & Losers", "Turnover", "Floorsheet"].map(tab => (
            <button
              key={tab}
              className={`tab-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="card anim-fade-up">
          <div className="table-scroll">
            {activeTab === "Overview" && indices && (
              <table className="dash-table">
                <thead>
                  <tr><th>Index</th><th>Value</th><th>Change</th><th>% Change</th></tr>
                </thead>
                <tbody>
                  {Object.entries(indices).map(([name, d]) => (
                    <tr key={name}>
                      <td><span className="cell-primary">{name}</span></td>
                      <td>{fmt(d.currentValue ?? d.value)}</td>
                      <td className={getValClass(d.change)}>{fmt(d.change)}</td>
                      <td className={getValClass(d.percentageChange ?? d.perChange)}>
                        {fmt(d.percentageChange ?? d.perChange)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "Gainers & Losers" && (
              <div className="nepse-grid-2">
                <div className="table-wrapper">
                  <p className="table-heading-sm text-success">Top Gainers</p>
                  <table className="dash-table">
                    <thead><tr><th>Symbol</th><th>LTP</th><th>%</th></tr></thead>
                    <tbody>
                      {gainers.map(r => (
                        <tr key={r.symbol}>
                          <td><span className="cell-primary">{r.symbol}</span></td>
                          <td>{fmt(r.ltp)}</td>
                          <td className="text-success">+{fmt(r.percentageChange)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-wrapper">
                  <p className="table-heading-sm text-danger">Top Losers</p>
                  <table className="dash-table">
                    <thead><tr><th>Symbol</th><th>LTP</th><th>%</th></tr></thead>
                    <tbody>
                      {losers.map(r => (
                        <tr key={r.symbol}>
                          <td><span className="cell-primary">{r.symbol}</span></td>
                          <td>{fmt(r.ltp)}</td>
                          <td className="text-danger">{fmt(r.percentageChange)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "Turnover" && (
              <table className="dash-table">
                <thead>
                  <tr><th>Symbol</th><th>Turnover (Rs)</th><th>Shares</th><th>LTP</th></tr>
                </thead>
                <tbody>
                  {turnover.map(r => (
                    <tr key={r.symbol}>
                      <td><span className="cell-primary">{r.symbol}</span></td>
                      <td>{fmt(r.turnover, 0)}</td>
                      <td>{fmt(r.shareTraded, 0)}</td>
                      <td>{fmt(r.ltp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "Floorsheet" && (
              <table className="dash-table">
                <thead>
                  <tr><th>Symbol</th><th>Qty</th><th>Rate</th><th>Buyer</th><th>Seller</th></tr>
                </thead>
                <tbody>
                  {(Array.isArray(floorsheet)
                    ? floorsheet
                    : floorsheet?.floorsheets?.content ?? []
                  ).slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td><span className="cell-primary">{r.stockSymbol}</span></td>
                      <td>{fmt(r.contractQuantity, 0)}</td>
                      <td>{fmt(r.contractRate)}</td>
                      <td><span className="cell-dim">{r.buyerMemberId}</span></td>
                      <td><span className="cell-dim">{r.sellerMemberId}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}