import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout/Layout.jsx";
import NepseStrip, { NepseHeroCard } from "../../components/NepseStrip/NepseStrip.jsx";
import { useNepaliDateTime } from "../../dateUtils";
import "./Home.css";

const features = [
  {
    num: "01",
    title: "Apply in one click",
    desc: "Submit your IPO applications across multiple Meroshare profiles at the same time",
  },
  {
    num: "02",
    title: "Manage multiple accounts",
    desc: "Track and organize your entire family's investment profiles from one screen",
  },
  {
    num: "03",
    title: "Automatic result checks",
    desc: "Instantly find out if you were allotted shares without checking sites manually",
  },
  {
    num: "04",
    title: "History timeline",
    desc: "Keep a permanent, clean record of all your past applications and successes",
  },
];

const Home = ({ theme, onThemeToggle }) => {
  const { user } = useAuth();
  const { dateShort, timeStr } = useNepaliDateTime();

  return (
      <Layout theme={theme} onThemeToggle={onThemeToggle}>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow-row">
              <span className="hero-np-datetime">
                <span>{dateShort}</span>
                <span className="hero-np-sep">/</span>
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
                {user ? (
                    <Link to="/dashboard" className="btn-terminal">Go to Dashboard</Link>
                ) : (
                    <>
                      <Link to="/register" className="btn-terminal primary">Create an Account</Link>
                      <Link to="/login" className="btn-terminal secondary">Sign In</Link>
                    </>
                )}
              </div>
            </div>

            <div className="hero-right">
              <NepseHeroCard />
            </div>
          </div>
        </section>

        <NepseStrip />

        <section className="features-section">
          <div className="features-inner">
            <div className="features-header">
              <span className="eyebrow">FEATURES</span>
              <h2 className="section-title">Designed to save you time</h2>
            </div>
            <div className="features-grid">
              {features.map((f, i) => (
                  <div className="feature-card" key={i}>
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

        <section className="cta-section">
          <div className="cta-inner">
            <div className="cta-flat-box">
              <span className="eyebrow">GET STARTED</span>
              <h2 className="section-title">Ready to simplify your investments?</h2>
              <p className="cta-desc">
                Connect your accounts today and never miss another IPO deadline.
              </p>
              {user ? (
                  <Link to="/dashboard" className="btn-terminal">Open Dashboard</Link>
              ) : (
                  <div className="cta-actions">
                    <Link to="/register" className="btn-terminal primary">Get Started Now</Link>
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