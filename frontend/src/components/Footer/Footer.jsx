import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePWAInstall } from "../PWAInstall.js";
import { ArrowIcon, CodeIcon } from "../Icons.jsx";
import "./Footer.css";

const resourceGroups = [
  {
    title: "Trading & accounts",
    links: [
      { label: "MeroShare", href: "https://meroshare.cdsc.com.np/" },
      { label: "NEPSE", href: "https://www.nepalstock.com.np/" },
      { label: "Find your TMS", href: "https://www.nepalstock.com.np/brokers", title: "NEPSE broker directory for your broker's TMS" },
      { label: "IPO allotment results", href: "https://iporesult.cdsc.com.np/" },
    ],
  },
  {
    title: "Investor resources",
    links: [
      { label: "CDSC", href: "https://cdsc.com.np/" },
      { label: "SEBON", href: "https://www.sebon.gov.np/" },
      { label: "Nepal Rastra Bank", href: "https://www.nrb.org.np/" },
    ],
  },
];

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
        <div className="footer-inner">
          <div className="footer-main">
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

          <nav className="footer-links" aria-label="DasKitta">
            <h2 className="footer-heading">DasKitta</h2>
            <Link to="/nepse" className="footer-link">NEPSE market</Link>
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
            {isInstallable && (
                <button
                    type="button"
                    className="footer-link footer-pwa-btn"
                    onClick={handleInstallClick}
                >
                  Install App
                </button>
            )}
          </nav>

          {resourceGroups.map(({ title, links }) => (
            <nav className="footer-links" aria-label={title} key={title}>
              <h2 className="footer-heading">{title}</h2>
              {links.map(({ label, href, title: linkTitle }) => (
                <a
                  key={href}
                  className="footer-link footer-external-link"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={linkTitle || `${label} (opens in a new tab)`}
                >
                  <span>{label}</span>
                  <span className="footer-external-icon" aria-hidden="true"><ArrowIcon /></span>
                  <span className="footer-sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </nav>
          ))}
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">
              &copy; {new Date().getFullYear()} DasKitta
            </p>
            <nav className="footer-legal" aria-label="Legal">
              <Link to="/privacy" className="footer-link">Privacy Policy</Link>
              <Link to="/terms" className="footer-link">Terms of Service</Link>
              <Link to="/disclaimer" className="footer-link">Disclaimer</Link>
            </nav>
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
          </div>
        </div>
      </footer>
  );
};

export default Footer;