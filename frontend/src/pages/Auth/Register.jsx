import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import "./Auth.css";

const Register = ({ theme, onThemeToggle }) => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      </div>

      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create account">
        <div className="modal-blur" onClick={() => navigate("/")} />
        <div className="modal-box">
          <div className="auth-header">
            <Link to="/" className="auth-brand-link">
              <img src="/favicon.png" alt="" className="auth-brand-icon" />
              <span className="auth-brand-name">DasKitta</span>
            </Link>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-sub">Get started in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="input"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  Creating account
                </>
              ) : "Create account"}
            </button>
          </form>

          <div className="auth-sep" />
          <p className="auth-footer-text">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const SpinnerIcon = () => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: "spin 0.7s linear infinite" }}
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

export default Register;