import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateAccountApi, deleteAccountApi } from "../../api/accounts";
import { useAccount } from "../../context/AccountContext";
import Layout from "../../components/Layout/Layout.jsx";
import {
    SpinnerIcon, EyeIcon, EyeOffIcon,
    MoreIcon, CheckIcon, CloseIcon, ChevronIcon, InfoIcon, IconPlus,
} from "../../components/Icons";
import toast from "react-hot-toast";
import "./Accounts.css";

const EMPTY_EDIT_FORM = { password: "", pin: "" };

const Accounts = () => {
    const navigate = useNavigate();
    const {
        accounts, activeAccount, setActiveAccount,
        loading, refreshAccounts, reorderAccounts,
    } = useAccount();

    const [deleting, setDeleting] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
    const [editShowPassword, setEditShowPassword] = useState(false);
    const [editShowPin, setEditShowPin] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setActiveMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await deleteAccountApi(id);
            toast.success("Account removed");
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
        reorderAccounts(next);
        setActiveMenu(null);
    };

    return (
        <Layout>
            <div className="page">
                <div className="accounts-header-row">
                    <div className="accounts-title-container">
                        <div className="accounts-title-group">
                            <h1 className="page-title">Accounts</h1>
                            <Link to="/accounts/add" className="btn btn-primary btn-header-add">
                                <IconPlus /><span>Add account</span>
                            </Link>
                        </div>
                        <p className="page-subtitle">
                            Switch reorder and manage your saved Meroshare accounts
                        </p>
                    </div>
                </div>

                {accounts.length > 1 && !loading && (
                    <p className="acc-click-hint acc-click-hint-top">
                        Use the arrows to reorder Click a card to switch accounts
                    </p>
                )}

                {loading ? (
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
                        <span className="empty-state-sub">Add your first Meroshare account to get started</span>
                        <Link to="/accounts/add" className="btn btn-primary empty-state-cta">
                            Add account
                        </Link>
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
                                            {acc.boid && (
                                                <p className="saved-account-boid">BOID {acc.boid}</p>
                                            )}
                                            <p className="saved-account-meta">
                                                {acc.dpCode ? ` DP ${acc.dpCode}` : acc.dpId ? ` DP ${acc.dpId}` : ""}
                                            </p>

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
                                                    <button type="button" className="input-icon-btn" onClick={() => setEditShowPassword((v) => !v)}
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
                                                    <button type="button" className="input-icon-btn" onClick={() => setEditShowPin((v) => !v)}
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
        </Layout>
    );
};

export default Accounts;