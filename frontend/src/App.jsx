import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AccountProvider } from "./context/AccountContext";
import { NotificationProvider } from "./context/NotificationContext";
import AccountSync from "./components/AccountSync";
import ProtectedRoute from "./components/ProtectedRoute";

import Home          from "./pages/Home/Home";
import Auth          from "./pages/Auth/Auth";
import Dashboard     from "./pages/Dashboard/Dashboard";
import AddAccount    from "./pages/AddAccount/AddAccount";
import IPOApply      from "./pages/IPOApply/IPOApply";
import ResultChecker from "./pages/ResultChecker/ResultChecker";
import History       from "./pages/History/History";
import NotFound      from "./pages/NotFound/NotFound";
import Portfolio     from "./pages/Portfolio/Portfolio";
import Nepse         from "./pages/Nepse/Nepse";

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AccountProvider>
            <NotificationProvider>
              <AccountSync />
              <Toaster
                position="top-right"
                containerStyle={{ zIndex: 500 }}
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
              <Routes>
                <Route path="/"           element={<Home />} />
                <Route path="/login"    element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route path="/ipo/result" element={<ResultChecker />} />
                <Route path="/nepse"      element={<Nepse />} />

                <Route path="/dashboard" element={
                  <ProtectedRoute><Dashboard /></ProtectedRoute>
                } />
                <Route path="/accounts/add" element={
                  <ProtectedRoute><AddAccount /></ProtectedRoute>
                } />
                <Route path="/ipo/apply" element={
                  <ProtectedRoute><IPOApply /></ProtectedRoute>
                } />
                <Route path="/history" element={
                  <ProtectedRoute><History /></ProtectedRoute>
                } />
                <Route path="/portfolio" element={
                  <ProtectedRoute><Portfolio /></ProtectedRoute>
                } />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </AccountProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;