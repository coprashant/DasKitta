import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { PWAInstall } from "../PWAInstall.js";
import { ArrowIcon, CodeIcon } from "../Icons.jsx";
import "./Footer.css";

const Footer = () => {
  const { user } = useAuth();
  const { isInstallable, handleInstallClick } = PWAInstall();

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

            {isInstallable && (
                <button
                    type="button"
                    className="footer-link footer-pwa-btn"
                    onClick={handleInstallClick}
                >
                  Install App
                </button>
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