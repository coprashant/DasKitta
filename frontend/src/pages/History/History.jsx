import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getHistoryApi } from "../../api/ipo";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import { ChevronLeft, ChevronRight, EmptyIllustration, SearchIcon } from "../../components/Icons";
import "./History.css";

const PAGE_SIZE = 20;
const Skeleton = ({ h = 12, w = "100%" }) => <div className="skeleton" style={{ height: h, width: w }} />;
const STATUS_FILTERS = ["ALL", "SUCCESS", "FAILED", "ALREADY_APPLIED", "PENDING"];

/**
 * Derives a single human-readable status from the raw application + result fields.
 *
 * status=SUCCESS + resultStatus=NOT_PUBLISHED (or null) → amount is blocked with CDSC
 * status=SUCCESS + resultStatus=ALLOTTED        → allotted, kitta received
 * status=SUCCESS + resultStatus=NOT_ALLOTTED    → not allotted, amount released
 * status=FAILED / ALREADY_APPLIED / PENDING     → show as-is
 */
const deriveStatus = (item) => {
  if (item.status === "SUCCESS") {
    const r = item.resultStatus;
    if (r === "ALLOTTED") {
      return { label: `Allotted · ${item.allottedKitta} kitta`, variant: "allotted" };
    }
    if (r === "NOT_ALLOTTED") {
      return { label: "Amount released", variant: "released" };
    }
    // NOT_PUBLISHED, UNKNOWN, or null all mean the result hasn't come out yet
    return { label: "Amount blocked", variant: "blocked" };
  }
  if (item.status === "ALREADY_APPLIED") {
    return { label: "Already applied", variant: "warning" };
  }
  if (item.status === "FAILED") {
    return { label: "Failed", variant: "failed" };
  }
  if (item.status === "PENDING") {
    return { label: "Pending", variant: "pending" };
  }
  return { label: item.status ?? "—", variant: "pending" };
};

const IconUser = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const History = () => {
  const { activeAccount } = useAccount();
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage]             = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getHistoryApi();
        if (!cancelled) setAllHistory(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setAllHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter, activeAccount]);

  const history = useMemo(() => {
    if (!activeAccount) return [];
    return allHistory.filter((h) => h.accountUsername === activeAccount.username);
  }, [allHistory, activeAccount]);

  const filtered = useMemo(() => {
    let d = history;
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter((h) =>
        h.companyName?.toLowerCase().includes(q) ||
        h.accountUsername?.toLowerCase().includes(q) ||
        h.accountFullName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") {
      d = d.filter((h) => h.status === statusFilter);
    }
    return d;
  }, [search, statusFilter, history]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
  };

  const noAccountState = !activeAccount && !loading;

  return (
    <Layout>
      <div className="page">
        <div className="history-page-header">
          <div>
            <h1 className="page-title">Application history</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              {activeAccount
                ? `IPO applications for ${activeAccount.fullName}`
                : "Select an account to view history"}
            </p>
          </div>
        </div>

        {activeAccount && (
          <div className="history-account-pill">
            <div className="history-account-avatar">
              {activeAccount.fullName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="history-account-info">
              <span className="history-account-name">{activeAccount.fullName}</span>
              <span className="history-account-meta">
                {activeAccount.username}
                {activeAccount.dpCode ? ` · DP ${activeAccount.dpCode}` : ""}
              </span>
            </div>
          </div>
        )}

        {noAccountState ? (
          <div className="card empty-state">
            <div className="history-empty-icon"><IconUser /></div>
            <p>No account selected. Add an account to get started.</p>
            <Link to="/accounts/add" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
              <IconPlus /> Add account
            </Link>
          </div>
        ) : (
          <>
            <div className="history-controls">
              <div className="history-search-wrap">
                <SearchIcon />
                <input
                  type="text"
                  className="input history-search"
                  placeholder="Search by company"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search applications"
                />
              </div>
              <div className="filter-scroll" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    className={`filter-btn${statusFilter === s ? " active" : ""}`}
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={statusFilter === s}
                  >
                    {s === "ALL" ? "All" : s.replace(/_/g, " ")}
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
                        <th>Company</th><th>Kitta</th><th>Status</th><th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5].map((k) => (
                        <tr key={k}>
                          <td><Skeleton h={12} w="80%" /></td>
                          <td><Skeleton h={12} w={30} /></td>
                          <td><Skeleton h={20} w={110} /></td>
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
                <p>{history.length === 0 ? "No applications yet." : "No applications match your filters."}</p>
              </div>
            ) : (
              <div className="card anim-fade-up">
                <div className="history-scroll">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Kitta</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((item) => {
                        const derived = deriveStatus(item);
                        return (
                          <tr key={item.id}>
                            <td>
                              <span className="h-company">{item.companyName || "—"}</span>
                              {item.shareId && (
                                <span className="h-share-id">ID: {item.shareId}</span>
                              )}
                            </td>
                            <td>{item.appliedKitta ?? "—"}</td>
                            <td>
                              <span className={`h-status-badge h-status-${derived.variant}`}>
                                {derived.label}
                              </span>
                              {item.status === "FAILED" && item.statusMessage && (
                                <p className="h-msg" title={item.statusMessage}>
                                  {item.statusMessage}
                                </p>
                              )}
                            </td>
                            <td className="td-muted">{fmtDate(item.appliedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  <span>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
                      <span className="page-info" aria-current="page">{page} / {totalPages}</span>
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
          </>
        )}
      </div>
    </Layout>
  );
};

export default History;