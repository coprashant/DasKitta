import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar/Navbar.jsx";
import { EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon } from "../../components/Icons";
import "./Auth.css";

const Auth = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isLogin = location.pathname === "/login";

    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isLogin && form.password.length < 6) return;
        setLoading(true);
        if (isLogin) {
            await login({ username: form.username, password: form.password });
        } else {
            await register(form);
        }
        setLoading(false);
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
                            {isLogin ? "Sign in" : "Create account"}
                        </h1>
                        <p className="auth-sub">
                            {isLogin ? "Enter your credentials to continue" : "Get started in seconds"}
                        </p>
                    </div>

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

                    <div className="auth-sep" />
                    <p className="auth-footer-text">
                        {isLogin
                            ? <>No account? <Link to="/register" className="auth-link">Create one</Link></>
                            : <>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></>
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;