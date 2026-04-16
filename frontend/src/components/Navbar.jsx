import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const authLinks = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/ipo/apply", label: "Apply IPO" },
  { path: "/ipo/result", label: "Results" },
  { path: "/history", label: "History" },
  { path: "/accounts/add", label: "Accounts" },
];

const guestLinks = [
  { path: "/ipo/result", label: "Check Result" },
];

const Navbar = () => {
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
            <span className="navbar-logo-wrap">
              <img src="/favicon.png" className="navbar-logo" alt="DasKitta" />
            </span>
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
            {user ? (
              <>
                <span className="navbar-username">{user.username}</span>
                <button onClick={logout} className="navbar-logout">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="navbar-link-ghost">Sign In</Link>
                <Link to="/register" className="navbar-cta">Get Started</Link>
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

      <div className={`mobile-drawer${open ? " open" : ""}`} ref={drawerRef}>
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)} />
        <div className="mobile-drawer-panel" role="dialog" aria-modal="true" aria-label="Navigation menu">

          <div className="drawer-header">
            <span className="drawer-brand">DasKitta</span>
            <button className="drawer-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
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
            {user ? (
              <>
                {user.username && (
                  <p className="drawer-user">Signed in as <strong>{user.username}</strong></p>
                )}
                <button onClick={() => { logout(); setOpen(false); }} className="drawer-logout">
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/register" className="btn btn-primary btn-full" style={{ textAlign: "center" }}>
                Get Started Free
              </Link>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default Navbar;