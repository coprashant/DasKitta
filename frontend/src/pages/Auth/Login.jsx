import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "./Auth.css";

const Login = ({ theme, onThemeToggle }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(form);
    setLoading(false);
  };

  return (
    <div className="auth-page">
      {/* Blurred background layer */}
      <div className="auth-bg-layer" aria-hidden="true">
        <div className="auth-bg-navbar" />
        <div className="auth-bg-content">
          <div className="auth-bg-block auth-bg-block--tall" />
          <div className="auth-bg-block auth-bg-block--short" />
          <div className="auth-bg-block auth-bg-block--wide" />
        </div>
      </div>

      {/* Real navbar sits above blur but below modal */}
      <div className="auth-nav-wrap">
        <Navbar theme={theme} onThemeToggle={onThemeToggle} />
      </div>

      {/* Modal */}
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Sign in">
        <div className="modal-blur" onClick={() => navigate("/")} />
        <div className="modal-box">
          <div className="auth-header">
            <Link to="/" className="auth-brand-link">
              <img src="/favicon.png" alt="" className="auth-brand-icon" />
              <span className="auth-brand-name">DasKitta</span>
            </Link>
            <h1 className="auth-title">Sign in</h1>
            <p className="auth-sub">Enter your credentials to continue</p>
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
                placeholder="Your username"
                required
                autoFocus
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
                placeholder="Your password"
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
                  Signing in
                </>
              ) : "Sign in"}
            </button>
          </form>

          <div className="auth-sep" />
          <p className="auth-footer-text">
            No account?{" "}
            <Link to="/register" className="auth-link">Create one</Link>
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

export default Login;