import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { getHistoryApi } from "../../api/ipo";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import AccountSwitcher from "../../components/AccountSwitcher/AccountSwitcher.jsx";
import SEO from "../../seo/SEO.jsx";
import {
  IconPlus,
  IconUser,
  ChevronLeft,
  ChevronRight,
  EmptyIllustration,
  SearchIcon,
  ClearIcon,
  IconStack,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  WarnIcon,
} from "../../components/Icons";
import "./History.css";

const PAGE_SIZE = 20;

// Extracted outside the render loop so it doesn't re-instantiate on every render
const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "allotted", label: "Allotted" },
  { key: "released", label: "Released" },
  { key: "blocked", label: "Blocked" },
  { key: "pending", label: "Pending" },
  { key: "warning", label: "Already applied" },
  { key: "failed", label: "Failed" },
];

const Skeleton = ({ h = 12, w = "100%" }) => (
    <div className="skeleton" style={{ height: h, width: w }} />
);

/**
 * Derives a human-readable status object from raw application payload fields.
 */
const deriveStatus = (item) => {
  if (item.status === "SUCCESS") {
    const r = item.resultStatus;
    if (r === "ALLOTTED") {
      return { label: `Allotted · ${item.allottedKitta ?? 0} kitta`, variant: "allotted", icon: IconCheck };
    }
    if (r === "NOT_ALLOTTED") {
      return { label: "Amount released", variant: "released", icon: IconRefresh };
    }
    return { label: "Amount blocked", variant: "blocked", icon: IconClock };
  }
  if (item.status === "ALREADY_APPLIED") {
    return { label: "Already applied", variant: "warning", icon: IconAlertCircle };
  }
  if (item.status === "FAILED") {
    return { label: "Failed", variant: "failed", icon: WarnIcon };
  }
  if (item.status === "PENDING") {
    return { label: "Pending", variant: "pending", icon: IconClock };
  }
  return { label: item.status ?? "—", variant: "pending", icon: IconClock };
};

const History = () => {
  const { activeAccount } = useAccount();
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Fetch application history
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

  // Reset pagination when active filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, activeAccount]);

  // Active account history dataset
  const history = useMemo(() => {
    if (!activeAccount?.username) return [];
    return allHistory.filter((h) => h.accountUsername === activeAccount.username);
  }, [allHistory, activeAccount]);

  // Overall account statistics summary
  const stats = useMemo(() => {
    let allotted = 0;
    let pending = 0;
    let failed = 0;

    history.forEach((h) => {
      const variant = deriveStatus(h).variant;
      if (variant === "allotted") allotted += 1;
      else if (variant === "blocked" || variant === "pending") pending += 1;
      else if (variant === "failed") failed += 1;
    });

    return { total: history.length, allotted, pending, failed };
  }, [history]);

  // Filtered dataset search & status tag filters
  const filtered = useMemo(() => {
    let dataset = history;

    if (search.trim()) {
      const q = search.toLowerCase();
      dataset = dataset.filter((h) =>
          h.companyName?.toLowerCase().includes(q) ||
          h.accountUsername?.toLowerCase().includes(q) ||
          h.accountFullName?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      dataset = dataset.filter((h) => deriveStatus(h).variant === statusFilter);
    }

    return dataset;
  }, [search, statusFilter, history]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filtered.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filtered, page]);

  const fmtDate = useCallback((iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("ALL");
  }, []);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "ALL";
  const noAccountState = !activeAccount && !loading;

  return (
      <Layout>
        <SEO
            title="Application History"
            description="A complete timeline of all your past NEPSE IPO applications, allotment results, and transaction statuses across your Meroshare accounts."
            canonical="/history"
            noindex={true}
        />
        <div className="page">
          <div className="history-shell">
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

            {activeAccount && <AccountSwitcher />}

            {noAccountState ? (
                <div className="card empty-state">
                  <div className="history-empty-icon"><IconUser /></div>
                  <p>No account selected. Add an account to get started.</p>
                  <Link to="/settings/accounts/add" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                    <IconPlus /> Add account
                  </Link>
                </div>
            ) : (
                <>
                  {activeAccount && !loading && history.length > 0 && (
                      <div className="history-stats-row">
                        <div className="history-stat-card">
                          <span className="history-stat-icon stat-total"><IconStack /></span>
                          <div className="history-stat-text">
                            <span className="history-stat-value">{stats.total}</span>
                            <span className="history-stat-label">Total</span>
                          </div>
                        </div>
                        <div className="history-stat-card">
                          <span className="history-stat-icon stat-allotted"><IconCheck /></span>
                          <div className="history-stat-text">
                            <span className="history-stat-value">{stats.allotted}</span>
                            <span className="history-stat-label">Allotted</span>
                          </div>
                        </div>
                        <div className="history-stat-card">
                          <span className="history-stat-icon stat-pending"><IconClock /></span>
                          <div className="history-stat-text">
                            <span className="history-stat-value">{stats.pending}</span>
                            <span className="history-stat-label">Pending</span>
                          </div>
                        </div>
                        <div className="history-stat-card">
                          <span className="history-stat-icon stat-failed"><WarnIcon /></span>
                          <div className="history-stat-text">
                            <span className="history-stat-value">{stats.failed}</span>
                            <span className="history-stat-label">Failed</span>
                          </div>
                        </div>
                      </div>
                  )}

                  <div className="history-controls">
                    <div className="history-search-wrap">
                      <span className="history-search-icon"><SearchIcon /></span>
                      <input
                          type="text"
                          className="history-search"
                          placeholder="Search by company"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          aria-label="Search applications"
                      />
                      {search && (
                          <button
                              type="button"
                              className="search-clear-btn"
                              onClick={() => setSearch("")}
                              aria-label="Clear search"
                          >
                            <ClearIcon />
                          </button>
                      )}
                    </div>

                    <div className="filter-scroll" role="group" aria-label="Filter by status">
                      {STATUS_FILTERS.map((s) => (
                          <button
                              key={s.key}
                              type="button"
                              className={`filter-btn${statusFilter === s.key ? " active" : ""}`}
                              onClick={() => setStatusFilter(s.key)}
                              aria-pressed={statusFilter === s.key}
                          >
                            {s.label}
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
                              <th>Company</th>
                              <th>Kitta</th>
                              <th>Status</th>
                              <th>Date</th>
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
                        {hasActiveFilters && history.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: 8 }}
                                onClick={clearFilters}
                            >
                              Clear filters
                            </button>
                        )}
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
                              const StatusIcon = derived.icon;
                              return (
                                  <tr key={item.id}>
                                    <td>
                                      <span className="h-company">{item.companyName || "—"}</span>
                                    </td>
                                    <td>{item.appliedKitta ?? "—"}</td>
                                    <td>
                                <span className={`h-status-badge h-status-${derived.variant}`}>
                                  <StatusIcon />
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
                                    type="button"
                                    className="page-btn"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    aria-label="Previous page"
                                >
                                  <ChevronLeft />
                                </button>
                                <span className="page-info" aria-current="page">{page} / {totalPages}</span>
                                <button
                                    type="button"
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
        </div>
      </Layout>
  );
};

export default History;