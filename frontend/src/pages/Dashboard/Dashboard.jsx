import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccountsApi } from "../../api/accounts";
import { getHistoryApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
import "./Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, histRes] = await Promise.all([
          getAccountsApi(),
          getHistoryApi(),
        ]);
        setAccounts(accRes.data);
        setHistory(histRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalApplied = history.length;
  const totalAllotted = history.filter((h) => h.resultStatus === "ALLOTTED").length;
  const totalFailed = history.filter((h) => h.status === "FAILED").length;

  const recent = history.slice(0, 5);

  const statusBadge = (status) => {
    const map = {
      SUCCESS: "badge-success",
      FAILED: "badge-danger",
      ALREADY_APPLIED: "badge-warning",
      PENDING: "badge-muted",
    };
    return map[status] || "badge-muted";
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
            <Link to="/accounts/add" className="btn btn-primary">
              Add Account
            </Link>
            <Link to="/ipo/apply" className="btn btn-primary">
              Apply IPO
            </Link>
          </div>
        </div>

        <div className="dash-stats">
          <div className="stat-card">
            <p className="stat-label">Meroshare Accounts</p>
            <p className="stat-value">{accounts.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Applied</p>
            <p className="stat-value">{totalApplied}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Allotted</p>
            <p className="stat-value success">{totalAllotted}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Failed</p>
            <p className="stat-value danger">{totalFailed}</p>
          </div>
        </div>

        <div className="dash-body">
          <div className="dash-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Recent Applications</h2>
              <Link to="/history" className="dash-section-link">
                View all
              </Link>
            </div>

            {loading ? (
              <div className="card">
                <p className="loading-text">Loading...</p>
              </div>
            ) : recent.length === 0 ? (
              <div className="card empty-state">
                <p>No applications yet.</p>
                <Link to="/ipo/apply" className="btn btn-primary">
                  Apply for an IPO
                </Link>
              </div>
            ) : (
              <div className="card">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Account</th>
                      <th>Kitta</th>
                      <th>Status</th>
                      <th>Result</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((item) => (
                      <tr key={item.id}>
                        <td className="td-company">{item.companyName}</td>
                        <td className="td-muted">{item.accountUsername}</td>
                        <td>{item.appliedKitta}</td>
                        <td>
                          <span className={`badge ${statusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {item.resultStatus ? (
                            <span className={`badge ${item.resultStatus === "ALLOTTED" ? "badge-success" : "badge-muted"}`}>
                              {item.resultStatus}
                            </span>
                          ) : (
                            <span className="td-muted">-</span>
                          )}
                        </td>
                        <td className="td-muted">
                          {new Date(item.appliedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="dash-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Meroshare Accounts</h2>
              <Link to="/accounts/add" className="dash-section-link">
                Add new
              </Link>
            </div>

            {loading ? (
              <div className="card">
                <p className="loading-text">Loading...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="card empty-state">
                <p>No accounts added yet.</p>
                <Link to="/accounts/add" className="btn btn-primary">
                  Add Account
                </Link>
              </div>
            ) : (
              <div className="accounts-list">
                {accounts.map((acc) => (
                  <div className="account-row card" key={acc.id}>
                    <div className="account-avatar">
                      {acc.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="account-info">
                      <p className="account-name">{acc.fullName}</p>
                      <p className="account-meta">
                        {acc.username} &middot; DP {acc.dpId}
                      </p>
                    </div>
                    <div className="account-boid">
                      <p className="account-boid-label">BOID</p>
                      <p className="account-boid-value">{acc.boid || "N/A"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;