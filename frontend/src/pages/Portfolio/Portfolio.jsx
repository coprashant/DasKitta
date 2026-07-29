import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getPortfolioApi } from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import AccountSwitcher from "../../components/AccountSwitcher/AccountSwitcher.jsx";
import {
    IconBriefcase,
    IconTrendUp,
    IconStack as IconLayers,
    IconRefreshOutline as IconRefresh,
    IconPlus,
    IconArrowUp,
    IconArrowDown,
    IconUser,
} from "../../components/Icons/Icons.jsx";
import "./Portfolio.css";

const fmt = (n) =>
    typeof n === "number"
        ? n.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";

const fmtUnits = (n) =>
    typeof n === "number" ? n.toLocaleString("en-NP") : "—";

const gainClass = (ltp, prev) => {
    if (!ltp || !prev) return "";
    return ltp > prev ? "positive" : ltp < prev ? "negative" : "";
};

const Skeleton = ({ h = 14, w = "100%", style = {} }) => (
    <div className="skeleton" style={{ height: h, width: w, borderRadius: 4, ...style }} />
);

const Portfolio = () => {
    const { activeAccount, loading: accountLoading } = useAccount();
    const [portfolio, setPortfolio] = useState(null);
    const [portfolioLoading, setPortfolioLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortKey, setSortKey] = useState("script");
    const [sortAsc, setSortAsc] = useState(true);

    const loadPortfolio = useCallback(async (id) => {
        if (!id) return;
        setPortfolioLoading(true);
        setError(null);
        setPortfolio(null);
        try {
            const res = await getPortfolioApi(id);
            setPortfolio(res?.data ?? null);
        } catch (e) {
            setError(e?.response?.data?.message || "Failed to load portfolio. Please try again.");
        } finally {
            setPortfolioLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accountLoading) return;
        if (activeAccount?.id) {
            loadPortfolio(activeAccount.id);
        } else {
            setPortfolio(null);
            setError(null);
        }
    }, [activeAccount?.id, accountLoading, loadPortfolio]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortAsc((p) => !p);
        } else {
            setSortKey(key);
            setSortAsc(true);
        }
    };

    const sortedItems = portfolio?.items
        ? [...portfolio.items].sort((a, b) => {
            let av = a[sortKey] ?? "";
            let bv = b[sortKey] ?? "";
            if (typeof av === "string") av = av.toLowerCase();
            if (typeof bv === "string") bv = bv.toLowerCase();
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        })
        : [];

    const totalPnL = portfolio
        ? portfolio.totalValueLTP - portfolio.totalValuePrevClose
        : 0;

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
            <div className="portfolio-page">

                <div className="portfolio-header">
                    <div>
                        <h1 className="page-title">Portfolio</h1>
                        <p className="page-subtitle" style={{ marginBottom: 0 }}>
                            {activeAccount
                                ? `Demat holdings for ${activeAccount.fullName}`
                                : "Select an account to view holdings"}
                        </p>
                    </div>
                    {activeAccount && (
                        <button
                            className="btn btn-secondary btn-sm btn-refresh"
                            onClick={() => loadPortfolio(activeAccount.id)}
                            disabled={portfolioLoading}
                            aria-label="Refresh portfolio"
                        >
                            <span className={portfolioLoading ? "spin" : ""}><IconRefresh /></span>
                            Refresh
                        </button>
                    )}
                </div>

                {showEmpty ? (
                    <div className="portfolio-empty">
                        <div className="portfolio-empty-icon"><IconUser /></div>
                        <p>No account selected. Add an account to get started.</p>
                        <Link to="/accounts/add" className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
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
                        ) : portfolio && (
                            <div className="summary-grid anim-fade-up">
                                <div className="summary-card">
                                    <p className="summary-label">
                                        <IconLayers /> Total scrips
                                    </p>
                                    <p className="summary-value">{portfolio.totalItems}</p>
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
                        )}

                        {error && !portfolioLoading && (
                            <div className="portfolio-error">
                                <p>{error}</p>
                                <button className="btn btn-secondary btn-sm" onClick={() => loadPortfolio(activeAccount.id)}>
                                    Try again
                                </button>
                            </div>
                        )}

                        {!error && !portfolioLoading && portfolio && (
                            <div className="portfolio-table-wrap anim-fade-up" style={{ animationDelay: "0.08s" }}>
                                {sortedItems.length === 0 ? (
                                    <div className="portfolio-empty">
                                        <div className="portfolio-empty-icon"><IconBriefcase /></div>
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
                                                        onClick={() => handleSort(col.key)}
                                                        aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : "none"}
                                                    >
                              <span className="th-inner">
                                {col.label}
                                  <SortIcon col={col.key} />
                              </span>
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
                                                <td colSpan={5} className="tfoot-label">Total</td>
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