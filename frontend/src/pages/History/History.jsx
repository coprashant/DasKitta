import { useState, useEffect } from "react";
import { getHistoryApi } from "../../api/ipo";
import Layout from "../../components/Layout";
import "./History.css";

const statusBadge = (s) =>
  ({ SUCCESS: "badge-success", FAILED: "badge-danger", ALREADY_APPLIED: "badge-warning", PENDING: "badge-muted" }[s] || "badge-muted");

const resultBadge = (s) =>
  ({ ALLOTTED: "badge-success", NOT_ALLOTTED: "badge-danger", NOT_PUBLISHED: "badge-warning", UNKNOWN: "badge-muted" }[s] || "badge-muted");

const Skeleton = ({ h = 12, w = "100%" }) => (
  <div className="skeleton" style={{ height: h, width: w }} />
);

const History = ({ theme, onThemeToggle }) => {
  const [history, setHistory]         = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await getHistoryApi();
        setHistory(res.data);
        setFiltered(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let d = history;
    if (search.trim()) {
      d = d.filter((h) =>
        h.companyName.toLowerCase().includes(search.toLowerCase()) ||
        h.accountUsername.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "ALL") d = d.filter((h) => h.status === statusFilter);
    setFiltered(d);
  }, [search, statusFilter, history]);

  return (
    <Layout theme={theme} onThemeToggle={onThemeToggle}>
      <div className="page">
        <h1 className="page-title">Application history</h1>
        <p className="page-subtitle">
          All IPO applications across all your accounts.
        </p>

        <div className="history-controls">
          <div className="history-search-wrap">
            <SearchIcon />
            <input
              type="text"
              className="input history-search"
              placeholder="Search by company or account"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-scroll">
            {["ALL", "SUCCESS", "FAILED", "ALREADY_APPLIED", "PENDING"].map((s) => (
              <button
                key={s}
                className={`filter-btn${statusFilter === s ? " active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="history-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Company</th><th>Account</th><th>Kitta</th>
                    <th>Status</th><th>Result</th><th>Allotted</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((k) => (
                    <tr key={k}>
                      <td><Skeleton h={12} w="80%" /></td>
                      <td><Skeleton h={12} w="60%" /></td>
                      <td><Skeleton h={12} w={30} /></td>
                      <td><Skeleton h={20} w={70} /></td>
                      <td><Skeleton h={20} w={80} /></td>
                      <td><Skeleton h={12} w={30} /></td>
                      <td><Skeleton h={12} w={70} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <p>No applications found.</p>
          </div>
        ) : (
          <div className="card anim-fade-up">
            <div className="history-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Account</th>
                    <th>Kitta</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Allotted</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="h-company">{item.companyName}</span>
                        <span className="h-share-id">ID: {item.shareId}</span>
                      </td>
                      <td>
                        <span className="h-acc-name">{item.accountFullName}</span>
                        <span className="h-acc-user">{item.accountUsername}</span>
                      </td>
                      <td>{item.appliedKitta}</td>
                      <td>
                        <span className={`badge ${statusBadge(item.status)}`}>
                          {item.status}
                        </span>
                        {item.statusMessage && (
                          <p className="h-msg">{item.statusMessage}</p>
                        )}
                      </td>
                      <td>
                        {item.resultStatus
                          ? <span className={`badge ${resultBadge(item.resultStatus)}`}>
                              {item.resultStatus.replace("_", " ")}
                            </span>
                          : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {item.allottedKitta > 0
                          ? <span className="h-allotted">{item.allottedKitta}</span>
                          : <span className="td-muted">—</span>}
                      </td>
                      <td className="td-muted">
                        {new Date(item.appliedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              Showing {filtered.length} of {history.length} applications
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="history-search-icon">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export default History;