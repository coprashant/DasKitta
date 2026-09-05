import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAccount } from "../../context/AccountContext";
import { getPortfolioApi } from "../../api/accounts";
import { getHistoryApi, getCdscSummaryApi } from "../../api/ipo";
import { getCompanySectors, isNepseError } from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import AccountSwitcher from "../../components/AccountSwitcher/AccountSwitcher.jsx";
import SEO from "../../seo/SEO.jsx";
import DashboardCharts from "./DashboardCharts.jsx";
import {
  IconPlus,
  IconFile,
  IconRefresh,
  IconStack,
  IconCheck,
  IconX,
  IconClock
} from "../../components/Icons";
import "./Dashboard.css";

const CDSC_MOBILE_LIMIT = 5;

const numberFormat = new Intl.NumberFormat("en-US");
const fmt = (n) => numberFormat.format(n ?? 0);

// no response means the request never reached the server, ie offline
const resolveErrorMessage = (error, fallback) => {
  if (!error?.response) {
    return "No internet connection. Check your network and try again.";
  }

  return error?.response?.data?.message || fallback;
};

// local icons for the empty state cards, kept simple and on brand
const IconLinkConnect = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

const IconAlertCircle = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
    </svg>
);

const Skeleton = ({ h = 16, w = "100%", style = {} }) => (
    <div className="skeleton" style={{ height: h, width: w, ...style }} />
);

const cdscResultBadgeClass = (s) =>
    s === "ALLOTTED"
        ? "badge-success"
        : s === "NOT_ALLOTTED"
            ? "badge-danger"
            : "badge-muted";

const deriveStatus = (item) => {
  if (item.status === "SUCCESS") {
    const r = item.resultStatus;

    if (r === "ALLOTTED") {
      return {
        label: `Allotted · ${item.allottedKitta} kitta`,
        variant: "allotted"
      };
    }

    if (r === "NOT_ALLOTTED") {
      return {
        label: "Released",
        variant: "released"
      };
    }

    return {
      label: "Blocked",
      variant: "blocked"
    };
  }

  if (item.status === "ALREADY_APPLIED") {
    return {
      label: "Applied",
      variant: "warning"
    };
  }

  if (item.status === "FAILED") {
    return {
      label: "Failed",
      variant: "failed"
    };
  }

  if (item.status === "PENDING") {
    return {
      label: "Pending",
      variant: "pending"
    };
  }

  return {
    label: item.status ?? "—",
    variant: "pending"
  };
};

const Dashboard = () => {
  const { user } = useAuth();
  const {
    activeAccount,
    accounts,
    loading: accountLoading,
    error: accountError,
    refetch: refetchAccounts
  } = useAccount();

  const [allHistory, setAllHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const [cdscSummary, setCdscSummary] = useState(null);
  const [cdscLoading, setCdscLoading] = useState(false);
  const [cdscError, setCdscError] = useState(null);
  const [cdscRefreshing, setCdscRefreshing] = useState(false);
  const [cdscExpanded, setCdscExpanded] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [chartMode, setChartMode] = useState("portfolio");
  const [sectorMap, setSectorMap] = useState({});
  const [isMobile, setIsMobile] = useState(() =>
      typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");

    const handler = (event) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);

    return () => {
      mq.removeEventListener("change", handler);
    };
  }, []);

  // reload key lets the retry button retrigger this effect
  useEffect(() => {
    let cancelled = false;

    setHistoryLoading(true);
    setHistoryError(null);

    (async () => {
      try {
        const res = await getHistoryApi();

        if (cancelled) {
          return;
        }

        const sorted = (Array.isArray(res?.data) ? res.data : [])
            .sort(
                (a, b) =>
                    new Date(b.appliedAt) - new Date(a.appliedAt)
            );

        setAllHistory(sorted);
      } catch (error) {
        if (!cancelled) {
          setAllHistory([]);
          setHistoryError(
              resolveErrorMessage(error, "Could not load platform activity")
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historyReloadKey]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getCompanySectors();

        if (cancelled || isNepseError(res?.data)) {
          return;
        }

        const list = res?.data?.sectors || {};
        const map = {};

        Object.entries(list).forEach(([symbol, sector]) => {
          const key = (symbol || "").trim().toUpperCase();

          if (key) {
            map[key] = sector || "Uncategorized";
          }
        });

        setSectorMap(map);
      } catch {
        // non critical enrichment, sectors just fall back to uncategorized
        if (!cancelled) {
          setSectorMap({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCdscSummary = useCallback(
      async (accountId, isRefresh = false) => {
        if (!accountId) {
          return;
        }

        if (isRefresh) {
          setCdscRefreshing(true);
        } else {
          setCdscLoading(true);
          setCdscSummary(null);
        }

        setCdscError(null);

        try {
          const res = await getCdscSummaryApi(accountId);
          setCdscSummary(res.data);
        } catch (error) {
          setCdscError(
              resolveErrorMessage(error, "Could not synchronize CDSC history")
          );
        } finally {
          setCdscLoading(false);
          setCdscRefreshing(false);
        }
      },
      []
  );

  const fetchPortfolio = useCallback(
      async (accountId) => {
        if (!accountId) {
          return;
        }

        setPortfolioLoading(true);
        setPortfolioError(null);

        try {
          const res = await getPortfolioApi(accountId);
          setPortfolio(res?.data || null);
        } catch (error) {
          setPortfolio(null);
          setPortfolioError(
              resolveErrorMessage(error, "Could not load portfolio")
          );
        } finally {
          setPortfolioLoading(false);
        }
      },
      []
  );

  const activeAccountId = activeAccount?.id;

  useEffect(() => {
    if (accountLoading) {
      return;
    }

    if (!activeAccountId) {
      setCdscSummary(null);
      setCdscError(null);
      setPortfolio(null);
      setPortfolioError(null);
      return;
    }

    setCdscExpanded(false);
    setChartMode("portfolio");
    setSearchTerm("");

    fetchCdscSummary(activeAccountId, false);
    fetchPortfolio(activeAccountId);
  }, [
    activeAccountId,
    accountLoading,
    fetchCdscSummary,
    fetchPortfolio
  ]);

  const history = useMemo(() => {
    if (!activeAccount) {
      return [];
    }

    return allHistory.filter(
        (item) =>
            item.accountUsername === activeAccount.username
    );
  }, [allHistory, activeAccount]);

  const recent = useMemo(
      () => history.slice(0, 5),
      [history]
  );

  const successRate = useMemo(() => {
    if (!cdscSummary || !cdscSummary.total) {
      return "0%";
    }

    const decided =
        (cdscSummary.allotted || 0) +
        (cdscSummary.failed || 0);

    if (decided === 0) {
      return "0%";
    }

    return `${Math.round(
        (cdscSummary.allotted / decided) * 100
    )}%`;
  }, [cdscSummary]);

  const notAllottedRate = useMemo(() => {
    if (!cdscSummary || !cdscSummary.total) {
      return "0%";
    }

    const decided =
        (cdscSummary.allotted || 0) +
        (cdscSummary.failed || 0);

    if (decided === 0) {
      return "0%";
    }

    return `${Math.round(
        (cdscSummary.failed / decided) * 100
    )}%`;
  }, [cdscSummary]);

  const filteredCdscItems = useMemo(() => {
    if (!cdscSummary?.items) {
      return [];
    }

    if (!searchTerm.trim()) {
      return cdscSummary.items;
    }

    const term = searchTerm.toLowerCase();

    return cdscSummary.items.filter(
        (item) =>
            item.companyName
                ?.toLowerCase()
                .includes(term) ||
            item.scrip
                ?.toLowerCase()
                .includes(term)
    );
  }, [cdscSummary, searchTerm]);

  const visibleCdscItems =
      isMobile && !cdscExpanded
          ? filteredCdscItems.slice(0, CDSC_MOBILE_LIMIT)
          : filteredCdscItems;

  const statsLoading =
      accountLoading || cdscLoading;

  const localLoading =
      accountLoading || historyLoading;

  // drives the status dot color and label in the merged status strip
  const syncState = cdscError
      ? "error"
      : cdscRefreshing
          ? "syncing"
          : "idle";

  const showAnalyticsCard = Boolean(activeAccount) && !accountLoading;

  return (
      <Layout>
        <SEO
            title="Dashboard"
            description="IPO management overview."
            canonical="/dashboard"
            noindex={true}
        />

        <div className="dash-container">
          <header className="dash-header">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">
                Welcome, <strong>{user?.username}</strong>
              </p>
            </div>

            <div className="dash-header-actions">
              <Link
                  to="/settings/accounts/add"
                  className="btn btn-secondary btn-sm dash-add-account-btn"
                  aria-label="Add Account"
              >
                <IconPlus />
                Add Account
              </Link>

              <Link
                  to="/ipo/apply"
                  className="btn btn-primary btn-sm"
                  aria-label="Apply IPO"
              >
                <IconFile />
                Apply IPO
              </Link>
            </div>
          </header>

          <AccountSwitcher />

          {accountError ? (
              // account list itself failed to load, not the same as zero accounts
              <div className="dash-empty-state is-error">
                <div className="dash-empty-state-icon">
                  <IconAlertCircle />
                </div>

                <h3>Could Not Load Accounts</h3>
                <p>{accountError}</p>

                <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                        refetchAccounts
                            ? refetchAccounts()
                            : window.location.reload()
                    }
                >
                  <IconRefresh />
                  Retry
                </button>
              </div>
          ) : !activeAccount && !accountLoading ? (
              <div className="dash-empty-state">
                <div className="dash-empty-state-icon">
                  <IconLinkConnect />
                </div>

                <h3>Connect Your Meroshare Account</h3>
                <p>
                  Link a Meroshare account to see application status,
                  portfolio value and IPO history in one place.
                </p>

                <Link
                    to="/settings/accounts/add"
                    className="btn btn-primary btn-sm"
                >
                  <IconPlus />
                  Connect Account
                </Link>
              </div>
          ) : (
              <>
                {/* single status strip, dot and copy reflect real state */}
                <div className={`dash-status-bar status-${syncState}`}>
                  <div className="dash-status-row">
                    <div className="dash-status-info">
                      <span className="dash-status-dot" />
                      <span>
                        CDSC Sync:{" "}
                        {cdscError
                            ? "Sync failed"
                            : cdscSummary
                                ? `${fmt(cdscSummary.total)} Records`
                                : "Awaiting Data"}
                      </span>
                    </div>

                    {activeAccount && (
                        <button
                            className="dash-sync-btn"
                            onClick={() =>
                                Promise.all([
                                  fetchCdscSummary(activeAccount.id, true),
                                  fetchPortfolio(activeAccount.id)
                                ])
                            }
                            disabled={
                                cdscLoading ||
                                cdscRefreshing ||
                                portfolioLoading ||
                                accountLoading
                            }
                        >
                          <IconRefresh
                              spinning={cdscRefreshing}
                          />

                          <span>
                            {cdscRefreshing
                                ? "Syncing..."
                                : "Sync"}
                          </span>
                        </button>
                    )}
                  </div>

                  {cdscError && (
                      <div className="dash-status-row dash-status-error-row">
                        <span className="dash-error-text">
                          {cdscError}
                        </span>

                        <button
                            className="dash-retry-btn"
                            onClick={() =>
                                fetchCdscSummary(
                                    activeAccount.id,
                                    false
                                )
                            }
                        >
                          Retry
                        </button>
                      </div>
                  )}
                </div>

                <div className="dash-kpi-grid">
                  <div className="kpi-card">
                    <span className="kpi-label">
                      <span className="kpi-icon" aria-hidden="true">
                        <IconStack />
                      </span>
                      Total Applied
                    </span>

                    {statsLoading ? (
                        <Skeleton h={28} w={60} />
                    ) : (
                        <div className="kpi-value">
                          {fmt(cdscSummary?.total)}
                        </div>
                    )}
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">
                      <span className="kpi-icon" aria-hidden="true">
                        <IconCheck />
                      </span>
                      Allotted
                    </span>

                    {statsLoading ? (
                        <Skeleton h={28} w={60} />
                    ) : (
                        <div className="kpi-value-row">
                          <div className="kpi-value text-success">
                            {fmt(cdscSummary?.allotted)}
                          </div>

                          <span className="kpi-rate">
                            {successRate} Rate
                          </span>
                        </div>
                    )}
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">
                      <span className="kpi-icon" aria-hidden="true">
                        <IconX />
                      </span>
                      Not Allotted
                    </span>

                    {statsLoading ? (
                        <Skeleton h={28} w={60} />
                    ) : (
                        <div className="kpi-value-row">
                          <div className="kpi-value text-danger">
                            {fmt(cdscSummary?.failed)}
                          </div>

                          <span className="kpi-rate kpi-rate-danger">
                            {notAllottedRate} Rate
                          </span>
                        </div>
                    )}
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">
                      <span className="kpi-icon" aria-hidden="true">
                        <IconClock />
                      </span>
                      Pending
                    </span>

                    {statsLoading ? (
                        <Skeleton h={28} w={60} />
                    ) : (
                        <div className="kpi-value text-muted">
                          {fmt(cdscSummary?.notPublished)}
                        </div>
                    )}
                  </div>
                </div>

                {/* card shell always renders once account is active, no
                    layout jump when data or loading state changes */}
                {showAnalyticsCard && (
                    <DashboardCharts
                        isMobile={isMobile}
                        activeAccount={activeAccount}
                        cdscSummary={cdscSummary}
                        cdscLoading={cdscLoading}
                        cdscError={cdscError}
                        portfolio={portfolio}
                        portfolioLoading={portfolioLoading}
                        portfolioError={portfolioError}
                        sectorMap={sectorMap}
                        chartMode={chartMode}
                        setChartMode={setChartMode}
                        fetchCdscSummary={fetchCdscSummary}
                        fetchPortfolio={fetchPortfolio}
                    />
                )}

                <div className="dash-grid">
                  <div className="dash-primary">
                    <div className="dash-section-header">
                      <h3>CDSC Application Log ({fmt(visibleCdscItems.length)})</h3>

                      {cdscSummary?.items?.length > 0 && (
                          <input
                              type="text"
                              placeholder="Search company..."
                              aria-label="Search CDSC application log by company"
                              value={searchTerm}
                              onChange={(event) =>
                                  setSearchTerm(event.target.value)
                              }
                              className="dash-filter-input"
                          />
                      )}
                    </div>

                    <div className="dash-card">
                      {cdscLoading ? (
                          <div className="dash-skeleton-wrapper">
                            {[1, 2, 3, 4].map((key) => (
                                <Skeleton
                                    key={key}
                                    h={36}
                                    style={{
                                      marginBottom: 8
                                    }}
                                />
                            ))}
                          </div>
                      ) : cdscError && !cdscSummary ? (
                          <div className="dash-empty dash-empty-error">
                            <span>Could not load application log</span>
                            <button
                                className="dash-retry-btn"
                                onClick={() =>
                                    fetchCdscSummary(
                                        activeAccount.id,
                                        false
                                    )
                                }
                            >
                              Retry
                            </button>
                          </div>
                      ) : filteredCdscItems.length === 0 ? (
                          <div className="dash-empty">
                            {searchTerm
                                ? "No matching records found"
                                : "No applications recorded yet"}
                          </div>
                      ) : (
                          <>
                            <table className="dash-table">
                              <thead>
                              <tr>
                                <th>Company</th>
                                <th className="hide-mobile">
                                  Type
                                </th>
                                <th className="text-right">
                                  Status
                                </th>
                              </tr>
                              </thead>

                              <tbody>
                              {visibleCdscItems.map(
                                  (item, index) => (
                                      <tr
                                          key={
                                              item.applicantFormId ??
                                              index
                                          }
                                      >
                                        <td>
                                          <span className="cell-title">
                                            {item.companyName}
                                          </span>

                                          {item.scrip && (
                                              <span className="cell-sub">
                                                {item.scrip}
                                              </span>
                                          )}
                                        </td>

                                        <td className="hide-mobile dash-cell-type">
                                          {item.shareTypeName ||
                                              "—"}
                                        </td>

                                        <td className="text-right">
                                          <span
                                              className={`status-pill ${cdscResultBadgeClass(
                                                  item.resultStatus
                                              )}`}
                                          >
                                            {item.resultStatus?.replace(
                                                /_/g,
                                                " "
                                            ) ?? "—"}
                                          </span>
                                        </td>
                                      </tr>
                                  )
                              )}
                              </tbody>
                            </table>

                            {isMobile &&
                                filteredCdscItems.length >
                                CDSC_MOBILE_LIMIT && (
                                    <button
                                        className="dash-expand-btn"
                                        onClick={() =>
                                            setCdscExpanded(
                                                !cdscExpanded
                                            )
                                        }
                                    >
                                      {cdscExpanded
                                          ? "Show Less"
                                          : `Show All (${fmt(filteredCdscItems.length)})`}
                                    </button>
                                )}
                          </>
                      )}
                    </div>
                  </div>

                  <aside className="dash-sidebar">
                    <div className="dash-sidebar-block">
                      <div className="dash-section-header">
                        <h3>Platform Activity ({fmt(recent.length)})</h3>

                        <Link
                            to="/history"
                            className="dash-link"
                        >
                          View All
                        </Link>
                      </div>

                      <div className="dash-card">
                        {localLoading ? (
                            <Skeleton h={80} />
                        ) : historyError ? (
                            <div className="dash-empty dash-empty-error">
                              <span>{historyError}</span>
                              <button
                                  className="dash-retry-btn"
                                  onClick={() =>
                                      setHistoryReloadKey((k) => k + 1)
                                  }
                              >
                                Retry
                              </button>
                            </div>
                        ) : recent.length === 0 ? (
                            <div className="dash-empty">
                              No platform activity recorded
                            </div>
                        ) : (
                            <div className="dash-sidebar-list">
                              {recent.map((item) => {
                                const derived =
                                    deriveStatus(item);

                                return (
                                    <div
                                        key={item.id}
                                        className="sidebar-item"
                                    >
                                      <span className="sidebar-title">
                                        {item.companyName}
                                      </span>

                                      <span
                                          className={`status-tag status-${derived.variant}`}
                                      >
                                        {derived.label}
                                      </span>
                                    </div>
                                );
                              })}
                            </div>
                        )}
                      </div>
                    </div>

                    <div className="dash-sidebar-block">
                      <div className="dash-section-header">
                        <h3>Accounts ({fmt(accounts?.length || 0)})</h3>

                        <Link
                            to="/settings/accounts"
                            className="dash-link"
                        >
                          Manage
                        </Link>
                      </div>

                      <div className="dash-card">
                        <div className="dash-sidebar-list">
                          {(accounts || []).map((account) => (
                              <div
                                  key={account.id}
                                  className={`sidebar-account-row ${
                                      activeAccount?.id ===
                                      account.id
                                          ? "active"
                                          : ""
                                  }`}
                              >
                                <div className="account-avatar">
                                  {account.fullName?.[0]}
                                </div>

                                <div className="account-details">
                                  <span className="account-name">
                                    {account.fullName}
                                  </span>

                                  <span className="account-meta">
                                    {account.username}
                                  </span>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
          )}
        </div>
      </Layout>
  );
};

export default Dashboard;