import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

const features = [
  {
    icon: "⚡",
    title: "One-Click Apply",
    desc: "Apply for any open IPO across all your Meroshare accounts simultaneously.",
  },
  {
    icon: "👥",
    title: "Multiple Accounts",
    desc: "Manage and apply from unlimited Meroshare accounts from a single dashboard.",
  },
  {
    icon: "📊",
    title: "Result Checker",
    desc: "Check your IPO allotment results instantly. No login required.",
  },
  {
    icon: "📁",
    title: "Full History",
    desc: "Track every application you have ever made with status and result.",
  },
];

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="landing-logo">M</span>
            <span className="landing-brand-name">Meroshare Bot</span>
          </div>
          <div className="landing-nav-actions">
            <Link to="/ipo/result" className="landing-nav-link">
              Check Result
            </Link>
            {user ? (
              <Link to="/dashboard" className="landing-nav-btn">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-nav-link">
                  Sign In
                </Link>
                <Link to="/register" className="landing-nav-btn">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">NEPSE IPO Automation</div>
          <h1 className="hero-title">
            Apply for IPOs
            <br />
            <span className="hero-title-accent">in one click</span>
          </h1>
          <p className="hero-desc">
            Automate your NEPSE IPO applications across multiple Meroshare
            accounts. Never miss an IPO again.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="hero-btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="hero-btn-primary">
                  Get Started Free
                </Link>
                <Link to="/login" className="hero-btn-secondary">
                  Sign In
                </Link>
              </>
            )}
            <Link to="/ipo/result" className="hero-btn-ghost">
              Check IPO Result
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-card">
            <div className="hero-card-header">
              <span className="hero-card-dot green"></span>
              <span className="hero-card-label">Live Applications</span>
            </div>
            <div className="hero-card-rows">
              {["Nabil Bank", "NIC Asia", "Laxmi Sunrise"].map((name, i) => (
                <div className="hero-card-row" key={i}>
                  <span className="hero-card-name">{name}</span>
                  <span className="hero-card-status success">Applied</span>
                </div>
              ))}
            </div>
            <div className="hero-card-footer">
              3 accounts applied successfully
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-inner">
          <p className="features-label">Features</p>
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

      <section className="cta">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to automate?</h2>
          <p className="cta-desc">
            Join other NEPSE investors using Meroshare Bot to never miss an IPO.
          </p>
          <div className="cta-actions">
            {user ? (
              <Link to="/dashboard" className="hero-btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <Link to="/register" className="hero-btn-primary">
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>Meroshare Bot — Built for NEPSE investors</p>
      </footer>
    </div>
  );
};

export default Landing;