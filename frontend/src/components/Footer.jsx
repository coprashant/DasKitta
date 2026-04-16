import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Footer.css";

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
  );
};

export default Footer;