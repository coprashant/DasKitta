import { useState, useEffect } from "react";
import { getAccountsApi } from "../../api/accounts";
import { getOpenIposApi, applyIpoApi } from "../../api/ipo";
import Layout from "../../components/Layout";
import toast from "react-hot-toast";
import "./IPOApply.css";

const statusBadge = (s) =>
  ({ SUCCESS: "badge-success", FAILED: "badge-danger", ALREADY_APPLIED: "badge-warning", PENDING: "badge-muted" }[s] || "badge-muted");

const IPOApply = () => {
  const [ipos, setIpos] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedIpo, setSelectedIpo] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [kitta, setKitta] = useState(10);
  const [loading, setLoading] = useState(true);
  const [ipoError, setIpoError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setIpoError(null);
    try {
      const [ipoRes, accRes] = await Promise.allSettled([getOpenIposApi(), getAccountsApi()]);
      if (ipoRes.status === "fulfilled") setIpos(Array.isArray(ipoRes.value.data) ? ipoRes.value.data : []);
      else {
        const m = ipoRes.reason?.response?.data?.message || "Failed to load open IPOs";
        setIpoError(m);
        toast.error(m);
      }
      if (accRes.status === "fulfilled") setAccounts(Array.isArray(accRes.value.data) ? accRes.value.data : []);
      else toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = (id) =>
    setSelectedAccounts((p) => p.includes(id) ? p.filter((a) => a !== id) : [...p, id]);

  const selectAll = () =>
    setSelectedAccounts(selectedAccounts.length === accounts.length ? [] : accounts.map((a) => a.id));

  const handleApply = async () => {
    if (!selectedIpo) { toast.error("Select an IPO first"); return; }
    if (!selectedAccounts.length) { toast.error("Select at least one account"); return; }
    if (kitta < 10 || kitta % 10 !== 0) { toast.error("Kitta must be a multiple of 10"); return; }
    setApplying(true);
    setResults([]);
    try {
      const res = await applyIpoApi({
        shareId: String(selectedIpo.companyShareId || selectedIpo.id),
        companyName: selectedIpo.companyName || selectedIpo.scrip || "Unknown",
        kitta,
        accountIds: selectedAccounts,
      });
      setResults(res.data);
      const ok = res.data.filter((r) => r.status === "SUCCESS").length;
      const already = res.data.filter((r) => r.status === "ALREADY_APPLIED").length;
      if (ok > 0) toast.success(`Applied for ${ok} account(s)`);
      else if (already > 0) toast(`Already applied for ${already} account(s)`);
      else toast.error("All applications failed.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <Layout>
      <div className="page">
        <h1 className="page-title">Apply IPO</h1>
        <p className="loading-text">Loading</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="page">
        <h1 className="page-title">Apply IPO</h1>
        <p className="page-subtitle">Select an IPO and accounts, then apply in one click.</p>

        <div className="apply-layout">
          <div className="apply-col">
            <div className="card">
              <p className="card-title">Open IPOs</p>
              {ipoError ? (
                <div className="empty-state">
                  <p style={{ color: "var(--danger)" }}>{ipoError}</p>
                  <button className="btn btn-secondary" onClick={fetchData} style={{ marginTop: 12 }}>Retry</button>
                </div>
              ) : ipos.length === 0 ? (
                <div className="empty-state"><p>No IPOs are currently open.</p></div>
              ) : (
                <div className="ipo-list">
                  {ipos.map((ipo) => {
                    const id = ipo.companyShareId || ipo.id;
                    const name = ipo.companyName || ipo.scrip || "Unknown";
                    const sub = ipo.shareTypeName || ipo.subGroup || "IPO";
                    const sel = selectedIpo?.companyShareId === ipo.companyShareId && selectedIpo?.companyShareId != null;
                    return (
                      <div key={id} className={`ipo-item${sel ? " selected" : ""}`} onClick={() => setSelectedIpo(ipo)}>
                        <div>
                          <p className="ipo-name">{name}</p>
                          <p className="ipo-meta">ID: {id} · {sub}</p>
                        </div>
                        <div className={`ipo-check${sel ? " on" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <p className="card-title">Kitta to Apply</p>
              <div className="kitta-row">
                <button type="button" className="kitta-stepper" onClick={() => setKitta((k) => Math.max(10, k - 10))}>−</button>
                <input
                  type="number"
                  className="kitta-val"
                  value={kitta}
                  min={10}
                  step={10}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 10) setKitta(v);
                  }}
                />
                <button type="button" className="kitta-stepper" onClick={() => setKitta((k) => k + 10)}>+</button>
              </div>
            </div>
          </div>

          <div className="apply-col">
            <div className="card">
              <div className="accounts-head">
                <span className="card-title-sm">Select Accounts</span>
                {accounts.length > 0 && (
                  <button className="sel-all-btn" onClick={selectAll}>
                    {selectedAccounts.length === accounts.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {accounts.length === 0 ? (
                <div className="empty-state">
                  <p>No accounts added yet.</p>
                  <a href="/accounts/add" className="btn btn-primary" style={{ marginTop: 12 }}>Add Account</a>
                </div>
              ) : (
                <div className="acc-checks">
                  {accounts.map((acc) => {
                    const on = selectedAccounts.includes(acc.id);
                    return (
                      <div key={acc.id} className={`acc-check-row${on ? " on" : ""}`} onClick={() => toggleAccount(acc.id)}>
                        <div className={`check-box${on ? " on" : ""}`}>{on && "✓"}</div>
                        <div>
                          <p className="acc-name">{acc.fullName}</p>
                          <p className="acc-meta">{acc.username} · DP {acc.dpId}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary btn-full"
              style={{ padding: "11px" }}
              onClick={handleApply}
              disabled={applying || !selectedIpo || !selectedAccounts.length || !accounts.length}
            >
              {applying
                ? `Applying to ${selectedAccounts.length} account(s)`
                : `Apply to ${selectedAccounts.length} account(s)`}
            </button>

            {results.length > 0 && (
              <div className="card">
                <p className="card-title">Application Results</p>
                <div className="results-list">
                  {results.map((r, i) => (
                    <div className="result-row" key={i}>
                      <div>
                        <p className="result-name">{r.fullName || r.username}</p>
                        <p className="result-msg">{r.message}</p>
                      </div>
                      <span className={`badge ${statusBadge(r.status)}`}>{r.status?.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default IPOApply;