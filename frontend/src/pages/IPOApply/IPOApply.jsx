import { useState, useEffect, useMemo, useCallback } from "react";
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
  const [accountSearch, setAccountSearch] = useState("");

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

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.fullName?.toLowerCase().includes(q) || a.username?.toLowerCase().includes(q)
    );
  }, [accounts, accountSearch]);

  const groupIpos = (ipoList) =>
    ipoList.reduce((acc, ipo) => {
      const cat = ipo.shareTypeName || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(ipo);
      return acc;
    }, {});

  const toggleAccount = (id) =>
    setSelectedAccounts((p) => p.includes(id) ? p.filter((a) => a !== id) : [...p, id]);

  const selectAll = () => {
    const visibleIds = filteredAccounts.map((a) => a.id);
    // FIX: check only visible ids for the toggle so label matches visible state
    const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selectedAccounts.includes(id));
    if (allVisible) {
      setSelectedAccounts((p) => p.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedAccounts((p) => [...new Set([...p, ...visibleIds])]);
    }
  };

  const allVisibleSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedAccounts.includes(a.id));

  // FIX: clear stale results when a different IPO is selected
  const handleSelectIpo = useCallback((ipo) => {
    setSelectedIpo(ipo);
    setResults([]);
  }, []);

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

  const canApply = !!selectedIpo && selectedAccounts.length > 0 && !applying;

  // FIX: extracted ApplyButton outside render cycle via useCallback to avoid re-creating on every render
  const ApplyButton = useCallback(({ className = "" }) => (
    <button
      className={`ipo-apply-btn${canApply ? "" : " disabled"} ${className}`.trim()}
      onClick={handleApply}
      disabled={!canApply}
    >
      {applying
        ? <><SpinnerIcon /> Applying…</>
        : `Apply to ${selectedAccounts.length} account${selectedAccounts.length !== 1 ? "s" : ""}`}
    </button>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [canApply, applying, selectedAccounts.length]);

  const renderIpoItem = (ipo) => {
    const sel = selectedIpo?.companyShareId === ipo.companyShareId;
    return (
      // FIX: use handleSelectIpo to clear results on selection change
      <div key={ipo.companyShareId} className={`ipo-item${sel ? " selected" : ""}`} onClick={() => handleSelectIpo(ipo)}>
        <div className="ipo-item-body">
          <p className="ipo-name">{ipo.companyName}</p>
          <p className="ipo-meta">{ipo.scrip} · ID {ipo.companyShareId}</p>
        </div>
        <div className={`ipo-radio${sel ? " on" : ""}`}>
          {sel && <span className="ipo-radio-dot" />}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="page ipo-page">
        <h1 className="page-title">IPO Application</h1>
        <p className="page-subtitle">Select an offering and accounts to apply in one step.</p>

        {loading ? (
          <div className="ipo-layout">
            <div className="ipo-col">
              <div className="card">
                <div className="ipo-section-label">Open IPOs</div>
                {[1, 2, 3].map((k) => (
                  <div key={k} className="ipo-skel-row">
                    <div className="skeleton" style={{ height: 13, width: "58%", marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: "32%" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="ipo-col">
              <div className="card">
                <div className="ipo-section-label">Select Accounts</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ipo-layout">
              <div className="ipo-col">
                <div className="card anim-fade-up">
                  <div className="ipo-section-label">Open IPOs</div>
                  {ipoError ? (
                    <div className="empty-state">
                      <p style={{ color: "var(--danger)" }}>{ipoError}</p>
                      <button className="btn btn-secondary" onClick={fetchData}>Retry</button>
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
                          if (mainKeys.includes(key)) ordinary.push(...val);
                          else { others.push([key, val]); othersCount += val.length; }
                        });
                        return (
                          <>
                            {ordinary.length > 0 ? (
                              <div className="ipo-group">
                                <div className="ipo-group-label">Ordinary Shares</div>
                                {ordinary.map(renderIpoItem)}
                              </div>
                            ) : (
                              <div className="empty-state"><p>No Ordinary Shares available.</p></div>
                            )}
                            {others.length > 0 && (
                              <div className="ipo-others-wrap">
                                <button className="ipo-toggle-others" onClick={() => setShowOthers(!showOthers)}>
                                  {showOthers ? "Hide Reserved Categories" : `Reserved Categories (${othersCount})`}
                                  <ChevronIcon rotated={showOthers} />
                                </button>
                                {showOthers && (
                                  <div className="ipo-others-content anim-fade-up">
                                    {others.map(([cat, catIpos]) => (
                                      <div key={cat} className="ipo-group">
                                        <div className="ipo-group-label">{cat}</div>
                                        {catIpos.map(renderIpoItem)}
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

                <div className="card anim-fade-up" style={{ animationDelay: "0.07s" }}>
                  <div className="ipo-section-label">Kitta to apply</div>
                  <div className="kitta-row">
                    <button type="button" className="kitta-btn" onClick={() => setKitta((k) => Math.max(10, k - 1))}>
                      <MinusIcon />
                    </button>
                    <div className="kitta-display">
                      <input
                        type="number"
                        className="kitta-input"
                        value={kitta}
                        min={10}
                        onChange={(e) => {
                          // FIX: parseInt can return NaN on empty string; default to 10 before Math.max
                          const parsed = parseInt(e.target.value, 10);
                          setKitta(Math.max(10, isNaN(parsed) ? 10 : parsed));
                        }}
                      />
                      <span className="kitta-unit">kitta</span>
                    </div>
                    <button type="button" className="kitta-btn" onClick={() => setKitta((k) => k + 1)}>
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              </div>

              <div className="ipo-col">
                <div className="card anim-fade-up" style={{ animationDelay: "0.12s" }}>
                  <div className="ipo-accounts-head">
                    <span className="ipo-section-label ipo-section-label--inline">Accounts</span>
                    {filteredAccounts.length > 0 && (
                      <button className="ipo-sel-all" onClick={selectAll}>
                        {allVisibleSelected ? "Deselect all" : "Select all"}
                      </button>
                    )}
                  </div>

                  {accounts.length > 3 && (
                    <div className="ipo-search-wrap">
                      <span className="ipo-search-icon"><SearchIcon /></span>
                      <input
                        type="text"
                        className="input ipo-search-input"
                        placeholder="Search accounts…"
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                      />
                      {accountSearch && (
                        <button className="ipo-search-clear" onClick={() => setAccountSearch("")}>
                          <ClearIcon />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="ipo-acc-list">
                    {filteredAccounts.length === 0 ? (
                      <div className="empty-state"><p>No accounts match your search.</p></div>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const on = selectedAccounts.includes(acc.id);
                        return (
                          // FIX: use acc.id as key instead of array index for stable reconciliation
                          <div key={acc.id} className={`ipo-acc-row${on ? " on" : ""}`} onClick={() => toggleAccount(acc.id)}>
                            <div className={`ipo-checkbox${on ? " on" : ""}`}>{on && <CheckIcon />}</div>
                            <div className="ipo-acc-info">
                              <p className="ipo-acc-name">{acc.fullName}</p>
                              <p className="ipo-acc-meta">{acc.username}{acc.dpCode ? ` · DP ${acc.dpCode}` : ""}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="ipo-desktop-apply">
                  <ApplyButton />
                </div>

                {results.length > 0 && (
                  <div className="card anim-fade-up">
                    <div className="ipo-section-label">Results</div>
                    <div className="ipo-results-list">
                      {results.map((r, i) => (
                        // FIX: use stable key combining username and index to avoid collisions
                        <div className="ipo-result-row" key={`${r.username ?? ""}_${i}`}>
                          <div>
                            <p className="ipo-result-name">{r.fullName || r.username}</p>
                            <p className="ipo-result-msg">{r.message}</p>
                          </div>
                          <span className={`badge ${statusBadge(r.status)}`}>{r.status?.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="ipo-sticky-bar">
              <div className="ipo-sticky-summary">
                {/* FIX: only show total kitta line when accounts are selected to avoid showing 0 */}
                <span>{selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""}</span>
                {selectedAccounts.length > 0 && (
                  <>
                    <span className="ipo-sticky-dot">·</span>
                    <span>{kitta * selectedAccounts.length} total kitta</span>
                  </>
                )}
                {selectedIpo && (
                  <><span className="ipo-sticky-dot">·</span><span className="ipo-sticky-scrip">{selectedIpo.scrip}</span></>
                )}
              </div>
              <ApplyButton className="ipo-sticky-apply" />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const MinusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const SpinnerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
);
const ChevronIcon = ({ rotated }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rotated ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const ClearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export default IPOApply;