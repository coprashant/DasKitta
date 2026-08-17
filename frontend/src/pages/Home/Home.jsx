import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout/Layout.jsx";
import NepseStrip, { NepseHeroCard } from "../../components/NepseStrip/NepseStrip.jsx";
import { useNepaliDateTime } from "../../dateUtils";
import SEO from "../../seo/SEO.jsx";
import { HOME_JSONLD } from "../../seo/jsonLd.js";
import "./Home.css";

const FEATURES = [
  {
    num: "01",
    title: "Apply in one click",
    desc: "Submit your IPO applications across multiple Meroshare profiles at the same time.",
  },
  {
    num: "02",
    title: "Manage multiple accounts",
    desc: "Track and organize your entire family's investment profiles from one screen.",
  },
  {
    num: "03",
    title: "Automatic result checks",
    desc: "Instantly find out if you were allotted shares without checking sites manually.",
  },
  {
    num: "04",
    title: "History timeline",
    desc: "Keep a permanent, clean record of all your past applications and successes.",
  },
];

const HeroActions = ({ user }) => {
  if (user) {
    return (
        <Link to="/dashboard" className="btn-terminal">
          Go to Dashboard
        </Link>
    );
  }

  return (
      <>
        <Link to="/register" className="btn-terminal primary">
          Create an Account
        </Link>
        <Link to="/login" className="btn-terminal secondary">
          Sign In
        </Link>
      </>
  );
};

const Home = ({ theme, onThemeToggle }) => {
  const { user } = useAuth();
  const { dateShort, timeStr } = useNepaliDateTime();

  return (
      <Layout theme={theme} onThemeToggle={onThemeToggle}>
        <SEO
            canonical="/"
            jsonLd={HOME_JSONLD}
        />
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow-row">
              <span className="hero-np-datetime" aria-label={`Current date ${dateShort}, time ${timeStr}`}>
                <span>{dateShort}</span>
                <span className="hero-np-sep" aria-hidden="true">/</span>
                <span>{timeStr}</span>
              </span>
              </div>

              <h1 className="hero-title">
                Apply for IPOs<br />
                <span className="hero-title-strong">instantly</span>
              </h1>

              <p className="hero-desc">
                Save time on every IPO. Apply across all your Meroshare accounts with a single click, completely free of hassle.
              </p>

              <div className="hero-actions">
                <HeroActions user={user} />
              </div>
            </div>

            <div className="hero-right">
              <NepseHeroCard />
            </div>
          </div>
        </section>

        {/* Live Nepse Market Ticker Strip */}
        <NepseStrip />

        {/* Features Grid */}
        <section className="features-section">
          <div className="features-inner">
            <div className="features-header">
              <span className="eyebrow">FEATURES</span>
              <h2 className="section-title">Designed to save you time</h2>
            </div>

            <div className="features-grid">
              {FEATURES.map((f) => (
                  <div className="feature-card" key={f.num}>
                    <div className="feature-top">
                      <span className="feature-num">{f.num}</span>
                    </div>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call To Action Banner */}
        <section className="cta-section">
          <div className="cta-inner">
            <div className="cta-flat-box">
              <span className="eyebrow">GET STARTED</span>
              <h2 className="section-title">Ready to simplify your investments?</h2>
              <p className="cta-desc">
                Connect your accounts today and never miss another IPO deadline.
              </p>

              {user ? (
                  <Link to="/dashboard" className="btn-terminal">
                    Open Dashboard
                  </Link>
              ) : (
                  <div className="cta-actions">
                    <Link to="/register" className="btn-terminal primary">
                      Get Started Now
                    </Link>
                    <Link to="/ipo/result" className="cta-guest-link">
                      Check Results as Guest
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