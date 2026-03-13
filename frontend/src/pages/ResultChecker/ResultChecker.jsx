import { useState, useEffect } from "react";
import { checkResultApi, getOpenIposApi, getClosedIposApi } from "../../api/ipo";
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

  useEffect(() => {
    fetchIpoList();
  }, []);

  const fetchIpoList = async () => {
    setIpoListLoading(true);
    try {
      const [openRes, closedRes] = await Promise.allSettled([
        getOpenIposApi(),
        user ? getClosedIposApi() : Promise.resolve({ data: [] }),
      ]);

      const open = openRes.status === "fulfilled" ? (openRes.value.data || []) : [];
      const closed = closedRes.status === "fulfilled" ? (closedRes.value.data || []) : [];

      const seen = new Set();
      const merged = [...open, ...closed].filter((ipo) => {
        const key = ipo.id || ipo.shareId;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const sorted = merged.sort((a, b) => {
        const dateA = new Date(a.issueOpenDate || a.openDate || a.closingDate || 0);
        const dateB = new Date(b.issueOpenDate || b.openDate || b.closingDate || 0);
        return dateB - dateA;
      });

      setIpoList(sorted);
      if (sorted.length > 0) {
        setShareId(String(sorted[0].id || sorted[0].shareId || ""));
      }
    } catch (err) {
      toast.error("Failed to load IPO list");
    } finally {
      setIpoListLoading(false);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) {
      toast.error("Select an IPO");
      return;
    }
    if (!user && !boid.trim()) {
      toast.error("Enter your BOID");
      return;
    }

    setLoading(true);
    setResults([]);
    setChecked(false);

    try {
      const res = user
        ? await checkResultApi(shareId)
        : await checkResultApi(`${shareId}?boid=${boid}`);

      setResults(res.data);
      setChecked(true);

      if (res.data.length === 0) {
        toast("No results found for this IPO");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to check result");
    } finally {
      setLoading(false);
    }
  };

  const selectedIpo = ipoList.find(
    (ipo) => String(ipo.id || ipo.shareId) === shareId
  );

  return (
    <div>
      {user && <Navbar />}

      {!user && (
        <nav className="public-nav">
          <div className="public-nav-inner">
            <Link to="/" className="public-nav-brand">
              <span className="landing-logo">M</span>
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
          <div className="card result-form">
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label>IPO / Share</label>
                <select
                  value={shareId}
                  onChange={(e) => setShareId(e.target.value)}
                  required
                  disabled={ipoListLoading}
                >
                  <option value="">
                    {ipoListLoading ? "Loading IPOs..." : "Select an IPO"}
                  </option>
                  {ipoList.map((ipo) => (
                    <option
                      key={ipo.id || ipo.shareId}
                      value={String(ipo.id || ipo.shareId)}
                    >
                      {ipo.companyName || ipo.name || `Share ID: ${ipo.id || ipo.shareId}`}
                    </option>
                  ))}
                </select>
                {selectedIpo && (
                  <span className="input-hint">
                    Share ID: {selectedIpo.id || selectedIpo.shareId}
                    {selectedIpo.issueOpenDate && ` · Open: ${new Date(selectedIpo.issueOpenDate).toLocaleDateString()}`}
                    {selectedIpo.issueCloseDate && ` · Close: ${new Date(selectedIpo.issueCloseDate).toLocaleDateString()}`}
                  </span>
                )}
              </div>

              {!user && (
                <div className="form-group">
                  <label>Your BOID</label>
                  <input
                    type="text"
                    value={boid}
                    onChange={(e) => setBoid(e.target.value)}
                    placeholder="16-digit BOID number"
                    required
                  />
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
                disabled={loading || ipoListLoading}
              >
                {loading ? "Checking..." : "Check Result"}
              </button>
            </form>

            {!user && (
              <div className="result-login-prompt">
                <p>
                  Have multiple accounts?{" "}
                  <Link to="/register">Sign up free</Link> to check all accounts
                  at once.
                </p>
              </div>
            )}
          </div>

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
                      <span className={`badge result-badge ${
                        r.resultStatus === "ALLOTTED"
                          ? "badge-success"
                          : r.resultStatus === "NOT_ALLOTTED"
                          ? "badge-danger"
                          : "badge-muted"
                      }`}>
                        {r.resultStatus || "UNKNOWN"}
                      </span>
                    </div>

                    {r.resultStatus === "ALLOTTED" && (
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