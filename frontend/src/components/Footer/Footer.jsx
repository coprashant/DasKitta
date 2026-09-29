import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePWAInstall } from "../PWAInstall.js";
import { ArrowIcon, CodeIcon } from "../Icons.jsx";
import "./Footer.css";

const Footer = () => {
  const { user } = useAuth();
  const { isInstallable, handleInstallClick } = usePWAInstall();
  const location = useLocation();

  // Check if current page is homepage
  const isHomePage = location.pathname === "/";

  return (
      <footer
          className={`site-footer${user ? " has-tabbar" : ""}${
              !isHomePage ? " hide-on-mobile" : ""
          }`}
      >
        {/* compact link row mobile only */}
        <nav className="footer-mobile-bar" aria-label="Quick links">
          {user ? (
              <Link to="/history" className="footer-mobile-link">
                History
              </Link>
          ) : (
              <Link to="/nepse" className="footer-mobile-link">
                Nepse
              </Link>
          )}
          <Link to="/privacy" className="footer-mobile-link">
            Privacy
          </Link>
          <Link to="/terms" className="footer-mobile-link">
            Terms
          </Link>
          <Link to="/disclaimer" className="footer-mobile-link">
            Disclaimer
          </Link>
        </nav>

        <div className="footer-inner">
          {/* Brand Header */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link">
              <img
                  src="/favicon.png"
                  alt="DasKitta"
                  className="footer-logo-img"
              />
              <span className="footer-brand-name">DasKitta</span>
            </Link>
            <span className="footer-tagline">Built for NEPSE investors.</span>
          </div>

          {/* Navigation and Legal Links */}
          <nav className="footer-links" aria-label="Footer Navigation">
            {user ? (
                <>
                  <Link to="/dashboard" className="footer-link">
                    Dashboard
                  </Link>
                  <Link to="/history" className="footer-link">
                    History
                  </Link>
                </>
            ) : (
                <>
                  <Link to="/login" className="footer-link">
                    Sign in
                  </Link>
                  <Link to="/register" className="footer-link">
                    Register
                  </Link>
                </>
            )}

            {/* Legal Links */}
            <Link to="/privacy" className="footer-link">
              Privacy Policy
            </Link>
            <Link to="/terms" className="footer-link">
              Terms of Service
            </Link>
            <Link to="/disclaimer" className="footer-link">
              Disclaimer
            </Link>

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

          {/* Copyright */}
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} DasKitta
          </p>
        </div>
      </footer>
  );
};

export default Footer;