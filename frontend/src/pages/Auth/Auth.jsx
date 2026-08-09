import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import OtpInput from "../../components/OtpInput/OtpInput";
import { EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon } from "../../components/Icons";
import { verifyOtpApi, resendOtpApi } from "../../api/auth";
import "./Auth.css";

const RESEND_COOLDOWN = 60;

const Auth = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    // Preserve the background state when swapping between login and register
    const background = location.state?.background;

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [otpCode, setOtpCode] = useState("");
    const [isOtpStage, setIsOtpStage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        setErrorMessage("");
        setIsOtpStage(false);
        setOtpCode("");
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

    const handleClose = () => {
        // If opened as a modal, navigate to the background path directly so it closes in 1 click
        if (background) {
            navigate(background.pathname + background.search + background.hash, { replace: true });
        } else {
            navigate("/", { replace: true });
        }
    };

    const handleSwitchMode = (targetPath) => {
        // Replace current history entry instead of pushing a new one
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
                setIsOtpStage(true);
                setTimer(RESEND_COOLDOWN);
            }
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otpCode.length !== 6) return;
        setErrorMessage("");
        setLoading(true);

        try {
            await verifyOtpApi(form.email, otpCode);
            await login({ username: form.username, password: form.password });
            setIsOtpStage(false);
            handleClose();
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Invalid code or token expired.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0 || resending) return;

        setErrorMessage("");
        setResending(true);

        try {
            await resendOtpApi(form.email);
            setTimer(RESEND_COOLDOWN);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Could not resend code. Please try again.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-blur" onClick={handleClose} aria-hidden="true" />

            <div className="modal-box">
                <button
                    className="modal-close-btn"
                    onClick={handleClose}
                    aria-label="Close dialog"
                >
                    <CloseIcon />
                </button>

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
                            <>Enter the code sent to <strong className="auth-sub-highlight">{form.email}</strong></>
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
                    </form>
                )}

                <div className="auth-sep" />

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