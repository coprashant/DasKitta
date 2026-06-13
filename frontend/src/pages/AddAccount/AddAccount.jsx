import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  addAccountApi, getAccountsApi, updateAccountApi,
  deleteAccountApi, getDpListApi, getBankByDpApi,
} from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import {
  InfoIcon, SpinnerIcon, EyeIcon, EyeOffIcon,
  MoreIcon, CheckIcon, CloseIcon, ChevronIcon,
} from "../../components/Icons";
import toast from "react-hot-toast";
import "./AddAccount.css";

const EMPTY_FORM = { dpId: "", dpCode: "", username: "", password: "", bankId: "", crn: "", pin: "" };
const EMPTY_EDIT_FORM = { password: "", pin: "" };

const AddAccount = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { refreshAccounts, activeAccount, setActiveAccount, reorderAccounts } = useAccount();
  const [form, setForm] = useState(EMPTY_FORM);
  const [accounts, setAccounts] = useState([]);
  const [dpList, setDpList] = useState([]);
  const [dpFilter, setDpFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [dpLoading, setDpLoading] = useState(true);
  const [accsLoading, setAccsLoading] = useState(true);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);
  const [dpError, setDpError] = useState(false);

  const [activeMenu, setActiveMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editShowPin, setEditShowPin] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const menuRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
    fetchDpList();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDpList = async () => {
    setDpLoading(true);
    setDpError(false);
    try {
      const res = await getDpListApi();
      setDpList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDpError(true);
      toast.error("Failed to load DP list");
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
      toast.error("Failed to load saved accounts");
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
    if (!form.bankId) {
      toast.error("Bank ID could not be resolved Please reselect your DP");
      return;
    }
    setLoading(true);
    try {
      await addAccountApi(form);
      toast.success("Account added successfully");
      setForm(EMPTY_FORM);
      setDpFilter("");
      await fetchAccounts();
      await refreshAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add account");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteAccountApi(id);
      toast.success("Account removed");
      const next = accounts.filter((a) => a.id !== id);
      setAccounts(next);
      reorderAccounts(next);
      await refreshAccounts();
    } catch {
      toast.error("Failed to remove account");
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSelectAccount = (acc) => {
    setActiveAccount(acc);
    toast.success(`Switched to ${acc.fullName}`);
    navigate("/dashboard");
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setEditForm(EMPTY_EDIT_FORM);
    setEditShowPassword(false);
    setEditShowPin(false);
    setActiveMenu(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleEditChange = (e) => setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleEditSubmit = async (e, accId) => {
    e.preventDefault();
    if (!editForm.password.trim() && !editForm.pin.trim()) {
      toast.error("Enter a new password or PIN to update");
      return;
    }
    setEditSaving(true);
    try {
      await updateAccountApi(accId, editForm);
      toast.success("Account credentials updated");
      closeEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update account");
    } finally {
      setEditSaving(false);
    }
  };

  const moveAccount = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= accounts.length) return;
    const next = [...accounts];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setAccounts(next);
    reorderAccounts(next);
    setActiveMenu(null);
  };

  const selectedDp = dpList.find((d) => String(d.id) === String(form.dpId));

  const filteredDpList = dpFilter.trim()
      ? dpList.filter((dp) =>
          `${dp.name} ${dp.code}`.toLowerCase().includes(dpFilter.trim().toLowerCase()))
      : dpList;

  return (
      <Layout>
        <div className="page">
          <h1 className="page-title">Meroshare Accounts</h1>
          <p className="page-subtitle">
            Add and manage your Meroshare credentials Passwords are AES encrypted before storing
          </p>

          <div className="add-account-layout">
            <div className="card anim-fade-up">
              <h2 className="card-section-title">Add new account</h2>
              <form onSubmit={handleSubmit}>

                <div className="form-group">
                  <label className="form-label">Depository Participant (DP)</label>
                  {dpError ? (
                      <div className="dp-error-box">
                        <span>Could not load the DP list</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDpList}>
                          Retry
                        </button>
                      </div>
                  ) : (
                      <>
                        <input
                            className="input"
                            type="text"
                            placeholder={dpLoading ? "Loading DPs..." : "Search your bank or DP"}
                            value={dpFilter}
                            onChange={(e) => setDpFilter(e.target.value)}
                            disabled={dpLoading}
                            style={{ marginBottom: 8 }}
                        />
                        <select
                            className="input"
                            name="dpId"
                            value={form.dpId}
                            onChange={handleDpChange}
                            required
                            disabled={dpLoading}
                            size={dpFilter.trim() ? Math.min(filteredDpList.length + 1, 6) : undefined}
                        >
                          <option value="">
                            {dpLoading ? "Loading DPs..." : "Select your bank or DP"}
                          </option>
                          {filteredDpList.map((dp) => (
                              <option key={dp.id} value={dp.id}>
                                {dp.name} ({dp.code})
                              </option>
                          ))}
                        </select>
                      </>
                  )}
                  {selectedDp && (
                      <span className="form-hint">
                    DP code {selectedDp.code} ID {selectedDp.id}
                        {bankLookupLoading && " Looking up bank..."}
                        {!bankLookupLoading && form.bankId && ` Bank ID ${form.bankId}`}
                        {!bankLookupLoading && !form.bankId && (
                            <span className="form-hint-danger">
                        {" "}Bank ID not found Try a different DP
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
                  <div className="input-with-icon">
                    <input
                        className="input" type={showPassword ? "text" : "password"} name="password"
                        value={form.password} onChange={handleChange}
                        placeholder="Your Meroshare password" required
                    />
                    <button type="button" className="input-icon-btn" onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}>
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
                  <div className="input-with-icon">
                    <input
                        className="input" type={showPin ? "text" : "password"} name="pin"
                        value={form.pin} onChange={handleChange}
                        placeholder="Meroshare transaction PIN (MPIN)"
                    />
                    <button type="button" className="input-icon-btn" onClick={() => setShowPin(v => !v)}
                            aria-label={showPin ? "Hide PIN" : "Show PIN"}>
                      {showPin ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className="form-note">
                  <InfoIcon />
                  <span>
                  Your password and PIN are AES encrypted before saving
                  Bank details are resolved automatically from your selected DP
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
                    <span className="acc-click-hint">Use the arrows to reorder Click a card to switch accounts</span>
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
                    <p>No accounts added yet</p>
                    <span className="empty-state-sub">Add your first Meroshare account using the form</span>
                  </div>
              ) : (
                  <div className="saved-accounts-list">
                    {accounts.map((acc, i) => {
                      const isActive = activeAccount?.id === acc.id;
                      const isEditing = editingId === acc.id;
                      const isConfirming = confirmDeleteId === acc.id;
                      return (
                          <div
                              key={acc.id}
                              className={`card saved-account-card anim-fade-up${isActive ? " saved-account-card-active" : ""}${activeMenu === acc.id ? " saved-account-card-menu-open" : ""}`}
                              style={{ animationDelay: `${i * 0.07}s` }}
                          >
                            <div className="saved-account-row">
                              <div className="reorder-arrows">
                                <button
                                    className="reorder-arrow-btn"
                                    aria-label="Move up"
                                    onClick={() => moveAccount(i, -1)}
                                    disabled={i === 0}
                                >
                                  <ChevronIcon rotated />
                                </button>
                                <button
                                    className="reorder-arrow-btn"
                                    aria-label="Move down"
                                    onClick={() => moveAccount(i, 1)}
                                    disabled={i === accounts.length - 1}
                                >
                                  <ChevronIcon />
                                </button>
                              </div>

                              <div
                                  className={`saved-account-avatar${isActive ? " saved-account-avatar-active" : ""}`}
                                  onClick={() => !isEditing && handleSelectAccount(acc)}
                                  style={{ cursor: isEditing ? "default" : "pointer" }}
                              >
                                {acc.fullName?.charAt(0)?.toUpperCase() || "?"}
                              </div>

                              <div
                                  className="saved-account-info"
                                  onClick={() => !isEditing && handleSelectAccount(acc)}
                                  style={{ cursor: isEditing ? "default" : "pointer" }}
                              >
                                <p className="saved-account-name">{acc.fullName}</p>
                                <p className="saved-account-meta">
                                  {acc.username}
                                  {acc.dpCode ? ` DP ${acc.dpCode}` : acc.dpId ? ` DP ${acc.dpId}` : ""}
                                </p>
                                {acc.boid && (
                                    <p className="saved-account-boid">BOID {acc.boid}</p>
                                )}
                              </div>

                              {isActive && (
                                  <span className="saved-account-active-badge">Active</span>
                              )}

                              <div className="saved-account-menu-wrap" ref={activeMenu === acc.id ? menuRef : null}>
                                <button
                                    className="icon-btn"
                                    aria-label="Account options"
                                    onClick={() => setActiveMenu(activeMenu === acc.id ? null : acc.id)}
                                >
                                  <MoreIcon />
                                </button>
                                {activeMenu === acc.id && (
                                    <div className="account-menu">
                                      <div className="account-menu-head">
                                        <span className="account-menu-title">Account options</span>
                                        <button className="icon-btn icon-btn-sm" aria-label="Close menu" onClick={() => setActiveMenu(null)}>
                                          <CloseIcon />
                                        </button>
                                      </div>
                                      {!isActive && (
                                          <button className="account-menu-item" onClick={() => { setActiveMenu(null); handleSelectAccount(acc); }}>
                                            Set as active
                                          </button>
                                      )}
                                      <button className="account-menu-item" onClick={() => openEdit(acc)}>
                                        Edit credentials
                                      </button>
                                      <button
                                          className="account-menu-item account-menu-item-danger"
                                          onClick={() => { setActiveMenu(null); setConfirmDeleteId(acc.id); }}
                                      >
                                        Remove account
                                      </button>
                                    </div>
                                )}
                              </div>
                            </div>

                            {isEditing && (
                                <form className="edit-account-panel" onSubmit={(e) => handleEditSubmit(e, acc.id)}>
                                  <div className="edit-panel-head">
                                    <span className="edit-panel-title">Edit credentials</span>
                                    <button type="button" className="icon-btn" aria-label="Cancel edit" onClick={closeEdit}>
                                      <CloseIcon />
                                    </button>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">New password</label>
                                    <div className="input-with-icon">
                                      <input
                                          className="input" type={editShowPassword ? "text" : "password"}
                                          name="password" value={editForm.password} onChange={handleEditChange}
                                          placeholder="Leave blank to keep current password"
                                      />
                                      <button type="button" className="input-icon-btn" onClick={() => setEditShowPassword(v => !v)}
                                              aria-label={editShowPassword ? "Hide password" : "Show password"}>
                                        {editShowPassword ? <EyeOffIcon /> : <EyeIcon />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="form-group">
                                    <label className="form-label">New transaction PIN</label>
                                    <div className="input-with-icon">
                                      <input
                                          className="input" type={editShowPin ? "text" : "password"}
                                          name="pin" value={editForm.pin} onChange={handleEditChange}
                                          placeholder="Leave blank to keep current PIN"
                                      />
                                      <button type="button" className="input-icon-btn" onClick={() => setEditShowPin(v => !v)}
                                              aria-label={editShowPin ? "Hide PIN" : "Show PIN"}>
                                        {editShowPin ? <EyeOffIcon /> : <EyeIcon />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="form-note">
                                    <InfoIcon />
                                    <span>
                              DP username CRN and bank details cannot be changed
                              If you update your password we verify it with Meroshare before saving
                            </span>
                                  </div>

                                  <div className="edit-panel-actions">
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={closeEdit}>
                                      Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={editSaving}>
                                      {editSaving ? <><SpinnerIcon /> Saving</> : <><CheckIcon /> Save changes</>}
                                    </button>
                                  </div>
                                </form>
                            )}

                            {isConfirming && (
                                <div className="confirm-panel">
                          <span className="confirm-panel-text">
                            Remove {acc.fullName} from this app? Your Meroshare account itself is not affected
                          </span>
                                  <div className="confirm-panel-actions">
                                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>
                                      Cancel
                                    </button>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => handleDelete(acc.id)}
                                        disabled={deleting === acc.id}
                                    >
                                      {deleting === acc.id ? <SpinnerIcon /> : "Remove"}
                                    </button>
                                  </div>
                                </div>
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