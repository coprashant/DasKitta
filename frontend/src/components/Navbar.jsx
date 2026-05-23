import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useAccount } from "../context/AccountContext";
import { useNotifications } from "../context/NotificationContext";
import NotificationPanel from "./NotificationPanel";
import { BellIcon, SunIcon, MoonIcon, ProfileIcon, CloseIcon, CheckIcon, PlusIcon, SettingsIcon, SignOutIcon } from "./Icons";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard",  label: "Dashboard" },
  { path: "/nepse",      label: "Nepse"      },
  { path: "/ipo/apply",  label: "Apply IPO"  },
  { path: "/ipo/result", label: "Results"    },
  { path: "/portfolio",  label: "Portfolio"  },
  { path: "/history",   label: "History"   }
];

const guestLinks = [
  { path: "/nepse", label: "Nepse" },
];

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

const BellButton = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { unreadCount, readTimestamp, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => {
      if (!v) markAllRead();
      return !v;
    });
  };

  return (
    <div className="bell-btn-wrap" ref={wrapRef}>
      <button
        className={`navbar-bell-btn${open ? " active" : ""}`}
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          readTimestamp={readTimestamp}
          onClose={() => setOpen(false)}
        />
      )}
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
            {user && <BellButton />}

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