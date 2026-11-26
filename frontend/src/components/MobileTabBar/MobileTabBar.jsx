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

// match exact path or any nested path under it
const isActivePath = (pathname, path) =>
    pathname === path || pathname.startsWith(path + "/");

const MobileTabBar = () => {
    const { pathname } = useLocation();
    const activeIndex = tabs.findIndex((t) => isActivePath(pathname, t.path));

    return (
        <nav className="mobile-tab-bar" aria-label="Mobile navigation">
            <div
                className="tab-track"
                data-none={activeIndex === -1 ? "true" : undefined}
                style={{ "--i": Math.max(activeIndex, 0), "--n": tabs.length }}
            >
                {/* sliding marker follows the active tab */}
                <span className="tab-marker" aria-hidden="true" />

                {tabs.map(({ path, mobileLabel, icon: Icon }, idx) => {
                    const active = idx === activeIndex;
                    return (
                        <Link
                            key={path}
                            to={path}
                            className={`tab-item${active ? " active" : ""}`}
                            aria-current={active ? "page" : undefined}
                        >
                            <Icon />
                            <span className="tab-label">{mobileLabel}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileTabBar;