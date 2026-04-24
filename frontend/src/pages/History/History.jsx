import { useState, useEffect, useMemo } from "react";
import { getHistoryApi } from "../../api/ipo";
import Layout from "../../components/Layout";
import "./History.css";

const PAGE_SIZE = 20;

const statusBadge = (s) =>
  ({ SUCCESS: "badge-success", FAILED: "badge-danger", ALREADY_APPLIED: "badge-warning", PENDING: "badge-muted" }[s] || "badge-muted");

const resultBadge = (s) =>
  ({ ALLOTTED: "badge-success", NOT_ALLOTTED: "badge-danger", NOT_PUBLISHED: "badge-warning", UNKNOWN: "badge-muted" }[s] || "badge-muted");

const Skeleton = ({ h = 12, w = "100%" }) => (
  <div className="skeleton" style={{ height: h, width: w }} />
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="history-search-icon">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const History = () => {
  const [history, setHistory]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await getHistoryApi();
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* reset to page 1 whenever filters change */
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const filtered = useMemo(() => {
    let d = history;
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter((h) =>
        h.companyName?.toLowerCase().includes(q) ||
        h.accountUsername?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") d = d.filter((h) => h.status === statusFilter);
    return d;
  }, [search, statusFilter, history]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout>
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
              aria-label="Search applications"
            />
          </div>
          <div className="filter-scroll" role="group" aria-label="Filter by status">
            {["ALL", "SUCCESS", "FAILED", "ALREADY_APPLIED", "PENDING"].map((s) => (
              <button
                key={s}
                className={`filter-btn${statusFilter === s ? " active" : ""}`}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
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
            <EmptyIllustration />
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
                  {paginated.map((item) => (
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
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} applications
              </span>
              {totalPages > 1 && (
                <div className="pagination" role="navigation" aria-label="Pagination">
                  <button
                    className="page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft />
                  </button>
                  <span className="page-info" aria-current="page">
                    {page} / {totalPages}
                  </span>
                  <button
                    className="page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const EmptyIllustration = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
    style={{ margin: "0 auto 12px", display: "block" }}>
    <rect x="6" y="10" width="36" height="30" rx="4" stroke="var(--border-strong)" strokeWidth="1.5"/>
    <line x1="12" y1="18" x2="36" y2="18" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="24" x2="28" y2="24" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="30" x2="22" y2="30" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default History;