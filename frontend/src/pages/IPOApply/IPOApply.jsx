import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAccountsApi } from "../../api/accounts";
import {
    cancelApplyJobApi,
    getOpenIposApi,
    getApplyJobSnapshotApi,
    retryFailedApplyJobApi,
    startApplyJobApi,
    streamApplyJobApi,
} from "../../api/ipo";
import {
    CheckIcon,
    ChevronIcon,
    ClearIcon,
    MinusIcon,
    PlusIcon,
    SearchIcon,
    SpinnerIcon,
} from "../../components/Icons";
import Layout from "../../components/Layout/Layout.jsx";
import toast from "react-hot-toast";
import ipoData from "../../ipo_data.json";
import { bsToAd, nowNepal } from "../../dateUtils";
import SEO from "../../seo/SEO.jsx";
import BulkApplyProgress from "../../components/BulkApplyProgress/BulkApplyProgress.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import "./IPOApply.css";

const STATUS_BADGE_MAP = {
    SUCCESS: "badge-success",
    FAILED: "badge-danger",
    CANCELLED: "badge-warning",
    APPLYING: "badge-warning",
    ALREADY_APPLIED: "badge-danger",
    PENDING: "badge-muted",
};

const ACTIVE_APPLY_JOB_KEY = "ipo_apply_active_job";

const statusBadge = (s) => STATUS_BADGE_MAP[s] || "badge-muted";

const resolveErrorMessage = (error, fallback) => {
    if (!error?.response) {
        return "No internet connection. Check your network and try again.";
    }

    const status = error.response.status;
    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have permission to perform this action.";
    if (status === 409) return "This application cannot be submitted in its current state.";
    if (status === 422) return "Some application details are invalid. Check your selections and try again.";
    if (status === 429) return "Too many requests. Please wait and try again.";
    if (status >= 500) return "The service is temporarily unavailable. Please try again.";
    return fallback;
};

const msToDhm = (ms) => {
    const totalMins = Math.floor(ms / 60000);
    return {
        days: Math.floor(totalMins / 1440),
        hrs: Math.floor((totalMins % 1440) / 60),
        mins: totalMins % 60,
    };
};

const getClosingCountdown = (closeDateBs) => {
    if (!closeDateBs) return null;
    try {
        const targetDate = bsToAd(closeDateBs);
        if (!targetDate) return null;
        const diff = targetDate - nowNepal();
        if (diff <= 0) return null;

        const { days, hrs, mins } = msToDhm(diff);
        if (days > 0) return `${days}d`;
        if (hrs > 0) return `${hrs}h`;
        if (mins > 0) return `${mins}m`;
        return null;
    } catch {
        return null;
    }
};

const getOpeningCountdown = (openDateBs) => {
    if (!openDateBs) return null;
    try {
        const targetDate = bsToAd(openDateBs);
        if (!targetDate) return "Opens today";
        const diff = targetDate - nowNepal();
        if (diff <= 0) return "Opens today";

        const { days, hrs, mins } = msToDhm(diff);
        if (days > 0) return `in ${days}d`;
        if (hrs > 0) return `in ${hrs}h`;
        if (mins > 0) return `in ${mins}m`;
        return "soon";
    } catch {
        return null;
    }
};

const formatBsDate = (bsDateStr) => {
    if (!bsDateStr) return "";
    const months = [
        "Baisakh", "Jestha", "Ashadh", "Shrawan",
        "Bhadra", "Ashwin", "Kartik", "Mangsir",
        "Poush", "Magh", "Falgun", "Chaitra",
    ];
    try {
        const parts = bsDateStr.split("-").map(Number);
        if (parts.length < 3 || isNaN(parts[1]) || isNaN(parts[2])) return bsDateStr;
        const m = parts[1];
        const d = parts[2];
        return months[m - 1] ? `${months[m - 1]} ${d}` : bsDateStr;
    } catch {
        return bsDateStr;
    }
};

const categorizeIpo = (ipo) => {
    if (!ipo || typeof ipo !== "object") return "Other Offerings";

    const shareTypeName = (ipo.shareTypeName || "").toLowerCase();
    const companyName = (ipo.companyName || "").toLowerCase();
    const shareType = (ipo.shareType || "").toLowerCase();
    const scrip = (ipo.scrip || "").toLowerCase();

    const text = `${shareTypeName} ${companyName} ${shareType} ${scrip}`;

    if (text.includes("foreign") || text.includes("migrant") || text.includes("feq") || text.includes("remittance")) {
        return "Foreign Employment Quota";
    }
    if (text.includes("local") || text.includes("project affected") || text.includes("affected residents")) {
        return "Project Affected Locals";
    }
    if (text.includes("staff") || text.includes("employee") || text.includes("institutional") || text.includes("qib")) {
        return "Employees & Reserved Quota";
    }
    if (text.includes("mutual fund") || text.includes("scheme") || text.includes("yojana") || text.includes("unit")) {
        return "Mutual Funds";
    }
    if (text.includes("debenture") || text.includes("bond") || text.includes("%")) {
        return "Debentures & Bonds";
    }
    if (text.includes("right")) {
        return "Right Shares";
    }
    if (text.includes("ordinary") || text.includes("ipo") || text.includes("general public") || shareTypeName.includes("ordinary")) {
        return "Ordinary Shares";
    }

    return "Other Offerings";
};

const safeIpoData = Array.isArray(ipoData) ? ipoData : [];

const upcomingIpos = safeIpoData
    .filter((d) => {
        if (!d || d.status !== "upcoming" || !d.openDate) return false;
        try {
            const openAd = bsToAd(d.openDate);
            return openAd ? openAd > nowNepal() : false;
        } catch {
            return false;
        }
    })
    .sort((a, b) => {
        try {
            const aAd = bsToAd(a.openDate) || 0;
            const bAd = bsToAd(b.openDate) || 0;
            return aAd - bAd;
        } catch {
            return 0;
        }
    });

const closingMap = safeIpoData.reduce((acc, d) => {
    if (d && d.status === "open" && d.closeDate && d.companyShareId) {
        acc[d.companyShareId] = d.closeDate;
    }
    return acc;
}, {});

const IPOApply = () => {
    const { refresh: refreshNotifications } = useNotifications();
    const [ipos, setIpos] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedIpo, setSelectedIpo] = useState(null);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [kitta, setKitta] = useState(10);
    const [kittaInput, setKittaInput] = useState("10");
    const [, setCountdownTick] = useState(0);
    const [retryingIpos, setRetryingIpos] = useState(false);
    const [retryingAccounts, setRetryingAccounts] = useState(false);
    const [accountsLoaded, setAccountsLoaded] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [ipoError, setIpoError] = useState(null);
    const [accountsError, setAccountsError] = useState(null);
    const [applying, setApplying] = useState(false);
    const [results, setResults] = useState([]);
    const [progressOpen, setProgressOpen] = useState(false);
    const [progressDone, setProgressDone] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [activeJobId, setActiveJobId] = useState(null);
    const [progressSummary, setProgressSummary] = useState({
        totalCount: 0,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        pendingCount: 0,
    });
    const [showOthers, setShowOthers] = useState(false);
    const [accountSearch, setAccountSearch] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef(null);
    const progressSeqRef = useRef(0);
    const applyingRef = useRef(false);
    const activeJobRef = useRef(null);
    const streamAbortRef = useRef(null);
    const mountedRef = useRef(false);

    const hydrateSnapshot = useCallback(async (jobId) => {
        const snapRes = await getApplyJobSnapshotApi(jobId);
        const snap = snapRes?.data || {};
        const rows = Array.isArray(snap.accounts) ? snap.accounts : [];

        setResults(rows.map((r) => ({
            accountId: r.accountId,
            username: r.username || "",
            fullName: r.fullName || "",
            status: r.status || "PENDING",
            message: r.message || "",
        })));

        setProgressSummary({
            totalCount: Number(snap.totalCount || rows.length || 0),
            processedCount: Number(snap.processedCount || 0),
            successCount: Number(snap.successCount || 0),
            failedCount: Number(snap.failedCount || 0),
            cancelledCount: Number(snap.cancelledCount || 0),
            pendingCount: Number(snap.pendingCount || 0),
        });

        progressSeqRef.current = Number(snap.lastSequence || 0);
        setProgressDone(Boolean(snap.completed));
        if (snap.completed) {
            setApplying(false);
            applyingRef.current = false;
            localStorage.removeItem(ACTIVE_APPLY_JOB_KEY);
        }
        return snap;
    }, []);

    const processProgressEvent = useCallback((jobId, data) => {
        if (!data || activeJobRef.current !== jobId) return;

        const sequence = Number(data.sequence || 0);
        if (sequence > 0 && sequence <= progressSeqRef.current) return;
        if (sequence > 0) progressSeqRef.current = sequence;

        setProgressSummary((prev) => ({
            totalCount: Number(data.totalCount ?? prev.totalCount),
            processedCount: Number(data.processedCount ?? prev.processedCount),
            successCount: Number(data.successCount ?? prev.successCount),
            failedCount: Number(data.failedCount ?? prev.failedCount),
            cancelledCount: Number(data.cancelledCount ?? prev.cancelledCount),
            pendingCount: Number(data.pendingCount ?? prev.pendingCount),
        }));

        if (data.eventType === "job_completed" || data.eventType === "job_cancelled") {
            setProgressDone(true);
            setApplying(false);
            setCancelling(false);
            applyingRef.current = false;
            localStorage.removeItem(ACTIVE_APPLY_JOB_KEY);
            refreshNotifications();
        }

        if (data.accountId == null) return;

        const accountId = data.accountId;
        const status =
            data.status ||
            (data.eventType === "account_applying"
                ? "APPLYING"
                : data.eventType === "account_success"
                    ? "SUCCESS"
                    : data.eventType === "account_cancelled"
                        ? "CANCELLED"
                        : "FAILED");

        setResults((prev) => {
            const ix = prev.findIndex((row) => String(row.accountId) === String(accountId));
            const nextRow = {
                accountId,
                username: data.username || prev[ix]?.username || "",
                fullName: data.fullName || prev[ix]?.fullName || "",
                status,
                message: data.message || (status === "APPLYING" ? "Applying" : ""),
            };

            if (ix === -1) return [...prev, nextRow];
            const copy = [...prev];
            copy[ix] = nextRow;
            return copy;
        });
    }, [refreshNotifications]);

    const attachJobStream = useCallback(async (jobId, fromSequence = 0, retryCount = 0) => {
        if (!mountedRef.current || activeJobRef.current !== jobId) return;

        streamAbortRef.current?.abort();
        const controller = new AbortController();
        streamAbortRef.current = controller;

        await streamApplyJobApi(
            jobId,
            fromSequence,
            ({ data }) => processProgressEvent(jobId, data),
            async () => {
                if (!mountedRef.current || activeJobRef.current !== jobId) return;

                const snap = await hydrateSnapshot(jobId);
                if (!mountedRef.current || activeJobRef.current !== jobId) return;

                setReconnecting(false);
                if (snap?.completed) {
                    localStorage.removeItem(ACTIVE_APPLY_JOB_KEY);
                    if (Number(snap.successCount || 0) > 0) {
                        toast.success(`Applied for ${Number(snap.successCount)} account(s)`);
                    }
                    if (Number(snap.failedCount || 0) > 0) {
                        toast.error(`${Number(snap.failedCount)} account(s) failed`);
                    }
                    if (Number(snap.cancelledCount || 0) > 0) {
                        toast("Remaining accounts cancelled");
                    }
                    refreshNotifications();
                }
            },
            async (err) => {
                if (!mountedRef.current || !applyingRef.current || activeJobRef.current !== jobId) {
                    return;
                }

                try {
                    setReconnecting(true);
                    const snap = await hydrateSnapshot(jobId);
                    if (!mountedRef.current || activeJobRef.current !== jobId) return;

                    if (snap?.completed) {
                        setReconnecting(false);
                        return;
                    }

                    if (retryCount < 2) {
                        await attachJobStream(jobId, Number(snap.lastSequence || 0), retryCount + 1);
                        return;
                    }
                } catch {
                    if (!mountedRef.current || activeJobRef.current !== jobId) return;
                }

                if (!mountedRef.current || activeJobRef.current !== jobId) return;
                setReconnecting(false);
                setApplying(false);
                applyingRef.current = false;
                toast.error("Connection to application progress was lost. The application may still be processing.");
            },
            controller.signal
        );
    }, [hydrateSnapshot, processProgressEvent, refreshNotifications]);

    useEffect(() => {
        applyingRef.current = applying;
    }, [applying]);

    useEffect(() => {
        activeJobRef.current = activeJobId;
        if (activeJobId) {
            localStorage.setItem(ACTIVE_APPLY_JOB_KEY, activeJobId);
        } else {
            localStorage.removeItem(ACTIVE_APPLY_JOB_KEY);
        }
    }, [activeJobId]);


    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            streamAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const stored = localStorage.getItem(ACTIVE_APPLY_JOB_KEY);
        if (!stored) return undefined;

        const resume = async () => {
            try {
                setActiveJobId(stored);
                activeJobRef.current = stored;
                const snap = await hydrateSnapshot(stored);
                if (!isMounted) return;
                if (!snap?.completed) {
                    setApplying(true);
                    applyingRef.current = true;
                    setProgressOpen(true);
                    await attachJobStream(stored, Number(snap.lastSequence || 0), 0);
                }
            } catch {
                if (isMounted) {
                    localStorage.removeItem(ACTIVE_APPLY_JOB_KEY);
                    setActiveJobId(null);
                }
            }
        };

        resume();
        return () => {
            isMounted = false;
        };
    }, [attachJobStream, hydrateSnapshot]);

    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState !== "visible" || !activeJobRef.current || !applyingRef.current) return;
            const jobId = activeJobRef.current;
            try {
                const snap = await hydrateSnapshot(jobId);
                if (!snap?.completed && activeJobRef.current === jobId) {
                    setReconnecting(true);
                    await attachJobStream(jobId, Number(snap.lastSequence || 0), 0);
                }
            } catch {
                setReconnecting(true);
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [attachJobStream, hydrateSnapshot]);

    useEffect(() => {
        const id = window.setInterval(() => setCountdownTick((v) => v + 1), 30000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        if (!confirmOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setConfirmOpen(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [confirmOpen]);

    const fetchIpos = useCallback(async () => {
        setIpoError(null);
        try {
            const res = await getOpenIposApi();
            if (!mountedRef.current) return;
            setIpos(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            if (!mountedRef.current) return;
            const message = resolveErrorMessage(err, "Failed to load open IPOs");
            setIpoError(message);
            toast.error(message);
        }
    }, []);

    const fetchAccounts = useCallback(async () => {
        setAccountsError(null);
        try {
            const res = await getAccountsApi();
            if (!mountedRef.current) return;
            setAccounts(Array.isArray(res?.data) ? res.data : []);
            setAccountsLoaded(true);
        } catch (err) {
            if (!mountedRef.current) return;
            const message = resolveErrorMessage(err, "Failed to load accounts");
            setAccountsError(message);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        await Promise.allSettled([fetchIpos(), fetchAccounts()]);
        if (mountedRef.current) setLoading(false);
    }, [fetchAccounts, fetchIpos]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!accountsLoaded) return;
        const validIds = new Set(accounts.map((a) => a.id));
        setSelectedAccounts((prev) => prev.filter((id) => validIds.has(id)));
    }, [accounts, accountsLoaded]);

    const filteredAccounts = useMemo(() => {
        const q = accountSearch.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter(
            (a) =>
                a?.fullName?.toLowerCase().includes(q) ||
                a?.username?.toLowerCase().includes(q)
        );
    }, [accounts, accountSearch]);

    const groupedIpos = useMemo(() => {
        if (!Array.isArray(ipos)) return {};

        return ipos.reduce((acc, ipo) => {
            if (!ipo || typeof ipo !== "object") return acc;
            const cat = categorizeIpo(ipo);
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(ipo);
            return acc;
        }, {});
    }, [ipos]);

    const toggleAccount = useCallback((id) => {
        setSelectedAccounts((p) =>
            p.includes(id) ? p.filter((a) => a !== id) : [...p, id]
        );
    }, []);

    const selectAll = useCallback(() => {
        const visibleIds = filteredAccounts.map((a) => a.id);
        const allVisible =
            visibleIds.length > 0 &&
            visibleIds.every((id) => selectedAccounts.includes(id));

        if (allVisible) {
            setSelectedAccounts((p) => p.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedAccounts((p) => [...new Set([...p, ...visibleIds])]);
        }
    }, [filteredAccounts, selectedAccounts]);

    const allVisibleSelected = useMemo(() => {
        return (
            filteredAccounts.length > 0 &&
            filteredAccounts.every((a) => selectedAccounts.includes(a.id))
        );
    }, [filteredAccounts, selectedAccounts]);

    const handleSelectIpo = useCallback((ipo) => {
        setSelectedIpo(ipo);
        setResults([]);
    }, []);

    const openSearch = useCallback(() => {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);

    const closeSearch = useCallback(() => {
        setSearchOpen(false);
        setAccountSearch("");
    }, []);

    const submitApply = useCallback(async () => {
        if (!mountedRef.current || applyingRef.current) return;

        const normalizedKitta = Number(kitta);
        if (!Number.isInteger(normalizedKitta) || normalizedKitta < 10) {
            setKitta(10);
            setKittaInput("10");
            toast.error("Minimum kitta is 10");
            return;
        }

        if (!selectedIpo || !selectedAccounts.length) return;

        setConfirmOpen(false);
        setApplying(true);
        applyingRef.current = true;
        setReconnecting(false);
        setCancelling(false);
        setProgressDone(false);
        setProgressOpen(true);
        progressSeqRef.current = 0;

        const seeded = selectedAccounts.map((id) => {
            const account = accounts.find((a) => a.id === id);
            return {
                accountId: id,
                username: account?.username || "",
                fullName: account?.fullName || "",
                status: "PENDING",
                message: "Queued",
            };
        });

        setResults(seeded);
        setProgressSummary({
            totalCount: selectedAccounts.length,
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            cancelledCount: 0,
            pendingCount: selectedAccounts.length,
        });

        try {
            const start = await startApplyJobApi({
                shareId: String(selectedIpo.companyShareId),
                companyName: selectedIpo.companyName || selectedIpo.scrip || "Unknown",
                kitta: normalizedKitta,
                accountIds: selectedAccounts,
            });
            const jobId = start?.data?.jobId;
            if (!jobId) throw new Error("Could not start apply job");
            if (!mountedRef.current) return;

            setActiveJobId(jobId);
            activeJobRef.current = jobId;
            await attachJobStream(jobId, 0, 0);
        } catch (err) {
            if (!mountedRef.current) return;
            toast.error(resolveErrorMessage(err, "Apply failed"));
            setProgressDone(true);
            setApplying(false);
            setCancelling(false);
            applyingRef.current = false;
            setActiveJobId(null);
            activeJobRef.current = null;
        }
    }, [selectedIpo, selectedAccounts, kitta, accounts, attachJobStream]);

    const handleApply = useCallback(() => {
        const normalizedKitta = Number(kitta);
        if (!selectedIpo) {
            toast.error("Select an IPO first");
            return;
        }
        if (!selectedAccounts.length) {
            toast.error("Select at least one account");
            return;
        }
        if (!Number.isInteger(normalizedKitta) || normalizedKitta < 10) {
            toast.error("Minimum kitta is 10");
            return;
        }
        if (applyingRef.current) return;
        setConfirmOpen(true);
    }, [kitta, selectedIpo, selectedAccounts.length]);

    const handleRetryFailed = useCallback(async () => {
        if (!activeJobId || applyingRef.current) return;

        try {
            setApplying(true);
            applyingRef.current = true;
            setReconnecting(false);
            setCancelling(false);
            setProgressDone(false);
            setProgressOpen(true);
            progressSeqRef.current = 0;

            const retry = await retryFailedApplyJobApi(activeJobId);
            const nextJobId = retry?.data?.jobId;
            if (!nextJobId) {
                throw new Error("Could not start retry job");
            }

            setActiveJobId(nextJobId);
            activeJobRef.current = nextJobId;
            await hydrateSnapshot(nextJobId);
            await attachJobStream(nextJobId, progressSeqRef.current, 0);
        } catch (err) {
            toast.error(resolveErrorMessage(err, "Retry failed"));
            setApplying(false);
            setCancelling(false);
            applyingRef.current = false;
            setProgressDone(true);
        }
    }, [activeJobId, attachJobStream, hydrateSnapshot]);

    const handleResumeProgress = useCallback(async () => {
        if (!activeJobId || applyingRef.current) return;
        try {
            setApplying(true);
            applyingRef.current = true;
            setReconnecting(true);
            await hydrateSnapshot(activeJobId);
            await attachJobStream(activeJobId, progressSeqRef.current, 0);
        } catch (err) {
            setReconnecting(false);
            setApplying(false);
            applyingRef.current = false;
            toast.error(resolveErrorMessage(err, "Resume failed"));
        }
    }, [activeJobId, hydrateSnapshot, attachJobStream]);

    const handleCancelRemaining = useCallback(async () => {
        if (!activeJobId || !applyingRef.current || cancelling) return;
        try {
            setCancelling(true);
            await cancelApplyJobApi(activeJobId);
        } catch (err) {
            setCancelling(false);
            toast.error(resolveErrorMessage(err, "Cancel failed"));
        }
    }, [activeJobId, cancelling]);

    const canApply = useMemo(
        () => Boolean(selectedIpo) && selectedAccounts.length > 0 && !applying && (progressDone || !activeJobId),
        [selectedIpo, selectedAccounts.length, applying, progressDone, activeJobId]
    );

    const renderApplyBtn = (extraClass = "") => (
        <button
            type="button"
            className={`ipo-apply-btn${canApply ? "" : " disabled"} ${extraClass}`.trim()}
            onClick={handleApply}
            disabled={!canApply}
        >
            {applying ? (
                <>
                    <SpinnerIcon /> Applying…
                </>
            ) : (
                `Apply to ${selectedAccounts.length} account${
                    selectedAccounts.length !== 1 ? "s" : ""
                }`
            )}
        </button>
    );

    const renderIpoItem = (ipo) => {
        if (!ipo) return null;
        const sel = selectedIpo?.companyShareId === ipo.companyShareId;
        const closeDateBs = closingMap[ipo.companyShareId];
        const countdown = closeDateBs ? getClosingCountdown(closeDateBs) : null;
        return (
            <button
                type="button"
                key={ipo.companyShareId}
                className={`ipo-item${sel ? " selected" : ""}`}
                onClick={() => handleSelectIpo(ipo)}
                aria-pressed={sel}
            >
                <div className="ipo-item-body">
                    <div className="ipo-name-row">
                        <p className="ipo-name">{ipo.companyName}</p>
                        {countdown && <span className="ipo-countdown-badge">{countdown}</span>}
                    </div>
                    <p className="ipo-meta">
                        {ipo.scrip} · ID {ipo.companyShareId}
                    </p>
                </div>
                <div className={`ipo-radio${sel ? " on" : ""}`}>
                    {sel && <span className="ipo-radio-dot" />}
                </div>
            </button>
        );
    };

    const renderAccountsCard = () => (
        <div className="card anim-fade-up" style={{ animationDelay: "0.12s" }}>
            <div className="ipo-accounts-head">
                <span className="ipo-section-label ipo-section-label--inline">Accounts</span>

                {!accountsError && accounts.length > 3 && (
                    <div className={`ipo-search-inline${searchOpen ? " open" : ""}`}>
                        {searchOpen ? (
                            <>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="ipo-search-inline-input"
                                    placeholder="Search…"
                                    value={accountSearch}
                                    onChange={(e) => setAccountSearch(e.target.value)}
                                />
                                <button type="button" className="ipo-search-inline-close" onClick={closeSearch}>
                                    <ClearIcon />
                                </button>
                            </>
                        ) : (
                            <button
                                className="ipo-search-inline-trigger"
                                onClick={openSearch}
                                aria-label="Search accounts"
                            >
                                <SearchIcon />
                            </button>
                        )}
                    </div>
                )}

                {!accountsError && !searchOpen && filteredAccounts.length > 0 && (
                    <button type="button" className="ipo-sel-all" onClick={selectAll}>
                        {allVisibleSelected ? "Deselect all" : "Select all"}
                    </button>
                )}
            </div>

            <div className="ipo-acc-list">
                {accountsError ? (
                    <div className="empty-state">
                        <p style={{ color: "var(--danger)" }}>{accountsError}</p>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={retryingAccounts}
                            onClick={async () => {
                                setRetryingAccounts(true);
                                try { await fetchAccounts(); } finally { setRetryingAccounts(false); }
                            }}
                        >
                            {retryingAccounts ? "Retrying..." : "Retry"}
                        </button>
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="empty-state">
                        <p>
                            {accounts.length === 0
                                ? "No accounts connected."
                                : "No accounts match your search."}
                        </p>
                    </div>
                ) : (
                    filteredAccounts.map((acc) => {
                        const on = selectedAccounts.includes(acc.id);
                        return (
                            <button
                                type="button"
                                key={acc.id}
                                className={`ipo-acc-row${on ? " on" : ""}`}
                                onClick={() => toggleAccount(acc.id)}
                                aria-pressed={on}
                            >
                                <div className={`ipo-checkbox${on ? " on" : ""}`}>
                                    {on && <CheckIcon />}
                                </div>
                                <div className="ipo-acc-info">
                                    <p className="ipo-acc-name">{acc.fullName}</p>
                                    <p className="ipo-acc-meta">
                                        {acc.username}
                                        {acc.dpCode ? ` · DP ${acc.dpCode}` : ""}
                                    </p>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );

    const renderKittaCard = () => (
        <div className="card ipo-kitta-card anim-fade-up" style={{ animationDelay: "0.07s" }}>
            <div className="ipo-section-label">Kitta to apply</div>
            <div className="kitta-row">
                <button
                    type="button"
                    className="kitta-btn"
                    aria-label="Decrease kitta"
                    onClick={() => {
                        const next = Math.max(10, kitta - 1);
                        setKitta(next);
                        setKittaInput(String(next));
                    }}
                >
                    <MinusIcon />
                </button>
                <div className="kitta-display">
                    <input
                        type="number"
                        className="kitta-input"
                        value={kittaInput}
                        min={10}
                        inputMode="numeric"
                        aria-label="Kitta to apply"
                        onChange={(e) => {
                            const value = e.target.value;
                            if (!/^\d*$/.test(value)) return;
                            setKittaInput(value);
                            if (value === "") {
                                setKitta(0);
                                return;
                            }
                            const parsed = Number(value);
                            setKitta(Number.isInteger(parsed) ? parsed : 0);
                        }}
                        onBlur={() => {
                            const parsed = Number(kittaInput);
                            const next = Number.isInteger(parsed) && parsed >= 10 ? parsed : 10;
                            setKitta(next);
                            setKittaInput(String(next));
                        }}
                    />
                    <span className="kitta-unit">kitta</span>
                </div>
                <button
                    type="button"
                    className="kitta-btn"
                    aria-label="Increase kitta"
                    onClick={() => {
                        const next = kitta + 1;
                        setKitta(next);
                        setKittaInput(String(next));
                    }}
                >
                    <PlusIcon />
                </button>
            </div>
        </div>
    );

    const renderUpcomingCard = () => {
        if (upcomingIpos.length === 0) return null;
        return (
            <div className="card ipo-upcoming-card anim-fade-up" style={{ animationDelay: "0.18s" }}>
                <div className="ipo-section-label">Upcoming IPOs</div>
                <div className="ipo-upcoming-list">
                    {upcomingIpos.map((ipo) => (
                        <div key={ipo.id || ipo.companyName} className="ipo-upcoming-row">
                            <div className="ipo-upcoming-info">
                                <p className="ipo-upcoming-name">{ipo.companyName}</p>
                                <p className="ipo-upcoming-meta">
                                    {ipo.scrip}
                                    {ipo.openDate && <> · Opens {formatBsDate(ipo.openDate)}</>}
                                </p>
                            </div>
                            {ipo.openDate && (
                                <span className="ipo-opening-badge">
                  {getOpeningCountdown(ipo.openDate)}
                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderIpoList = () => {
        if (!ipos || !Array.isArray(ipos) || ipos.length === 0) {
            return (
                <div className="empty-state">
                    <p>No offerings available at the moment.</p>
                </div>
            );
        }

        const primaryCategory = "Ordinary Shares";
        const primaryItems = groupedIpos[primaryCategory] || [];
        const hasPrimary = primaryItems.length > 0;
        let activeCategory = primaryCategory;
        let activeItems = primaryItems;

        if (!hasPrimary) {
            const fallbackEntry = Object.entries(groupedIpos).find(
                ([cat, items]) => Array.isArray(items) && items.length > 0
            );
            if (fallbackEntry) {
                activeCategory = fallbackEntry[0];
                activeItems = fallbackEntry[1];
            }
        }
        const otherCategories = Object.entries(groupedIpos).filter(
            ([cat, items]) => cat !== activeCategory && Array.isArray(items) && items.length > 0
        );

        const otherCount = otherCategories.reduce(
            (sum, [_, items]) => sum + items.length,
            0
        );

        return (
            <>
                <div className="ipo-group">
                    <div className="ipo-group-label">
                        {activeCategory} ({activeItems.length})
                    </div>
                    {activeItems.length > 0 ? (
                        activeItems.map(renderIpoItem)
                    ) : (
                        <div className="empty-state">
                            <p>No IPOs currently open.</p>
                        </div>
                    )}
                </div>

                {otherCategories.length > 0 && (
                    <div className="ipo-others-wrap">
                        <button
                            type="button"
                            className="ipo-toggle-others"
                            onClick={() => setShowOthers((prev) => !prev)}
                        >
                            {showOthers
                                ? "Hide Other Categories"
                                : `Other Categories & Reserved Quotas (${otherCount})`}
                            <ChevronIcon rotated={showOthers} />
                        </button>
                        {showOthers && (
                            <div className="ipo-others-content anim-fade-up">
                                {otherCategories.map(([cat, catIpos]) => (
                                    <div key={cat} className="ipo-group">
                                        <div className="ipo-group-label">
                                            {cat} ({catIpos.length})
                                        </div>
                                        {catIpos.map(renderIpoItem)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </>
        );
    };

    return (
        <>
            {confirmOpen && (
                <div className="ipo-confirm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
                    <div className="ipo-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="ipo-confirm-title">
                        <div className="ipo-confirm-head">
                            <div>
                                <p className="ipo-confirm-eyebrow">Confirm application</p>
                                <h2 id="ipo-confirm-title">{selectedIpo?.companyName || selectedIpo?.scrip || "IPO"}</h2>
                            </div>
                            <button type="button" className="ipo-confirm-close" onClick={() => setConfirmOpen(false)} aria-label="Close confirmation">
                                <ClearIcon />
                            </button>
                        </div>
                        <p className="ipo-confirm-copy">Apply {kitta} kitta to {selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""}?</p>
                        <div className="ipo-confirm-summary">
                            <span>Total kitta</span>
                            <strong>{kitta * selectedAccounts.length}</strong>
                        </div>
                        <div className="ipo-confirm-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
                            <button type="button" className="ipo-apply-btn" onClick={submitApply}>Confirm and apply</button>
                        </div>
                    </div>
                </div>
            )}
            <Layout>
                <SEO
                    title="Apply for IPOs"
                    description="Apply for open NEPSE IPOs across all your Meroshare accounts in one click. Select the IPO, pick accounts, and submit in seconds."
                    canonical="/ipo/apply"
                    noindex={true}
                />
                <div className="page ipo-page">
                    <h1 className="page-title">IPO Application</h1>
                    <p className="page-subtitle">Select an offering and accounts to apply in one step.</p>

                    {loading ? (
                        <div className="ipo-layout">
                            <div className="ipo-col">
                                <div className="card">
                                    <div className="ipo-section-label">Open IPOs</div>
                                    {[1, 2, 3].map((k) => (
                                        <div key={k} className="ipo-skel-row">
                                            <div
                                                className="skeleton"
                                                style={{ height: 13, width: "58%", marginBottom: 6 }}
                                            />
                                            <div className="skeleton" style={{ height: 10, width: "32%" }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="ipo-col">
                                <div className="card">
                                    <div className="ipo-section-label">Select Accounts</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="ipo-layout">
                                <div className="ipo-col">
                                    <div className="card anim-fade-up">
                                        <div className="ipo-section-label">Open IPOs</div>
                                        {ipoError ? (
                                            <div className="empty-state">
                                                <p style={{ color: "var(--danger)" }}>{ipoError}</p>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    disabled={retryingIpos}
                                                    onClick={async () => {
                                                        setRetryingIpos(true);
                                                        try { await fetchIpos(); } finally { setRetryingIpos(false); }
                                                    }}
                                                >
                                                    {retryingIpos ? "Retrying..." : "Retry"}
                                                </button>
                                            </div>
                                        ) : ipos.length === 0 ? (
                                            <div className="empty-state">
                                                <p>No IPOs are currently open.</p>
                                            </div>
                                        ) : (
                                            <div className="ipo-list">{renderIpoList()}</div>
                                        )}
                                    </div>

                                    <div className="ipo-desktop-only">{renderKittaCard()}</div>
                                    <div className="ipo-desktop-only">{renderUpcomingCard()}</div>
                                </div>

                                <div className="ipo-col">
                                    <div className="ipo-accounts-wrapper">{renderAccountsCard()}</div>

                                    <div className="ipo-mobile-only">{renderKittaCard()}</div>
                                    <div className="ipo-mobile-only">{renderUpcomingCard()}</div>

                                    <div className="ipo-desktop-summary">
                                        <span>{selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""}</span>
                                        <span>{kitta > 0 ? `${kitta * selectedAccounts.length} total kitta` : "Enter kitta"}</span>
                                        {selectedIpo?.scrip && <span>{selectedIpo.scrip}</span>}
                                    </div>
                                    <div className="ipo-desktop-apply">{renderApplyBtn()}</div>

                                    {!progressOpen && (applying || results.length > 0) && (
                                        <button
                                            type="button"
                                            className="ipo-progress-reopen"
                                            onClick={() => setProgressOpen(true)}
                                        >
                                            Show progress
                                        </button>
                                    )}

                                    {results.length > 0 && (
                                        <div className="card anim-fade-up">
                                            <div className="ipo-section-label">Results</div>
                                            <div className="ipo-results-list">
                                                {results.map((r, i) => (
                                                    <div
                                                        className="ipo-result-row"
                                                        key={r?.accountId ?? `${r?.username ?? "user"}_${i}`}
                                                    >
                                                        <div>
                                                            <p className="ipo-result-name">
                                                                {r?.fullName || r?.username || "Account"}
                                                            </p>
                                                            <p className="ipo-result-msg">{r?.message}</p>
                                                        </div>
                                                        <span className={`badge ${statusBadge(r?.status)}`}>
                              {r?.status?.replace(/_/g, " ")}
                            </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="ipo-sticky-bar">
                                <div className="ipo-sticky-summary">
                  <span>
                    {selectedAccounts.length} account
                      {selectedAccounts.length !== 1 ? "s" : ""}
                  </span>
                                    {selectedAccounts.length > 0 && (
                                        <>
                                            <span className="ipo-sticky-dot">·</span>
                                            <span>{kitta * selectedAccounts.length} total kitta</span>
                                        </>
                                    )}
                                    {selectedIpo && (
                                        <>
                                            <span className="ipo-sticky-dot">·</span>
                                            <span className="ipo-sticky-scrip">{selectedIpo.scrip}</span>
                                        </>
                                    )}
                                </div>
                                {renderApplyBtn("ipo-sticky-apply")}
                            </div>
                        </>
                    )}
                </div>
            </Layout>

            <BulkApplyProgress
                open={progressOpen}
                title={selectedIpo ? `${selectedIpo.companyName || selectedIpo.scrip} ${kitta} kitta` : "IPO"}
                summary={progressSummary}
                rows={results}
                applying={applying}
                completed={progressDone}
                reconnecting={reconnecting}
                cancelling={cancelling}
                canCancel={applying && !progressDone && !cancelling}
                canRetryFailed={progressDone && progressSummary.failedCount > 0 && !applying}
                onRetryFailed={handleRetryFailed}
                onCancelRemaining={handleCancelRemaining}
                onResume={handleResumeProgress}
                onClose={() => setProgressOpen(false)}
            />
        </>
    );
};

export default IPOApply;