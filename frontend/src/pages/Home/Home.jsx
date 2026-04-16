import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

const features = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    label: "01",
    title: "One-Click Apply",
    desc: "Apply for any open IPO across all your Meroshare accounts simultaneously.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: "02",
    title: "Multi-Account",
    desc: "Manage multiple Meroshare accounts from one unified dashboard.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    label: "03",
    title: "Result Checker",
    desc: "Check your IPO allotment results instantly. No Meroshare login required.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    label: "04",
    title: "Application History",
    desc: "Track every application with apply status and allotment results.",
  },
];

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="landing">

      <nav className="land-nav">
        <div className="land-nav-inner">
          <Link to="/" className="land-brand">
            <span className="land-logo">
              <img src="/favicon.png" alt="DasKitta" />
            </span>
            <span className="land-brand-name">DasKitta</span>
          </Link>

          <div className="land-nav-actions">
            <Link to="/ipo/result" className="land-nav-link">Check Result</Link>
            {user ? (
              <Link to="/dashboard" className="land-nav-link land-nav-link--active">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="land-nav-link">Sign In</Link>
                <Link to="/register" className="land-nav-cta">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-left">
            <span className="hero-tag">NEPSE IPO Automation</span>
            <h1 className="hero-title">
              Apply for IPOs<br />
              <em className="hero-em">in one click</em>
            </h1>
            <p className="hero-desc">
              Automate your NEPSE IPO applications across multiple Meroshare accounts. Never miss an opening again.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary">Get Started Free</Link>
                  <Link to="/login" className="btn-ghost">Sign In</Link>
                </>
              )}
            </div>
          </div>

          <div className="hero-right">
            <div className="ticker-card">
              <div className="ticker-header">
                <span className="ticker-label">IPO Status</span>
                <span className="ticker-live">
                  <span className="ticker-dot" />
                  Live
                </span>
              </div>
              <div className="ticker-rows">
                <div className="ticker-row">
                  <span className="ticker-name">Account 1</span>
                  <span className="ticker-status ticker-status--applied">Applied</span>
                </div>
                <div className="ticker-row">
                  <span className="ticker-name">Account 2</span>
                  <span className="ticker-status ticker-status--applied">Applied</span>
                </div>
                <div className="ticker-row">
                  <span className="ticker-name">Account 3</span>
                  <span className="ticker-status ticker-status--pending">Pending</span>
                </div>
              </div>
              <div className="ticker-footer">
                <span className="ticker-stat-label">Allotment</span>
                <span className="ticker-stat-val">Checking...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <div className="features-header">
            <span className="section-eyebrow">Features</span>
            <h2 className="section-title">Everything you need</h2>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-top">
                  <span className="feature-num">{f.label}</span>
                  <div className="feature-icon">{f.icon}</div>
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-inner">
          <p className="section-eyebrow">Get started</p>
          <h2 className="cta-title">Ready to automate?</h2>
          <p className="cta-desc">
            Join other NEPSE investors using DasKitta to never miss an IPO opening.
          </p>
          {user ? (
            <Link to="/dashboard" className="btn-primary">Go to Dashboard</Link>
          ) : (
            <Link to="/register" className="btn-primary">Create Free Account</Link>
          )}
        </div>
      </section>

      <footer className="land-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link">
              <img src="/favicon.png" alt="DasKitta" className="footer-logo-img" />
              <span className="footer-brand-name">DasKitta</span>
            </Link>
            <span className="footer-tagline">Built for NEPSE investors.</span>
          </div>

          <nav className="footer-links">
            <Link to="/ipo/result" className="footer-link">Check Result</Link>
            {user ? (
              <Link to="/dashboard" className="footer-link">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="footer-link">Sign In</Link>
                <Link to="/register" className="footer-link">Register</Link>
              </>
            )}
            <a
              className="footer-link"
              href="https://prasant-bhattarai.com.np"
              target="_blank"
              rel="noopener noreferrer"
            >
              Developer
            </a>
          </nav>

          <p className="footer-copy">
            &copy; {new Date().getFullYear()} DasKitta
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;