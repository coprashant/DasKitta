import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
    checkResultStreamApi,
    getAppliedCompaniesApi,
} from "../../api/ipo";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout/Layout.jsx";
import { SpinnerIcon, WarnIcon } from "../../components/Icons";
import toast from "react-hot-toast";
import SEO from "../../seo/SEO.jsx";
import { RESULT_CHECKER_JSONLD } from "../../seo/jsonLd.js";
import "./ResultChecker.css";

const resolveShareId = (ipo) =>
    String(ipo?.companyShareId ?? ipo?.id ?? ipo?.shareId ?? "");

const getIpoName = (ipo) =>
    ipo?.companyName || ipo?.name || `Share #${resolveShareId(ipo)}`;

// no response means the request never reached the server, ie offline
const resolveErrorMessage = (error, fallback) => {
    if (!error?.response) {
        return "No internet connection. Check your network and try again.";
    }
    return error?.response?.data?.message || error?.message || fallback;
};

const ResultChecker = () => {
    const { user } = useAuth();
    const [shareId, setShareId] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState(false);
    const [checkError, setCheckError] = useState(null);
    const [ipoList, setIpoList] = useState([]);
    const [ipoListLoading, setIpoListLoading] = useState(true);
    const [ipoListError, setIpoListError] = useState(null);
    const nextKeyRef = useRef(0);

    const fetchIpoList = useCallback(async () => {
        if (!user) {
            setIpoListLoading(false);
            return;
        }
        setIpoListLoading(true);
        setIpoListError(null);
        setShareId("");
        try {
            const res = await getAppliedCompaniesApi();
            const shares = Array.isArray(res?.data) ? res.data : [];
            setIpoList(shares);
            if (shares.length > 0) {
                setShareId(resolveShareId(shares[0]));
            }
        } catch (err) {
            const msg = resolveErrorMessage(err, "Failed to load IPO list");
            setIpoListError(msg);
            toast.error(msg);
        } finally {
            setIpoListLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchIpoList();
    }, [fetchIpoList]);

    const runCheck = async (targetShareId) => {
        setLoading(true);
        setResults([]);
        setChecked(true);
        setCheckError(null);
        nextKeyRef.current = 0;

        await checkResultStreamApi(
            targetShareId,
            (result) => {
                nextKeyRef.current += 1;
                setResults((prev) => [...prev, { ...result, resultKey: nextKeyRef.current }]);
            },
            () => setLoading(false),
            (err) => {
                const msg = resolveErrorMessage(err, "Failed to check result");
                setCheckError(msg);
                toast.error(msg);
                setLoading(false);
            }
        );
    };

    const handleCheck = (e) => {
        e.preventDefault();
        if (!shareId.trim()) {
            toast.error("Select an IPO");
            return;
        }
        runCheck(shareId);
    };

    const selectedIpo = ipoList.find((ipo) => resolveShareId(ipo) === shareId);
    const formDisabled = ipoListLoading || Boolean(ipoListError) || !ipoList.length;

    const allottedCount = results.filter((r) => r.resultStatus === "ALLOTTED").length;
    const totalKitta = results.reduce((acc, curr) => acc + (Number(curr.allottedKitta) || 0), 0);

    const handleCopySummary = () => {
        if (!results.length) return;
        const company = selectedIpo ? getIpoName(selectedIpo) : "IPO";
        const lines = results.map((r) => {
            const name = r.accountFullName || r.accountUsername || "Account";
            if (r.resultStatus === "ALLOTTED") {
                return `• ${name}: ${r.allottedKitta || 0} Kitta 🎉`;
            }
            if (r.resultStatus === "NOT_ALLOTTED") {
                return `• ${name}: Not Allotted`;
            }
            return `• ${name}: Pending/Check manually`;
        });
        const text = `${company} Results:\n` + lines.join("\n");
        navigator.clipboard.writeText(text);
        toast.success("Summary copied");
    };

    return (
        <Layout>
            <SEO
                title="IPO Result Checker"
                description="Check your NEPSE IPO allotment result instantly across all your Meroshare accounts."
                canonical="/ipo/result"
                jsonLd={RESULT_CHECKER_JSONLD}
            />
            <div className="page">
                <h1 className="page-title">IPO result checker</h1>
                <p className="page-subtitle">
                    Check allotment across all your accounts in real-time.
                </p>

                <div className="result-layout">
                    <div className="card result-form">
                        <p className="result-card-title">Check result</p>

                        {!user ? (
                            <div className="login-cta">
                                Sign in to check your IPO results.{" "}
                                <Link to="/login">Log in</Link> or{" "}
                                <Link to="/register">sign up</Link>.
                            </div>
                        ) : (
                            <form onSubmit={handleCheck}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="ipo-select">
                                        Select IPO
                                    </label>
                                    {ipoListError ? (
                                        <div className="form-error-fallback">
                                            <span>{ipoListError}</span>
                                            <button
                                                type="button"
                                                className="btn-retry-inline"
                                                onClick={fetchIpoList}
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : (
                                        <select
                                            id="ipo-select"
                                            className="input"
                                            value={shareId}
                                            onChange={(e) => setShareId(e.target.value)}
                                            required
                                            disabled={ipoListLoading || loading}
                                        >
                                            <option value="">
                                                {ipoListLoading
                                                    ? "Loading IPOs..."
                                                    : !ipoList.length
                                                        ? "No published results"
                                                        : "Select company"}
                                            </option>
                                            {ipoList.map((ipo) => {
                                                const id = resolveShareId(ipo);
                                                return (
                                                    <option key={id} value={id}>
                                                        {getIpoName(ipo)}
                                                        {ipo.scrip ? ` (${ipo.scrip})` : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                </div>

                                {loading && (
                                    <div className="stream-progress">
                                        <div className="progress-track">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${Math.min((results.length / 5) * 100, 95)}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="progress-text">
                      Checking accounts ({results.length})...
                    </span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-full"
                                    disabled={loading || formDisabled}
                                >
                                    {loading ? (
                                        <>
                                            <SpinnerIcon /> Checking...
                                        </>
                                    ) : (
                                        "Check results"
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {checked && (
                        <div className="results-out">
                            {results.length > 0 && (
                                <div className="results-header">
                  <span className="summary-badge">
                    {allottedCount > 0
                        ? `${allottedCount} Allotted (${totalKitta} Kitta)`
                        : `${results.length} Checked`}
                  </span>
                                    <button
                                        type="button"
                                        className="btn-copy"
                                        onClick={handleCopySummary}
                                    >
                                        Copy summary
                                    </button>
                                </div>
                            )}

                            {!results.length && !loading && (
                                <div className="card empty-card">
                                    {checkError ? (
                                        <>
                                            <p style={{ color: "var(--danger)" }}>{checkError}</p>
                                            <button
                                                type="button"
                                                className="btn-retry-inline"
                                                onClick={() => runCheck(shareId)}
                                            >
                                                Retry
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p>No results found for this selection.</p>
                                            <a
                                                href="https://iporesult.cdsc.com.np"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-cdsc"
                                            >
                                                Check on CDSC Portal &rarr;
                                            </a>
                                        </>
                                    )}
                                </div>
                            )}

                            {results.map((r) => (
                                <ResultCard
                                    key={r.resultKey}
                                    result={r}
                                    onRetryAccount={() => runCheck(shareId)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

const ResultCard = ({ result: r, onRetryAccount }) => {
    const isAllotted = r.resultStatus === "ALLOTTED";
    const isNotAllotted = r.resultStatus === "NOT_ALLOTTED";
    const isUnknown = r.resultStatus === "UNKNOWN";

    const statusLabel = isAllotted
        ? "Allotted"
        : isNotAllotted
            ? "Not Allotted"
            : "Pending";

    const badgeClass = isAllotted
        ? "badge-success"
        : isNotAllotted
            ? "badge-muted"
            : "badge-warning";

    const cardVariantClass = isAllotted
        ? "res-card-allotted"
        : isNotAllotted
            ? "res-card-muted"
            : "";

    return (
        <div className={`card res-card ${cardVariantClass}`}>
            <div className="res-head">
                <div>
                    <p className="res-name">{r.accountFullName || r.accountUsername}</p>
                    <p className="res-share">{r.companyName || "Meroshare Account"}</p>
                </div>
                <span className={`badge ${badgeClass}`}>{statusLabel}</span>
            </div>

            {isAllotted && r.allottedKitta > 0 && (
                <div className="allotted-row">
                    <span className="allotted-lbl">Allotted kitta</span>
                    <span className="allotted-num">{r.allottedKitta}</span>
                </div>
            )}

            {isUnknown && (
                <div className="warn-box">
                    <WarnIcon />
                    <div>
            <span>
              {r.statusMessage || "Could not fetch automatically."}
            </span>
                        {onRetryAccount && (
                            <div>
                                <button
                                    type="button"
                                    className="btn-card-retry"
                                    onClick={onRetryAccount}
                                >
                                    Retry check
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultChecker;