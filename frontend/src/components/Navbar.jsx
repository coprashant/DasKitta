import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useAccount } from "../context/AccountContext";
import { useNotifications } from "../context/NotificationContext";
import NotificationPanel from "./NotificationPanel";
import {
  BellIcon, SunIcon, MoonIcon, ProfileIcon, CheckIcon,
  PlusIcon, SettingsIcon, SignOutIcon, TabIconPortfolio, TabIconResults, TabIconNepse,
  TabIconDashboard, TabIconApply
} from "./Icons";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard",  label: "Dashboard", mobileLabel: "Home",      MobileIcon: TabIconDashboard },
  { path: "/nepse",      label: "Nepse",      mobileLabel: "Nepse",     MobileIcon: TabIconNepse     },
  { path: "/ipo/apply",  label: "Apply IPO",  mobileLabel: "Apply",     MobileIcon: TabIconApply     },
  { path: "/ipo/result", label: "Results",    mobileLabel: "Results",   MobileIcon: TabIconResults   },
  { path: "/portfolio",  label: "Portfolio",  mobileLabel: "Portfolio", MobileIcon: TabIconPortfolio },
];

const secondaryLinks = [
  { path: "/history", label: "History" },
];

const guestLinks = [
  { path: "/nepse", label: "Nepse" },
];

const ProfileDropdown = ({ onClose }) => {
  const { user, logout } = useAuth();
  const { accounts = [], activeAccount, setActiveAccount } = useAccount() || {};

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
                            <span className="profile-account-check"><CheckIcon /></span>
                        )}
                      </button>
                  );
                })}
              </div>
            </>
        )}

        <div className="profile-dropdown-divider" />

        <div className="profile-dropdown-actions">
          <Link to="/accounts/add" className="profile-action-btn" onClick={onClose} role="menuitem">
            <PlusIcon /><span>Add account</span>
          </Link>
          <Link to="/accounts/manage" className="profile-action-btn" onClick={onClose} role="menuitem">
            <SettingsIcon /><span>Manage accounts</span>
          </Link>
        </div>

        <div className="profile-dropdown-divider" />

        <button
            className="profile-signout-btn"
            onClick={() => { logout(); onClose(); }}
            role="menuitem"
        >
          <SignOutIcon /><span>Sign out</span>
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
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
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
            <NotificationPanel readTimestamp={readTimestamp} onClose={() => setOpen(false)} />
        )}
      </div>
  );
};

const Navbar = () => {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const desktopLinks = user ? [...authLinks, ...secondaryLinks] : guestLinks;

  useEffect(() => { setProfileOpen(false); }, [pathname]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  return (
      <>
        <nav className="navbar" aria-label="Main navigation">
          <div className="navbar-inner">
            <Link to="/" className="navbar-brand">
              <img src="/favicon.png" className="navbar-logo" alt="DasKitta" />
              <span className="navbar-name">DasKitta</span>
            </Link>

            <div className="navbar-links">
              {desktopLinks.map((l) => (
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
                    <Link to="/login" className="navbar-link navbar-link-ghost">Sign in</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
                  </>
              )}
            </div>
          </div>
        </nav>

        {user && (
            <nav className="mobile-tab-bar" aria-label="Mobile navigation">
              {authLinks.map(({ path, mobileLabel, MobileIcon }) => (
                  <Link
                      key={path}
                      to={path}
                      className={`tab-item${pathname === path ? " active" : ""}`}
                      aria-current={pathname === path ? "page" : undefined}
                  >
                    <MobileIcon />
                    <span className="tab-label">{mobileLabel}</span>
                  </Link>
              ))}
            </nav>
        )}
      </>
  );
};

export default Navbar;