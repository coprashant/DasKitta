import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccountsApi } from "../../api/accounts";
import { getHistoryApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "./Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ accounts: [], history: [], loading: true });

  useEffect(() => {
    (async () => {
      try {
        const [accRes, histRes] = await Promise.all([getAccountsApi(), getHistoryApi()]);
        const sorted = (Array.isArray(histRes?.data) ? histRes.data : [])
          .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
        setData({ accounts: Array.isArray(accRes?.data) ? accRes.data : [], history: sorted, loading: false });
      } catch {
        setData({ accounts: [], history: [], loading: false });
      }
    })();
  }, []);

  const stats = useMemo(() => ({
    total: data.history.length,
    allotted: data.history.filter((h) => h.resultStatus === "ALLOTTED").length,
    failed: data.history.filter((h) => h.status === "FAILED").length,
  }), [data.history]);

  const recent = useMemo(() => data.history.slice(0, 6), [data.history]);

  const lineData = useMemo(() => {
    const map = {};
    data.history.forEach((h) => {
      const d = new Date(h.appliedAt).toLocaleDateString();
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [data.history]);

  const pieData = [
    { name: "Allotted", value: stats.allotted },
    { name: "Failed", value: stats.failed },
  ];

  const tooltipStyle = {
    contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, boxShadow: "var(--shadow)" },
    labelStyle: { color: "var(--text-2)" },
  };

  return (
    <div>
      <Navbar />
      <div className="page">

        <div className="dash-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome back, {user?.username}</p>
          </div>
          <div className="dash-header-actions">
            <Link to="/accounts/add" className="btn btn-secondary btn-sm">Add Account</Link>
            <Link to="/ipo/apply" className="btn btn-primary btn-sm">Apply IPO</Link>
          </div>
        </div>

        <div className="dash-stats">
          <div className="stat-card">
            <p className="stat-label">Total Applied</p>
            <p className="stat-value">{stats.total}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Allotted</p>
            <p className="stat-value green">{stats.allotted}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Failed</p>
            <p className="stat-value red">{stats.failed}</p>
          </div>
        </div>

        {data.history.length > 0 && (
          <div className="dash-charts">
            <div className="card">
              <p className="chart-label">Applications Over Time</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={lineData}>
                  <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <Tooltip {...tooltipStyle} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <p className="chart-label">Result Breakdown</p>
              {pieData.every((p) => p.value === 0) ? (
                <div className="inline-empty">No results yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" outerRadius={55} innerRadius={28}>
                      <Cell fill="var(--success)" />
                      <Cell fill="var(--danger)" />
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        <div className="dash-main">
          <div>
            <div className="section-head">
              <span className="section-title">Recent Activity</span>
              <Link to="/history" className="section-link">View all →</Link>
            </div>
            <div className="card">
              {data.loading ? (
                <div className="inline-empty">Loading…</div>
              ) : recent.length === 0 ? (
                <div className="inline-empty">
                  No applications yet. <Link to="/ipo/apply" style={{ color: "var(--accent)" }}>Apply for an IPO</Link>
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
                            <span className={`badge ${item.status === "FAILED" ? "badge-danger" : item.status === "ALREADY_APPLIED" ? "badge-warning" : "badge-success"}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            {item.resultStatus ? (
                              <span className={`badge ${item.resultStatus === "ALLOTTED" ? "badge-success" : item.resultStatus === "NOT_ALLOTTED" ? "badge-danger" : "badge-muted"}`}>
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
              <span className="section-title">Accounts ({data.accounts.length})</span>
              <Link to="/accounts/add" className="section-link">Manage →</Link>
            </div>
            <div className="card">
              {data.accounts.length === 0 ? (
                <div className="inline-empty">
                  <Link to="/accounts/add" style={{ color: "var(--accent)" }}>Add an account</Link>
                </div>
              ) : (
                <div className="account-list">
                  {data.accounts.map((acc) => (
                    <div key={acc.id} className="account-row">
                      <div className="account-initial">{acc.fullName?.[0] || "?"}</div>
                      <div>
                        <p className="account-name">{acc.fullName}</p>
                        <p className="account-meta">{acc.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;