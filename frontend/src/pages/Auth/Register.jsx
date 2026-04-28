import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import "./Auth.css";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return;
    setLoading(true);
    await register(form);
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
            <h1 className="auth-title" id="auth-title">Create account</h1>
            <p className="auth-sub">Get started in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                className="input"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                autoFocus
                autoComplete="username"
                minLength={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
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
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                className="input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? <><SpinnerIcon /> Creating account</> : "Create account"}
            </button>
          </form>

          <div className="auth-sep" />
          <p className="auth-footer-text">
            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6"  y1="6" x2="18" y2="18"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: "spin 0.7s linear infinite" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

export default Register;