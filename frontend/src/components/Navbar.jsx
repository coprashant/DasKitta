import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard",    label: "Dashboard" },
  { path: "/ipo/apply",    label: "Apply IPO"  },
  { path: "/ipo/result",   label: "Results"    },
  { path: "/history",      label: "History"    },
  { path: "/accounts/add", label: "Accounts"   },
];

const guestLinks = [
  { path: "/ipo/result", label: "Check Result" },
];

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6"  x2="6"  y2="18"/>
    <line x1="6"  y1="6"  x2="18" y2="18"/>
  </svg>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef(null);
  const firstFocusRef = useRef(null);

  const links = user ? authLinks : guestLinks;

  useEffect(() => { setOpen(false); }, [pathname]);

  /* keyboard close */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* body scroll lock + focus trap */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open && firstFocusRef.current) firstFocusRef.current.focus();
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* inert on main content when drawer open */
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (open) {
      main.setAttribute("inert", "");
      main.setAttribute("aria-hidden", "true");
    } else {
      main.removeAttribute("inert");
      main.removeAttribute("aria-hidden");
    }
  }, [open]);

  return (
    <>
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-inner">

          <Link to="/" className="navbar-brand">
            <img src="/favicon.png" className="navbar-logo" alt="DasKitta" />
            <span className="navbar-name">DasKitta</span>
          </Link>

          <div className="navbar-links" role="list">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                role="listitem"
                className={`navbar-link${pathname === l.path ? " active" : ""}`}
                aria-current={pathname === l.path ? "page" : undefined}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="navbar-right">
            <button
              className="navbar-theme-btn"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {user ? (
              <>
                <span className="navbar-username" aria-label={`Signed in as ${user.username}`}>
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="btn btn-secondary btn-sm navbar-logout-btn"
                >
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
              aria-controls="mobile-drawer"
            >
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
              <span className="hamburger-bar" />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        className={`mobile-drawer${open ? " open" : ""}`}
        ref={drawerRef}
        aria-hidden={!open}
      >
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          className="mobile-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="drawer-header">
            <Link
              to="/"
              className="drawer-brand"
              onClick={() => setOpen(false)}
              ref={firstFocusRef}
            >
              <img src="/favicon.png" className="drawer-logo" alt="" />
              DasKitta
            </Link>
            <button
              className="drawer-close"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="drawer-links" aria-label="Mobile navigation">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`drawer-link${pathname === l.path ? " active" : ""}`}
                aria-current={pathname === l.path ? "page" : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="drawer-footer">
            <button className="drawer-theme-row" onClick={toggle}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>

            {user ? (
              <>
                <p className="drawer-user">
                  Signed in as <strong>{user.username}</strong>
                </p>
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