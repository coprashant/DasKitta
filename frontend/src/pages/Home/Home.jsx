import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "One-Click Apply",
    desc: "Apply for any open IPO across all your Meroshare accounts at once.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Multi-Account",
    desc: "Manage unlimited Meroshare accounts from a single dashboard.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Result Checker",
    desc: "Instantly check your IPO allotment results. No login required.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Full History",
    desc: "Track every application with apply status and allotment result.",
  },
];

const stats = [
  { value: "10+", label: "IPOs tracked" },
  { value: "Multi", label: "Account support" },
  { value: "Free", label: "To get started" },
];

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="landing">
      <nav className="land-nav">
        <div className="land-nav-inner">
          <Link to="/" className="land-brand">
            <span className="land-logo">
              <img src="/favicon.png" alt="DasKitta Logo" />
            </span>
            <span className="land-brand-name">DasKitta</span>
          </Link>
          <div className="land-nav-actions">
            <Link to="/ipo/result" className="land-nav-link">
              Check Result
            </Link>
            {user ? (
              <Link to="/dashboard" className="land-nav-btn">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="land-nav-link">
                  Sign In
                </Link>
                <Link to="/register" className="land-nav-btn">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <span className="hero-eyebrow">NEPSE IPO Automation</span>
          <h1 className="hero-title">
            Apply for IPOs
            <br />
            <span className="hero-accent">in one click</span>
          </h1>
          <p className="hero-desc">
            Automate your NEPSE IPO applications across multiple Meroshare
            accounts. Never miss an opening again.
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="stats-stack">
            {stats.map((s, i) => (
              <div className="stat-card" key={i}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
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
            Join other NEPSE investors using DasKitta to never miss an IPO
            opening.
          </p>
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
      </section>

      <footer className="land-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="brand-logo-link">
              <span className="brand-name">DasKitta</span>
            </Link>
            <span className="brand-tagline">Built for NEPSE investors.</span>
          </div>

          <div className="footer-nav">
            <Link to="/ipo/result" className="footer-nav-link">
              Check Result
            </Link>
            {user ? (
              <Link to="/dashboard" className="footer-nav-btn">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="footer-nav-link">
                  Sign In
                </Link>
                <Link to="/register" className="footer-nav-btn">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="footer-meta">
            <p className="footer-credit">
              Meet the Developer:
              <a
                className="footer-developer-link"
                href="https://prasant-bhattarai.com.np"
                target="_blank"
                rel="noopener noreferrer"
              >
                Prasant Bhattarai
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;