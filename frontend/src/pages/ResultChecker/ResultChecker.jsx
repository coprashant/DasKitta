import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  checkResultStreamApi,
  getPublicShareListApi,
  getAppliedCompaniesApi,
} from "../../api/ipo";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout/Layout.jsx";
import { InfoIcon, SpinnerIcon, WarnIcon } from "../../components/Icons";
import toast from "react-hot-toast";
import SEO from "../../seo/SEO.jsx";
import { RESULT_CHECKER_JSONLD } from "../../seo/jsonLd.js";
import "./ResultChecker.css";

const resolveShareId = (ipo) =>
    String(ipo?.companyShareId ?? ipo?.id ?? ipo?.shareId ?? "");

const getIpoName = (ipo) =>
    ipo?.companyName || ipo?.name || `Share #${resolveShareId(ipo)}`;

const ResultChecker = () => {
  const { user } = useAuth();
  const [shareId, setShareId] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [ipoList, setIpoList] = useState([]);
  const [ipoListLoading, setIpoListLoading] = useState(true);
  const [ipoListError, setIpoListError] = useState(false);
  const nextKeyRef = useRef(0);

  const fetchIpoList = useCallback(async () => {
    if (!user) {
      setIpoListLoading(false);
      return;
    }
    setIpoListLoading(true);
    setIpoListError(false);
    setShareId("");
    try {
      const res = await getAppliedCompaniesApi();
      const shares = Array.isArray(res?.data) ? res.data : [];
      setIpoList(shares);
      if (shares.length > 0) {
        setShareId(resolveShareId(shares[0]));
      }
    } catch {
      setIpoListError(true);
      toast.error("Failed to load IPO list. Try refreshing.");
    } finally {
      setIpoListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIpoList();
  }, [fetchIpoList]);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) {
      toast.error("Select an IPO");
      return;
    }

    setLoading(true);
    setResults([]);
    setChecked(true);
    nextKeyRef.current = 0;

    await checkResultStreamApi(
        shareId,
        (result) => {
          nextKeyRef.current += 1;
          setResults((prev) => [...prev, { ...result, resultKey: nextKeyRef.current }]);
        },
        () => {
          setLoading(false);
        },
        (err) => {
          toast.error(err.message || "Failed to check result");
          setLoading(false);
        }
    );
  };

  const selectedIpo = ipoList.find((ipo) => resolveShareId(ipo) === shareId);
  const formDisabled = ipoListLoading || ipoListError || !ipoList.length;

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
            Check results for all your Meroshare accounts, one by one as they come in.
          </p>

          <div className="result-layout">
            <div className="card result-form anim-fade-up">
              <p className="result-card-title">Check result</p>

              {!user ? (
                  <div className="login-cta">
                    Sign in to check your IPO results.{" "}
                    <Link to="/register">Sign up free</Link> or{" "}
                    <Link to="/login">log in</Link>.
                  </div>
              ) : (
                  <form onSubmit={handleCheck}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ipo-select">
                        IPO / Share
                      </label>
                      {ipoListError ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--danger)" }}>
                        Failed to load.
                      </span>
                            <button
                                type="button"
                                onClick={fetchIpoList}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--accent)",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  padding: 0,
                                }}
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
                              disabled={ipoListLoading}
                          >
                            <option value="">
                              {ipoListLoading
                                  ? "Loading IPOs..."
                                  : !ipoList.length
                                      ? "No results published yet"
                                      : "Select an IPO"}
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
                      {selectedIpo && (
                          <span className="form-hint">
                      Share ID: {resolveShareId(selectedIpo)}
                            {selectedIpo.scrip ? ` — ${selectedIpo.scrip}` : ""}
                    </span>
                      )}
                    </div>

                    <div className="accounts-note">
                      <InfoIcon />
                      <span>
                    Results are checked one account at a time and shown as each finishes.
                  </span>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        style={{ padding: "10px" }}
                        disabled={loading || formDisabled}
                    >
                      {loading ? (
                          <>
                            <SpinnerIcon /> Checking
                          </>
                      ) : (
                          "Check result"
                      )}
                    </button>
                  </form>
              )}
            </div>

            {checked && (
                <div className="results-out">
                  {!results.length && !loading && (
                      <div className="card empty-state">
                        <p>No results found. The IPO result may not be published yet.</p>
                      </div>
                  )}
                  {results.map((r, i) => (
                      <ResultCard
                          key={r.resultKey}
                          result={r}
                          style={{ animationDelay: `${i * 0.07}s` }}
                      />
                  ))}
                  {loading && results.length > 0 && (
                      <div className="card empty-state">
                        <SpinnerIcon /> Checking next account...
                      </div>
                  )}
                </div>
            )}
          </div>
        </div>
      </Layout>
  );
};

const ResultCard = ({ result: r, style }) => {
  const isAllotted = r.resultStatus === "ALLOTTED";
  const isNotAllotted = r.resultStatus === "NOT_ALLOTTED";
  const isUnknown = r.resultStatus === "UNKNOWN";

  const badgeClass = isAllotted
      ? "badge-success"
      : isNotAllotted
          ? "badge-danger"
          : isUnknown
              ? "badge-muted"
              : "badge-warning";

  const formattedDate = r.resultCheckedAt
      ? new Date(r.resultCheckedAt).toLocaleString("en-NP", {
        dateStyle: "medium",
        timeStyle: "short",
      })
      : null;

  const unknownContent = r.statusMessage ? (
      r.statusMessage
  ) : (
      <>
        Result could not be determined. The IPO result may not be published
        yet, or CDSC may be blocking automated checks. Try{" "}
        <a href="https://iporesult.cdsc.com.np" target="_blank" rel="noopener noreferrer">
          iporesult.cdsc.com.np
        </a>
      </>
  );

  return (
      <div className="card res-card anim-fade-up" style={style}>
        <div className="res-head">
          <div>
            <p className="res-name">{r.accountFullName || r.accountUsername}</p>
            <p className="res-share">{r.companyName || `Share ID: ${r.shareId}`}</p>
          </div>
          <span className={`badge ${badgeClass}`}>
          {r.resultStatus ? r.resultStatus.replace(/_/g, " ") : "UNKNOWN"}
        </span>
        </div>

        {isAllotted && r.allottedKitta > 0 && (
            <div className="allotted-row">
              <p className="allotted-lbl">Allotted kitta</p>
              <p className="allotted-num">{r.allottedKitta}</p>
            </div>
        )}

        {isUnknown && (
            <div className="warn-box">
              <WarnIcon />
              <span>{unknownContent}</span>
            </div>
        )}

        {formattedDate && <p className="res-time">Checked at {formattedDate}</p>}
      </div>
  );
};

export default ResultChecker;