import { useState, useEffect, useCallback } from "react";
import {
  getNepseIndex,
  isNepseOpen,
  getSummary,
  getTopGainers,
  getTopLosers,
  getTopTurnover,
  getTopTrade,
  getTopTransaction,
  getSupplyDemand,
  getNepseSubIndices,
  getTradeTurnoverSubindices,
  getFloorsheet,
  getDailyNepseIndexGraph,
  getDailyBankSubindexGraph,
  getDailyDevBankSubindexGraph,
  getDailyFinanceSubindexGraph,
  getDailyHotelTourismSubindexGraph,
  getDailyHydroPowerSubindexGraph,
  getDailyInvestmentSubindexGraph,
  getDailyLifeInsuranceSubindexGraph,
  getDailyManufacturingSubindexGraph,
  getDailyMicrofinanceSubindexGraph,
  getDailyMutualFundSubindexGraph,
  getDailyNonLifeInsuranceSubindexGraph,
  getDailyOthersSubindexGraph,
  getDailyTradingSubindexGraph,
} from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import { fmt, fmtCompact, dirClass, Arrow, useClock, resolveHeroKey, HeroChart, MiniSpark, TermSearch } from "./nepseShared.jsx";
import "./Nepse.css";

const REFRESH_INTERVAL = 30000;

// matches a sector label to its daily graph endpoint
const SECTOR_GRAPH_RULES = [
  { test: /development|dev bank/i, fetch: getDailyDevBankSubindexGraph },
  { test: /\bbank/i, fetch: getDailyBankSubindexGraph },
  { test: /finance/i, fetch: getDailyFinanceSubindexGraph },
  { test: /hotel|tourism/i, fetch: getDailyHotelTourismSubindexGraph },
  { test: /hydro/i, fetch: getDailyHydroPowerSubindexGraph },
  { test: /investment/i, fetch: getDailyInvestmentSubindexGraph },
  { test: /non.?life/i, fetch: getDailyNonLifeInsuranceSubindexGraph },
  { test: /life insurance/i, fetch: getDailyLifeInsuranceSubindexGraph },
  { test: /manufactur/i, fetch: getDailyManufacturingSubindexGraph },
  { test: /microfinance/i, fetch: getDailyMicrofinanceSubindexGraph },
  { test: /mutual fund/i, fetch: getDailyMutualFundSubindexGraph },
  { test: /trading/i, fetch: getDailyTradingSubindexGraph },
];

function matchSectorGraph(name = "") {
  const rule = SECTOR_GRAPH_RULES.find((r) => r.test.test(name));
  return rule ? rule.fetch : getDailyOthersSubindexGraph;
}

// dense mover row for the movers tab
function MoverRow({ item, tone }) {
  const pct = item.percentageChange ?? 0;
  return (
      <div className="ledger-row">
        <span className="ledger-sym">{item.symbol}</span>
        <span className="ledger-row-right">
        <span className="ledger-ltp">{fmt(item.ltp)}</span>
        <span className={`ledger-pct ${tone}`}>
          <Arrow up={tone === "up"} /> {pct >= 0 ? "+" : ""}{fmt(pct)}%
        </span>
      </span>
      </div>
  );
}

function EmptyRow({ label }) {
  return <p className="ledger-empty">{label}</p>;
}

export default function Nepse() {
  const clock = useClock();

  const [marketOpen, setMarketOpen] = useState(null);
  const [indices, setIndices] = useState(null);
  const [summary, setSummary] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [feed, setFeed] = useState("Movers");
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [turnover, setTurnover] = useState([]);
  const [topTrade, setTopTrade] = useState([]);
  const [topTransaction, setTopTransaction] = useState([]);
  const [supplyDemand, setSupplyDemand] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [sectorTurnover, setSectorTurnover] = useState([]);
  const [floorsheet, setFloorsheet] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);

  const [expandedSector, setExpandedSector] = useState(null);
  const [sectorGraphs, setSectorGraphs] = useState({});

  const fetchCore = useCallback(async () => {
    try {
      const [openRes, indexRes, summaryRes, graphRes] = await Promise.all([
        isNepseOpen(),
        getNepseIndex(),
        getSummary(),
        getDailyNepseIndexGraph(),
      ]);
      setMarketOpen(openRes.data);
      setIndices(indexRes.data);
      setSummary(summaryRes.data);
      const rawGraph = graphRes.data;
      setGraphData(Array.isArray(rawGraph) ? rawGraph : (rawGraph?.data ?? Object.values(rawGraph ?? {})));
      setError(null);
    } catch (e) {
      setError("data feed unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCore();
    const id = setInterval(fetchCore, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCore]);

  useEffect(() => {
    let alive = true;
    setFeedLoading(true);
    const load = async () => {
      try {
        if (feed === "Movers" && !gainers.length) {
          const [g, l] = await Promise.all([getTopGainers(), getTopLosers()]);
          if (!alive) return;
          setGainers(g.data ?? []);
          setLosers(l.data ?? []);
        }
        if (feed === "Turnover" && !turnover.length) {
          const t = await getTopTurnover();
          if (!alive) return;
          setTurnover(t.data ?? []);
        }
        if (feed === "Activity" && !topTrade.length) {
          const [t, tr] = await Promise.all([getTopTrade(), getTopTransaction()]);
          if (!alive) return;
          setTopTrade(t.data ?? []);
          setTopTransaction(tr.data ?? []);
          try {
            const sd = await getSupplyDemand();
            if (!alive) return;
            setSupplyDemand(Array.isArray(sd.data) ? sd.data : (sd.data?.data ?? []));
          } catch {
            // imbalance list is a bonus section, missing it should not break trade and transaction data
          }
        }
        if (feed === "Sectors" && !sectors.length) {
          const s = await getNepseSubIndices();
          if (!alive) return;
          const list = Array.isArray(s.data) ? s.data : Object.entries(s.data ?? {}).map(([name, v]) => ({ name, ...v }));
          setSectors(list);
          try {
            const st = await getTradeTurnoverSubindices();
            if (!alive) return;
            setSectorTurnover(Array.isArray(st.data) ? st.data : Object.entries(st.data ?? {}).map(([name, v]) => ({ name, ...v })));
          } catch {
            // turnover per sector is a bonus column, missing it should not break the sector list
          }
        }
        if (feed === "Floorsheet" && !floorsheet) {
          const f = await getFloorsheet();
          if (!alive) return;
          setFloorsheet(f.data);
        }
      } finally {
        if (alive) setFeedLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [feed]);

  const heroKey = resolveHeroKey(indices);
  const heroEntry = heroKey ? indices?.[heroKey] : null;
  const heroValue = heroEntry?.currentValue ?? heroEntry?.value ?? 0;
  const heroChange = heroEntry?.change ?? 0;
  const heroPct = heroEntry?.percentageChange ?? heroEntry?.perChange ?? 0;

  const secondaryIndices = indices
      ? Object.entries(indices).filter(([name]) => name !== heroKey)
      : [];

  const openBool = typeof marketOpen === "object"
      ? marketOpen?.isOpen === "OPEN"
      : marketOpen === true || marketOpen === "OPEN";

  const floorRows = Array.isArray(floorsheet) ? floorsheet : (floorsheet?.floorsheets?.content ?? []);

  // the subindex endpoint returns every index including the main ones already
  // shown up top, so drop anything whose name is already in the index strip
  const sectorRows = sectors.filter((s) => !indices || !Object.prototype.hasOwnProperty.call(indices, s.name ?? s.index ?? ""));

  const sectorTurnoverFor = (name) => {
    const hit = sectorTurnover.find((t) => (t.name ?? "").toLowerCase().includes(name.toLowerCase().split(" ")[0]));
    return hit?.turnover ?? hit?.totalTurnover ?? null;
  };

  const toggleSector = async (name) => {
    if (expandedSector === name) {
      setExpandedSector(null);
      return;
    }
    setExpandedSector(name);
    if (!sectorGraphs[name]) {
      try {
        const fetcher = matchSectorGraph(name);
        const res = await fetcher();
        const raw = res.data;
        const points = Array.isArray(raw) ? raw : (raw?.data ?? Object.values(raw ?? {}));
        setSectorGraphs((prev) => ({ ...prev, [name]: points }));
      } catch {
        setSectorGraphs((prev) => ({ ...prev, [name]: [] }));
      }
    }
  };

  return (
      <Layout>
        <div className="term-shell">
          {/* header */}
          <header className="term-header">
            <div className="term-brand">
              <span className="term-brand-name">NEPSE</span>
              <span className="term-brand-tag">live market feed</span>
            </div>

            <TermSearch />

            <div className="term-header-right">
            <span className={`term-status ${openBool ? "open" : "closed"}`}>
              <span className="term-status-dot" />
              {marketOpen === null ? "connecting" : openBool ? "market open" : "market closed"}
            </span>
              <span className="term-clock">
              {clock.toLocaleTimeString("en-NP", { hour12: false })}
            </span>
            </div>
          </header>

          {error && <div className="term-alert">{error}</div>}

          {/* asymmetrical canvas */}
          <div className="term-grid">
            <div className="term-primary">
              <HeroChart
                  loading={loading}
                  data={graphData}
                  value={heroValue}
                  changeVal={heroChange}
                  changePct={heroPct}
              />

              {summary && !loading && (
                  <div className="term-ticker">
                    {Object.entries(summary).map(([k, v]) => (
                        <span key={k} className="term-ticker-item">
                    <span className="ledger-label">{k}</span>
                    <span>{fmtCompact(typeof v === "object" ? JSON.stringify(v) : v)}</span>
                  </span>
                    ))}
                  </div>
              )}

              <div className="index-strip">
                {loading
                    ? [1, 2, 3, 4].map((i) => <div key={i} className="skel index-skel" />)
                    : secondaryIndices.map(([name, d]) => {
                      const change = d.percentageChange ?? d.perChange ?? 0;
                      return (
                          <div key={name} className="index-item">
                            <span className="index-name">{name}</span>
                            <span className="index-value">{fmt(d.currentValue ?? d.value)}</span>
                            <span className={`index-change ${dirClass(change)}`}>
                          <Arrow up={change >= 0} flat={change === 0} />
                              {change >= 0 ? "+" : ""}{fmt(change)}%
                        </span>
                          </div>
                      );
                    })}
              </div>
            </div>

            {/* borderless ledger */}
            <aside className="term-ledger">
              <div className="ledger-tabs">
                {["Movers", "Turnover", "Activity", "Sectors", "Floorsheet"].map((tab) => (
                    <button
                        key={tab}
                        className={`ledger-tab ${feed === tab ? "active" : ""}`}
                        onClick={() => setFeed(tab)}
                    >
                      {tab}
                    </button>
                ))}
              </div>

              <div className="ledger-body">
                {feed === "Movers" && (
                    <>
                      <p className="ledger-heading up">gainers</p>
                      {feedLoading && !gainers.length
                          ? [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                          : gainers.length
                              ? gainers.slice(0, 6).map((r) => <MoverRow key={r.symbol} item={r} tone="up" />)
                              : <EmptyRow label="no gainers yet" />}

                      <p className="ledger-heading down">losers</p>
                      {feedLoading && !losers.length
                          ? [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                          : losers.length
                              ? losers.slice(0, 6).map((r) => <MoverRow key={r.symbol} item={r} tone="down" />)
                              : <EmptyRow label="no losers yet" />}
                    </>
                )}

                {feed === "Turnover" && (
                    <>
                      <p className="ledger-heading">top turnover</p>
                      {feedLoading && !turnover.length ? (
                          [1, 2, 3, 4].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : turnover.length ? (
                          turnover.slice(0, 10).map((r) => (
                              <div className="ledger-row ledger-row-4" key={r.symbol}>
                                <span className="ledger-sym">{r.symbol}</span>
                                <span className="ledger-num">{fmtCompact(r.turnover)}</span>
                                <span className="ledger-num">{fmtCompact(r.shareTraded)}</span>
                                <span className="ledger-ltp">{fmt(r.ltp)}</span>
                              </div>
                          ))
                      ) : <EmptyRow label="no turnover data yet" />}
                    </>
                )}

                {feed === "Activity" && (
                    <>
                      <p className="ledger-heading">top trade by volume</p>
                      {feedLoading && !topTrade.length ? (
                          [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : topTrade.length ? (
                          topTrade.slice(0, 6).map((r) => (
                              <div className="ledger-row" key={r.symbol}>
                                <span className="ledger-sym">{r.symbol}</span>
                                <span className="ledger-num">{fmtCompact(r.shareTraded ?? r.totalTradeQuantity)}</span>
                              </div>
                          ))
                      ) : <EmptyRow label="no trade data yet" />}

                      <p className="ledger-heading">top by transactions</p>
                      {feedLoading && !topTransaction.length ? (
                          [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : topTransaction.length ? (
                          topTransaction.slice(0, 6).map((r) => (
                              <div className="ledger-row" key={r.symbol}>
                                <span className="ledger-sym">{r.symbol}</span>
                                <span className="ledger-num">{fmtCompact(r.totalTrades ?? r.transactionCount)}</span>
                              </div>
                          ))
                      ) : <EmptyRow label="no transaction data yet" />}

                      <p className="ledger-heading">supply demand imbalance</p>
                      {feedLoading && !supplyDemand.length ? (
                          [1, 2, 3].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : supplyDemand.length ? (
                          supplyDemand.slice(0, 6).map((r, i) => {
                            const buy = r.buyQuantity ?? r.totalBuyQty ?? r.buyQty ?? null;
                            const sell = r.sellQuantity ?? r.totalSellQty ?? r.sellQty ?? null;
                            return (
                                <div className="ledger-row ledger-row-3" key={r.symbol ?? i}>
                                  <span className="ledger-sym">{r.symbol ?? r.securityName}</span>
                                  <span className="ledger-num">{buy != null ? fmtCompact(buy) : "--"}</span>
                                  <span className="ledger-num">{sell != null ? fmtCompact(sell) : "--"}</span>
                                </div>
                            );
                          })
                      ) : <EmptyRow label="no imbalance data yet" />}
                    </>
                )}

                {feed === "Sectors" && (
                    <>
                      <p className="ledger-heading">sector sub indices</p>
                      {feedLoading && !sectorRows.length ? (
                          [1, 2, 3, 4].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : sectorRows.length ? (
                          sectorRows.map((s) => {
                            const name = s.name ?? s.index ?? "sector";
                            const change = s.percentageChange ?? s.perChange ?? s.change ?? 0;
                            const turn = sectorTurnoverFor(name);
                            const expanded = expandedSector === name;
                            return (
                                <div key={name} className="sector-block">
                                  <div
                                      className="ledger-row ledger-row-3 sector-row"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => toggleSector(name)}
                                      onKeyDown={(e) => { if (e.key === "Enter") toggleSector(name); }}
                                  >
                                    <span className="ledger-sym">{name}</span>
                                    <span className={`ledger-pct ${dirClass(change)}`}>
                              <Arrow up={change >= 0} flat={change === 0} />
                                      {change >= 0 ? "+" : ""}{fmt(change)}%
                            </span>
                                    <span className="ledger-num">{turn ? fmtCompact(turn) : "--"}</span>
                                  </div>
                                  {expanded && (
                                      <div className="sector-expand">
                                        <MiniSpark data={sectorGraphs[name]} />
                                      </div>
                                  )}
                                </div>
                            );
                          })
                      ) : <EmptyRow label="no sector data yet" />}
                    </>
                )}

                {feed === "Floorsheet" && (
                    <>
                      <p className="ledger-heading">live contracts</p>
                      {feedLoading && !floorRows.length ? (
                          [1, 2, 3, 4].map((i) => <div key={i} className="skel ledger-skel" />)
                      ) : floorRows.length ? (
                          floorRows.slice(0, 14).map((r, i) => (
                              <div className="ledger-row ledger-row-3" key={i}>
                                <span className="ledger-sym">{r.stockSymbol}</span>
                                <span className="ledger-num">{fmt(r.contractQuantity, 0)}</span>
                                <span className="ledger-ltp">{fmt(r.contractRate)}</span>
                              </div>
                          ))
                      ) : <EmptyRow label="no contracts yet" />}
                    </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </Layout>
  );
}