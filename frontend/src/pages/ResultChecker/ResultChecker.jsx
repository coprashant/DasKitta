import { useState, useEffect } from "react";
import { checkResultApi, checkResultGuestApi, getPublicShareListApi } from "../../api/ipo";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import "./ResultChecker.css";

const ResultChecker = () => {
  const { user } = useAuth();
  const [shareId, setShareId] = useState("");
  const [boid, setBoid] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [ipoList, setIpoList] = useState([]);
  const [ipoListLoading, setIpoListLoading] = useState(true);
  const [ipoListError, setIpoListError] = useState(false);

  useEffect(() => { fetchIpoList(); }, []);

  const fetchIpoList = async () => {
    setIpoListLoading(true); setIpoListError(false); setIpoList([]); setShareId("");
    try {
      const res = await getPublicShareListApi();
      const shares = Array.isArray(res.data) ? res.data : [];
      setIpoList(shares);
      if (shares.length > 0) setShareId(String(shares[0].id ?? shares[0].shareId ?? ""));
    } catch (err) {
      console.error(err); setIpoListError(true);
      toast.error("Failed to load IPO list. Try refreshing.");
    } finally { setIpoListLoading(false); }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) { toast.error("Select an IPO"); return; }
    if (!user && !boid.trim()) { toast.error("Enter your BOID"); return; }
    if (!user && boid.trim().length !== 16) { toast.error("BOID must be exactly 16 digits"); return; }
    setLoading(true); setResults([]); setChecked(false);
    try {
      const res = user ? await checkResultApi(shareId) : await checkResultGuestApi(shareId, boid.trim());
      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data); setChecked(true);
      if (!data.length) toast("No results found. The result may not be published yet.");
      else if (data.every((r) => r.resultStatus === "UNKNOWN")) toast.error("Could not fetch results — CDSC may be blocking automated checks.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to check result");
      setChecked(true);
    } finally { setLoading(false); }
  };

  const getIpoName = (ipo) => ipo.companyName || ipo.name || `Share #${ipo.id ?? ipo.shareId}`;
  const selectedIpo = ipoList.find((ipo) => String(ipo.id ?? ipo.shareId) === shareId);
  const formDisabled = ipoListLoading || ipoListError || !ipoList.length;

  return (
    <div>
      {user ? <Navbar /> : (
        <nav className="pub-nav">
          <div className="pub-nav-inner">
            <Link to="/" className="pub-nav-brand">
              <span className="pub-nav-icon">M</span>
              <span className="pub-brand-name">Meroshare Bot</span>
            </Link>
            <div className="pub-nav-actions">
              <Link to="/login" className="pub-nav-link">Sign In</Link>
              <Link to="/register" className="pub-nav-btn">Get Started</Link>
            </div>
          </div>
        </nav>
      )}

      <div className="page">
        <h1 className="page-title">IPO Result Checker</h1>
        <p className="page-subtitle">
          {user ? "Check results for all your Meroshare accounts at once." : "Check your IPO result without signing in."}
        </p>

        <div className="result-layout">
          <div className="card result-form">
            <p className="card-title">Check Result</p>
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label className="form-label">IPO / Share</label>
                {ipoListError ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--danger)" }}>Failed to load.</span>
                    <button type="button" onClick={fetchIpoList} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: 0 }}>Retry</button>
                  </div>
                ) : (
                  <select className="input" value={shareId} onChange={(e) => setShareId(e.target.value)} required disabled={ipoListLoading}>
                    <option value="">{ipoListLoading ? "Loading IPOs…" : !ipoList.length ? "No IPOs available" : "Select an IPO"}</option>
                    {ipoList.map((ipo) => {
                      const id = String(ipo.id ?? ipo.shareId ?? "");
                      return <option key={id} value={id}>{getIpoName(ipo)}{ipo.scrip ? ` (${ipo.scrip})` : ""}</option>;
                    })}
                  </select>
                )}
                {selectedIpo && (
                  <span className="form-hint">Share ID: {selectedIpo.id ?? selectedIpo.shareId}{selectedIpo.scrip ? ` · ${selectedIpo.scrip}` : ""}</span>
                )}
              </div>

              {!user && (
                <div className="form-group">
                  <label className="form-label">Your BOID</label>
                  <input className="input" type="text" value={boid} onChange={(e) => setBoid(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="16-digit BOID number" maxLength={16} required />
                  <span className="form-hint">
                    16-digit BOID from your Meroshare profile
                    {boid.length > 0 && boid.length < 16 && <span style={{ color: "var(--danger)", marginLeft: 6 }}>({16 - boid.length} more)</span>}
                  </span>
                </div>
              )}

              {user && (
                <div className="accounts-note">
                  <span className="note-pip" />
                  Results will be checked for all your saved Meroshare accounts.
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={loading || formDisabled} style={{ padding: "10px" }}>
                {loading ? "Checking…" : "Check Result"}
              </button>
            </form>

            {!user && (
              <div className="login-cta">
                Have multiple accounts? <Link to="/register">Sign up free</Link> to check all at once.
              </div>
            )}
          </div>

          {checked && (
            <div className="results-out">
              {!results.length ? (
                <div className="card empty-state"><p>No results found. The IPO result may not be published yet.</p></div>
              ) : (
                results.map((r, i) => <ResultCard key={i} result={r} />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ result: r }) => {
  const isAllotted    = r.resultStatus === "ALLOTTED";
  const isNotAllotted = r.resultStatus === "NOT_ALLOTTED";
  const isUnknown     = r.resultStatus === "UNKNOWN";

  const badgeClass = isAllotted ? "badge-success" : isNotAllotted ? "badge-danger" : isUnknown ? "badge-muted" : "badge-warning";

  return (
    <div className="card res-card">
      <div className="res-head">
        <div>
          <p className="res-name">{r.accountFullName || r.accountUsername}</p>
          <p className="res-share">{r.companyName || `Share ID: ${r.shareId}`}</p>
        </div>
        <span className={`res-badge badge ${badgeClass}`}>{r.resultStatus ? r.resultStatus.replace(/_/g, " ") : "UNKNOWN"}</span>
      </div>

      {isAllotted && r.allottedKitta > 0 && (
        <div className="allotted-row">
          <p className="allotted-lbl">Allotted Kitta</p>
          <p className="allotted-num">{r.allottedKitta}</p>
        </div>
      )}

      {isUnknown && (
        <div className="warn-box">
          {r.statusMessage
            ? `⚠ ${r.statusMessage}`
            : <>⚠ Result could not be determined. The IPO result may not be published yet, or CDSC may be blocking automated checks. Try <a href="https://iporesult.cdsc.com.np" target="_blank" rel="noopener noreferrer">iporesult.cdsc.com.np</a></>
          }
        </div>
      )}

      {r.resultCheckedAt && <p className="res-time">Checked at {new Date(r.resultCheckedAt).toLocaleString()}</p>}
    </div>
  );
};

export default ResultChecker;