import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useAccount } from "../context/AccountContext";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard",  label: "Dashboard" },
  { path: "/nepse",      label: "Nepse"      },
  { path: "/ipo/apply",  label: "Apply IPO"  },
  { path: "/ipo/result", label: "Results"    },
  { path: "/portfolio",  label: "Portfolio"  },
  { path: "/history",    label: "History"    },
];

const guestLinks = [
  { path: "/nepse", label: "Nepse" },
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

const ProfileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const SignOutIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const ProfileDropdown = ({ onClose }) => {
  const { user, logout } = useAuth();
  const { accounts, activeAccount, setActiveAccount } = useAccount();

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <div className="profile-dropdown" role="menu" aria-label="Profile menu">
      <div className="profile-dropdown-header">
        <div className="profile-dropdown-avatar">
          {user?.username?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="profile-dropdown-user">
          <span className="profile-dropdown-name">{user?.username}</span>
          <span className="profile-dropdown-email">{user?.email}</span>
        </div>
      </div>

      {accounts.length > 0 && (
        <>
          <div className="profile-dropdown-section-label">Switch account</div>
          <div className="profile-dropdown-accounts">
            {accounts.map((acc) => {
              const active = activeAccount?.id === acc.id;
              return (
                <button
                  key={acc.id}
                  className={`profile-account-row${active ? " profile-account-row-active" : ""}`}
                  onClick={() => { setActiveAccount(acc); onClose(); }}
                  role="menuitem"
                >
                  <div className="profile-account-avatar">
                    {acc.fullName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="profile-account-info">
                    <span className="profile-account-name">{acc.fullName}</span>
                    <span className="profile-account-meta">{acc.username}</span>
                  </div>
                  {active && (
                    <span className="profile-account-check">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="profile-dropdown-divider" />

      <div className="profile-dropdown-actions">
        <Link
          to="/accounts/add"
          className="profile-action-btn"
          onClick={onClose}
          role="menuitem"
        >
          <PlusIcon />
          <span>Add account</span>
        </Link>
        <Link
          to="/accounts/add"
          className="profile-action-btn"
          onClick={onClose}
          role="menuitem"
        >
          <SettingsIcon />
          <span>Manage accounts</span>
        </Link>
      </div>

      <div className="profile-dropdown-divider" />

      <button
        className="profile-signout-btn"
        onClick={handleLogout}
        role="menuitem"
      >
        <SignOutIcon />
        <span>Sign out</span>
      </button>
    </div>
  );
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const drawerRef = useRef(null);
  const profileRef = useRef(null);
  const firstFocusRef = useRef(null);

  const links = user ? authLinks : guestLinks;

  useEffect(() => { setOpen(false); setProfileOpen(false); }, [pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { setOpen(false); setProfileOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open && firstFocusRef.current) firstFocusRef.current.focus();
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (open) {
      main.setAttribute("inert", "");
    } else {
      main.removeAttribute("inert");
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

          <div className="navbar-links">
            {links.map((l) => (
              <Link
                key={l.path}
                to={l.path}
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
              <div className="profile-btn-wrap" ref={profileRef}>
                <button
                  className={`navbar-profile-btn${profileOpen ? " active" : ""}`}
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-label="Profile menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  <ProfileIcon />
                </button>
                {profileOpen && (
                  <ProfileDropdown onClose={() => setProfileOpen(false)} />
                )}
              </div>
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
                <Link
                  to="/accounts/add"
                  className="drawer-action-link"
                  onClick={() => setOpen(false)}
                >
                  <PlusIcon /> Add account
                </Link>
                <Link
                  to="/accounts/add"
                  className="drawer-action-link"
                  onClick={() => setOpen(false)}
                >
                  <SettingsIcon /> Manage accounts
                </Link>
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