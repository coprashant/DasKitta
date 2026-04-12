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

  useEffect(() => {
    fetchIpoList();
  }, []);

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
        // Pre-select the first entry
        const firstId = String(shares[0].id ?? shares[0].shareId ?? "");
        setShareId(firstId);
      }
    } catch (err) {
      console.error("Failed to load IPO list", err);
      setIpoListError(true);
      toast.error("Failed to load IPO list. Try refreshing.");
    } finally {
      setIpoListLoading(false);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) { toast.error("Select an IPO"); return; }

    // Guest mode requires a BOID
    if (!user && !boid.trim()) { toast.error("Enter your BOID"); return; }
    if (!user && boid.trim().length !== 16) {
      toast.error("BOID must be exactly 16 digits");
      return;
    }

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
      if (data.length === 0) {
        toast("No results found. The result may not be published yet.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to check result";
      toast.error(msg);
      setChecked(true); // still show the "no results" state
    } finally {
      setLoading(false);
    }
  };

  const getIpoDisplayName = (ipo) =>
    ipo.companyName || ipo.name || `Share #${ipo.id ?? ipo.shareId}`;

  const selectedIpo = ipoList.find(
    (ipo) => String(ipo.id ?? ipo.shareId) === shareId
  );

  const isFormDisabled = ipoListLoading || ipoListError || ipoList.length === 0;

  return (
    <div>
      {user ? (
        <Navbar />
      ) : (
        <nav className="public-nav">
          <div className="public-nav-inner">
            <Link to="/" className="public-nav-brand">
              <span
                style={{
                  width: 28, height: 28, background: "var(--accent)", borderRadius: 7,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 13,
                  color: "white", marginRight: 8, flexShrink: 0,
                }}
              >M</span>
              <span>Meroshare Bot</span>
            </Link>
            <div className="public-nav-actions">
              <Link to="/login" className="landing-nav-link">Sign In</Link>
              <Link to="/register" className="landing-nav-btn">Get Started</Link>
            </div>
          </div>
        </nav>
      )}

      <div className="page">
        <h1 className="page-title">IPO Result Checker</h1>
        <p className="page-subtitle">
          {user
            ? "Check results for all your Meroshare accounts at once."
            : "Check your IPO result without signing in. Enter your BOID and select the IPO."}
        </p>

        <div className="result-checker-layout">
          {/* ── Form ── */}
          <div className="card result-form">
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label>IPO / Share</label>
                {ipoListError ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "var(--danger)", fontSize: 13 }}>
                      Failed to load IPO list.
                    </span>
                    <button
                      type="button"
                      onClick={fetchIpoList}
                      style={{
                        background: "none", border: "none", color: "var(--accent)",
                        cursor: "pointer", fontSize: 13, padding: 0,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    value={shareId}
                    onChange={(e) => setShareId(e.target.value)}
                    required
                    disabled={ipoListLoading}
                  >
                    <option value="">
                      {ipoListLoading
                        ? "Loading IPOs…"
                        : ipoList.length === 0
                        ? "No IPOs available"
                        : "Select an IPO"}
                    </option>
                    {ipoList.map((ipo) => {
                      const id = String(ipo.id ?? ipo.shareId ?? "");
                      return (
                        <option key={id} value={id}>
                          {getIpoDisplayName(ipo)}
                          {ipo.scrip ? ` (${ipo.scrip})` : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedIpo && (
                  <span className="input-hint">
                    Share ID: {selectedIpo.id ?? selectedIpo.shareId}
                    {selectedIpo.scrip ? ` · ${selectedIpo.scrip}` : ""}
                  </span>
                )}
              </div>

              {/* BOID input — only shown for guests */}
              {!user && (
                <div className="form-group">
                  <label>Your BOID</label>
                  <input
                    type="text"
                    value={boid}
                    onChange={(e) => setBoid(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    placeholder="16-digit BOID number"
                    maxLength={16}
                    required
                  />
                  <span className="input-hint">
                    16-digit BOID from your Meroshare profile
                    {boid.length > 0 && boid.length < 16 && (
                      <span style={{ color: "var(--danger)", marginLeft: 6 }}>
                        ({16 - boid.length} digits remaining)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {user && (
                <div className="user-accounts-note">
                  Results will be checked for all your saved Meroshare accounts.
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary result-check-btn"
                disabled={loading || isFormDisabled}
              >
                {loading ? "Checking…" : "Check Result"}
              </button>
            </form>

            {!user && (
              <div className="result-login-prompt">
                <p>
                  Have multiple accounts?{" "}
                  <Link to="/register">Sign up free</Link> to check all at once.
                </p>
              </div>
            )}
          </div>

          {/* ── Results ── */}
          {checked && (
            <div className="result-output">
              {results.length === 0 ? (
                <div className="card empty-state">
                  <p>No results found. The IPO result may not be published yet.</p>
                </div>
              ) : (
                results.map((r, i) => (
                  <div className="result-card card" key={i}>
                    <div className="result-card-header">
                      <div>
                        <p className="result-card-name">
                          {r.accountFullName || r.accountUsername}
                        </p>
                        <p className="result-card-share">
                          {r.companyName || `Share ID: ${r.shareId}`}
                        </p>
                      </div>
                      <span
                        className={`badge result-badge ${
                          r.resultStatus === "ALLOTTED"
                            ? "badge-success"
                            : r.resultStatus === "NOT_ALLOTTED"
                            ? "badge-danger"
                            : "badge-muted"
                        }`}
                      >
                        {r.resultStatus
                          ? r.resultStatus.replace(/_/g, " ")
                          : "UNKNOWN"}
                      </span>
                    </div>

                    {r.resultStatus === "ALLOTTED" && r.allottedKitta > 0 && (
                      <div className="result-allotted">
                        <p className="result-allotted-label">Allotted Kitta</p>
                        <p className="result-allotted-value">{r.allottedKitta}</p>
                      </div>
                    )}

                    {r.resultCheckedAt && (
                      <p className="result-checked-time">
                        Checked at {new Date(r.resultCheckedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultChecker;