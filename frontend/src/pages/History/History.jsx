import { useState, useEffect } from "react";
import { getHistoryApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
import "./History.css";

const History = () => {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await getHistoryApi();
        setHistory(res.data);
        setFiltered(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    let data = history;

    if (search.trim()) {
      data = data.filter(
        (h) =>
          h.companyName.toLowerCase().includes(search.toLowerCase()) ||
          h.accountUsername.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== "ALL") {
      data = data.filter((h) => h.status === statusFilter);
    }

    setFiltered(data);
  }, [search, statusFilter, history]);

  const statusBadge = (status) => {
    const map = {
      SUCCESS: "badge-success",
      FAILED: "badge-danger",
      ALREADY_APPLIED: "badge-warning",
      PENDING: "badge-muted",
    };
    return map[status] || "badge-muted";
  };

  const resultBadge = (status) => {
    const map = {
      ALLOTTED: "badge-success",
      NOT_ALLOTTED: "badge-danger",
      NOT_PUBLISHED: "badge-warning",
      UNKNOWN: "badge-muted",
    };
    return map[status] || "badge-muted";
  };

  return (
    <div>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Application History</h1>
        <p className="page-subtitle">
          All IPO applications across all your accounts.
        </p>

        <div className="history-filters card">
          <input
            type="text"
            className="history-search"
            placeholder="Search by company or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="history-status-filters">
            {["ALL", "SUCCESS", "FAILED", "ALREADY_APPLIED", "PENDING"].map(
              (s) => (
                <button
                  key={s}
                  className={`filter-btn ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "ALL" ? "All" : s.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </div>

        {loading ? (
          <div className="card">
            <p className="loading-text">Loading history...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <p>No applications found.</p>
          </div>
        ) : (
          <div className="card">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Account</th>
                  <th>Kitta</th>
                  <th>Apply Status</th>
                  <th>Result</th>
                  <th>Allotted</th>
                  <th>Applied On</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="history-company">{item.companyName}</p>
                      <p className="history-share-id">ID: {item.shareId}</p>
                    </td>
                    <td>
                      <p className="history-account-name">
                        {item.accountFullName}
                      </p>
                      <p className="history-account-user">
                        {item.accountUsername}
                      </p>
                    </td>
                    <td>{item.appliedKitta}</td>
                    <td>
                      <span className={`badge ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                      {item.statusMessage && (
                        <p className="history-message">{item.statusMessage}</p>
                      )}
                    </td>
                    <td>
                      {item.resultStatus ? (
                        <span className={`badge ${resultBadge(item.resultStatus)}`}>
                          {item.resultStatus.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="td-muted">-</span>
                      )}
                    </td>
                    <td>
                      {item.allottedKitta > 0 ? (
                        <span className="history-allotted">
                          {item.allottedKitta}
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
            <div className="history-footer">
              Showing {filtered.length} of {history.length} applications
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;