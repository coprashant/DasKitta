import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown } from "../../components/Icons";
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

// holds all chart data prep and rendering for the analytics card
const DashboardCharts = ({
                             isMobile,
                             activeAccount,
                             cdscSummary,
                             cdscLoading,
                             cdscError,
                             portfolio,
                             portfolioLoading,
                             portfolioError,
                             sectorMap,
                             chartMode,
                             setChartMode,
                             fetchCdscSummary,
                             fetchPortfolio
                         }) => {
    const chartScrollRef = useRef(null);
    const [chartTrackWidth, setChartTrackWidth] = useState(0);

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

    // pie mode is mobile only, fall back if screen grows past that
    useEffect(() => {
        if (!isMobile && chartMode === "pie") {
            setChartMode("portfolio");
        }
    }, [isMobile, chartMode, setChartMode]);

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

    const hasAnalyticsData = cdscSummary && cdscSummary.total > 0;
    const hasPortfolioData = portfolioData.length > 0;
    const isPortfolioMode = chartMode === "portfolio";
    const analyticsLoading = isPortfolioMode ? portfolioLoading : cdscLoading;
    const hasActiveChartData = isPortfolioMode ? hasPortfolioData : hasAnalyticsData;

    // only surface a chart level error if there is no cached data to fall
    // back on, same rule the log table below already follows
    const chartError = isPortfolioMode
        ? (portfolioError && !hasPortfolioData ? portfolioError : null)
        : (cdscError && !hasAnalyticsData ? cdscError : null);

    const retryActiveChart = () => {
        if (!activeAccount) {
            return;
        }

        if (isPortfolioMode) {
            fetchPortfolio(activeAccount.id);
        } else {
            fetchCdscSummary(activeAccount.id, false);
        }
    };

    return (
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
            ) : chartError ? (
                <div className="dash-empty dash-empty-tall dash-empty-error">
                    <span>{chartError}</span>
                    <button
                        className="dash-retry-btn"
                        onClick={retryActiveChart}
                    >
                        Retry
                    </button>
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
    );
};

export default DashboardCharts;