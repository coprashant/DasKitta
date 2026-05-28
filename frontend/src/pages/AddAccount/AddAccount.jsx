import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  addAccountApi, getAccountsApi,
  deleteAccountApi, getDpListApi, getBankByDpApi,
} from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import { InfoIcon, SpinnerIcon, DragHandleIcon , EyeIcon, EyeOffIcon} from "../../components/Icons";
import toast from "react-hot-toast";
import "./AddAccount.css";

const EMPTY_FORM = { dpId: "", dpCode: "", username: "", password: "", bankId: "", crn: "", pin: "" };

const AddAccount = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { refreshAccounts, activeAccount, setActiveAccount, reorderAccounts } = useAccount();
  const [form, setForm] = useState(EMPTY_FORM);
  const [accounts, setAccounts] = useState([]);
  const [dpList, setDpList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [dpLoading, setDpLoading] = useState(true);
  const [accsLoading, setAccsLoading] = useState(true);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);

  const dragIndex = useRef(null);

  useEffect(() => {
    fetchAccounts();
    fetchDpList();
  }, []);

  const fetchDpList = async () => {
    setDpLoading(true);
    try {
      const res = await getDpListApi();
      setDpList(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load DP list. Please refresh.");
    } finally {
      setDpLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setAccsLoading(true);
    try {
      const res = await getAccountsApi();
      const list = Array.isArray(res.data) ? res.data : [];
      const stored = (() => {
        try {
          const s = localStorage.getItem("dk-account-order");
          return s ? JSON.parse(s) : [];
        } catch { return []; }
      })();
      const map = new Map(list.map((a) => [a.id, a]));
      const ordered = stored.filter((id) => map.has(id)).map((id) => map.get(id));
      const seen = new Set(stored);
      const rest = list.filter((a) => !seen.has(a.id));
      setAccounts([...ordered, ...rest]);
    } catch {
      toast.error("Failed to load saved accounts.");
    } finally {
      setAccsLoading(false);
    }
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleDpChange = async (e) => {
    const selectedId = e.target.value;
    const dp = dpList.find((d) => String(d.id) === String(selectedId));
    setForm((f) => ({ ...f, dpId: selectedId, dpCode: dp ? dp.code : "", bankId: "" }));
    if (!selectedId) return;
    setBankLookupLoading(true);
    try {
      const res = await getBankByDpApi(selectedId);
      const bankId = res.data?.bankId;
      // only set bankId if it is a valid truthy number
      if (bankId) setForm((f) => ({ ...f, bankId: String(bankId) }));
    } catch {
      // silent fail on bank lookup
    } finally {
      setBankLookupLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dpId || !form.username || !form.password) {
      toast.error("DP username and password are required");
      return;
    }
    if (!form.crn.trim()) {
      toast.error("CRN number is required for IPO applications");
      return;
    }
    // guard against missing bankId before submit
    if (!form.bankId) {
      toast.error("Bank ID could not be resolved. Please reselect your DP.");
      return;
    }
    setLoading(true);
    try {
      await addAccountApi(form);
      toast.success("Account added successfully");
      setForm(EMPTY_FORM);
      await fetchAccounts();
      await refreshAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this Meroshare account?")) return;
    setDeleting(id);
    try {
      await deleteAccountApi(id);
      toast.success("Account removed");
      const next = accounts.filter((a) => a.id !== id);
      setAccounts(next);
      // full replace in localStorage via reorderAccounts
      reorderAccounts(next);
      await refreshAccounts();
    } catch {
      toast.error("Failed to remove account");
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectAccount = (acc) => {
    setActiveAccount(acc);
    toast.success(`Switched to ${acc.fullName}`);
    navigate("/dashboard");
  };

  const handleDragStart = (e, index) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (index) => {
    if (dragIndex.current === index) return;
    const next = [...accounts];
    const dragged = next.splice(dragIndex.current, 1)[0];
    next.splice(index, 0, dragged);
    dragIndex.current = index;
    setAccounts(next);
  };

  const handleDragEnd = () => {
    reorderAccounts(accounts);
    dragIndex.current = null;
  };

  const selectedDp = dpList.find((d) => String(d.id) === String(form.dpId));

  return (
    <Layout>
      <div className="page">
        <h1 className="page-title">Meroshare Accounts</h1>
        <p className="page-subtitle">
          Add and manage your Meroshare credentials. Passwords are AES-encrypted before storing.
        </p>

        <div className="add-account-layout">
          <div className="card anim-fade-up">
            <h2 className="card-section-title">Add new account</h2>
            <form onSubmit={handleSubmit}>

              <div className="form-group">
                <label className="form-label">Depository Participant (DP)</label>
                <select
                  className="input"
                  name="dpId"
                  value={form.dpId}
                  onChange={handleDpChange}
                  required
                  disabled={dpLoading}
                >
                  <option value="">
                    {dpLoading ? "Loading DPs..." : "Select your bank or DP"}
                  </option>
                  {dpList.map((dp) => (
                    <option key={dp.id} value={dp.id}>
                      {dp.name} ({dp.code})
                    </option>
                  ))}
                </select>
                {selectedDp && (
                  <span className="form-hint">
                    DP code: {selectedDp.code} · ID: {selectedDp.id}
                    {bankLookupLoading && " · Looking up bank..."}
                    {!bankLookupLoading && form.bankId && ` · Bank ID: ${form.bankId}`}
                    {!bankLookupLoading && !form.bankId && (
                      <span style={{ color: "var(--color-danger, #e53e3e)" }}>
                        {" "}Bank ID not found. Try a different DP.
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Meroshare username</label>
                <input
                  className="input" type="text" name="username"
                  value={form.username} onChange={handleChange}
                  placeholder="Your Meroshare username" required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meroshare password</label>
                <div style={{ position: "relative" }}>
                  <input
                      className="input" type={showPassword ? "text" : "password"} name="password"
                      value={form.password} onChange={handleChange}
                      placeholder="Your Meroshare password" required
                      style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-3)", display: "flex", alignItems: "center", padding: 0,
                          }}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">CRN number</label>
                <input
                  className="input" type="text" name="crn"
                  value={form.crn} onChange={handleChange}
                  placeholder="Bank CRN (required for IPO apply)" required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Transaction PIN</label>
                <div style={{ position: "relative" }}>
                  <input
                      className="input" type={showPin ? "text" : "password"} name="pin"
                      value={form.pin} onChange={handleChange}
                      placeholder="Meroshare transaction PIN (MPIN)"
                      style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPin(v => !v)}
                          aria-label={showPin ? "Hide PIN" : "Show PIN"}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-3)", display: "flex", alignItems: "center", padding: 0,
                          }}>
                    {showPin ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>


              <div className="form-note">
                <InfoIcon />
                <span>
                  Your password and PIN are AES-encrypted before saving.
                  Bank details are resolved automatically from your selected DP.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading || dpLoading || bankLookupLoading}
                style={{ marginTop: 4 }}
              >
                {loading ? <><SpinnerIcon /> Verifying and adding</> : "Add account"}
              </button>
            </form>
          </div>

          <div>
            <div className="section-head-row">
              <span className="section-title-sm">
                Saved accounts ({accounts.length})
              </span>
              {accounts.length > 1 && (
                <span className="acc-click-hint">Drag to reorder. Click to switch accounts.</span>
              )}
            </div>

            {accsLoading ? (
              <div className="saved-accounts-list">
                {[1, 2].map((k) => (
                  <div className="card saved-account-card" key={k}>
                    <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 10, width: "35%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="card empty-state">
                <p>No accounts added yet.</p>
              </div>
            ) : (
              <div className="saved-accounts-list">
                {accounts.map((acc, i) => {
                  const isActive = activeAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`card saved-account-card anim-fade-up${isActive ? " saved-account-card-active" : ""}`}
                      style={{ animationDelay: `${i * 0.07}s`, cursor: "grab" }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragEnter={() => handleDragEnter(i)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => handleSelectAccount(acc)}
                      title={isActive ? "Go to dashboard" : `Switch to ${acc.fullName}`}
                    >
                      <DragHandleIcon />
                      <div className={`saved-account-avatar${isActive ? " saved-account-avatar-active" : ""}`}>
                        {acc.fullName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="saved-account-info">
                        <p className="saved-account-name">{acc.fullName}</p>
                        <p className="saved-account-meta">
                          {acc.username}
                          {acc.dpCode ? ` DP ${acc.dpCode}` : acc.dpId ? ` DP ${acc.dpId}` : ""}
                        </p>
                        {acc.boid && (
                          <p className="saved-account-boid">BOID: {acc.boid}</p>
                        )}
                      </div>
                      {isActive ? (
                        <span className="saved-account-active-badge">Active</span>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }}
                          disabled={deleting === acc.id}
                        >
                          {deleting === acc.id ? <SpinnerIcon /> : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AddAccount;