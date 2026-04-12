import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccountsApi } from "../../api/accounts";
import { getHistoryApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
import {
  LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { motion } from "framer-motion";
import "./Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ accounts: [], history: [], loading: true });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, histRes] = await Promise.all([getAccountsApi(), getHistoryApi()]);
        const sortedHistory = (Array.isArray(histRes?.data) ? histRes.data : [])
          .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

        setData({
          accounts: Array.isArray(accRes?.data) ? accRes.data : [],
          history: sortedHistory,
          loading: false,
        });
      } catch {
        setData({ accounts: [], history: [], loading: false });
      }
    };
    fetchData();
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

  const sparkData = data.history.slice(-10).map((_, i) => ({ v: i + 1 }));

  return (
    <div className="dashboard-root">
      <Navbar />
      <div className="dashboard-page">

        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="dash-hero"
        >
          <div>
            <h1 className="page-title">Operations</h1>
            <p className="page-subtitle">
              Welcome back, <span className="user-span">{user?.username}</span>
            </p>
          </div>
          <div className="hero-actions">
            <Link to="/accounts/add" className="btn btn-secondary">Add Account</Link>
            <Link to="/ipo/apply" className="btn btn-primary">Apply IPO</Link>
          </div>
        </motion.header>

        <section className="stats-highlight">
          <motion.div
            className="main-stat card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <span className="stat-label">Total Applications</span>
              <h2 className="main-value">{stats.total}</h2>
            </div>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={sparkData}>
                  <Line dataKey="v" stroke="#7c5cff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <div className="side-stats">
            <motion.div
              className="stat-box success"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span>Allotted</span>
              <strong>{stats.allotted}</strong>
            </motion.div>
            <motion.div
              className="stat-box danger"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span>Failed</span>
              <strong>{stats.failed}</strong>
            </motion.div>
          </div>
        </section>

        <section className="charts-grid">
          <motion.div
            className="card chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="chart-header">Applications Trend</div>
            {lineData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={lineData}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Line type="monotone" dataKey="count" stroke="#7c5cff" strokeWidth={3} dot={false} />
                  <Tooltip />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div
            className="card chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="chart-header">Result Breakdown</div>
            {pieData.every((p) => p.value === 0) ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={70}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </section>

        <div className="main-layout">
          <section>
            <div className="section-header">
              <h2>Recent Activity</h2>
              <Link to="/history" className="view-all">All Logs</Link>
            </div>
            <div className="card table-wrapper">
              {data.loading ? (
                <LoadingPulse />
              ) : recent.length === 0 ? (
                <EmptyState />
              ) : (
                <HistoryTable items={recent} />
              )}
            </div>
          </section>

          <aside>
            <div className="section-header">
              <h2>Accounts ({data.accounts.length})</h2>
              <Link to="/accounts/add" className="view-all">Manage</Link>
            </div>
            <div className="card nodes-list">
              {data.accounts.length === 0 ? (
                <EmptyState />
              ) : (
                data.accounts.map((acc) => (
                  <div key={acc.id} className="node-item">
                    <div className="node-avatar">{acc.fullName?.[0] || "?"}</div>
                    <div>
                      <p className="node-name">{acc.fullName}</p>
                      <p className="node-meta">{acc.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const EmptyState = () => <div className="empty">No data yet</div>;
const LoadingPulse = () => <div className="loading-pulse">Loading...</div>;

const HistoryTable = ({ items }) => (
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
      {items.map((item) => (
        <tr key={item.id}>
          <td><span className="company-text">{item.companyName}</span></td>
          <td className="dim">{item.accountUsername}</td>
          <td>
            <span className={`tag ${item.status === "FAILED" ? "failed" : "success"}`}>
              {item.status}
            </span>
          </td>
          <td>
            <span className={item.resultStatus === "ALLOTTED" ? "success" : "dim"}>
              {item.resultStatus ? item.resultStatus.replace(/_/g, " ") : "-"}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default Dashboard;