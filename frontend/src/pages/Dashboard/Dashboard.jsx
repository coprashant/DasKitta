import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccountsApi } from "../../api/accounts";
import { getHistoryApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
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
          loading: false
        });
      } catch (err) {
        setData(prev => ({ ...prev, loading: false }));
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => ({
    total: data.history.length,
    allotted: data.history.filter(h => h.resultStatus === "ALLOTTED").length,
    failed: data.history.filter(h => h.status === "FAILED").length
  }), [data.history]);

  const recent = useMemo(() => data.history.slice(0, 6), [data.history]);

  return (
    <div className="dashboard-root">
      <Navbar />
      <div className="dashboard-page">
        
        <header className="dash-hero">
          <div className="hero-content">
            <h1 className="page-title">Operations</h1>
            <p className="page-subtitle">Welcome back, <span className="user-span">{user?.username}</span></p>
          </div>
          <div className="hero-actions">
            <Link to="/accounts/add" className="btn btn-secondary">Add Account</Link>
            <Link to="/ipo/apply" className="btn btn-primary">Deploy IPO</Link>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard label="Linked Nodes" value={data.accounts.length} />
          <StatCard label="Total Deployments" value={stats.total} />
          <StatCard label="Allotted" value={stats.allotted} variant="success" />
          <StatCard label="Failed" value={stats.failed} variant="danger" />
        </section>

        <div className="main-layout">
          <section className="feed-section">
            <div className="section-header">
              <h2>Recent Activity</h2>
              <Link to="/history" className="view-all">Logs →</Link>
            </div>
            
            <div className="card glass-card table-wrapper">
              {data.loading ? <LoadingPulse /> : <HistoryTable items={recent} />}
            </div>
          </section>

          <aside className="nodes-section">
            <div className="section-header">
              <h2>Active Nodes</h2>
              <Link to="/accounts/add" className="view-all">Manage</Link>
            </div>
            <div className="card glass-card nodes-list">
              {data.accounts.map(acc => (
                <div key={acc.id} className="node-item">
                  <div className="node-avatar">{acc.fullName[0]}</div>
                  <div className="node-details">
                    <p className="node-name">{acc.fullName}</p>
                    <p className="node-meta">{acc.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

// Sub-components for cleaner code
const StatCard = ({ label, value, variant }) => (
  <div className={`stat-card ${variant || ""}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);

const LoadingPulse = () => (
  <div className="loading-pulse">Scanning system...</div>
);

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
      {items.map(item => (
        <tr key={item.id}>
          <td><span className="company-text">{item.companyName}</span></td>
          <td className="dim">{item.accountUsername}</td>
          <td><span className={`tag ${item.status.toLowerCase()}`}>{item.status}</span></td>
          <td><span className={item.resultStatus === 'ALLOTTED' ? 'success' : 'dim'}>
            {item.resultStatus || '-'}
          </span></td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default Dashboard;