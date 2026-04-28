import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccountsApi } from "../../api/accounts";
import { getHistoryApi } from "../../api/ipo";
import Layout from "../../components/Layout";
import {
  LineChart, Line, PieChart, Pie, Cell,
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

const TOOLTIP_CONTENT_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  boxShadow: "var(--shadow)",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ accounts: [], history: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, histRes] = await Promise.all([getAccountsApi(), getHistoryApi()]);
        if (cancelled) return;
        const sorted = (Array.isArray(histRes?.data) ? histRes.data : [])
          .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
        setData({
          accounts: Array.isArray(accRes?.data) ? accRes.data : [],
          history:  sorted,
          loading:  false,
        });
      } catch {
        if (!cancelled) setData({ accounts: [], history: [], loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    total:    data.history.length,
    allotted: data.history.filter((h) => h.resultStatus === "ALLOTTED").length,
    failed:   data.history.filter((h) => h.status === "FAILED").length,
  }), [data.history]);

  const recent = useMemo(() => data.history.slice(0, 6), [data.history]);

  const lineData = useMemo(() => {
    const map = {};
    data.history.forEach((h) => {
      if (!h.appliedAt) return;
      const d = new Date(h.appliedAt).toLocaleDateString();
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [data.history]);

  const pieData = [
    { name: "Allotted", value: stats.allotted },
    { name: "Failed",   value: stats.failed   },
  ];

  const tooltipProps = {
    contentStyle: TOOLTIP_CONTENT_STYLE,
    labelStyle: { color: "var(--text-2)" },
  };

  return (
    <Layout>
      <div className="page">

        <div className="dash-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome back, {user?.username}</p>
          </div>
          <div className="dash-header-actions">
            <Link to="/accounts/add" className="btn btn-secondary btn-sm">Add account</Link>
            <Link to="/ipo/apply"    className="btn btn-primary  btn-sm">Apply IPO</Link>
          </div>
        </div>

        <div className="dash-stats">
          {data.loading ? (
            [1, 2, 3].map((k) => (
              <div className="stat-card" key={k}>
                <Skeleton h={10} w={80} style={{ marginBottom: 12 }} />
                <Skeleton h={36} w={60} />
              </div>
            ))
          ) : (
            <>
              <div className="stat-card anim-fade-up" style={{ animationDelay: "0s" }}>
                <p className="stat-label">Total applied</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <div className="stat-card anim-fade-up" style={{ animationDelay: "0.06s" }}>
                <p className="stat-label">Allotted</p>
                <p className="stat-value green">{stats.allotted}</p>
              </div>
              <div className="stat-card anim-fade-up" style={{ animationDelay: "0.12s" }}>
                <p className="stat-label">Failed</p>
                <p className="stat-value red">{stats.failed}</p>
              </div>
            </>
          )}
        </div>

        {!data.loading && data.history.length > 0 && (
          <div className="dash-charts">
            <div className="card anim-fade-up" style={{ animationDelay: "0.18s" }}>
              <p className="chart-label">Applications over time</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={lineData}>
                  <Line
                    type="monotone" dataKey="count"
                    stroke="var(--accent)" strokeWidth={2} dot={false}
                  />
                  <Tooltip {...tooltipProps} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card anim-fade-up" style={{ animationDelay: "0.24s" }}>
              <p className="chart-label">Result breakdown</p>
              {pieData.every((p) => p.value === 0) ? (
                <div className="inline-empty">No results yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" outerRadius={52} innerRadius={26}>
                      <Cell fill="var(--success)" />
                      <Cell fill="var(--danger)"  />
                    </Pie>
                    <Tooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        <div className="dash-main">
          <div>
            <div className="section-head">
              <span className="section-title-sm">Recent activity</span>
              <Link to="/history" className="section-link">View all</Link>
            </div>
            <div className="card">
              {data.loading ? (
                <div className="table-skeleton">
                  {[1, 2, 3, 4].map((k) => (
                    <div key={k} className="table-skeleton-row">
                      <Skeleton h={12} w="35%" />
                      <Skeleton h={12} w="20%" />
                      <Skeleton h={20} w={60} />
                      <Skeleton h={20} w={60} />
                    </div>
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="inline-empty">
                  No applications yet.{" "}
                  <Link to="/ipo/apply" style={{ color: "var(--accent)" }}>Apply for an IPO</Link>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Account</th>
                        <th>Status</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((item) => (
                        <tr key={item.id}>
                          <td><span className="cell-primary">{item.companyName}</span></td>
                          <td><span className="cell-dim">{item.accountUsername}</span></td>
                          <td>
                            <span className={`badge ${statusBadgeClass(item.status)}`}>
                              {item.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            {item.resultStatus ? (
                              <span className={`badge ${resultBadgeClass(item.resultStatus)}`}>
                                {item.resultStatus.replace(/_/g, " ")}
                              </span>
                            ) : <span className="cell-dim">—</span>}
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
              <span className="section-title-sm">Accounts ({data.accounts.length})</span>
              <Link to="/accounts/add" className="section-link">Manage</Link>
            </div>
            <div className="card">
              {data.loading ? (
                <div className="account-list">
                  {[1, 2].map((k) => (
                    <div key={k} className="account-row">
                      <Skeleton h={34} w={34} style={{ borderRadius: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <Skeleton h={12} w="60%" style={{ marginBottom: 6 }} />
                        <Skeleton h={10} w="40%" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : data.accounts.length === 0 ? (
                <div className="inline-empty">
                  <Link to="/accounts/add" style={{ color: "var(--accent)" }}>Add an account</Link>
                </div>
              ) : (
                <div className="account-list">
                  {data.accounts.map((acc) => (
                    <div key={acc.id} className="account-row">
                      <div className="account-initial">
                        {acc.fullName?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="account-name">{acc.fullName}</p>
                        <p className="account-meta">
                          {acc.username}
                          {acc.dpCode ? ` · DP ${acc.dpCode}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Dashboard;