import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAccountsApi } from "../../api/accounts";
import { getOpenIposApi, applyIpoApi } from "../../api/ipo";
import {
  CheckIcon, ChevronIcon, ClearIcon, MinusIcon,
  PlusIcon, SearchIcon, SpinnerIcon,
} from "../../components/Icons";
import Layout from "../../components/Layout/Layout.jsx";
import toast from "react-hot-toast";
import ipoData from "../../ipo_data.json";
import { bsToAd, nowNepal } from "../../dateUtils";
import "./IPOApply.css";

const statusBadge = (s) =>
  ({ SUCCESS: "badge-success", FAILED: "badge-danger", ALREADY_APPLIED: "badge-warning", PENDING: "badge-muted" }[s] || "badge-muted");

const msToDhm = (ms) => {
  const totalMins = Math.floor(ms / 60000);
  return {
    days: Math.floor(totalMins / 1440),
    hrs:  Math.floor((totalMins % 1440) / 60),
    mins: totalMins % 60,
  };
};

const getClosingCountdown = (closeDateBs) => {
  try {
    const diff = bsToAd(closeDateBs) - nowNepal();
    if (diff <= 0) return null;
    const { days, hrs, mins } = msToDhm(diff);
    if (days > 0) return `${days}d`;
    if (hrs  > 0) return `${hrs}h`;
    if (mins > 0) return `${mins}m`;
    return null;
  } catch {
    return null;
  }
};

const getOpeningCountdown = (openDateBs) => {
  try {
    const diff = bsToAd(openDateBs) - nowNepal();
    if (diff <= 0) return "Opens today";
    const { days, hrs, mins } = msToDhm(diff);
    if (days > 0) return `in ${days}d`;
    if (hrs  > 0) return `in ${hrs}h`;
    if (mins > 0) return `in ${mins}m`;
    return "soon";
  } catch {
    return null;
  }
};

const formatBsDate = (bsDateStr) => {
  const months = [
    "Baisakh","Jestha","Ashadh","Shrawan",
    "Bhadra","Ashwin","Kartik","Mangsir",
    "Poush","Magh","Falgun","Chaitra",
  ];
  try {
    const [, m, d] = bsDateStr.split("-").map(Number);
    return `${months[m - 1]} ${d}`;
  } catch {
    return bsDateStr;
  }
};

const upcomingIpos = ipoData
  .filter((d) => {
    if (d.status !== "upcoming") return false;
    try { return bsToAd(d.openDate) > nowNepal(); } catch { return false; }
  })
  .sort((a, b) => {
    try { return bsToAd(a.openDate) - bsToAd(b.openDate); } catch { return 0; }
  });

const closingMap = ipoData.reduce((acc, d) => {
  if (d.status === "open" && d.closeDate) acc[d.companyShareId] = d.closeDate;
  return acc;
}, {});

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
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

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
    const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selectedAccounts.includes(id));
    if (allVisible) {
      setSelectedAccounts((p) => p.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedAccounts((p) => [...new Set([...p, ...visibleIds])]);
    }
  };

  const allVisibleSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((a) => selectedAccounts.includes(a.id));

  const handleSelectIpo = useCallback((ipo) => {
    setSelectedIpo(ipo);
    setResults([]);
  }, []);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setAccountSearch("");
  };

  const handleApply = async () => {
    if (!selectedIpo)          { toast.error("Select an IPO first"); return; }
    if (!selectedAccounts.length) { toast.error("Select at least one account"); return; }
    if (kitta < 10)            { toast.error("Minimum kitta is 10"); return; }

    setApplying(true);
    setResults([]);
    try {
      const res = await applyIpoApi({
        shareId:     String(selectedIpo.companyShareId),
        companyName: selectedIpo.companyName || selectedIpo.scrip || "Unknown",
        kitta,
        accountIds:  selectedAccounts,
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
    const sel       = selectedIpo?.companyShareId === ipo.companyShareId;
    const closeDateBs = closingMap[ipo.companyShareId];
    const countdown = closeDateBs ? getClosingCountdown(closeDateBs) : null;

    return (
      <div
        key={ipo.companyShareId}
        className={`ipo-item${sel ? " selected" : ""}`}
        onClick={() => handleSelectIpo(ipo)}
      >
        <div className="ipo-item-body">
          <div className="ipo-name-row">
            <p className="ipo-name">{ipo.companyName}</p>
            {countdown && <span className="ipo-countdown-badge">{countdown}</span>}
          </div>
          <p className="ipo-meta">{ipo.scrip} · ID {ipo.companyShareId}</p>
        </div>
        <div className={`ipo-radio${sel ? " on" : ""}`}>
          {sel && <span className="ipo-radio-dot" />}
        </div>
      </div>
    );
  };

  const AccountsCard = (
    <div className="card anim-fade-up" style={{ animationDelay: "0.12s" }}>
      <div className="ipo-accounts-head">
        <span className="ipo-section-label ipo-section-label--inline">Accounts</span>

        {accounts.length > 3 && (
          <div className={`ipo-search-inline${searchOpen ? " open" : ""}`}>
            {searchOpen ? (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="ipo-search-inline-input"
                  placeholder="Search…"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                />
                <button className="ipo-search-inline-close" onClick={closeSearch}>
                  <ClearIcon />
                </button>
              </>
            ) : (
              <button className="ipo-search-inline-trigger" onClick={openSearch} aria-label="Search accounts">
                <SearchIcon />
              </button>
            )}
          </div>
        )}

        {!searchOpen && filteredAccounts.length > 0 && (
          <button className="ipo-sel-all" onClick={selectAll}>
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <div className="ipo-acc-list">
        {filteredAccounts.length === 0 ? (
          <div className="empty-state"><p>No accounts match your search.</p></div>
        ) : (
          filteredAccounts.map((acc) => {
            const on = selectedAccounts.includes(acc.id);
            return (
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
  );

  const KittaCard = (
    <div className="card ipo-kitta-card anim-fade-up" style={{ animationDelay: "0.07s" }}>
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
  );

  const UpcomingCard = upcomingIpos.length === 0 ? null : (
    <div className="card ipo-upcoming-card anim-fade-up" style={{ animationDelay: "0.18s" }}>
      <div className="ipo-section-label">Upcoming IPOs</div>
      <div className="ipo-upcoming-list">
        {upcomingIpos.map((ipo) => (
          <div key={ipo.id} className="ipo-upcoming-row">
            <div className="ipo-upcoming-info">
              <p className="ipo-upcoming-name">{ipo.companyName}</p>
              <p className="ipo-upcoming-meta">
                {ipo.scrip}
                {ipo.openDate && <> · Opens {formatBsDate(ipo.openDate)}</>}
              </p>
            </div>
            {ipo.openDate && (
              <span className="ipo-opening-badge">{getOpeningCountdown(ipo.openDate)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
                        const groups    = groupIpos(ipos);
                        const mainKeys  = ["Ordinary Shares", "IPO"];
                        const ordinary  = [];
                        const others    = [];
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

                <div className="ipo-desktop-only">
                  {KittaCard}
                </div>

                <div className="ipo-desktop-only">
                  {UpcomingCard}
                </div>
              </div>

              <div className="ipo-col">
                <div className="ipo-accounts-wrapper">
                  {AccountsCard}
                </div>

                <div className="ipo-mobile-only">
                  {KittaCard}
                </div>

                <div className="ipo-mobile-only">
                  {UpcomingCard}
                </div>

                <div className="ipo-desktop-apply">
                  <ApplyButton />
                </div>

                {results.length > 0 && (
                  <div className="card anim-fade-up">
                    <div className="ipo-section-label">Results</div>
                    <div className="ipo-results-list">
                      {results.map((r, i) => (
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

export default IPOApply;