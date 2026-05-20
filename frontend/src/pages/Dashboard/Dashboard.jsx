import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAccount } from "../../context/AccountContext";
import { getHistoryApi, getCdscSummaryApi } from "../../api/ipo";
import Layout from "../../components/Layout";
import AccountSwitcher from "../../components/AccountSwitcher";
import { IconUser, IconPlus, IconFile, IconRefresh, IconStack, IconCheck, IconX, IconClock } from "../../components/Icons";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip,
} from "recharts";
import "./Dashboard.css";

const Skeleton = ({ h = 16, w = "100%", style = {} }) => (
  <div className="skeleton" style={{ height: h, width: w, ...style }} />
);

const statusBadgeClass = (s) =>
  s === "FAILED"          ? "badge-danger"  :
  s === "ALREADY_APPLIED" ? "badge-warning" : "badge-success";

const resultBadgeClass = (s) =>
  s === "ALLOTTED"     ? "badge-success" :
  s === "NOT_ALLOTTED" ? "badge-danger"  : "badge-muted";

const cdscResultBadgeClass = (s) =>
  s === "ALLOTTED"     ? "badge-success" :
  s === "NOT_ALLOTTED" ? "badge-danger"  : "badge-muted";

const statusDotClass = (s) =>
  s === "FAILED" ? "badge-dot badge-dot-danger" : "badge-dot badge-dot-success";

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "var(--shadow-lg)",
  padding: "6px 10px",
};

const NoAccountBanner = () => (
  <div className="dash-no-account">
    <div className="dash-no-account-icon"><IconUser /></div>
    <p className="dash-no-account-title">No account connected</p>
    <p className="dash-no-account-desc">Link a Meroshare account to see your IPO stats.</p>
    <Link to="/accounts/add" className="btn btn-primary btn-sm"><IconPlus /> Add account</Link>
  </div>
);

const StatCard = ({ icon, label, value, color, loading, delay }) => (
  <div className="stat-card anim-fade-up" style={{ animationDelay: delay }}>
    <div className={`stat-icon-wrap stat-icon-${color}`}>{icon}</div>
    <div className="stat-body">
      <p className="stat-label">{label}</p>
      {loading
        ? <Skeleton h={36} w={52} style={{ marginTop: 6, borderRadius: 6 }} />
        : <p className={`stat-value stat-value-${color}`}>{value ?? "—"}</p>
      }
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { activeAccount, accounts, loading: accountLoading } = useAccount();

  const [allHistory, setAllHistory]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [cdscSummary, setCdscSummary]       = useState(null);
  const [cdscLoading, setCdscLoading]       = useState(false);
  const [cdscError, setCdscError]           = useState(null);
  const [cdscRefreshing, setCdscRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      try {
        const res = await getHistoryApi();
        if (cancelled) return;
        const sorted = (Array.isArray(res?.data) ? res.data : [])
          .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
        setAllHistory(sorted);
      } catch {
        if (!cancelled) setAllHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchCdscSummary = useCallback(async (accountId, isRefresh = false) => {
    if (isRefresh) setCdscRefreshing(true);
    else { setCdscLoading(true); setCdscSummary(null); }
    setCdscError(null);
    try {
      const res = await getCdscSummaryApi(accountId);
      setCdscSummary(res.data);
    } catch (e) {
      setCdscError(e?.response?.data?.message || "Could not load data from CDSC");
    } finally {
      setCdscLoading(false);
      setCdscRefreshing(false);
    }
  }, []);

  /* THE FIX: wait for accountLoading to settle before firing */
  useEffect(() => {
    if (accountLoading) return;
    if (!activeAccount) { setCdscSummary(null); setCdscError(null); return; }
    fetchCdscSummary(activeAccount.id, false);
  }, [activeAccount?.id, accountLoading]);

  const history = useMemo(() => {
    if (!activeAccount) return [];
    return allHistory.filter(h => h.accountUsername === activeAccount.username);
  }, [allHistory, activeAccount]);

  const recent = useMemo(() => history.slice(0, 5), [history]);

  const areaData = useMemo(() => {
    if (!cdscSummary?.items?.length) return [];
    return [...cdscSummary.items].reverse().reduce((acc, item, i) => {
      acc.push({ name: item.scrip || String(i + 1), total: (acc[acc.length - 1]?.total ?? 0) + 1 });
      return acc;
    }, []);
  }, [cdscSummary]);

  const pieData = cdscSummary ? [
    { name: "Allotted",     value: cdscSummary.allotted      },
    { name: "Not Allotted", value: cdscSummary.failed        },
    { name: "Pending",      value: cdscSummary.notPublished  },
  ] : [];

  const statsLoading = accountLoading || cdscLoading;
  const localLoading = accountLoading || historyLoading;

  return (
    <Layout>
      <div className="page">

        <div className="dash-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome back, <strong>{user?.username}</strong></p>
          </div>
          <div className="dash-header-actions">
            <Link to="/accounts/add" className="btn btn-ghost btn-sm"><IconPlus /> Account</Link>
            <Link to="/ipo/apply" className="btn btn-primary btn-sm"><IconFile /> Apply IPO</Link>
          </div>
        </div>

        <AccountSwitcher />

        {!activeAccount && !accountLoading ? <NoAccountBanner /> : (
          <>
            <div className="dash-stats-bar">
              <div className="dash-stats-bar-left">
                <span className="dash-source-tag">CDSC · last 12 months</span>
                {cdscSummary && !cdscLoading && (
                  <span className="dash-source-count">{cdscSummary.total} applications</span>
                )}
              </div>
              {activeAccount && (
                <button
                  className="dash-refresh-btn"
                  onClick={() => fetchCdscSummary(activeAccount.id, true)}
                  disabled={cdscLoading || cdscRefreshing || accountLoading}
                >
                  <IconRefresh spinning={cdscRefreshing} />
                  {cdscRefreshing ? "Syncing" : "Sync"}
                </button>
              )}
            </div>

            {cdscError && (
              <div className="dash-error-bar">
                <span>{cdscError}</span>
                <button className="dash-error-retry" onClick={() => fetchCdscSummary(activeAccount.id, false)}>
                  Retry
                </button>
              </div>
            )}

            <div className="dash-stats">
              <StatCard icon={<IconStack />}  label="Total Applied"  value={cdscSummary?.total}        color="accent"   loading={statsLoading} delay="0ms" />
              <StatCard icon={<IconCheck />}  label="Allotted"       value={cdscSummary?.allotted}     color="success"  loading={statsLoading} delay="60ms" />
              <StatCard icon={<IconX />}      label="Not Allotted"   value={cdscSummary?.failed}       color="danger"   loading={statsLoading} delay="120ms" />
              <StatCard icon={<IconClock />}  label="Pending"        value={cdscSummary?.notPublished} color="muted"    loading={statsLoading} delay="180ms" />
            </div>

            {cdscSummary && cdscSummary.total > 0 && (
              <div className="dash-charts">
                <div className="card dash-chart-card anim-fade-up" style={{ animationDelay: "200ms" }}>
                  <p className="chart-label">Cumulative applications</p>
                  <ResponsiveContainer width="100%" height={128}>
                    <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--text-2)" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="card dash-chart-card anim-fade-up" style={{ animationDelay: "260ms" }}>
                  <p className="chart-label">Result breakdown</p>
                  {pieData.every(p => p.value === 0) ? (
                    <div className="inline-empty" style={{ height: 128 }}>No results yet</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={100}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" outerRadius={44} innerRadius={26} paddingAngle={2}>
                            <Cell fill="var(--success)" />
                            <Cell fill="var(--danger)"  />
                            <Cell fill="var(--border-strong)" />
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pie-legend">
                        <span className="pie-legend-item"><span className="pie-dot" style={{ background: "var(--success)" }} />Allotted</span>
                        <span className="pie-legend-item"><span className="pie-dot" style={{ background: "var(--danger)"  }} />Not allotted</span>
                        <span className="pie-legend-item"><span className="pie-dot" style={{ background: "var(--border-strong)" }} />Pending</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="dash-main">
              <div className="dash-main-primary">
                <div className="section-head">
                  <span className="section-title-sm">
                    CDSC history
                    {cdscSummary && <span className="section-count">{cdscSummary.total}</span>}
                  </span>
                </div>
                <div className="card">
                  {cdscLoading ? (
                    <div className="table-skeleton">
                      {[1,2,3,4,5].map(k => (
                        <div key={k} className="table-skeleton-row">
                          <div style={{ flex: 1 }}>
                            <Skeleton h={12} w="60%" />
                            <Skeleton h={10} w="30%" style={{ marginTop: 5 }} />
                          </div>
                          <Skeleton h={12} w={50} />
                          <Skeleton h={22} w={90} style={{ borderRadius: 20 }} />
                        </div>
                      ))}
                    </div>
                  ) : cdscError ? (
                    <div className="inline-empty">
                      Failed to load.{" "}
                      <button className="inline-link-btn" onClick={() => fetchCdscSummary(activeAccount.id, false)}>Retry</button>
                    </div>
                  ) : cdscSummary?.items?.length === 0 ? (
                    <div className="inline-empty">
                      No applications in CDSC.{" "}
                      <Link to="/ipo/apply" className="inline-link-btn">Apply now</Link>
                    </div>
                  ) : cdscSummary ? (
                    <div className="table-scroll">
                      <table className="dash-table">
                        <thead>
                          <tr><th>Company</th><th>Type</th><th>Result</th></tr>
                        </thead>
                        <tbody>
                          {cdscSummary.items.map((item, i) => (
                            <tr key={item.applicantFormId ?? i}>
                              <td>
                                <span className="cell-primary">{item.companyName}</span>
                                {item.scrip && <span className="cell-scrip">{item.scrip}</span>}
                              </td>
                              <td><span className="cell-type">{item.shareTypeName || "—"}</span></td>
                              <td>
                                <span className={`badge ${cdscResultBadgeClass(item.resultStatus)}`}>
                                  {item.resultStatus === "ALLOTTED"     && <span className="badge-dot badge-dot-success" />}
                                  {item.resultStatus === "NOT_ALLOTTED" && <span className="badge-dot badge-dot-danger"  />}
                                  {item.resultStatus?.replace(/_/g, " ") ?? "—"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="dash-main-sidebar">
                <div>
                  <div className="section-head">
                    <span className="section-title-sm">Applied via app</span>
                    <Link to="/history" className="section-link">View all</Link>
                  </div>
                  <div className="card">
                    {localLoading ? (
                      <div className="table-skeleton">
                        {[1,2,3].map(k => (
                          <div key={k} className="table-skeleton-row">
                            <Skeleton h={12} w="55%" />
                            <Skeleton h={22} w={65} style={{ borderRadius: 20 }} />
                          </div>
                        ))}
                      </div>
                    ) : recent.length === 0 ? (
                      <div className="inline-empty">
                        No history yet.{" "}
                        <Link to="/ipo/apply" className="inline-link-btn">Apply now</Link>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="dash-table">
                          <thead>
                            <tr><th>Company</th><th>Status</th><th>Result</th></tr>
                          </thead>
                          <tbody>
                            {recent.map(item => (
                              <tr key={item.id}>
                                <td><span className="cell-primary">{item.companyName}</span></td>
                                <td>
                                  <span className={`badge ${statusBadgeClass(item.status)}`}>
                                    {item.status !== "ALREADY_APPLIED" && <span className={statusDotClass(item.status)} />}
                                    {item.status?.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td>
                                  {item.resultStatus
                                    ? <span className={`badge ${resultBadgeClass(item.resultStatus)}`}>{item.resultStatus.replace(/_/g, " ")}</span>
                                    : <span className="cell-dim">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="section-head">
                    <span className="section-title-sm">Accounts <span className="section-count">{accounts.length}</span></span>
                    <Link to="/accounts/add" className="section-link">Manage</Link>
                  </div>
                  <div className="card">
                    {accounts.length === 0 ? (
                      <div className="inline-empty">
                        <Link to="/accounts/add" className="inline-link-btn">Add an account</Link>
                      </div>
                    ) : (
                      <div className="account-list">
                        {accounts.map(acc => {
                          const active = activeAccount?.id === acc.id;
                          return (
                            <div key={acc.id} className="account-row">
                              <div className={`account-initial${active ? " active" : ""}`}>
                                {acc.fullName?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="account-row-info">
                                <p className="account-name">{acc.fullName}</p>
                                <p className="account-meta">{acc.username}{acc.dpCode ? ` · DP ${acc.dpCode}` : ""}</p>
                              </div>
                              {active && <span className="account-active-badge">Active</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;