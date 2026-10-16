import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Layout from "../../components/Layout/Layout.jsx";
import { SettingsIcon, ProfileIcon, UsersIcon, IconPlus } from "../../components/Icons.jsx";
import "./Settings.css";

const TABS = [
    { to: "/settings/profile", label: "Profile", icon: ProfileIcon, end: true },
    { to: "/settings/general", label: "General", icon: SettingsIcon, end: true },
    { to: "/settings/accounts", label: "Accounts", icon: UsersIcon, end: true },
    { to: "/settings/accounts/add", label: "Add account", icon: IconPlus, end: true },
];

function SettingsMenu() {
    const navRef = useRef(null);
    const { pathname } = useLocation();

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;

        const activeTab = nav.querySelector(".stg-menu-item-active");
        if (!activeTab) return;

        const navRect = nav.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        const isOutsideLeft = tabRect.left < navRect.left;
        const isOutsideRight = tabRect.right > navRect.right;

        if (!isOutsideLeft && !isOutsideRight) {
            return;
        }

        const scrollOffset = isOutsideLeft
            ? tabRect.left - navRect.left - 8
            : tabRect.right - navRect.right + 8;

        nav.scrollTo({
            left: nav.scrollLeft + scrollOffset,
            behavior: "smooth",
        });
    }, [pathname]);

    return (
        <nav ref={navRef} className="stg-menu" aria-label="Settings navigation">
            {TABS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                        `stg-menu-item${isActive ? " stg-menu-item-active" : ""}`
                    }
                >
                    <span className="stg-menu-icon" aria-hidden="true">
                        <Icon />
                    </span>
                    <span className="stg-menu-label">{label}</span>
                </NavLink>
            ))}
        </nav>
    );
}

export default function Settings() {
    const { pathname } = useLocation();

    return (
        <Layout>
            <div className="page stg-page">
                <div className="stg-shell">
                    <aside className="stg-sidebar">
                        <header className="stg-header">
                            <h1 className="page-title">Settings</h1>
                            <p className="page-subtitle">
                                Manage your profile and Meroshare accounts
                            </p>
                        </header>

                        <SettingsMenu />
                    </aside>

                    <main className="stg-content anim-fade-up" key={pathname}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </Layout>
    );
}