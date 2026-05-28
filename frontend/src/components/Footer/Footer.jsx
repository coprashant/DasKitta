import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Footer.css";

/* code bracket SVG */
const CodeIcon = () => (
  <svg className="dev-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

/* external link arrow SVG */
const ArrowIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, flexShrink: 0, transition: "transform 0.22s", opacity: 0.6 }}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const Footer = () => {
  const { user } = useAuth();

  return (
    <footer className="site-footer">
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
            <>
              <Link to="/dashboard" className="footer-link">Dashboard</Link>
              <Link to="/history" className="footer-link">History</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="footer-link">Sign in</Link>
              <Link to="/register" className="footer-link">Register</Link>
            </>
          )}

          <a
            className="footer-link footer-link--dev"
            href="https://prasant-bhattarai.com.np"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CodeIcon />
            Developer
            <span className="dev-name">Prasant Bhattarai</span>
            <ArrowIcon />
          </a>
        </nav>

        <p className="footer-copy">
          &copy; {new Date().getFullYear()} DasKitta
        </p>

      </div>
    </footer>
  );
};

export default Footer;