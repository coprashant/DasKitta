import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar/Navbar.jsx";
import { EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon } from "../../components/Icons";
import { verifyOtpApi, resendOtpApi } from "../../api/auth";
import "./Auth.css";

const Auth = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [otpCode, setOtpCode] = useState("");
    const [isOtpStage, setIsOtpStage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (!isLogin && form.password.length < 6) return;
        setLoading(true);

        try {
            if (isLogin) {
                await login({ username: form.username, password: form.password });
            } else {
                await register(form);
                setIsOtpStage(true);
            }
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setLoading(true);

        try {
            await verifyOtpApi(form.email, otpCode);
            setIsOtpStage(false);
            navigate("/login");
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Invalid code or token expired.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setErrorMessage("");
        setResending(true);

        try {
            await resendOtpApi(form.email);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || "Could not resend code. Please try again.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg-layer" aria-hidden="true">
                <div className="auth-bg-navbar" />
                <div className="auth-bg-content">
                    <div className="auth-bg-block auth-bg-block--tall" />
                    <div className="auth-bg-block auth-bg-block--short" />
                    <div className="auth-bg-block auth-bg-block--wide" />
                </div>
            </div>

            <div className="auth-nav-wrap">
                <Navbar />
            </div>

            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title">
                <div className="modal-blur" onClick={() => navigate("/")} aria-hidden="true" />
                <div className="modal-box">
                    <button
                        className="modal-close-btn"
                        onClick={() => navigate("/")}
                        aria-label="Close and go home"
                    >
                        <CloseIcon />
                    </button>

                    <div className="auth-header">
                        <Link to="/" className="auth-brand-link">
                            <img src="/favicon.png" alt="" className="auth-brand-icon" />
                            <span className="auth-brand-name">DasKitta</span>
                        </Link>
                        <h1 className="auth-title" id="auth-title">
                            {isOtpStage ? "Verify Your Account" : isLogin ? "Sign in" : "Create account"}
                        </h1>
                        <p className="auth-sub">
                            {isOtpStage
                                ? `We sent a code to ${form.email}`
                                : isLogin ? "Enter your credentials to continue" : "Get started in seconds"
                            }
                        </p>
                    </div>

                    {errorMessage && (
                        <div style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>
                            {errorMessage}
                        </div>
                    )}

                    {isOtpStage ? (
                        <form onSubmit={handleOtpSubmit} className="auth-form">
                            <div className="form-group">
                                <label className="form-label" htmlFor="auth-otp">One-Time Password (OTP)</label>
                                <input
                                    id="auth-otp"
                                    className="input"
                                    type="text"
                                    maxLength="6"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                    placeholder="Enter 6-digit code"
                                    required
                                    autoFocus
                                    autoComplete="one-time-code"
                                    style={{ textAlign: "center", letterSpacing: "4px", fontSize: "18px" }}
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
                                    <label className="form-label" htmlFor="auth-email">Email</label>
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
                                <div style={{ position: "relative" }}>
                                    <input
                                        id="auth-password"
                                        className="input"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder={isLogin ? "Your password" : "Min 6 characters"}
                                        required
                                        autoComplete={isLogin ? "current-password" : "new-password"}
                                        minLength={isLogin ? undefined : 6}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        style={{
                                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--text-3)", display: "flex", alignItems: "center", padding: 0,
                                        }}
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
                                {loading
                                    ? <><SpinnerIcon /> {isLogin ? "Signing in" : "Creating account"}</>
                                    : isLogin ? "Sign in" : "Create account"
                                }
                            </button>
                        </form>
                    )}

                    <div className="auth-sep" />
                    <p className="auth-footer-text">
                        {isOtpStage ? (
                            <>Didn't get a code? <button type="button" onClick={handleResend} disabled={resending} className="auth-link" style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}>{resending ? "Sending..." : "Resend code"}</button></>
                        ) : isLogin ? (
                            <>No account? <Link to="/register" className="auth-link">Create one</Link></>
                        ) : (
                            <>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;