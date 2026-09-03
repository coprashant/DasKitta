import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAccount } from "../../context/AccountContext";
import { getPortfolioApi } from "../../api/accounts";
import { getHistoryApi, getCdscSummaryApi } from "../../api/ipo";
import { getCompanySectors, isNepseError } from "../../api/nepse";
import Layout from "../../components/Layout/Layout.jsx";
import AccountSwitcher from "../../components/AccountSwitcher/AccountSwitcher.jsx";
import SEO from "../../seo/SEO.jsx";
import {
  IconUser,
  IconPlus,
  IconFile,
  IconRefresh,
  IconStack,
  IconCheck,
  IconX,
  IconClock,
  IconChevronDown
} from "../../components/Icons";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import "./Dashboard.css";

const CDSC_MOBILE_LIMIT = 5;
const UNKNOWN_SECTOR = "Uncategorized";
const OTHERS_SECTOR = "Others";

// months visible by default before the user scrolls left for older history
const VISIBLE_MONTHS = 12;
const MIN_MONTH_WIDTH = 46;

// show up to five real sectors and optionally one aggregated others bar
const MAX_ACTUAL_SECTORS = 5;

const numberFormat = new Intl.NumberFormat("en-US");
const fmt = (n) => numberFormat.format(n ?? 0);

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

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const item = payload[0];
  const label =
      item.payload?.label ||
      item.payload?.name ||
      item.payload?.sector ||
      item.name;

  return (
      <div className="dash-custom-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">{fmt(item.value)} Applications</p>
      </div>
  );
};

const TypeOutcomeTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const allotted = payload.find((p) => p.dataKey === "allotted")?.value || 0;
  const notAllotted = payload.find((p) => p.dataKey === "notAllotted")?.value || 0;
  const pending = payload.find((p) => p.dataKey === "pending")?.value || 0;
  const total = allotted + notAllotted + pending;

  return (
      <div className="dash-custom-tooltip">
        <p className="tooltip-label">{label || "Share Type"}</p>
        <p className="tooltip-value">Total: {fmt(total)}</p>
        <p className="tooltip-value">Allotted: {fmt(allotted)}</p>
        <p className="tooltip-value">Not Allotted: {fmt(notAllotted)}</p>
        <p className="tooltip-value">Pending: {fmt(pending)}</p>
      </div>
  );
};

const PortfolioTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const item = payload[0]?.payload;

  return (
      <div className="dash-custom-tooltip">
        <p className="tooltip-label">{item?.name || "Holding"}</p>
        <p className="tooltip-value">Value: Rs {fmt(item?.value || 0)}</p>
        <p className="tooltip-value">Units: {fmt(item?.units || 0)}</p>
      </div>
  );
};

// pie colors read from theme vars so this stays in sync with badges/kpis
const PieChartWidget = ({ pieData, cdscSummary }) => (
    <div className="pie-container">
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie
              data={pieData}
              dataKey="value"
              outerRadius={48}
              innerRadius={30}
              stroke="none"
          >
            {pieData.map((entry) => (
                <Cell key={entry.name} fill={`var(${entry.colorVar})`} />
            ))}
          </Pie>

          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="pie-legend">
        <span>
          <i className="legend-dot legend-dot-success" />
          Allotted ({fmt(cdscSummary?.allotted)})
        </span>

        <span>
          <i className="legend-dot legend-dot-danger" />
          Not Allotted ({fmt(cdscSummary?.failed)})
        </span>

        <span>
          <i className="legend-dot legend-dot-muted" />
          Pending ({fmt(cdscSummary?.notPublished)})
        </span>
      </div>
    </div>
);

const getMonthKey = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonth = (key) => {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
};

const Dashboard = () => {
  const { user } = useAuth();
  const {
    activeAccount,
    accounts,
    loading: accountLoading
  } = useAccount();

  const [allHistory, setAllHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [cdscSummary, setCdscSummary] = useState(null);
  const [cdscLoading, setCdscLoading] = useState(false);
  const [cdscError, setCdscError] = useState(null);
  const [cdscRefreshing, setCdscRefreshing] = useState(false);
  const [cdscExpanded, setCdscExpanded] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [chartMode, setChartMode] = useState("portfolio");
  const [sectorMap, setSectorMap] = useState({});
  const [isMobile, setIsMobile] = useState(() =>
      typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  const chartScrollRef = useRef(null);
  const [chartTrackWidth, setChartTrackWidth] = useState(0);

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

  // tracks visible width of the scroll container so chart fits 12 months
  useEffect(() => {
    const el = chartScrollRef.current;

    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartTrackWidth(entry.contentRect.width);
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setHistoryLoading(true);

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
      } catch {
        if (!cancelled) {
          setAllHistory([]);
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
  }, []);

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
            map[key] = sector || UNKNOWN_SECTOR;
          }
        });

        setSectorMap(map);
      } catch {
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
              error?.response?.data?.message ||
              "Could not synchronize CDSC history"
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

        try {
          const res = await getPortfolioApi(accountId);
          setPortfolio(res?.data || null);
        } catch {
          setPortfolio(null);
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

  useEffect(() => {
    if (!isMobile && chartMode === "pie") {
      setChartMode("portfolio");
    }
  }, [isMobile, chartMode]);

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

  // sectors grouped by real name from company list, others only used when
  // total distinct sectors exceed five
  const sectorData = useMemo(() => {
    if (!cdscSummary?.items?.length) {
      return [];
    }

    const counts = {};

    cdscSummary.items.forEach((item) => {
      const scripKey = (item.scrip || "").trim().toUpperCase();
      const sector = sectorMap[scripKey] || UNKNOWN_SECTOR;
      counts[sector] = (counts[sector] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count);

    if (sorted.length <= MAX_ACTUAL_SECTORS) {
      return sorted;
    }

    const top = sorted.slice(0, MAX_ACTUAL_SECTORS);
    const rest = sorted.slice(MAX_ACTUAL_SECTORS);
    const restTotal = rest.reduce((sum, s) => sum + s.count, 0);

    const othersIndex = top.findIndex((s) => s.sector === OTHERS_SECTOR);

    if (othersIndex >= 0) {
      top[othersIndex] = {
        sector: OTHERS_SECTOR,
        count: top[othersIndex].count + restTotal
      };
    } else {
      top.push({ sector: OTHERS_SECTOR, count: restTotal });
    }

    return top.sort((a, b) => b.count - a.count);
  }, [cdscSummary, sectorMap]);

  const typeOutcomeData = useMemo(() => {
    if (!cdscSummary?.items?.length) {
      return [];
    }

    const map = {};

    cdscSummary.items.forEach((item) => {
      const type = item.shareTypeName || "Ordinary";

      if (!map[type]) {
        map[type] = {
          name: type,
          allotted: 0,
          notAllotted: 0,
          pending: 0,
          total: 0
        };
      }

      if (item.resultStatus === "ALLOTTED") {
        map[type].allotted += 1;
      } else if (item.resultStatus === "NOT_ALLOTTED") {
        map[type].notAllotted += 1;
      } else {
        map[type].pending += 1;
      }

      map[type].total += 1;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [cdscSummary]);

  const portfolioData = useMemo(() => {
    if (!portfolio?.items?.length) {
      return [];
    }

    const items = portfolio.items
        .map((item) => ({
          name: item.script || "Unknown",
          value: Number(item.valueAsOfLTP) || 0,
          units: Number(item.currentBalance) || 0
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

    const top = items.slice(0, 6);
    const rest = items.slice(6);
    const restValue = rest.reduce((sum, item) => sum + item.value, 0);
    const restUnits = rest.reduce((sum, item) => sum + item.units, 0);

    if (restValue > 0) {
      top.push({
        name: "Others",
        value: restValue,
        units: restUnits
      });
    }

    return top;
  }, [portfolio]);

  // full month by month cumulative series, all history included
  // chart scrolls to the latest 12 months by default, older data reachable
  // by scrolling the chart left, kept deliberately off a range toggle so
  // the analytics card does not add yet another control on small screens
  const cumulativeData = useMemo(() => {
    const items = cdscSummary?.items || [];
    const months = {};

    items.forEach((item) => {
      const key = getMonthKey(item.appliedDate);

      if (key) {
        months[key] = (months[key] || 0) + 1;
      }
    });

    const keys = Object.keys(months).sort();

    if (!keys.length) {
      return [];
    }

    const start = new Date(
        Number(keys[0].split("-")[0]),
        Number(keys[0].split("-")[1]) - 1,
        1
    );

    const end = new Date(
        Number(keys[keys.length - 1].split("-")[0]),
        Number(keys[keys.length - 1].split("-")[1]) - 1,
        1
    );

    const result = [];
    let runningTotal = 0;

    const cursor = new Date(start);

    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
      ).padStart(2, "0")}`;

      const count = months[key] || 0;

      runningTotal += count;

      result.push({
        key,
        label: formatMonth(key),
        applications: runningTotal,
        monthly: count
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }, [cdscSummary]);

  const cumulativeCount = cumulativeData.length
      ? cumulativeData[cumulativeData.length - 1].applications
      : 0;

  const unknownAppliedDateCount = Math.max(
      0,
      (cdscSummary?.total || 0) - cumulativeCount
  );

  // chart width fixed in px so track can be wider than container and
  // scrolled, default view fits exactly 12 months
  const monthWidth = Math.max(
      MIN_MONTH_WIDTH,
      chartTrackWidth ? chartTrackWidth / VISIBLE_MONTHS : MIN_MONTH_WIDTH
  );

  const cumulativeChartWidth = Math.max(
      chartTrackWidth,
      monthWidth * cumulativeData.length
  );

  // scroll to the most recent month whenever data or track size changes
  useEffect(() => {
    if (chartMode !== "cumulative") {
      return;
    }

    const el = chartScrollRef.current;

    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [cumulativeData, chartTrackWidth, chartMode]);

  const pieData = useMemo(
      () =>
          cdscSummary
              ? [
                {
                  name: "Allotted",
                  value: cdscSummary.allotted || 0,
                  colorVar: "--success"
                },
                {
                  name: "Not Allotted",
                  value: cdscSummary.failed || 0,
                  colorVar: "--danger"
                },
                {
                  name: "Pending",
                  value: cdscSummary.notPublished || 0,
                  colorVar: "--text-3"
                }
              ]
              : [],
      [cdscSummary]
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
  const hasAnalyticsData = cdscSummary && cdscSummary.total > 0;
  const hasPortfolioData = portfolioData.length > 0;
  const isPortfolioMode = chartMode === "portfolio";
  const analyticsLoading = isPortfolioMode ? portfolioLoading : cdscLoading;
  const hasActiveChartData = isPortfolioMode ? hasPortfolioData : hasAnalyticsData;

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

          {!activeAccount && !accountLoading ? (
              <div className="dash-no-account">
                <IconUser />

                <div>
                  <h3>No Account Selected</h3>
                  <p>
                    Connect or select a Meroshare account to
                    pull application telemetry.
                  </p>
                </div>

                <Link
                    to="/accounts/add"
                    className="btn btn-primary btn-sm"
                >
                  Connect
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
                    <div className="dash-card dash-analytics">
                      <div className="dash-card-header">
                        <div>
                          <h2 className="dash-card-title">
                            Application Analytics
                          </h2>

                          <p className="dash-card-subtitle">
                            Track your IPO application history
                          </p>
                        </div>

                        {isMobile ? (
                            <div className="dash-chart-select-wrap">
                              <div className="dash-chart-select-control">
                                <select
                                    id="chart-mode-select"
                                    className="dash-chart-select"
                                    value={chartMode}
                                    onChange={(event) => setChartMode(event.target.value)}
                                >
                                  <option value="portfolio">Portfolio</option>
                                  <option value="cumulative">Cumulative</option>
                                  <option value="sector">Sectors</option>
                                  <option value="type">Type</option>
                                  <option value="pie">Results</option>
                                </select>

                                <span className="dash-chart-select-icon" aria-hidden="true">
                                  <IconChevronDown />
                                </span>
                              </div>
                            </div>
                        ) : (
                            <div className="dash-toggle-scroll">
                              <div className="dash-toggle-group">
                                <button
                                    className={
                                      chartMode === "portfolio"
                                          ? "active"
                                          : ""
                                    }
                                    onClick={() =>
                                        setChartMode("portfolio")
                                    }
                                >
                                  Portfolio
                                </button>

                                <button
                                    className={
                                      chartMode === "cumulative"
                                          ? "active"
                                          : ""
                                    }
                                    onClick={() =>
                                        setChartMode("cumulative")
                                    }
                                >
                                  Cumulative
                                </button>

                                <button
                                    className={
                                      chartMode === "sector"
                                          ? "active"
                                          : ""
                                    }
                                    onClick={() =>
                                        setChartMode("sector")
                                    }
                                >
                                  Sectors
                                </button>

                                <button
                                    className={
                                      chartMode === "type"
                                          ? "active"
                                          : ""
                                    }
                                    onClick={() =>
                                        setChartMode("type")
                                    }
                                >
                                  Type
                                </button>
                              </div>
                            </div>
                        )}
                      </div>

                      {analyticsLoading ? (
                          <div className="dash-multi-chart-wrapper">
                            <Skeleton h={230} style={{ borderRadius: 10 }} />
                            <Skeleton h={230} style={{ borderRadius: 10 }} />
                          </div>
                      ) : !hasActiveChartData ? (
                          <div className="dash-empty dash-empty-tall">
                            {isPortfolioMode ? "No portfolio data yet" : "No application data yet"}
                          </div>
                      ) : (
                          <div
                              className={`dash-multi-chart-wrapper ${isMobile ? "mobile" : ""} ${!isMobile && !hasAnalyticsData ? "single" : ""}`}
                          >
                            <div className="dash-primary-chart">
                              {chartMode === "portfolio" && (
                                  <ResponsiveContainer
                                      width="100%"
                                      height={230}
                                  >
                                    <BarChart
                                        data={portfolioData}
                                        margin={{
                                          top: 10,
                                          right: 8,
                                          left: -18,
                                          bottom: 0
                                        }}
                                    >
                                      <XAxis
                                          dataKey="name"
                                          axisLine={false}
                                          tickLine={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 10
                                          }}
                                          interval={0}
                                          angle={-25}
                                          textAnchor="end"
                                          height={52}
                                      />

                                      <YAxis
                                          axisLine={false}
                                          tickLine={false}
                                          allowDecimals={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 11
                                          }}
                                      />

                                      <Tooltip
                                          content={<PortfolioTooltip />}
                                          cursor={{
                                            fill: "rgba(255,255,255,0.025)"
                                          }}
                                      />

                                      <Bar
                                          dataKey="value"
                                          fill="var(--accent)"
                                          radius={[4, 4, 0, 0]}
                                          barSize={24}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                              )}

                              {chartMode === "type" && (
                                  <ResponsiveContainer
                                      width="100%"
                                      height={230}
                                  >
                                    <BarChart
                                        data={typeOutcomeData}
                                        margin={{
                                          top: 10,
                                          right: 8,
                                          left: -18,
                                          bottom: 0
                                        }}
                                    >
                                      <XAxis
                                          dataKey="name"
                                          axisLine={false}
                                          tickLine={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 10
                                          }}
                                          interval={0}
                                          angle={-25}
                                          textAnchor="end"
                                          height={52}
                                      />

                                      <YAxis
                                          axisLine={false}
                                          tickLine={false}
                                          allowDecimals={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 11
                                          }}
                                      />

                                      <Tooltip
                                          content={<TypeOutcomeTooltip />}
                                          cursor={{
                                            fill: "rgba(255,255,255,0.025)"
                                          }}
                                      />

                                      <Bar
                                          dataKey="allotted"
                                          stackId="outcome"
                                          fill="var(--success)"
                                          radius={[4, 4, 0, 0]}
                                      />

                                      <Bar
                                          dataKey="notAllotted"
                                          stackId="outcome"
                                          fill="var(--danger)"
                                      />

                                      <Bar
                                          dataKey="pending"
                                          stackId="outcome"
                                          fill="var(--text-3)"
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                              )}

                              {chartMode === "cumulative" && (
                                  <div className="dash-chart-view">
                                    <div className="dash-chart-meta">
                                      <div>
                                        <span className="dash-chart-value">
                                          {fmt(cumulativeCount)}
                                        </span>

                                        <span className="dash-chart-label">
                                          {unknownAppliedDateCount > 0
                                              ? `${fmt(unknownAppliedDateCount)} applications have unknown applied date`
                                              : cumulativeData.length <= 1
                                                  ? "Only one month available so trend line is minimal"
                                                  : "Applications over time, scroll for full history"}
                                        </span>
                                      </div>
                                    </div>

                                    <div
                                        className="dash-chart-scroll"
                                        ref={chartScrollRef}
                                    >
                                      {/* fixed width track, responsivecontainer fills it */}
                                      <div style={{ width: cumulativeChartWidth || "100%", height: 230 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <LineChart
                                              data={cumulativeData}
                                              margin={{
                                                top: 10,
                                                right: 12,
                                                left: -18,
                                                bottom: 0
                                              }}
                                          >
                                            <CartesianGrid
                                                stroke="var(--border)"
                                                strokeDasharray="3 3"
                                                vertical={false}
                                            />

                                            <XAxis
                                                dataKey="label"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{
                                                  fill: "var(--text-2)",
                                                  fontSize: 11
                                                }}
                                                interval={0}
                                            />

                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                                tick={{
                                                  fill: "var(--text-2)",
                                                  fontSize: 11
                                                }}
                                            />

                                            <Tooltip
                                                content={
                                                  <CustomTooltip />
                                                }
                                            />

                                            <Line
                                                type="monotone"
                                                dataKey="applications"
                                                stroke="var(--accent)"
                                                strokeWidth={2.5}
                                                dot={{
                                                  r: cumulativeData.length <= 1 ? 6 : 3,
                                                  fill: "var(--accent)",
                                                  strokeWidth: 0
                                                }}
                                                activeDot={{
                                                  r: cumulativeData.length <= 1 ? 8 : 5
                                                }}
                                            />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                  </div>
                              )}

                              {/* vertical bars to maximize horizontal space for sector labels */}
                              {chartMode === "sector" && (
                                  <ResponsiveContainer
                                      width="100%"
                                      height={230}
                                  >
                                    <BarChart
                                        data={sectorData}
                                        margin={{
                                          top: 10,
                                          right: 8,
                                          left: -18,
                                          bottom: 0
                                        }}
                                    >
                                      <XAxis
                                          dataKey="sector"
                                          axisLine={false}
                                          tickLine={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 10
                                          }}
                                          interval={0}
                                          angle={-20}
                                          textAnchor="end"
                                          height={52}
                                      />

                                      <YAxis
                                          axisLine={false}
                                          tickLine={false}
                                          allowDecimals={false}
                                          tick={{
                                            fill: "var(--text-2)",
                                            fontSize: 11
                                          }}
                                      />

                                      <Tooltip
                                          content={
                                            <CustomTooltip />
                                          }
                                          cursor={{
                                            fill: "rgba(255,255,255,0.025)"
                                          }}
                                      />

                                      <Bar
                                          dataKey="count"
                                          fill="var(--accent)"
                                          radius={[4, 4, 0, 0]}
                                          barSize={24}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                              )}

                              {isMobile && chartMode === "pie" && (
                                  <div className="dash-mobile-pie-panel">
                                    <PieChartWidget
                                        pieData={pieData}
                                        cdscSummary={cdscSummary}
                                    />
                                  </div>
                              )}
                            </div>

                            {!isMobile && hasAnalyticsData && (
                                <div className="dash-fixed-pie-panel">
                                  <PieChartWidget
                                      pieData={pieData}
                                      cdscSummary={cdscSummary}
                                  />
                                </div>
                            )}
                          </div>
                      )}
                    </div>
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
                          {accounts.map((account) => (
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