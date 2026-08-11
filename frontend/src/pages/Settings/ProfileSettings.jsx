import { useState, useEffect, useCallback } from "react";
import {
    updateUsernameApi,
    updatePasswordApi,
    requestEmailChangeApi,
    confirmEmailChangeApi,
    getUserDetailsApi,
} from "../../api/auth.js";
import { useAuth } from "../../context/AuthContext";
import { ChevronIcon, EyeIcon, EyeOffIcon } from "../../components/Icons";
import OtpInput from "../../components/OtpInput/OtpInput.jsx";

function readError(err, fallback) {
    const data = err?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data?.message) return data.message;
    if (err?.message) return err.message;
    return fallback;
}

function Alert({ type, text }) {
    if (!text) return null;

    return (
        <div
            className={`stg-alert stg-alert-${type}`}
            role="status"
            aria-live="polite"
        >
            {text}
        </div>
    );
}

function Spinner() {
    return <span className="stg-spinner" aria-hidden="true" />;
}

function ProfileHeader({ user, loading }) {
    if (loading) {
        return (
            <div className="card stg-profile-card">
                <div
                    className="skeleton"
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        flexShrink: 0,
                    }}
                />
                <div style={{ flex: 1 }}>
                    <div
                        className="skeleton"
                        style={{
                            height: 14,
                            width: "45%",
                            marginBottom: 8,
                        }}
                    />
                    <div
                        className="skeleton"
                        style={{
                            height: 11,
                            width: "60%",
                        }}
                    />
                </div>
            </div>
        );
    }

    const displayName =
        user?.fullName || user?.username || "Your account";

    const initial = displayName.charAt(0).toUpperCase();

    const joined = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        })
        : null;

    return (
        <div className="card stg-profile-card">
            <div className="stg-profile-avatar">{initial}</div>

            <div className="stg-profile-info">
                <p className="stg-profile-name">{displayName}</p>

                {user?.email && (
                    <p className="stg-profile-email">{user.email}</p>
                )}

                {joined && (
                    <p className="stg-profile-joined">
                        Member since {joined}
                    </p>
                )}
            </div>
        </div>
    );
}

function SettingsRow({ label, value, children, open, onToggle }) {
    return (
        <div className="stg-row">
            <button
                type="button"
                className="stg-row-summary"
                onClick={onToggle}
            >
                <div className="stg-row-text">
                    <span className="stg-row-label">{label}</span>
                    <span className="stg-row-value">{value}</span>
                </div>

                <span
                    className={`stg-row-chevron${
                        open ? " stg-row-chevron-open" : ""
                    }`}
                >
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
            setAlert({
                type: "error",
                text: "Enter a username first",
            });
            return;
        }

        setLoading(true);
        setAlert(null);

        try {
            const res = await updateUsernameApi(newUsername.trim());

            setAlert({
                type: "success",
                text: res.data || "Username updated",
            });

            onUpdated(newUsername.trim());
            setNewUsername("");
        } catch (err) {
            setAlert({
                type: "error",
                text: readError(err, "Could not update username"),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsRow
            label="Username"
            value={username || "Not set"}
            open={open}
            onToggle={onToggle}
        >
            <form onSubmit={handleSubmit} className="stg-form">
                <div className="form-group">
                    <label className="form-label" htmlFor="new-username">
                        New username
                    </label>

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
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading && <Spinner />}
                        Save username
                    </button>
                </div>
            </form>
        </SettingsRow>
    );
}

function EmailSection({ email, onUpdated, open, onToggle }) {
    const [step, setStep] = useState("request");
    const [newEmail, setNewEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handleRequest = async (e) => {
        e.preventDefault();

        if (!newEmail.trim()) {
            setAlert({
                type: "error",
                text: "Enter an email first",
            });
            return;
        }

        setLoading(true);
        setAlert(null);

        try {
            const res = await requestEmailChangeApi(newEmail.trim());

            setAlert({
                type: "success",
                text: res.data || "Code sent",
            });

            setStep("confirm");
        } catch (err) {
            setAlert({
                type: "error",
                text: readError(err, "Could not send code"),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();

        if (code.length !== 6) {
            setAlert({
                type: "error",
                text: "Enter the 6 digit verification code",
            });
            return;
        }

        setLoading(true);
        setAlert(null);

        try {
            const res = await confirmEmailChangeApi(
                newEmail.trim(),
                code.trim()
            );

            setAlert({
                type: "success",
                text: res.data || "Email updated",
            });

            onUpdated(newEmail.trim());
            setStep("request");
            setNewEmail("");
            setCode("");
        } catch (err) {
            setAlert({
                type: "error",
                text: readError(err, "Could not confirm email"),
            });
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
        <SettingsRow
            label="Email"
            value={email || "Not set"}
            open={open}
            onToggle={onToggle}
        >
            {step === "request" ? (
                <form onSubmit={handleRequest} className="stg-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-email">
                            New email
                        </label>

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
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading && <Spinner />}
                            Send code
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleConfirm} className="stg-form">
                    <p className="form-hint stg-form-note">
                        Enter the code sent to {newEmail}
                    </p>

                    <div className="form-group">
                        <label className="form-label">
                            Verification code
                        </label>

                        <OtpInput
                            value={code}
                            onChange={setCode}
                            disabled={loading}
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

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || code.length !== 6}
                        >
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
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!oldPassword || !newPassword || !confirmPassword) {
            setAlert({
                type: "error",
                text: "Fill in all password fields",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setAlert({
                type: "error",
                text: "New passwords do not match",
            });
            return;
        }

        setLoading(true);
        setAlert(null);

        try {
            const res = await updatePasswordApi(
                oldPassword,
                newPassword
            );

            setAlert({
                type: "success",
                text: res.data || "Password updated",
            });

            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setAlert({
                type: "error",
                text: readError(err, "Could not update password"),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsRow
            label="Password"
            value="••••••••••"
            open={open}
            onToggle={onToggle}
        >
            <form onSubmit={handleSubmit} className="stg-form">
                <div className="form-group">
                    <label className="form-label" htmlFor="old-password">
                        Current password
                    </label>

                    <div className="input-with-icon">
                        <input
                            id="old-password"
                            className="input"
                            type={showOldPassword ? "text" : "password"}
                            placeholder="Enter current password"
                            value={oldPassword}
                            onChange={(e) =>
                                setOldPassword(e.target.value)
                            }
                            disabled={loading}
                            autoComplete="current-password"
                        />

                        <button
                            type="button"
                            className="input-icon-btn"
                            onClick={() =>
                                setShowOldPassword((v) => !v)
                            }
                            aria-label={
                                showOldPassword
                                    ? "Hide password"
                                    : "Show password"
                            }
                        >
                            {showOldPassword ? (
                                <EyeOffIcon />
                            ) : (
                                <EyeIcon />
                            )}
                        </button>
                    </div>
                </div>

                <div className="stg-row-split">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-password">
                            New password
                        </label>

                        <div className="input-with-icon">
                            <input
                                id="new-password"
                                className="input"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                value={newPassword}
                                onChange={(e) =>
                                    setNewPassword(e.target.value)
                                }
                                disabled={loading}
                                autoComplete="new-password"
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() =>
                                    setShowNewPassword((v) => !v)
                                }
                                aria-label={
                                    showNewPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showNewPassword ? (
                                    <EyeOffIcon />
                                ) : (
                                    <EyeIcon />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label
                            className="form-label"
                            htmlFor="confirm-password"
                        >
                            Confirm new password
                        </label>

                        <div className="input-with-icon">
                            <input
                                id="confirm-password"
                                className="input"
                                type={
                                    showConfirmPassword
                                        ? "text"
                                        : "password"
                                }
                                placeholder="Repeat new password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                disabled={loading}
                                autoComplete="new-password"
                            />

                            <button
                                type="button"
                                className="input-icon-btn"
                                onClick={() =>
                                    setShowConfirmPassword((v) => !v)
                                }
                                aria-label={
                                    showConfirmPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showConfirmPassword ? (
                                    <EyeOffIcon />
                                ) : (
                                    <EyeIcon />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <Alert type={alert?.type} text={alert?.text} />

                <div className="stg-actions">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading && <Spinner />}
                        Update password
                    </button>
                </div>
            </form>
        </SettingsRow>
    );
}

function DeleteAccountSection({ open, onToggle }) {
    const { deleteAccount } = useAuth();
    const [password, setPassword] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        setConfirming(false);
        setAlert(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password) {
            setAlert({
                type: "error",
                text: "Enter your password to continue",
            });
            return;
        }

        if (!confirming) {
            setConfirming(true);
            setAlert({
                type: "error",
                text: "This cannot be undone. Click again to confirm deletion.",
            });
            return;
        }

        setLoading(true);
        setAlert(null);

        try {
            await deleteAccount(password);
        } catch (err) {
            setAlert({
                type: "error",
                text: readError(err, "Could not delete account"),
            });
            setConfirming(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SettingsRow
            label="Delete account"
            value="Permanently remove your data"
            open={open}
            onToggle={onToggle}
        >
            <form onSubmit={handleSubmit} className="stg-form">
                <p className="form-hint stg-form-note">
                    This permanently deletes your account, saved meroshare
                    accounts, and ipo history. This cannot be undone.
                </p>

                <div className="form-group">
                    <label
                        className="form-label"
                        htmlFor="delete-password"
                    >
                        Current password
                    </label>

                    <div className="input-with-icon">
                        <input
                            id="delete-password"
                            className="input"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={handlePasswordChange}
                            disabled={loading}
                            autoComplete="current-password"
                        />

                        <button
                            type="button"
                            className="input-icon-btn"
                            onClick={() =>
                                setShowPassword((v) => !v)
                            }
                            aria-label={
                                showPassword
                                    ? "Hide password"
                                    : "Show password"
                            }
                        >
                            {showPassword ? (
                                <EyeOffIcon />
                            ) : (
                                <EyeIcon />
                            )}
                        </button>
                    </div>
                </div>

                <Alert type={alert?.type} text={alert?.text} />

                <div className="stg-actions">
                    <button
                        type="submit"
                        className="btn btn-danger"
                        disabled={loading}
                    >
                        {loading && <Spinner />}
                        {confirming
                            ? "Confirm delete"
                            : "Delete account"}
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

    const toggleRow = useCallback(
        (key) =>
            setOpenRow((cur) => (cur === key ? null : key)),
        []
    );

    return (
        <div className="stg-sections">
            <ProfileHeader user={user} loading={userLoading} />

            <div className="card stg-rows-card">
                <UsernameSection
                    username={user?.username}
                    onUpdated={(val) =>
                        setUser((u) => ({ ...u, username: val }))
                    }
                    open={openRow === "username"}
                    onToggle={() => toggleRow("username")}
                />

                <EmailSection
                    email={user?.email}
                    onUpdated={(val) =>
                        setUser((u) => ({ ...u, email: val }))
                    }
                    open={openRow === "email"}
                    onToggle={() => toggleRow("email")}
                />

                <PasswordSection
                    open={openRow === "password"}
                    onToggle={() => toggleRow("password")}
                />
            </div>

            <div className="card stg-danger-card">
                <DeleteAccountSection
                    open={openRow === "delete"}
                    onToggle={() => toggleRow("delete")}
                />
            </div>
        </div>
    );
}