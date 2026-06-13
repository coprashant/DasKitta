import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout/Layout.jsx";
import NepseStrip, { NepseHeroCard } from "../../components/NepseStrip/NepseStrip.jsx";
import { useNepaliDateTime } from "../../dateUtils";
import "./Home.css";

const features = [
  {
    num: "01",
    title: "One-click apply",
    desc: "Apply for any open IPO across all your Meroshare accounts in a single action.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Multi-account",
    desc: "Manage multiple Meroshare accounts from one unified dashboard.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Result checker",
    desc: "Check IPO allotment results instantly for multiple accounts.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "History tracking",
    desc: "Every application logged with apply status and allotment results.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

const Home = ({ theme, onThemeToggle }) => {
  const { user } = useAuth();
  const { dateShort, timeStr } = useNepaliDateTime();

  return (
    <Layout theme={theme} onThemeToggle={onThemeToggle}>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-left">

            <div className="hero-eyebrow-row">
              <span className="hero-eyebrow">NEPSE IPO Automation</span>
              <span className="hero-np-datetime">
                <span className="hero-np-date">{dateShort}</span>
                <span className="hero-np-sep" aria-hidden="true">·</span>
                <span className="hero-np-time">{timeStr}</span>
              </span>
            </div>

            <h1 className="hero-title">
              Apply for IPOs<br />
              <span className="hero-title-strong">in one click</span>
            </h1>
            <p className="hero-desc">
              Automate your NEPSE IPO applications across multiple Meroshare accounts.
              Never miss an opening again.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">Go to dashboard</Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">Get started free</Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
                </>
              )}
            </div>
            <p className="hero-footnote">Free to use. No card required.</p>
          </div>

          <div className="hero-right">
            <NepseHeroCard />
          </div>
        </div>
      </section>

      {/* Live NEPSE data */}
      <NepseStrip />

      {/* Features */}
      <section className="features-section">
        <div className="features-inner">
          <div className="features-header">
            <span className="eyebrow">Features</span>
            <h2 className="section-title">Everything you need</h2>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div
                className="feature-card"
                key={i}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="feature-top">
                  <span className="feature-num">{f.num}</span>
                  <div className="feature-icon">{f.icon}</div>
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-box">
            <span className="eyebrow">Get started</span>
            <h2 className="section-title">Every IPO. Every account.</h2>
            <p className="cta-desc">
              Join other NEPSE investors using DasKitta to manage every IPO opening automatically.
            </p>
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">Go to dashboard</Link>
            ) : (
              <div className="cta-actions">
                <Link to="/register" className="btn btn-primary btn-lg">Create free account</Link>
                <Link to="/ipo/result" className="cta-guest-link">
                  Check result without signing in
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

    </Layout>
  );
};

export default Home;