import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "isAdvancedNepseEnabled";

const NepseAdvancedModeContext = createContext(null);

export function NepseAdvancedModeProvider({ children }) {
    const [isAdvancedNepseEnabled, setIsAdvancedNepseEnabled] = useState(() => {
        if (typeof window === "undefined") return false;

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return raw === null ? false : raw === "true";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            window.localStorage.setItem(STORAGE_KEY, String(isAdvancedNepseEnabled));
        } catch {
            // storage unavailable, ignore quietly
        }
    }, [isAdvancedNepseEnabled]);

    const toggleAdvancedNepse = () => setIsAdvancedNepseEnabled((prev) => !prev);

    return (
        <NepseAdvancedModeContext.Provider
            value={{
                isAdvancedNepseEnabled,
                setIsAdvancedNepseEnabled,
                toggleAdvancedNepse,
            }}
        >
            {children}
        </NepseAdvancedModeContext.Provider>
    );
}

export function useNepseAdvancedMode() {
    const context = useContext(NepseAdvancedModeContext);

    if (!context) {
        throw new Error("useNepseAdvancedMode must be used within NepseAdvancedModeProvider");
    }

    return context;
}
