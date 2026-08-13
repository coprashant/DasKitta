import { NavLink, Outlet } from "react-router-dom";
import Layout from "../../components/Layout/Layout.jsx";
import "./Settings.css";

// Tab configurations defined statically outside render
const TABS = [
    { to: "/settings", label: "Profile", end: true },
    { to: "/settings/accounts", label: "Accounts", end: true },
    { to: "/settings/accounts/add", label: "Add account", end: true },
];

function SettingsMenu() {
    return (
        <nav className="stg-menu" aria-label="Settings navigation">
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
                <header className="stg-header">
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">
                        Manage your profile and your Meroshare accounts
                    </p>
                </header>

                <SettingsMenu />

                <main className="stg-content anim-fade-up">
                    <Outlet />
                </main>
            </div>
        </Layout>
    );
}