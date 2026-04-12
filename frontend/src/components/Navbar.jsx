import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const links = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/ipo/apply", label: "Apply IPO" },
  { path: "/ipo/result", label: "Results" },
  { path: "/history", label: "History" },
  { path: "/accounts/add", label: "Accounts" },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/dashboard" className="navbar-brand">
          <img src="/favicon.png" className="navbar-logo" alt="Logo" />
          <span className="navbar-name">Meroshare Bot</span>
        </Link>

        <div className="navbar-links">
          {links.map((l) => (
            <Link key={l.path} to={l.path} className={`navbar-link${pathname === l.path ? " active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="navbar-user">
          <span className="navbar-username">{user?.username}</span>
          <button onClick={logout} className="navbar-logout">Logout</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;