import { useState, useEffect } from "react";
import {
  checkResultApi, checkResultGuestApi, getPublicShareListApi,
} from "../../api/ipo";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import "./ResultChecker.css";

const SpinnerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: "spin 0.7s linear infinite" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const ResultChecker = ({ theme, onThemeToggle }) => {
  const { user } = useAuth();
  const [shareId, setShareId]             = useState("");
  const [boid, setBoid]                   = useState("");
  const [results, setResults]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [checked, setChecked]             = useState(false);
  const [ipoList, setIpoList]             = useState([]);
  const [ipoListLoading, setIpoListLoading] = useState(true);
  const [ipoListError, setIpoListError]   = useState(false);

  useEffect(() => { fetchIpoList(); }, []);

  const fetchIpoList = async () => {
    setIpoListLoading(true);
    setIpoListError(false);
    setIpoList([]);
    setShareId("");
    try {
      const res = await getPublicShareListApi();
      const shares = Array.isArray(res.data) ? res.data : [];
      setIpoList(shares);
      if (shares.length > 0) {
        setShareId(String(shares[0].id ?? shares[0].shareId ?? ""));
      }
    } catch (err) {
      console.error(err);
      setIpoListError(true);
      toast.error("Failed to load IPO list. Try refreshing.");
    } finally {
      setIpoListLoading(false);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) { toast.error("Select an IPO"); return; }
    if (!user && !boid.trim()) { toast.error("Enter your BOID"); return; }
    if (!user && boid.trim().length !== 16) { toast.error("BOID must be exactly 16 digits"); return; }
    setLoading(true);
    setResults([]);
    setChecked(false);
    try {
      const res = user
        ? await checkResultApi(shareId)
        : await checkResultGuestApi(shareId, boid.trim());
      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data);
      setChecked(true);
      if (!data.length) {
        toast("No results found. The result may not be published yet.");
      } else if (data.every((r) => r.resultStatus === "UNKNOWN")) {
        toast.error("Could not fetch results — CDSC may be blocking automated checks.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to check result");
      setChecked(true);
    } finally {
      setLoading(false);
    }
  };

  const getIpoName = (ipo) => ipo.companyName || ipo.name || `Share #${ipo.id ?? ipo.shareId}`;
  const selectedIpo = ipoList.find((ipo) => String(ipo.id ?? ipo.shareId) === shareId);
  const formDisabled = ipoListLoading || ipoListError || !ipoList.length;

  return (
    <Layout theme={theme} onThemeToggle={onThemeToggle}>
      <div className="page">
        <h1 className="page-title">IPO result checker</h1>
        <p className="page-subtitle">
          {user
            ? "Check results for all your Meroshare accounts at once."
            : "Check your IPO result without signing in."}
        </p>

        <div className="result-layout">
          <div className="card result-form anim-fade-up">
            <p className="result-card-title">Check result</p>
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label className="form-label">IPO / Share</label>
                {ipoListError ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--danger)" }}>Failed to load.</span>
                    <button
                      type="button"
                      onClick={fetchIpoList}
                      style={{
                        background: "none", border: "none",
                        color: "var(--accent)", cursor: "pointer",
                        fontSize: 13, padding: 0,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    className="input"
                    value={shareId}
                    onChange={(e) => setShareId(e.target.value)}
                    required
                    disabled={ipoListLoading}
                  >
                    <option value="">
                      {ipoListLoading ? "Loading IPOs" : !ipoList.length ? "No IPOs available" : "Select an IPO"}
                    </option>
                    {ipoList.map((ipo) => {
                      const id = String(ipo.id ?? ipo.shareId ?? "");
                      return (
                        <option key={id} value={id}>
                          {getIpoName(ipo)}{ipo.scrip ? ` (${ipo.scrip})` : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedIpo && (
                  <span className="form-hint">
                    Share ID: {selectedIpo.id ?? selectedIpo.shareId}
                    {selectedIpo.scrip ? ` — ${selectedIpo.scrip}` : ""}
                  </span>
                )}
              </div>

              {!user && (
                <div className="form-group">
                  <label className="form-label">Your BOID</label>
                  <input
                    className="input"
                    type="text"
                    value={boid}
                    onChange={(e) => setBoid(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    placeholder="16-digit BOID number"
                    maxLength={16}
                    required
                  />
                  <span className="form-hint">
                    16-digit BOID from your Meroshare profile
                    {boid.length > 0 && boid.length < 16 && (
                      <span style={{ color: "var(--danger)", marginLeft: 6 }}>
                        ({16 - boid.length} more)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {user && (
                <div className="accounts-note">
                  <InfoIcon />
                  <span>Results will be checked for all your saved Meroshare accounts.</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                style={{ padding: "10px" }}
                disabled={loading || formDisabled}
              >
                {loading ? <><SpinnerIcon /> Checking</> : "Check result"}
              </button>
            </form>

            {!user && (
              <div className="login-cta">
                Have multiple accounts?{" "}
                <a href="/register">Sign up free</a>{" "}
                to check all at once.
              </div>
            )}
          </div>

          {checked && (
            <div className="results-out">
              {!results.length ? (
                <div className="card empty-state">
                  <p>No results found. The IPO result may not be published yet.</p>
                </div>
              ) : (
                results.map((r, i) => (
                  <ResultCard
                    key={i}
                    result={r}
                    style={{ animationDelay: `${i * 0.07}s` }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const ResultCard = ({ result: r, style }) => {
  const isAllotted    = r.resultStatus === "ALLOTTED";
  const isNotAllotted = r.resultStatus === "NOT_ALLOTTED";
  const isUnknown     = r.resultStatus === "UNKNOWN";

  const badgeClass = isAllotted    ? "badge-success" :
                     isNotAllotted ? "badge-danger"  :
                     isUnknown     ? "badge-muted"   : "badge-warning";

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
          <span>
            {r.statusMessage
              ? r.statusMessage
              : <>
                  Result could not be determined. The IPO result may not be published yet,
                  or CDSC may be blocking automated checks. Try{" "}
                  <a href="https://iporesult.cdsc.com.np" target="_blank" rel="noopener noreferrer">
                    iporesult.cdsc.com.np
                  </a>
                </>
            }
          </span>
        </div>
      )}

      {r.resultCheckedAt && (
        <p className="res-time">
          Checked at {new Date(r.resultCheckedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
};

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8"  x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const WarnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9"  x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default ResultChecker;