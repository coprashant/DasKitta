import { useState } from "react";
import { checkResultApi } from "../../api/ipo";
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

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!shareId.trim()) {
      toast.error("Enter a Share ID");
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
      const url = user
        ? checkResultApi(shareId)
        : checkResultApi(`${shareId}?boid=${boid}`);

      const res = await url;
      setResults(res.data);
      setChecked(true);

      if (res.data.length === 0) {
        toast("No results found for this Share ID");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to check result");
    } finally {
      setLoading(false);
    }
  };

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
            : "Check your IPO result without signing in. Enter your BOID and Share ID."}
        </p>

        <div className="result-checker-layout">
          <div className="card result-form">
            <form onSubmit={handleCheck}>
              <div className="form-group">
                <label>Share ID</label>
                <input
                  type="text"
                  value={shareId}
                  onChange={(e) => setShareId(e.target.value)}
                  placeholder="e.g. 2185"
                  required
                />
                <span className="input-hint">
                  Find the Share ID on the CDSC website or Meroshare app.
                </span>
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
                disabled={loading}
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
                        <p className="result-card-share">Share ID: {r.shareId}</p>
                      </div>
                      <span className={`badge result-badge ${r.resultStatus === "ALLOTTED" ? "badge-success" : r.resultStatus === "NOT_ALLOTTED" ? "badge-danger" : "badge-muted"}`}>
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