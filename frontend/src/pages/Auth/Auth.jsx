import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import OtpInput from "../../components/OtpInput/OtpInput";
import { PasswordStrength } from "../../components/FieldHints/FieldHints";
import { EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon, CheckIcon, IconAlertCircle } from "../../components/Icons";
import { verifyOtpApi, resendOtpApi, forgotPasswordApi, resetPasswordApi } from "../../api/auth";
import {
    USERNAME_MIN,
    USERNAME_MAX,
    PASSWORD_MIN,
    PASSWORD_MAX,
    checkUsername,
    checkNewPassword,
} from "../../authRules";
import SEO from "../../seo/SEO.jsx";
import "./Auth.css";

const RESEND_COOLDOWN = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// field checks used on blur and submit
// username and password rules apply to new values only
const validateField = (name, value, mode) => {
    const trimmed = (value || "").trim();
    switch (name) {
        case "username":
            return mode === "register" ? checkUsername(value) : "";
        case "email":
            if (trimmed && !EMAIL_RE.test(trimmed)) {
                return "Enter a valid email address.";
            }
            return "";
        case "password":
            return mode === "register" ? checkNewPassword(value) : "";
        case "resetEmail":
            if (trimmed && !EMAIL_RE.test(trimmed)) {
                return "Enter a valid email address.";
            }
            return "";
        case "newPassword":
            return checkNewPassword(value);
        default:
            return "";
    }
};

const Auth = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    const background = location.state?.background;

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [authMode, setAuthMode] = useState(isLogin ? "login" : "register");
    const [submittedEmail, setSubmittedEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [timer, setTimer] = useState(0);
    const [fieldErrors, setFieldErrors] = useState({});

    const isOtpStage = authMode === "otp";
    const isForgotMode = authMode === "forgot";
    const isResetMode = authMode === "reset";
    const isLoginMode = authMode === "login";
    const isRegisterMode = authMode === "register";

    const sanitizeErrorMessage = (err, fallback) => {
        if (err?.response?.status === 401) {
            return "Invalid username or password.";
        }
        if (err?.response?.status === 409) {
            return "An account with these details already exists.";
        }
        if (err?.response?.status === 429) {
            return "Too many attempts. Please try again later.";
        }
        if (err?.response?.status >= 500) {
            return "A server error occurred. Please try again later.";
        }
        // first field message from server validation
        const fieldMsgs = err?.response?.data?.errors;
        if (fieldMsgs && typeof fieldMsgs === "object") {
            const first = Object.values(fieldMsgs)[0];
            if (typeof first === "string" && first.length < 100) {
                return first;
            }
        }
        const msg = err?.response?.data?.message;
        if (typeof msg === "string" && msg.length < 100 && !msg.includes("Exception") && !msg.includes("Error:")) {
            return msg;
        }
        return fallback;
    };

    const handleClose = () => {
        if (background) {
            navigate(background.pathname + background.search + background.hash, { replace: true });
        } else {
            navigate("/", { replace: true });
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [background]);

    useEffect(() => {
        if (background) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [background]);

    useEffect(() => {
        setErrorMessage("");
        setSuccessMessage("");
        setAuthMode(isLogin ? "login" : "register");
        setOtpCode("");
        setResetEmail("");
        setNewPassword("");
        setSubmittedEmail("");
        setTimer(0);
        setFieldErrors({});
    }, [location.pathname]);

    useEffect(() => {
        let interval = null;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;
        // no spaces in new usernames
        if (name === "username" && isRegisterMode) {
            value = value.replace(/\s/g, "");
        }
        setErrorMessage("");
        setSuccessMessage("");
        setForm((f) => ({ ...f, [name]: value }));
        if (fieldErrors[name]) {
            setFieldErrors((fe) => ({ ...fe, [name]: "" }));
        }
    };

    const handleFieldBlur = (e) => {
        const { name, value } = e.target;
        const message = validateField(name, value, authMode);
        setFieldErrors((fe) => ({ ...fe, [name]: message }));
    };

    const handleSwitchMode = (targetPath) => {
        setErrorMessage("");
        setSuccessMessage("");
        setOtpCode("");
        setNewPassword("");
        setResetEmail("");
        setSubmittedEmail("");
        setTimer(0);
        setFieldErrors({});
        setAuthMode(targetPath === "/login" ? "login" : "register");
        navigate(targetPath, { state: { background }, replace: true });
    };

    const handleForgotNavigation = () => {
        setErrorMessage("");
        setSuccessMessage("");
        const prefilledEmail = form.username.includes("@")
            ? form.username.trim().toLowerCase()
            : "";
        setResetEmail(prefilledEmail);
        setSubmittedEmail(prefilledEmail);
        setOtpCode("");
        setNewPassword("");
        setFieldErrors({});
        setAuthMode("forgot");
    };

    const handleBackToLogin = () => {
        if (location.pathname !== "/login") {
            handleSwitchMode("/login");
            return;
        }
        setErrorMessage("");
        setOtpCode("");
        setNewPassword("");
        setFieldErrors({});
        setAuthMode("login");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (!isRegisterMode && !isLoginMode) {
            return;
        }

        const usernameError = validateField("username", form.username, authMode);
        const emailError = isRegisterMode ? validateField("email", form.email, authMode) : "";
        const passwordError = validateField("password", form.password, authMode);

        if (usernameError || emailError || passwordError) {
            setFieldErrors((fe) => ({
                ...fe,
                username: usernameError,
                email: emailError,
                password: passwordError,
            }));
            setErrorMessage(usernameError || emailError || passwordError);
            return;
        }

        setLoading(true);

        try {
            if (isLoginMode) {
                const result = await login({ loginIdentifier: form.username.trim(), password: form.password, rememberMe });
                if (result?.ok) {
                    handleClose();
                } else if (result?.code === "UNVERIFIED_ACCOUNT") {
                    const email = (result.email || form.email || form.username || "").trim().toLowerCase();
                    if (email) {
                        setSubmittedEmail(email);
                        setAuthMode("otp");
                        setTimer(RESEND_COOLDOWN);
                        setErrorMessage(result.message || "Your account is not verified yet. A new code has been sent to your email.");
                    } else {
                        setErrorMessage(result.message || "Your account is not verified yet. Check your email for the verification code.");
                    }
                } else {
                    setErrorMessage(result?.message || "Unable to authenticate. Please try again.");
                }
            } else {
                await register({
                    ...form,
                    username: form.username.trim(),
                    email: form.email.trim(),
                });
                setSubmittedEmail(form.email.trim().toLowerCase());
                setAuthMode("otp");
                setTimer(RESEND_COOLDOWN);
            }
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Unable to authenticate. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otpCode.length !== 6) return;
        setErrorMessage("");
        setLoading(true);

        const targetEmail = (submittedEmail || form.email).trim().toLowerCase();

        try {
            await verifyOtpApi(targetEmail, otpCode.trim());
            await login({ loginIdentifier: form.username.trim(), password: form.password });
            setAuthMode("login");
            handleClose();
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Invalid or expired code. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const emailError = validateField("resetEmail", resetEmail, authMode);
        if (emailError || !resetEmail.trim()) {
            const message = emailError || "Email is required.";
            setFieldErrors((fe) => ({ ...fe, resetEmail: message }));
            setErrorMessage(message);
            return;
        }

        const targetEmail = resetEmail.trim().toLowerCase();

        setLoading(true);
        try {
            await forgotPasswordApi(targetEmail);
            setSubmittedEmail(targetEmail);
            setResetEmail(targetEmail);
            setOtpCode("");
            setNewPassword("");
            setAuthMode("reset");
            setSuccessMessage("A password reset verification code has been sent to your email.");
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Unable to send reset code. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const targetEmail = (submittedEmail || resetEmail).trim().toLowerCase();
        if (!targetEmail) {
            setErrorMessage("Email is required.");
            setAuthMode("forgot");
            return;
        }
        if (otpCode.length !== 6) {
            setErrorMessage("Verification code must be 6 digits.");
            return;
        }
        const newPasswordError = validateField("newPassword", newPassword, authMode);
        if (newPasswordError) {
            setFieldErrors((fe) => ({ ...fe, newPassword: newPasswordError }));
            setErrorMessage(newPasswordError);
            return;
        }

        setLoading(true);
        try {
            await resetPasswordApi(targetEmail, otpCode.trim(), newPassword);
            if (location.pathname !== "/login") {
                navigate("/login", { state: { background }, replace: true });
            }
            setAuthMode("login");
            setForm((prev) => ({ ...prev, username: targetEmail, password: "" }));
            setOtpCode("");
            setNewPassword("");
            setSuccessMessage("Password has been reset successfully. You can now log in.");
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Unable to reset password. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0 || resending) return;

        setErrorMessage("");
        setResending(true);

        const targetEmail = (submittedEmail || form.email).trim().toLowerCase();

        try {
            await resendOtpApi(targetEmail);
            setTimer(RESEND_COOLDOWN);
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Could not resend code. Please try again."));
        } finally {
            setResending(false);
        }
    };

    const activeEmail = submittedEmail || form.email;
    const activeResetEmail = submittedEmail || resetEmail;

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <SEO
                title={
                    isForgotMode
                        ? "Forgot Password"
                        : isResetMode
                            ? "Reset Password"
                            : isLoginMode
                                ? "Sign In"
                                : "Create Account"
                }
                description={
                    isLoginMode || isForgotMode || isResetMode
                        ? "Sign in to DasKitta to manage your Meroshare accounts, apply for IPOs, and track your NEPSE portfolio."
                        : "Create a free DasKitta account to apply for NEPSE IPOs across multiple Meroshare accounts, track your portfolio, and check allotment results."
                }
                canonical={isLoginMode || isForgotMode || isResetMode ? "/login" : "/register"}
                noindex={true}
            />
            <div className="modal-blur" onClick={handleClose} aria-hidden="true" />

            <div className="modal-box">
                <button
                    className="modal-close-btn"
                    onClick={handleClose}
                    aria-label="Close dialog"
                >
                    <CloseIcon />
                </button>

                {/* keyed on mode so each stage animates in */}
                <div className="auth-stage anim-fade-up" key={authMode}>
                    <div className="auth-header">
                        <button type="button" onClick={handleClose} className="auth-brand-link auth-inline-btn">
                            <img src="/favicon.png" alt="" className="auth-brand-icon" />
                            <span className="auth-brand-name">DasKitta</span>
                        </button>
                        <h1 className="auth-title" id="auth-title">
                            {isOtpStage
                                ? "Verify Your Account"
                                : isForgotMode
                                    ? "Forgot Password"
                                    : isResetMode
                                        ? "Reset Password"
                                        : isLoginMode
                                            ? "Welcome Back"
                                            : "Create Account"}
                        </h1>
                        <p className="auth-sub">
                            {isOtpStage ? (
                                <>Enter the code sent to <strong className="auth-sub-highlight">{activeEmail}</strong></>
                            ) : isForgotMode ? (
                                "Enter your account email to receive a reset code"
                            ) : isResetMode ? (
                                <>Enter the code sent to <strong className="auth-sub-highlight">{activeResetEmail}</strong> and set a new password</>
                            ) : isLoginMode ? (
                                "Enter your credentials to access your account"
                            ) : (
                                "Get started in seconds"
                            )}
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="auth-error-banner" role="alert">
                            <IconAlertCircle />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="auth-success-banner" role="status">
                            <CheckIcon />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {isOtpStage ? (
                        <form onSubmit={handleOtpSubmit} className="auth-form">
                            <div className="form-group">
                                <label className="form-label">One-Time Password</label>
                                <OtpInput
                                    value={otpCode}
                                    onChange={(val) => setOtpCode(val)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-full btn-lg"
                                disabled={loading || otpCode.length !== 6}
                            >
                                {loading ? <><SpinnerIcon /> Verifying...</> : "Verify & Activate"}
                            </button>
                        </form>
                    ) : isForgotMode ? (
                        <form onSubmit={handleForgotPasswordSubmit} className="auth-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="forgot-email">Email Address</label>
                                <input
                                    id="forgot-email"
                                    name="resetEmail"
                                    className={`input${fieldErrors.resetEmail ? " input-invalid" : ""}`}
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => {
                                        setErrorMessage("");
                                        setSuccessMessage("");
                                        setResetEmail(e.target.value);
                                        if (fieldErrors.resetEmail) {
                                            setFieldErrors((fe) => ({ ...fe, resetEmail: "" }));
                                        }
                                    }}
                                    onBlur={handleFieldBlur}
                                    placeholder="your@email.com"
                                    required
                                    autoFocus
                                    autoComplete="email"
                                />
                                {fieldErrors.resetEmail && (
                                    <span className="field-error">{fieldErrors.resetEmail}</span>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-full btn-lg"
                                disabled={loading}
                            >
                                {loading ? <><SpinnerIcon /> Sending...</> : "Send Reset Code"}
                            </button>
                        </form>
                    ) : isResetMode ? (
                        <form onSubmit={handleResetPasswordSubmit} className="auth-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="reset-email">Email Address</label>
                                <input
                                    id="reset-email"
                                    className="input"
                                    type="email"
                                    value={activeResetEmail}
                                    readOnly
                                    autoComplete="email"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">One-Time Password</label>
                                <OtpInput
                                    value={otpCode}
                                    onChange={(val) => {
                                        setErrorMessage("");
                                        setSuccessMessage("");
                                        setOtpCode(val);
                                    }}
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="reset-password">New Password</label>
                                <div className="input-password-wrap">
                                    <input
                                        id="reset-password"
                                        name="newPassword"
                                        className={`input input-password${fieldErrors.newPassword ? " input-invalid" : ""}`}
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => {
                                            setErrorMessage("");
                                            setSuccessMessage("");
                                            setNewPassword(e.target.value);
                                            if (fieldErrors.newPassword) {
                                                setFieldErrors((fe) => ({ ...fe, newPassword: "" }));
                                            }
                                        }}
                                        onBlur={handleFieldBlur}
                                        placeholder={`Min ${PASSWORD_MIN} characters`}
                                        required
                                        minLength={PASSWORD_MIN}
                                        maxLength={PASSWORD_MAX}
                                        autoComplete="new-password"
                                        aria-describedby={fieldErrors.newPassword || newPassword ? "reset-password-hint" : undefined}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                {fieldErrors.newPassword ? (
                                    <span className="field-error" id="reset-password-hint">{fieldErrors.newPassword}</span>
                                ) : (
                                    <PasswordStrength value={newPassword} id="reset-password-hint" />
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-full btn-lg"
                                disabled={loading || otpCode.length !== 6 || newPassword.length < PASSWORD_MIN}
                            >
                                {loading ? <><SpinnerIcon /> Resetting...</> : "Reset Password"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="auth-username">{isLoginMode ? "Username or Email" : "Username"}</label>
                                <input
                                    id="auth-username"
                                    className={`input${fieldErrors.username ? " input-invalid" : ""}`}
                                    type="text"
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    onBlur={handleFieldBlur}
                                    placeholder={isLoginMode ? "Username or email address" : "Choose a username"}
                                    required
                                    autoFocus
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    minLength={isLoginMode ? undefined : USERNAME_MIN}
                                    maxLength={isLoginMode ? undefined : USERNAME_MAX}
                                    aria-describedby={fieldErrors.username ? "username-hint" : undefined}
                                />
                                {fieldErrors.username ? (
                                    <span className="field-error" id="username-hint">{fieldErrors.username}</span>
                                ) : null}
                            </div>

                            {isRegisterMode && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="auth-email">Email Address</label>
                                    <input
                                        id="auth-email"
                                        className={`input${fieldErrors.email ? " input-invalid" : ""}`}
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        onBlur={handleFieldBlur}
                                        placeholder="your@email.com"
                                        required
                                        autoComplete="email"
                                    />
                                    {fieldErrors.email && (
                                        <span className="field-error">{fieldErrors.email}</span>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label" htmlFor="auth-password">Password</label>
                                <div className="input-password-wrap">
                                    <input
                                        id="auth-password"
                                        className={`input input-password${fieldErrors.password ? " input-invalid" : ""}`}
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        onBlur={handleFieldBlur}
                                        placeholder={isLoginMode ? "Your password" : `Min ${PASSWORD_MIN} characters`}
                                        required
                                        autoComplete={isLoginMode ? "current-password" : "new-password"}
                                        minLength={isLoginMode ? undefined : PASSWORD_MIN}
                                        maxLength={isLoginMode ? undefined : PASSWORD_MAX}
                                        aria-describedby={fieldErrors.password ? "password-hint" : isRegisterMode && form.password ? "password-hint" : undefined}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>
                                {fieldErrors.password ? (
                                    <span className="field-error" id="password-hint">{fieldErrors.password}</span>
                                ) : isRegisterMode ? (
                                    <PasswordStrength value={form.password} id="password-hint" />
                                ) : null}
                            </div>

                            {isLoginMode && (
                                <div className="form-group form-group-inline auth-login-options">
                                    <label className="checkbox-label" htmlFor="auth-remember-me">
                                        <input
                                            id="auth-remember-me"
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        Remember me
                                    </label>

                                    <button
                                        type="button"
                                        onClick={handleForgotNavigation}
                                        className="auth-link auth-inline-btn auth-forgot-btn"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-full btn-lg"
                                disabled={loading}
                            >
                                {loading ? (
                                    <><SpinnerIcon /> {isLoginMode ? "Signing in..." : "Creating account..."}</>
                                ) : (
                                    isLoginMode ? "Sign in" : "Create account"
                                )}
                            </button>

                            {isRegisterMode && (
                                <p className="auth-legal-notice">
                                    By creating an account, you agree to our{" "}
                                    <Link to="/terms" className="auth-link" target="_blank" rel="noopener noreferrer">
                                        Terms of Service
                                    </Link>{" "}
                                    and{" "}
                                    <Link to="/privacy" className="auth-link" target="_blank" rel="noopener noreferrer">
                                        Privacy Policy
                                    </Link>.
                                </p>
                            )}
                        </form>
                    )}

                    <div className="auth-footer-text">
                        {isOtpStage ? (
                            <>
                                Didn't get a code?{" "}
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resending || timer > 0}
                                    className="auth-link auth-inline-btn"
                                >
                                    {resending
                                        ? "Sending..."
                                        : timer > 0
                                            ? `Resend code in ${timer}s`
                                            : "Resend code"}
                                </button>
                            </>
                        ) : isForgotMode || isResetMode ? (
                            <>
                                Back to login{" "}
                                <button
                                    type="button"
                                    onClick={handleBackToLogin}
                                    className="auth-link auth-inline-btn"
                                >
                                    Sign in
                                </button>
                            </>
                        ) : isLoginMode ? (
                            <>
                                Don't have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => handleSwitchMode("/register")}
                                    className="auth-link auth-inline-btn"
                                >
                                    Create one
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => handleSwitchMode("/login")}
                                    className="auth-link auth-inline-btn"
                                >
                                    Sign in
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;