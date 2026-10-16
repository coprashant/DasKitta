import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconCheckSmall, MoonIcon, MonitorIcon, SunIcon } from "../../components/Icons";
import { useTheme } from "../../context/ThemeContext";
import { useNepseAdvancedMode } from "../../context/NepseAdvancedModeContext";

export default function GeneralSettings() {
    const { theme, setTheme } = useTheme();
    const { isAdvancedNepseEnabled, setIsAdvancedNepseEnabled } = useNepseAdvancedMode();
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const themeSelectRef = useRef(null);

    const themeOptions = [
        { value: "light", label: "Light", icon: <SunIcon /> },
        { value: "dark", label: "Dark", icon: <MoonIcon /> },
        { value: "system", label: "System", icon: <MonitorIcon /> }
    ];

    const selectedTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[2];

    useEffect(() => {
        if (!isThemeMenuOpen) return;

        const handleClickOutside = (event) => {
            if (themeSelectRef.current && !themeSelectRef.current.contains(event.target)) {
                setIsThemeMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isThemeMenuOpen]);

    const toggleAdvancedMode = () => {
        setIsAdvancedNepseEnabled((prev) => !prev);
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

                <div className="stg-theme-select" ref={themeSelectRef}>
                    <button
                        type="button"
                        className={`stg-theme-trigger ${isThemeMenuOpen ? "is-open" : ""}`}
                        aria-haspopup="listbox"
                        aria-expanded={isThemeMenuOpen}
                        aria-label="Select theme"
                        onClick={() => setIsThemeMenuOpen((open) => !open)}
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
