import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);
const THEME_OPTIONS = ["light", "dark", "system"];

const getSystemTheme = () => (
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);

const normalizeTheme = (value) => (THEME_OPTIONS.includes(value) ? value : "system");

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("dk-theme");
    return normalizeTheme(stored ?? "system");
  });

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    localStorage.setItem("dk-theme", theme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        document.documentElement.setAttribute("data-theme", getSystemTheme());
      }
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const toggle = () => {
    setTheme((current) => {
      const currentTheme = current === "system" ? getSystemTheme() : current;
      return currentTheme === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);