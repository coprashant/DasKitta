import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

const features = [
  { icon: "⚡", title: "One-Click Apply", desc: "Apply for any open IPO across all your Meroshare accounts at once." },
  { icon: "👥", title: "Multi-Account", desc: "Manage unlimited Meroshare accounts from a single dashboard." },
  { icon: "📊", title: "Result Checker", desc: "Instantly check your IPO allotment results. No login required." },
  { icon: "📁", title: "Full History", desc: "Track every application with apply status and allotment result." },
];

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="landing">
      <nav className="land-nav">
        <div className="land-nav-inner">
          <Link to="/" className="land-brand">
            <span className="land-logo">M</span>
            <span className="land-brand-name">Meroshare Bot</span>
          </Link>
          <div className="land-nav-actions">
            <Link to="/ipo/result" className="land-nav-link">Check Result</Link>
            {user ? (
              <Link to="/dashboard" className="land-nav-btn">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="land-nav-link">Sign In</Link>
                <Link to="/register" className="land-nav-btn">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div>
          <span className="hero-eyebrow">NEPSE IPO Automation</span>
          <h1 className="hero-title">
            Apply for IPOs<br />
            <span className="hero-accent">in one click</span>
          </h1>
          <p className="hero-desc">
            Automate your NEPSE IPO applications across multiple Meroshare accounts. Never miss an opening again.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="hero-btn-primary">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/register" className="hero-btn-primary">Get Started Free</Link>
                <Link to="/login" className="hero-btn-secondary">Sign In</Link>
              </>
            )}
            <Link to="/ipo/result" className="hero-btn-ghost">Check IPO Result →</Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="preview-card">
            <div className="preview-head">
              <span className="preview-dot" />
              <span className="preview-head-label">Live Applications</span>
            </div>
            <div className="preview-rows">
              {["Nabil Bank", "NIC Asia", "Laxmi Sunrise"].map((name, i) => (
                <div className="preview-row" key={i}>
                  <span className="preview-row-name">{name}</span>
                  <span className="preview-tag">Applied</span>
                </div>
              ))}
            </div>
            <div className="preview-footer">3 accounts applied successfully</div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <p className="features-eyebrow">Features</p>
          <h2 className="features-title">Everything you need</h2>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to automate?</h2>
          <p className="cta-desc">
            Join other NEPSE investors using Meroshare Bot to never miss an IPO opening.
          </p>
          {user ? (
            <Link to="/dashboard" className="hero-btn-primary">Go to Dashboard</Link>
          ) : (
            <Link to="/register" className="hero-btn-primary">Create Free Account</Link>
          )}
        </div>
      </section>

      <footer className="land-footer">
        Meroshare Bot — Built for NEPSE investors
      </footer>
    </div>
  );
};

export default Landing;