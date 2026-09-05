import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { getPortfolioApi } from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import AccountSwitcher from "../../components/AccountSwitcher/AccountSwitcher.jsx";
import SEO from "../../seo/SEO.jsx";
import { exportPortfolioCSV, exportPortfolioPDF } from "./portfolioExports.jsx";
import {
    IconBriefcase,
    IconTrendUp,
    IconStack as IconLayers,
    IconRefreshOutline as IconRefresh,
    IconPlus,
    IconArrowUp,
    IconArrowDown,
    IconUser,
    IconDownload,
} from "../../components/Icons.jsx";
import "./Portfolio.css";

const fmt = (n) =>
    typeof n === "number"
        ? n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";

const fmtUnits = (n) =>
    typeof n === "number" ? n.toLocaleString("en-NP") : "—";

const gainClass = (ltp, prev) => {
    if (ltp == null || prev == null) return "";
    return ltp > prev ? "positive" : ltp < prev ? "negative" : "";
};

// generic message shown to the user, never the raw error object
const FALLBACK_ERROR = "Failed to load portfolio. Please try again.";

const getErrorMessage = (e) => {
    const msg = e?.response?.data?.message;
    return typeof msg === "string" && msg.trim() ? msg : FALLBACK_ERROR;
};

// cache helpers, keyed per account
const CACHE_PREFIX = "portfolio_cache_";

const readCache = (id) => {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + id);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.ts !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
};

const writeCache = (id, data) => {
    try {
        localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ data, ts: Date.now() }));
    } catch {
        // storage full or blocked, ignore
    }
};

const timeAgo = (ts) => {
    if (!ts) return "";
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return "1 hour ago";
    return `${hrs} hours ago`;
};

const Skeleton = ({ h = 14, w = "100%", style = {} }) => (
    <div className="skeleton" style={{ height: h, width: w, borderRadius: 4, ...style }} />
);

const Portfolio = () => {
    const { activeAccount, loading: accountLoading } = useAccount();
    const [portfolio, setPortfolio] = useState(null);
    const [portfolioLoading, setPortfolioLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshFailed, setRefreshFailed] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);
    const [sortKey, setSortKey] = useState("script");
    const [sortAsc, setSortAsc] = useState(true);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // tracks which account the latest request belongs to, so a slow
    // response for an account the user has since switched away from
    // is dropped instead of overwriting the current view
    const activeAccountIdRef = useRef(null);
    const exportMenuRef = useRef(null);

    // single fetch path used by both auto load and manual refresh, so
    // there is one place that owns loading state and stale-response checks
    const fetchPortfolio = useCallback(async (id, { background = false } = {}) => {
        if (!id) return;

        if (background) {
            setIsRefreshing(true);
            setRefreshFailed(false);
        } else {
            setPortfolioLoading(true);
            setError(null);
            setRefreshFailed(false);
        }

        try {
            const res = await getPortfolioApi(id);
            if (activeAccountIdRef.current !== id) return;
            const data = res?.data ?? null;
            setPortfolio(data);
            setLastUpdated(Date.now());
            setError(null);
            setRefreshFailed(false);
            writeCache(id, data);
        } catch (e) {
            if (activeAccountIdRef.current !== id) return;
            if (background) {
                // keep showing cached data, just flag that the refresh failed
                setRefreshFailed(true);
            } else {
                setError(getErrorMessage(e));
            }
        } finally {
            if (activeAccountIdRef.current === id) {
                setPortfolioLoading(false);
                setIsRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        if (accountLoading) return;

        const id = activeAccount?.id ?? null;
        activeAccountIdRef.current = id;

        if (!id) {
            setPortfolio(null);
            setError(null);
            setLastUpdated(null);
            setRefreshFailed(false);
            return;
        }

        const cached = readCache(id);
        if (cached) {
            // instant load from cache, then refresh quietly in the background
            setPortfolio(cached.data);
            setLastUpdated(cached.ts);
            setError(null);
            fetchPortfolio(id, { background: true });
        } else {
            setPortfolio(null);
            setLastUpdated(null);
            fetchPortfolio(id, { background: false });
        }
    }, [activeAccount?.id, accountLoading, fetchPortfolio]);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!exportMenuRef.current) return;
            if (!exportMenuRef.current.contains(event.target)) {
                setIsExportMenuOpen(false);
            }
        };

        const handleEsc = (event) => {
            if (event.key === "Escape") {
                setIsExportMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortAsc((prev) => !prev);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const sortedItems = useMemo(() => {
        if (!portfolio?.items) return [];
        return [...portfolio.items].sort((a, b) => {
            let av = a[sortKey] ?? "";
            let bv = b[sortKey] ?? "";
            if (typeof av === "string") av = av.toLowerCase();
            if (typeof bv === "string") bv = bv.toLowerCase();
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [portfolio?.items, sortKey, sortAsc]);

    const totalPnL = portfolio
        ? (portfolio.totalValueLTP ?? 0) - (portfolio.totalValuePrevClose ?? 0)
        : 0;

    const hasHoldings = !!portfolio && sortedItems.length > 0;
    const isBusy = portfolioLoading || isRefreshing;

    const exportCSV = () => {
        exportPortfolioCSV({ items: sortedItems, activeAccount });
    };

    const exportPDF = async () => {
        await exportPortfolioPDF({
            items: sortedItems,
            activeAccount,
            portfolio,
            totalPnL,
            fmt,
            fmtUnits,
        });
    };

    const SortIcon = ({ col }) => {
        if (sortKey !== col) return <span className="sort-icon sort-icon-idle" />;
        return (
            <span className={`sort-icon ${sortAsc ? "sort-asc" : "sort-desc"}`}>
                {sortAsc ? <IconArrowUp /> : <IconArrowDown />}
            </span>
        );
    };

    const cols = [
        { key: "script", label: "Scrip", align: "left" },
        { key: "currentBalance", label: "Units", align: "right" },
        { key: "lastTransactionPrice", label: "LTP", align: "right" },
        { key: "previousClosingPrice", label: "Prev Close", align: "right" },
        { key: "valueAsOfLTP", label: "LTP Value", align: "right" },
        { key: "valueAsOfPrevClose", label: "Prev Value", align: "right" },
    ];

    const showEmpty = !accountLoading && !activeAccount;

    return (
        <Layout>
            <SEO
                title="Portfolio"
                description="View your NEPSE demat holdings, current stock values, and portfolio performance across your Meroshare accounts."
                canonical="/portfolio"
                noindex={true}
            />
            <div className="portfolio-page">
                <div className="portfolio-header">
                    <div>
                        <h1 className="page-title">Portfolio</h1>
                        <p className="page-subtitle portfolio-subtitle" style={{ marginBottom: 0 }}>
                            {activeAccount
                                ? `Demat holdings for ${activeAccount.fullName}`
                                : "Select an account to view holdings"}
                        </p>
                        {activeAccount && lastUpdated && (
                            <p className={`portfolio-updated ${refreshFailed ? "portfolio-updated-warn" : ""}`}>
                                {isRefreshing
                                    ? "Updating…"
                                    : refreshFailed
                                        ? "Couldn't refresh, showing saved data"
                                        : `Updated ${timeAgo(lastUpdated)}`}
                            </p>
                        )}
                    </div>
                    {activeAccount && (
                        <div className="portfolio-toolbar">
                            <div className="portfolio-export-menu" ref={exportMenuRef}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm btn-toolbar btn-export-toggle"
                                    onClick={() => setIsExportMenuOpen((prev) => !prev)}
                                    disabled={!hasHoldings}
                                    aria-label="Export options"
                                    aria-haspopup="menu"
                                    aria-expanded={isExportMenuOpen}
                                >
                                    <IconDownload />
                                    <span className="btn-label">Export</span>
                                    <span className="export-caret" aria-hidden="true" />
                                </button>

                                {isExportMenuOpen && (
                                    <div className="export-dropdown" role="menu" aria-label="Export portfolio">
                                        <button
                                            type="button"
                                            className="export-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                exportCSV();
                                                setIsExportMenuOpen(false);
                                            }}
                                        >
                                            Export as .csv
                                        </button>
                                        <button
                                            type="button"
                                            className="export-dropdown-item"
                                            role="menuitem"
                                            onClick={() => {
                                                exportPDF();
                                                setIsExportMenuOpen(false);
                                            }}
                                        >
                                            Export as .pdf
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-toolbar btn-refresh"
                                onClick={() => fetchPortfolio(activeAccount.id, { background: !!portfolio })}
                                disabled={isBusy}
                                aria-label="Refresh portfolio"
                            >
                                <span className={isBusy ? "spin" : ""}>
                                    <IconRefresh />
                                </span>
                                <span className="btn-label">Refresh</span>
                            </button>
                        </div>
                    )}
                </div>

                {showEmpty ? (
                    <div className="portfolio-empty">
                        <div className="portfolio-empty-icon">
                            <IconUser />
                        </div>
                        <p>No account selected. Add an account to get started.</p>
                        <Link to="/settings/accounts/add" className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
                            <IconPlus /> Add account
                        </Link>
                    </div>
                ) : (
                    <>
                        <AccountSwitcher />

                        {portfolioLoading ? (
                            <div className="summary-grid">
                                {[1, 2, 3].map((k) => (
                                    <div key={k} className="summary-card">
                                        <Skeleton h={10} w={80} style={{ marginBottom: 10 }} />
                                        <Skeleton h={28} w="60%" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            portfolio && (
                                <div className="summary-grid anim-fade-up">
                                    <div className="summary-card">
                                        <p className="summary-label">
                                            <IconLayers /> Total scrips
                                        </p>
                                        <p className="summary-value">{portfolio.totalItems ?? 0}</p>
                                    </div>
                                    <div className="summary-card">
                                        <p className="summary-label">
                                            <IconTrendUp /> Value at LTP
                                        </p>
                                        <p className="summary-value">Rs {fmt(portfolio.totalValueLTP)}</p>
                                    </div>
                                    <div className={`summary-card ${totalPnL >= 0 ? "summary-card-up" : "summary-card-down"}`}>
                                        <p className="summary-label">
                                            {totalPnL >= 0 ? <IconArrowUp /> : <IconArrowDown />}
                                            Day change
                                        </p>
                                        <p className={`summary-value ${totalPnL >= 0 ? "positive" : "negative"}`}>
                                            {totalPnL >= 0 ? "+" : ""}Rs {fmt(Math.abs(totalPnL))}
                                        </p>
                                    </div>
                                </div>
                            )
                        )}

                        {error && !portfolioLoading && (
                            <div className="portfolio-error">
                                <p>{error}</p>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => fetchPortfolio(activeAccount?.id)}
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {!error && !portfolioLoading && portfolio && (
                            <div className="portfolio-table-wrap anim-fade-up" style={{ animationDelay: "0.08s" }}>
                                {sortedItems.length === 0 ? (
                                    <div className="portfolio-empty">
                                        <div className="portfolio-empty-icon">
                                            <IconBriefcase />
                                        </div>
                                        <p>No holdings found in this demat account</p>
                                    </div>
                                ) : (
                                    <div className="table-scroll">
                                        <table className="portfolio-table">
                                            <thead>
                                            <tr>
                                                <th className="col-num">#</th>
                                                {cols.map((col) => (
                                                    <th
                                                        key={col.key}
                                                        className={`col-${col.align} sortable`}
                                                        aria-sort={
                                                            sortKey === col.key
                                                                ? sortAsc
                                                                    ? "ascending"
                                                                    : "descending"
                                                                : "none"
                                                        }
                                                    >
                                                        <button
                                                            type="button"
                                                            className="th-btn"
                                                            onClick={() => handleSort(col.key)}
                                                        >
                                                                <span className="th-inner">
                                                                    {col.label}
                                                                    <SortIcon col={col.key} />
                                                                </span>
                                                        </button>
                                                    </th>
                                                ))}
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {sortedItems.map((item, i) => {
                                                const gc = gainClass(item.lastTransactionPrice, item.previousClosingPrice);
                                                return (
                                                    <tr key={item.script ?? i}>
                                                        <td className="col-num col-dim">{i + 1}</td>
                                                        <td>
                                                            <span className="scrip-code">{item.script}</span>
                                                            {item.scriptDesc && (
                                                                <span className="scrip-desc">{item.scriptDesc}</span>
                                                            )}
                                                        </td>
                                                        <td className="col-right">
                                                            <span className="cell-mono">{fmtUnits(item.currentBalance)}</span>
                                                        </td>
                                                        <td className="col-right">
                                                                <span className={`cell-mono ltp-val ${gc}`}>
                                                                    {fmt(item.lastTransactionPrice)}
                                                                </span>
                                                        </td>
                                                        <td className="col-right">
                                                            <span className="cell-mono col-dim">{fmt(item.previousClosingPrice)}</span>
                                                        </td>
                                                        <td className="col-right">
                                                            <span className="cell-mono">{fmt(item.valueAsOfLTP)}</span>
                                                        </td>
                                                        <td className="col-right">
                                                            <span className="cell-mono col-dim">{fmt(item.valueAsOfPrevClose)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                            <tfoot>
                                            <tr className="tfoot-row">
                                                <td colSpan={5} className="tfoot-label">
                                                    Total
                                                </td>
                                                <td className="col-right tfoot-val">
                                                    Rs {fmt(portfolio.totalValueLTP)}
                                                </td>
                                                <td className="col-right tfoot-val col-dim">
                                                    Rs {fmt(portfolio.totalValuePrevClose)}
                                                </td>
                                            </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {portfolioLoading && (
                            <div className="portfolio-table-wrap">
                                <div className="table-skeleton">
                                    {[1, 2, 3, 4, 5].map((k) => (
                                        <div key={k} className="table-skeleton-row">
                                            <Skeleton h={12} w={28} />
                                            <Skeleton h={12} w="22%" />
                                            <Skeleton h={12} w="10%" />
                                            <Skeleton h={12} w="10%" />
                                            <Skeleton h={12} w="10%" />
                                            <Skeleton h={12} w="14%" />
                                            <Skeleton h={12} w="14%" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default Portfolio;