import { useEffect, useRef, useState } from "react";
import {
    IconChevronDown,
    IconCheckSmall,
    InfoIcon,
    MoonIcon,
    MonitorIcon,
    SunIcon,
    TabIconDashboard,
    TabIconNepse,
    TabIconPortfolio,
    TabIconApply,
} from "../../components/Icons";
import { useTheme } from "../../context/ThemeContext";
import { useNepseAdvancedMode } from "../../context/NepseAdvancedModeContext";

const DEFAULT_VIEW_KEY = "dk-default-market-view";
const AUTO_REFRESH_KEY = "dk-auto-refresh-interval";
const NOTIFICATIONS_KEY = "dk-notification-preferences";

const defaultViewOptions = [
    { value: "dashboard", label: "Dashboard", icon: <TabIconDashboard /> },
    { value: "nepse", label: "NEPSE", icon: <TabIconNepse /> },
    { value: "portfolio", label: "Portfolio", icon: <TabIconPortfolio /> },
    { value: "ipo", label: "IPO Apply", icon: <TabIconApply /> },
];

const refreshOptions = [
    { value: "off", label: "Off" },
    { value: 15000, label: "15 sec" },
    { value: 30000, label: "30 sec" },
    { value: 60000, label: "1 min" },
];

const notificationDefaults = {
    market: true,
    ipo: true,
    portfolio: true,
    security: true,
};

const notificationOptions = [
    {
        key: "market",
        label: "Market updates",
        info: "Get alerts for big index moves, trading sessions, and important market news.",
    },
    {
        key: "ipo",
        label: "IPO reminders",
        info: "Receive timing alerts for IPO openings, important deadlines, and result updates.",
    },
    {
        key: "portfolio",
        label: "Portfolio alerts",
        info: "Track changes in your holdings, gains, losses, and portfolio-level updates.",
    },
    {
        key: "security",
        label: "Security alerts",
        info: "Stay updated on critical account and security-related notifications.",
    },
];

const readLocalStorageValue = (key, fallback) => {
    if (typeof window === "undefined") return fallback;

    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;

    return value;
};

const readNotificationSettings = () => {
    const raw = readLocalStorageValue(NOTIFICATIONS_KEY, "{}");

    try {
        const parsed = JSON.parse(raw);
        return { ...notificationDefaults, ...parsed };
    } catch {
        return { ...notificationDefaults };
    }
};

export default function GeneralSettings() {
    const { theme, setTheme } = useTheme();
    const { isAdvancedNepseEnabled, setIsAdvancedNepseEnabled } = useNepseAdvancedMode();
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [isDefaultViewMenuOpen, setIsDefaultViewMenuOpen] = useState(false);
    const [defaultMarketView, setDefaultMarketView] = useState(() => readLocalStorageValue(DEFAULT_VIEW_KEY, "dashboard"));
    const [refreshInterval, setRefreshInterval] = useState(() => {
        const stored = readLocalStorageValue(AUTO_REFRESH_KEY, "off");
        return stored === "off" ? "off" : Number(stored) || "off";
    });
    const [notificationSettings, setNotificationSettings] = useState(readNotificationSettings);
    const [activeNotificationInfo, setActiveNotificationInfo] = useState(null);
    const themeSelectRef = useRef(null);
    const defaultViewSelectRef = useRef(null);

    const themeOptions = [
        { value: "light", label: "Light", icon: <SunIcon /> },
        { value: "dark", label: "Dark", icon: <MoonIcon /> },
        { value: "system", label: "System", icon: <MonitorIcon /> }
    ];

    const selectedTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[2];
    const selectedDefaultView = defaultViewOptions.find((option) => option.value === defaultMarketView) ?? defaultViewOptions[0];

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(DEFAULT_VIEW_KEY, defaultMarketView);
        }
    }, [defaultMarketView]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(AUTO_REFRESH_KEY, String(refreshInterval));
        }
    }, [refreshInterval]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notificationSettings));
        }
    }, [notificationSettings]);

    useEffect(() => {
        if (!isThemeMenuOpen && !isDefaultViewMenuOpen) return;

        const handleClickOutside = (event) => {
            const clickedInsideTheme = themeSelectRef.current && themeSelectRef.current.contains(event.target);
            const clickedInsideDefaultView = defaultViewSelectRef.current && defaultViewSelectRef.current.contains(event.target);

            if (!clickedInsideTheme) setIsThemeMenuOpen(false);
            if (!clickedInsideDefaultView) setIsDefaultViewMenuOpen(false);
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isThemeMenuOpen, isDefaultViewMenuOpen]);

    const toggleAdvancedMode = () => {
        setIsAdvancedNepseEnabled((prev) => !prev);
    };

    const toggleNotification = (key) => {
        setNotificationSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    return (
        <div className="card stg-card">
            <div className="stg-card-head">
                <div className="stg-card-head-row">
                    <div>
                        <h2 className="stg-card-title">General</h2>
                    </div>
                </div>
            </div>

            <div className="stg-theme-card">
                <div className="stg-toggle-copy">
                    <p className="stg-toggle-title">Theme</p>
                    <p className="stg-toggle-description">Choose the color scheme for DasKitta.</p>
                </div>

                {/* is-open lifts the wrapper above siblings */}
                <div
                    className={`stg-theme-select ${isThemeMenuOpen ? "is-open" : ""}`}
                    ref={themeSelectRef}
                >
                    <button
                        type="button"
                        className={`stg-theme-trigger ${isThemeMenuOpen ? "is-open" : ""}`}
                        aria-haspopup="listbox"
                        aria-expanded={isThemeMenuOpen}
                        aria-label="Select theme"
                        onClick={() => {
                            setIsDefaultViewMenuOpen(false);
                            setIsThemeMenuOpen((open) => !open);
                        }}
                    >
                        <span className="stg-theme-selected">
                            <span className="stg-theme-icon">{selectedTheme.icon}</span>
                            <span className="stg-theme-label">{selectedTheme.label}</span>
                        </span>
                        <span className="stg-theme-chevron"><IconChevronDown /></span>
                    </button>

                    {isThemeMenuOpen && (
                        <div className="stg-theme-menu" role="listbox" aria-label="Theme options">
                            {themeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`stg-theme-option ${theme === option.value ? "is-selected" : ""}`}
                                    role="option"
                                    aria-selected={theme === option.value}
                                    onClick={() => {
                                        setTheme(option.value);
                                        setIsThemeMenuOpen(false);
                                    }}
                                >
                                    <span className="stg-theme-option-main">
                                        <span className="stg-theme-icon">{option.icon}</span>
                                        <span className="stg-theme-label">{option.label}</span>
                                    </span>
                                    {theme === option.value && <span className="stg-theme-check"><IconCheckSmall /></span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="stg-setting-card">
                <div className="stg-toggle-copy">
                    <p className="stg-toggle-title">Default market view</p>
                    <p className="stg-toggle-description">Choose where DasKitta opens when you return to the app.</p>
                </div>

                {/* is-open lifts the wrapper above siblings */}
                <div
                    className={`stg-theme-select ${isDefaultViewMenuOpen ? "is-open" : ""}`}
                    ref={defaultViewSelectRef}
                >
                    <button
                        type="button"
                        className={`stg-theme-trigger ${isDefaultViewMenuOpen ? "is-open" : ""}`}
                        aria-haspopup="listbox"
                        aria-expanded={isDefaultViewMenuOpen}
                        aria-label="Select default market view"
                        onClick={() => {
                            setIsThemeMenuOpen(false);
                            setIsDefaultViewMenuOpen((open) => !open);
                        }}
                    >
                        <span className="stg-theme-selected">
                            <span className="stg-theme-icon">{selectedDefaultView.icon}</span>
                            <span className="stg-theme-label">{selectedDefaultView.label}</span>
                        </span>
                        <span className="stg-theme-chevron"><IconChevronDown /></span>
                    </button>

                    {isDefaultViewMenuOpen && (
                        <div className="stg-theme-menu" role="listbox" aria-label="Default market view options">
                            {defaultViewOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`stg-theme-option ${defaultMarketView === option.value ? "is-selected" : ""}`}
                                    role="option"
                                    aria-selected={defaultMarketView === option.value}
                                    onClick={() => {
                                        setDefaultMarketView(option.value);
                                        setIsDefaultViewMenuOpen(false);
                                    }}
                                >
                                    <span className="stg-theme-option-main">
                                        <span className="stg-theme-icon">{option.icon}</span>
                                        <span className="stg-theme-label">{option.label}</span>
                                    </span>
                                    {defaultMarketView === option.value && <span className="stg-theme-check"><IconCheckSmall /></span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="stg-setting-card stg-notification-card">
                <div className="stg-toggle-copy">
                    <p className="stg-toggle-title">Notification preferences</p>
                    <p className="stg-toggle-description">Choose which alerts and updates you want to receive.</p>
                </div>

                <div className="stg-notification-list">
                    {notificationOptions.map(({ key, label, info }) => (
                        <div key={key} className="stg-notification-item">
                            <div className="stg-toggle-copy stg-notification-main">
                                <div className="stg-notification-label-row">
                                    <p className="stg-toggle-title stg-notification-label">{label}</p>

                                    <button
                                        type="button"
                                        className="stg-info-button"
                                        aria-label={`More info about ${label}`}
                                        onMouseEnter={() => setActiveNotificationInfo(key)}
                                        onMouseLeave={() => setActiveNotificationInfo((current) => current === key ? null : current)}
                                        onFocus={() => setActiveNotificationInfo(key)}
                                        onBlur={() => setActiveNotificationInfo((current) => current === key ? null : current)}
                                        onClick={() => setActiveNotificationInfo((current) => current === key ? null : key)}
                                    >
                                        <InfoIcon />
                                    </button>
                                </div>

                                {activeNotificationInfo === key && (
                                    <span className="stg-info-tooltip">{info}</span>
                                )}
                            </div>

                            <button
                                type="button"
                                className={`stg-toggle-switch ${notificationSettings[key] ? "is-on" : ""}`}
                                role="switch"
                                aria-checked={notificationSettings[key]}
                                aria-label={`Toggle ${label}`}
                                onClick={() => toggleNotification(key)}
                            >
                                <span className="stg-toggle-knob" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="stg-setting-card">
                <div className="stg-toggle-copy">
                    <p className="stg-toggle-title">Auto-refresh settings</p>
                    <p className="stg-toggle-description">Refresh market data automatically while you stay on the page.</p>
                </div>

                <div className="stg-choice-grid" aria-label="Auto refresh options">
                    {refreshOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`stg-choice-button ${refreshInterval === option.value ? "is-selected" : ""}`}
                            onClick={() => setRefreshInterval(option.value)}
                            aria-pressed={refreshInterval === option.value}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="stg-toggle-card">
                <div className="stg-toggle-copy">
                    <p className="stg-toggle-title">Advanced NEPSE Features</p>
                    <p className="stg-toggle-description">
                        Enable technical indicators, market depth, floorsheets, and advanced broker analytics.
                    </p>
                </div>

                <button
                    type="button"
                    className={`stg-toggle-switch ${isAdvancedNepseEnabled ? "is-on" : ""}`}
                    role="switch"
                    aria-checked={isAdvancedNepseEnabled}
                    aria-label="Toggle advanced NEPSE features"
                    onClick={toggleAdvancedMode}
                >
                    <span className="stg-toggle-knob" />
                </button>
            </div>
        </div>
    );
}