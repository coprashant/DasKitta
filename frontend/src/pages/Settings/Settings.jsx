import { NavLink, Outlet } from "react-router-dom";
import Layout from "../../components/Layout/Layout.jsx";
import "./Settings.css";

// tabs shown on every settings page
const TABS = [
    { to: "/settings", label: "Profile", end: true },
    { to: "/settings/accounts", label: "Accounts" },
    { to: "/settings/accounts/add", label: "Add account" },
];

function SettingsMenu() {
    return (
        <nav className="stg-menu">
            {TABS.map((tab) => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) =>
                        `stg-menu-item${isActive ? " stg-menu-item-active" : ""}`
                    }
                >
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}

export default function Settings() {
    return (
        <Layout>
            <div className="page stg-page">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Manage your profile and your Meroshare accounts</p>

                <SettingsMenu />

                <div className="stg-content anim-fade-up">
                    <Outlet />
                </div>
            </div>
        </Layout>
    );
}