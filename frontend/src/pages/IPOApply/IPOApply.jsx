import { useState, useEffect } from "react";
import { getAccountsApi } from "../../api/accounts";
import { getOpenIposApi, applyIpoApi } from "../../api/ipo";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import "./IPOApply.css";

const IPOApply = () => {
  const [ipos, setIpos] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedIpo, setSelectedIpo] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [kitta, setKitta] = useState(10);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ipoRes, accRes] = await Promise.all([
          getOpenIposApi(),
          getAccountsApi(),
        ]);
        setIpos(ipoRes.data);
        setAccounts(accRes.data);
      } catch (err) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleAccount = (id) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedAccounts.length === accounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map((a) => a.id));
    }
  };

  const handleApply = async () => {
    if (!selectedIpo) {
      toast.error("Select an IPO first");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast.error("Select at least one account");
      return;
    }

    setApplying(true);
    setResults([]);

    try {
      const res = await applyIpoApi({
        shareId: String(selectedIpo.id),
        companyName: selectedIpo.companyName,
        kitta,
        accountIds: selectedAccounts,
      });
      setResults(res.data);
      const successCount = res.data.filter((r) => r.status === "SUCCESS").length;
      toast.success(`Applied successfully for ${successCount} account(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      SUCCESS: "badge-success",
      FAILED: "badge-danger",
      ALREADY_APPLIED: "badge-warning",
    };
    return map[status] || "badge-muted";
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="page">
          <p className="loading-text">Loading open IPOs...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Apply IPO</h1>
        <p className="page-subtitle">
          Select an IPO and accounts to apply in one click.
        </p>

        <div className="apply-layout">
          <div className="apply-left">
            <div className="card">
              <h2 className="form-section-title">Open IPOs</h2>
              {ipos.length === 0 ? (
                <div className="empty-state">
                  <p>No IPOs are currently open.</p>
                </div>
              ) : (
                <div className="ipo-list">
                  {ipos.map((ipo) => (
                    <div
                      key={ipo.id}
                      className={`ipo-item ${selectedIpo?.id === ipo.id ? "selected" : ""}`}
                      onClick={() => setSelectedIpo(ipo)}
                    >
                      <div className="ipo-item-info">
                        <p className="ipo-item-name">{ipo.companyName}</p>
                        <p className="ipo-item-meta">
                          Share ID: {ipo.id} &middot; {ipo.subGroup || "IPO"}
                        </p>
                      </div>
                      {selectedIpo?.id === ipo.id && (
                        <span className="ipo-selected-dot" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="form-section-title">Kitta to Apply</h2>
              <div className="kitta-input-row">
                <button
                  className="kitta-btn"
                  onClick={() => setKitta(Math.max(10, kitta - 10))}
                >
                  -
                </button>
                <input
                  type="number"
                  className="kitta-input"
                  value={kitta}
                  min={10}
                  step={10}
                  onChange={(e) => setKitta(Number(e.target.value))}
                />
                <button
                  className="kitta-btn"
                  onClick={() => setKitta(kitta + 10)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="apply-right">
            <div className="card">
              <div className="accounts-header">
                <h2 className="form-section-title">Select Accounts</h2>
                <button className="select-all-btn" onClick={selectAll}>
                  {selectedAccounts.length === accounts.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="empty-state">
                  <p>No accounts added yet.</p>
                </div>
              ) : (
                <div className="account-checkboxes">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`account-checkbox-row ${selectedAccounts.includes(acc.id) ? "checked" : ""}`}
                      onClick={() => toggleAccount(acc.id)}
                    >
                      <div className={`checkbox ${selectedAccounts.includes(acc.id) ? "checked" : ""}`}>
                        {selectedAccounts.includes(acc.id) && (
                          <span className="checkmark">✓</span>
                        )}
                      </div>
                      <div className="account-checkbox-info">
                        <p className="account-checkbox-name">{acc.fullName}</p>
                        <p className="account-checkbox-meta">
                          {acc.username} &middot; DP {acc.dpId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary apply-btn"
              onClick={handleApply}
              disabled={applying || !selectedIpo || selectedAccounts.length === 0}
            >
              {applying
                ? `Applying to ${selectedAccounts.length} account(s)...`
                : `Apply to ${selectedAccounts.length} account(s)`}
            </button>

            {results.length > 0 && (
              <div className="card apply-results">
                <h2 className="form-section-title">Application Results</h2>
                <div className="results-list">
                  {results.map((r, i) => (
                    <div className="result-row" key={i}>
                      <div className="result-info">
                        <p className="result-name">{r.fullName || r.username}</p>
                        <p className="result-message">{r.message}</p>
                      </div>
                      <span className={`badge ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IPOApply;