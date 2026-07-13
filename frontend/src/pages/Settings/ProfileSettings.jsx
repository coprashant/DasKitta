import { useState, useEffect } from "react";
import {
    updateUsernameApi,
    updatePasswordApi,
    requestEmailChangeApi,
    confirmEmailChangeApi,
    getUserDetailsApi,
} from "../../api/auth.js";
import { ChevronIcon } from "../../components/Icons";

// pulls a readable message out of an axios error or a plain response
function readError(err, fallback) {
    const data = err?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data?.message) return data.message;
    if (err?.message) return err.message;
    return fallback;
}

function Alert({ type, text }) {
    if (!text) return null;
    return <div className={`stg-alert stg-alert-${type}`}>{text}</div>;
}

function Spinner() {
    return <span className="stg-spinner" aria-hidden="true" />;
}

// header card showing who is signed in
function ProfileHeader({ user, loading }) {
    if (loading) {
        return (
            <div className="card stg-profile-card">
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 14, width: "45%", marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 11, width: "60%" }} />
                </div>
            </div>
        );
    }

    const displayName = user?.fullName || user?.username || "Your account";
    const initial = displayName.charAt(0).toUpperCase();
    const joined = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : null;

    return (
        <div className="card stg-profile-card">
            <div className="stg-profile-avatar">{initial}</div>
            <div className="stg-profile-info">
                <p className="stg-profile-name">{displayName}</p>
                {user?.email && <p className="stg-profile-email">{user.email}</p>}
                {joined && <p className="stg-profile-joined">Member since {joined}</p>}
            </div>
        </div>
    );
}

// a single row that expands into an edit form
function SettingsRow({ label, value, children, open, onToggle }) {
    return (
        <div className="stg-row">
            <button type="button" className="stg-row-summary" onClick={onToggle}>
                <div className="stg-row-text">
                    <span className="stg-row-label">{label}</span>
                    <span className="stg-row-value">{value}</span>
                </div>
                <span className={`stg-row-chevron${open ? " stg-row-chevron-open" : ""}`}>
                    <ChevronIcon />
                </span>
            </button>

            {open && <div className="stg-row-form">{children}</div>}
        </div>
    );
}

function UsernameSection({ username, onUpdated, open, onToggle }) {
    const [newUsername, setNewUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newUsername.trim()) {
            setAlert({ type: "error", text: "Enter a username first" });
            return;
        }
        setLoading(true);
        setAlert(null);
        try {
            const res = await updateUsernameApi(newUsername.trim());
            setAlert({ type: "success", text: res.data || "Username updated" });
            onUpdated(newUsername.trim());
            setNewUsername("");
        } catch (err) {
            setAlert({ type: "error", text: readError(err, "Could not update username") });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsRow label="Username" value={username || "Not set"} open={open} onToggle={onToggle}>
            <form onSubmit={handleSubmit} className="stg-form">
                <div className="form-group">
                    <label className="form-label" htmlFor="new-username">New username</label>
                    <input
                        id="new-username"
                        className="input"
                        type="text"
                        placeholder="Enter a new username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        disabled={loading}
                        autoComplete="off"
                    />
                </div>

                <Alert type={alert?.type} text={alert?.text} />

                <div className="stg-actions">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading && <Spinner />}
                        Save username
                    </button>
                </div>
            </form>
        </SettingsRow>
    );
}

function EmailSection({ email, onUpdated, open, onToggle }) {
    const [step, setStep] = useState("request"); // request or confirm
    const [newEmail, setNewEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!newEmail.trim()) {
            setAlert({ type: "error", text: "Enter an email first" });
            return;
        }
        setLoading(true);
        setAlert(null);
        try {
            const res = await requestEmailChangeApi(newEmail.trim());
            setAlert({ type: "success", text: res.data || "Code sent" });
            setStep("confirm");
        } catch (err) {
            setAlert({ type: "error", text: readError(err, "Could not send code") });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        if (!code.trim()) {
            setAlert({ type: "error", text: "Enter the code sent to your new email" });
            return;
        }
        setLoading(true);
        setAlert(null);
        try {
            const res = await confirmEmailChangeApi(newEmail.trim(), code.trim());
            setAlert({ type: "success", text: res.data || "Email updated" });
            onUpdated(newEmail.trim());
            setStep("request");
            setNewEmail("");
            setCode("");
        } catch (err) {
            setAlert({ type: "error", text: readError(err, "Could not confirm email") });
        } finally {
            setLoading(false);
        }
    };

    const handleUseDifferentEmail = () => {
        setStep("request");
        setCode("");
        setAlert(null);
    };

    return (
        <SettingsRow label="Email" value={email || "Not set"} open={open} onToggle={onToggle}>
            {step === "request" ? (
                <form onSubmit={handleRequest} className="stg-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-email">New email</label>
                        <input
                            id="new-email"
                            className="input"
                            type="email"
                            placeholder="Enter a new email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            disabled={loading}
                            autoComplete="off"
                        />
                    </div>

                    <Alert type={alert?.type} text={alert?.text} />

                    <div className="stg-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading && <Spinner />}
                            Send code
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleConfirm} className="stg-form">
                    <p className="form-hint stg-form-note">Enter the code sent to {newEmail}</p>

                    <div className="form-group">
                        <label className="form-label" htmlFor="email-code">Verification code</label>
                        <input
                            id="email-code"
                            className="input"
                            type="text"
                            inputMode="numeric"
                            placeholder="6 digit code"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={loading}
                            autoComplete="one-time-code"
                        />
                    </div>

                    <Alert type={alert?.type} text={alert?.text} />

                    <div className="stg-actions stg-actions-split">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleUseDifferentEmail}
                            disabled={loading}
                        >
                            Use a different email
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading && <Spinner />}
                            Confirm email
                        </button>
                    </div>
                </form>
            )}
        </SettingsRow>
    );
}

function PasswordSection({ open, onToggle }) {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!oldPassword || !newPassword || !confirmPassword) {
            setAlert({ type: "error", text: "Fill in all password fields" });
            return;
        }
        if (newPassword !== confirmPassword) {
            setAlert({ type: "error", text: "New passwords do not match" });
            return;
        }

        setLoading(true);
        setAlert(null);
        try {
            const res = await updatePasswordApi(oldPassword, newPassword);
            setAlert({ type: "success", text: res.data || "Password updated" });
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setAlert({ type: "error", text: readError(err, "Could not update password") });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsRow label="Password" value="••••••••••" open={open} onToggle={onToggle}>
            <form onSubmit={handleSubmit} className="stg-form">
                <div className="form-group">
                    <label className="form-label" htmlFor="old-password">Current password</label>
                    <input
                        id="old-password"
                        className="input"
                        type="password"
                        placeholder="Enter current password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                    />
                </div>

                <div className="stg-row-split">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-password">New password</label>
                        <input
                            id="new-password"
                            className="input"
                            type="password"
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="confirm-password">Confirm new password</label>
                        <input
                            id="confirm-password"
                            className="input"
                            type="password"
                            placeholder="Repeat new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                <Alert type={alert?.type} text={alert?.text} />

                <div className="stg-actions">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading && <Spinner />}
                        Update password
                    </button>
                </div>
            </form>
        </SettingsRow>
    );
}

export default function ProfileSettings() {
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);
    const [openRow, setOpenRow] = useState(null);

    useEffect(() => {
        let mounted = true;
        getUserDetailsApi()
            .then((res) => {
                if (mounted) setUser(res.data || null);
            })
            .catch(() => {
                if (mounted) setUser(null);
            })
            .finally(() => {
                if (mounted) setUserLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const toggleRow = (key) => setOpenRow((cur) => (cur === key ? null : key));

    return (
        <div className="stg-sections">
            <ProfileHeader user={user} loading={userLoading} />

            <div className="card stg-rows-card">
                <UsernameSection
                    username={user?.username}
                    onUpdated={(val) => setUser((u) => ({ ...u, username: val }))}
                    open={openRow === "username"}
                    onToggle={() => toggleRow("username")}
                />
                <EmailSection
                    email={user?.email}
                    onUpdated={(val) => setUser((u) => ({ ...u, email: val }))}
                    open={openRow === "email"}
                    onToggle={() => toggleRow("email")}
                />
                <PasswordSection
                    open={openRow === "password"}
                    onToggle={() => toggleRow("password")}
                />
            </div>
        </div>
    );
}