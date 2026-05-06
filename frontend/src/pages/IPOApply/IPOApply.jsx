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
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setIpoError(null);
    try {
      const [ipoRes, accRes] = await Promise.allSettled([getOpenIposApi(), getAccountsApi()]);
      if (ipoRes.status === "fulfilled") {
        setIpos(Array.isArray(ipoRes.value.data) ? ipoRes.value.data : []);
      } else {
        const m = ipoRes.reason?.response?.data?.message || "Failed to load open IPOs";
        setIpoError(m);
        toast.error(m);
      }
      if (accRes.status === "fulfilled") {
        setAccounts(Array.isArray(accRes.value.data) ? accRes.value.data : []);
      } else {
        toast.error("Failed to load accounts");
      }
    } finally {
      setLoading(false);
    }
  };

  const groupIpos = (ipoList) => {
    return ipoList.reduce((acc, ipo) => {
      const category = ipo.shareTypeName || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(ipo);
      return acc;
    }, {});
  };

  const toggleAccount = (id) =>
    setSelectedAccounts((p) => p.includes(id) ? p.filter((a) => a !== id) : [...p, id]);

  const selectAll = () =>
    setSelectedAccounts(selectedAccounts.length === accounts.length ? [] : accounts.map((a) => a.id));

  const handleApply = async () => {
    if (!selectedIpo) { toast.error("Select an IPO first"); return; }
    if (!selectedAccounts.length) { toast.error("Select at least one account"); return; }
    if (kitta < 10) { toast.error("Minimum kitta is 10"); return; }

    setApplying(true);
    setResults([]);
    try {
      const res = await applyIpoApi({
        shareId: String(selectedIpo.companyShareId),
        companyName: selectedIpo.companyName || selectedIpo.scrip || "Unknown",
        kitta,
        accountIds: selectedAccounts,
      });
      setResults(res.data);
      const ok = res.data.filter((r) => r.status === "SUCCESS").length;
      if (ok > 0) toast.success(`Applied for ${ok} account(s)`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const renderIpoItem = (ipo) => {
    const sel = selectedIpo?.companyShareId === ipo.companyShareId;
    return (
      <div
        key={ipo.companyShareId}
        className={`ipo-item${sel ? " selected" : ""}`}
        onClick={() => setSelectedIpo(ipo)}
      >
        <div>
          <p className="ipo-name">{ipo.companyName}</p>
          <p className="ipo-meta">{ipo.scrip} &middot; ID {ipo.companyShareId}</p>
        </div>
        <div className={`ipo-check${sel ? " on" : ""}`}>
          {sel && <CheckIcon />}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="page">
        <h1 className="page-title">Apply IPO</h1>
        <p className="page-subtitle">Select an IPO and accounts, then apply in one click.</p>

        {loading ? (
          <div className="apply-layout">
            <div className="apply-col">
              <div className="card">
                <div className="card-section-title-sm">Open IPOs</div>
                {[1, 2, 3].map((k) => (
                  <div key={k} className="ipo-skeleton">
                    <div className="skeleton" style={{ height: 13, width: "60%", marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: "35%" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="apply-col">
              <div className="card"><div className="card-section-title-sm">Select Accounts</div></div>
            </div>
          </div>
        ) : (
          <div className="apply-layout">
            <div className="apply-col">
              <div className="card anim-fade-up">
                <p className="card-section-title-sm">Open IPOs</p>
                {ipoError ? (
                  <div className="empty-state">
                    <p style={{ color: "var(--danger)" }}>{ipoError}</p>
                    <button className="btn btn-secondary" onClick={fetchData} style={{ marginTop: 12 }}>Retry</button>
                  </div>
                ) : ipos.length === 0 ? (
                  <div className="empty-state"><p>No IPOs are currently open.</p></div>
                ) : (
                  <div className="ipo-list">
                    {(() => {
                      const groups = groupIpos(ipos);
                      const mainKeys = ["Ordinary Shares", "IPO"];
                      const ordinary = [];
                      const others = [];
                      let othersCount = 0;

                      Object.entries(groups).forEach(([key, val]) => {
                        if (mainKeys.includes(key)) {
                          ordinary.push(...val);
                        } else {
                          others.push([key, val]);
                          othersCount += val.length;
                        }
                      });

                      return (
                        <>
                          {ordinary.length > 0 ? (
                            <div className="ipo-category-group">
                              <div className="category-label">Ordinary Shares</div>
                              {ordinary.map(renderIpoItem)}
                            </div>
                          ) : (
                            <div className="empty-state"><p>No Ordinary Shares available.</p></div>
                          )}

                          {others.length > 0 && (
                            <div className="others-container">
                              <button 
                                className="btn-toggle-others"
                                onClick={() => setShowOthers(!showOthers)}
                              >
                                {showOthers ? "Hide Reserved Categories" : `View Reserved Categories (${othersCount})`}
                                <ChevronIcon rotated={showOthers} />
                              </button>

                              {showOthers && (
                                <div className="others-content anim-fade-down">
                                  {others.map(([category, categoryIpos]) => (
                                    <div key={category} className="ipo-category-group">
                                      <div className="category-label">{category}</div>
                                      {categoryIpos.map(renderIpoItem)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="card anim-fade-up" style={{ animationDelay: "0.06s" }}>
                <p className="card-section-title-sm">Kitta to apply</p>
                <div className="kitta-row">
                  <button type="button" className="kitta-stepper" onClick={() => setKitta((k) => Math.max(10, k - 1))}><MinusIcon /></button>
                  <input type="number" className="kitta-val" value={kitta} min={10} onChange={(e) => setKitta(parseInt(e.target.value) || 10)} />
                  <button type="button" className="kitta-stepper" onClick={() => setKitta((k) => k + 1)}><PlusIcon /></button>
                </div>
              </div>
            </div>

            <div className="apply-col">
              <div className="card anim-fade-up" style={{ animationDelay: "0.1s" }}>
                <div className="accounts-head">
                  <span className="card-section-title-sm">Select accounts</span>
                  {accounts.length > 0 && (
                    <button className="sel-all-btn" onClick={selectAll}>
                      {selectedAccounts.length === accounts.length ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
                <div className="acc-checks">
                  {accounts.map((acc) => {
                    const on = selectedAccounts.includes(acc.id);
                    return (
                      <div key={acc.id} className={`acc-check-row${on ? " on" : ""}`} onClick={() => toggleAccount(acc.id)}>
                        <div className={`check-box${on ? " on" : ""}`}>{on && <CheckIcon />}</div>
                        <div>
                          <p className="acc-name">{acc.fullName}</p>
                          <p className="acc-meta">{acc.username}{acc.dpCode ? ` \u00b7 DP ${acc.dpCode}` : ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button className="btn btn-primary btn-full" onClick={handleApply} disabled={applying || !selectedIpo || !selectedAccounts.length}>
                {applying ? <><SpinnerIcon /> Applying...</> : `Apply to ${selectedAccounts.length} account(s)`}
              </button>

              {results.length > 0 && (
                <div className="card anim-fade-up">
                  <p className="card-section-title-sm">Results</p>
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
        )}
      </div>
    </Layout>
  );
};

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const SpinnerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
);
const ChevronIcon = ({ rotated }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rotated ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
);

export default IPOApply;