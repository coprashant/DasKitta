import { Link, useLocation } from "react-router-dom";
import {
    TabIconPortfolio, TabIconResults, TabIconNepse,
    TabIconDashboard, TabIconApply
} from "../Icons";
import "./MobileTabBar.css";

const tabs = [
    { path: "/dashboard",  mobileLabel: "Home",      icon: TabIconDashboard  },
    { path: "/nepse",      mobileLabel: "Nepse",     icon: TabIconNepse      },
    { path: "/ipo/apply",  mobileLabel: "Apply",     icon: TabIconApply      },
    { path: "/ipo/result", mobileLabel: "Results",   icon: TabIconResults    },
    { path: "/portfolio",  mobileLabel: "Portfolio", icon: TabIconPortfolio  },
];

const MobileTabBar = () => {
    const { pathname } = useLocation();

    return (
        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
            {tabs.map(({ path, mobileLabel, icon: Icon }) => (
                <Link
                    key={path}
                    to={path}
                    className={`tab-item${pathname === path ? " active" : ""}`}
                    aria-current={pathname === path ? "page" : undefined}
                >
                    <Icon />
                    <span className="tab-label">{mobileLabel}</span>
                </Link>
            ))}
        </nav>
    );
};

export default MobileTabBar;