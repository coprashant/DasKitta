import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useState, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home          from "./pages/Home/Home";
import Login         from "./pages/Auth/Login";
import Register      from "./pages/Auth/Register";
import Dashboard     from "./pages/Dashboard/Dashboard";
import AddAccount    from "./pages/AddAccount/AddAccount";
import IPOApply      from "./pages/IPOApply/IPOApply";
import ResultChecker from "./pages/ResultChecker/ResultChecker";
import History       from "./pages/History/History";

const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("dk-theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dk-theme", theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!localStorage.getItem("dk-theme-manual")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => {
    localStorage.setItem("dk-theme-manual", "1");
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return { theme, toggle };
};

/* Passes theme props down via context-like prop drilling at router level */
const AppRoutes = ({ theme, onThemeToggle }) => {
  return (
    <Routes>
      <Route path="/"          element={<Home theme={theme} onThemeToggle={onThemeToggle} />} />
      <Route path="/login"     element={<Login theme={theme} onThemeToggle={onThemeToggle} />} />
      <Route path="/register"  element={<Register theme={theme} onThemeToggle={onThemeToggle} />} />
      <Route path="/ipo/result" element={<ResultChecker theme={theme} onThemeToggle={onThemeToggle} />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard theme={theme} onThemeToggle={onThemeToggle} />
        </ProtectedRoute>
      } />
      <Route path="/accounts/add" element={
        <ProtectedRoute>
          <AddAccount theme={theme} onThemeToggle={onThemeToggle} />
        </ProtectedRoute>
      } />
      <Route path="/ipo/apply" element={
        <ProtectedRoute>
          <IPOApply theme={theme} onThemeToggle={onThemeToggle} />
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <History theme={theme} onThemeToggle={onThemeToggle} />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

const App = () => {
  const { theme, toggle } = useTheme();

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font)",
              fontSize: "13px",
              borderRadius: "var(--r)",
              boxShadow: "var(--shadow-lg)",
            },
            success: { iconTheme: { primary: "var(--success)", secondary: "var(--surface)" } },
            error:   { iconTheme: { primary: "var(--danger)",  secondary: "var(--surface)" } },
          }}
        />
        <AppRoutes theme={theme} onThemeToggle={toggle} />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;