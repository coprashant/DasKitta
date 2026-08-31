import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OtpInput from "../../components/OtpInput/OtpInput";
import { EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon } from "../../components/Icons";
import { verifyOtpApi, resendOtpApi } from "../../api/auth";
import SEO from "../../seo/SEO.jsx";
import "./Auth.css";

const RESEND_COOLDOWN = 60;

const Auth = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    const background = location.state?.background;

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [submittedEmail, setSubmittedEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [isOtpStage, setIsOtpStage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [timer, setTimer] = useState(0);

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
        setIsOtpStage(false);
        setOtpCode("");
        setSubmittedEmail("");
        setTimer(0);
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

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSwitchMode = (targetPath) => {
        navigate(targetPath, { state: { background }, replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (!isLogin && form.password.length < 6) {
            setErrorMessage("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                await login({ username: form.username, password: form.password });
                handleClose();
            } else {
                await register(form);
                setSubmittedEmail(form.email.trim().toLowerCase());
                setIsOtpStage(true);
                setTimer(RESEND_COOLDOWN);
            }
        } catch (err) {
            if (err?.response?.data?.code === "UNVERIFIED_ACCOUNT") {
                const email = err.response.data.email || form.email;
                setSubmittedEmail(email.trim().toLowerCase());
                setIsOtpStage(true);
                setTimer(RESEND_COOLDOWN);
                setErrorMessage("Your account is not verified yet. A new code has been sent to your email.");
            } else {
                setErrorMessage(sanitizeErrorMessage(err, "Unable to authenticate. Please try again."));
            }
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
            await login({ username: form.username, password: form.password });
            setIsOtpStage(false);
            handleClose();
        } catch (err) {
            setErrorMessage(sanitizeErrorMessage(err, "Invalid or expired code. Please try again."));
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

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <SEO
                title={isLogin ? "Sign In" : "Create Account"}
                description={
                    isLogin
                        ? "Sign in to DasKitta to manage your Meroshare accounts, apply for IPOs, and track your NEPSE portfolio."
                        : "Create a free DasKitta account to apply for NEPSE IPOs across multiple Meroshare accounts, track your portfolio, and check allotment results."
                }
                canonical={isLogin ? "/login" : "/register"}
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

                {/* Compact header with resized brand logo */}
                <div className="auth-header">
                    <button type="button" onClick={handleClose} className="auth-brand-link auth-inline-btn">
                        <img src="/favicon.png" alt="" className="auth-brand-icon" />
                        <span className="auth-brand-name">DasKitta</span>
                    </button>
                    <h1 className="auth-title" id="auth-title">
                        {isOtpStage ? "Verify Your Account" : isLogin ? "Welcome Back" : "Create Account"}
                    </h1>
                    <p className="auth-sub">
                        {isOtpStage ? (
                            <>Enter the code sent to <strong className="auth-sub-highlight">{activeEmail}</strong></>
                        ) : isLogin ? (
                            "Enter your credentials to access your account"
                        ) : (
                            "Get started in seconds"
                        )}
                    </p>
                </div>

                {errorMessage && (
                    <div className="auth-error-banner" role="alert">
                        {errorMessage}
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
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="auth-username">Username</label>
                            <input
                                id="auth-username"
                                className="input"
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                placeholder={isLogin ? "Your username" : "Choose a username"}
                                required
                                autoFocus
                                autoComplete="username"
                                minLength={isLogin ? undefined : 3}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="auth-email">Email Address</label>
                                <input
                                    id="auth-email"
                                    className="input"
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="your@email.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="auth-password">Password</label>
                            <div className="input-password-wrap">
                                <input
                                    id="auth-password"
                                    className="input input-password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder={isLogin ? "Your password" : "Min 6 characters"}
                                    required
                                    autoComplete={isLogin ? "current-password" : "new-password"}
                                    minLength={isLogin ? undefined : 6}
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
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <><SpinnerIcon /> {isLogin ? "Signing in..." : "Creating account..."}</>
                            ) : (
                                isLogin ? "Sign in" : "Create account"
                            )}
                        </button>

                        {/* Implicit agreement text */}
                        {!isLogin && (
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
                    ) : isLogin ? (
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
    );
};

export default Auth;