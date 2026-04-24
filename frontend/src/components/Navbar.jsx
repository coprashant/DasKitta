import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard",    label: "Dashboard" },
  { path: "/ipo/apply",   label: "Apply IPO"  },
  { path: "/ipo/result",  label: "Results"    },
  { path: "/history",     label: "History"    },
  { path: "/accounts/add", label: "Accounts"  },
];

const guestLinks = [
  { path: "/ipo/result", label: "Check Result" },
];

/* SVG icons */
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12"  x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("dk-theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dk-theme", theme);
  }, [theme]);

  /* sync with system if no override */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!localStorage.getItem("dk-theme-manual")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => {
    localStorage.setItem("dk-theme-manual", "1");
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return { theme, toggle };
};

const Navbar = ({ onThemeToggle, theme }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);

  const links = user ? authLinks : guestLinks;

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">

          <Link to="/" className="navbar-brand">
            <img src="/favicon.png" className="navbar-logo" alt="DasKitta" />
            <span className="navbar-name">DasKitta</span>
          </Link>

          <div className="navbar-links">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`navbar-link${pathname === l.path ? " active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="navbar-right">
            <button
              className="navbar-theme-btn"
              onClick={onThemeToggle}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {user ? (
              <>
                <span className="navbar-username">{user.username}</span>
                <button onClick={logout} className="btn btn-secondary btn-sm navbar-logout-btn">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login"    className="navbar-link navbar-link-ghost">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}

            <button
              className={`navbar-hamburger${open ? " open" : ""}`}
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`mobile-drawer${open ? " open" : ""}`} ref={drawerRef}>
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)} />
        <div
          className="mobile-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="drawer-header">
            <Link to="/" className="drawer-brand" onClick={() => setOpen(false)}>
              <img src="/favicon.png" className="drawer-logo" alt="" />
              DasKitta
            </Link>
            <button className="drawer-close" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <nav className="drawer-links">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`drawer-link${pathname === l.path ? " active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="drawer-footer">
            <button className="drawer-theme-row" onClick={onThemeToggle}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>

            {user ? (
              <>
                {user.username && (
                  <p className="drawer-user">
                    Signed in as <strong>{user.username}</strong>
                  </p>
                )}
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="drawer-logout"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/register"
                className="btn btn-primary btn-full"
                style={{ textAlign: "center" }}
                onClick={() => setOpen(false)}
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;