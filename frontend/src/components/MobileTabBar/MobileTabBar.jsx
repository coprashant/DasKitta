import { Link, useLocation } from "react-router-dom";
import {
    TabIconPortfolio, TabIconResults, TabIconNepse,
    TabIconDashboard, TabIconApply
} from "../Icons";
import "./MobileTabBar.css";

const tabs = [
    { path: "/dashboard",  mobileLabel: "Home",      MobileIcon: TabIconDashboard  },
    { path: "/nepse",      mobileLabel: "Nepse",     MobileIcon: TabIconNepse      },
    { path: "/ipo/apply",  mobileLabel: "Apply",     MobileIcon: TabIconApply      },
    { path: "/ipo/result", mobileLabel: "Results",   MobileIcon: TabIconResults    },
    { path: "/portfolio",  mobileLabel: "Portfolio", MobileIcon: TabIconPortfolio  },
];

const MobileTabBar = () => {
    const { pathname } = useLocation();

    return (
        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
            {tabs.map(({ path, mobileLabel, MobileIcon }) => (
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
    );
};

export default MobileTabBar;