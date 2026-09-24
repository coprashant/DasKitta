import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AccountProvider } from "./context/AccountContext";
import { NotificationProvider } from "./context/NotificationContext";
import AccountSync from "./components/AccountSync";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

// route pages are loaded on demand so first load only ships what is needed
const PrivacyPolicy    = lazy(() => import("./pages/Legal/PrivacyPolicy.jsx"));
const TermsOfService   = lazy(() => import("./pages/Legal/TermsOfService.jsx"));
const Disclaimer       = lazy(() => import("./pages/Legal/Disclaimer.jsx"));
const Settings         = lazy(() => import("./pages/Settings/Settings.jsx"));
const ProfileSettings  = lazy(() => import("./pages/Settings/ProfileSettings.jsx"));
const AddAccountSettings = lazy(() => import("./pages/Settings/AddAccountSettings.jsx"));
const AccountsSettings = lazy(() => import("./pages/Settings/AccountsSettings.jsx"));
const AccountInfo      = lazy(() => import("./pages/Settings/AccountInfo.jsx"));
const Home             = lazy(() => import("./pages/Home/Home"));
const Auth             = lazy(() => import("./pages/Auth/Auth"));
const Dashboard        = lazy(() => import("./pages/Dashboard/Dashboard"));
const IPOApply         = lazy(() => import("./pages/IPOApply/IPOApply"));
const ResultChecker    = lazy(() => import("./pages/ResultChecker/ResultChecker"));
const History          = lazy(() => import("./pages/History/History"));
const NotFound         = lazy(() => import("./pages/NotFound/NotFound"));
const Portfolio        = lazy(() => import("./pages/Portfolio/Portfolio"));
const Nepse            = lazy(() => import("./pages/Nepse/Nepse"));
const CompanyDetail    = lazy(() => import("./pages/Nepse/CompanyDetail"));

const PageLoader = () => (
    <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
    }}>
        <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round"
            style={{ animation: "spin 0.8s linear infinite" }}
        >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const AppContent = () => {
    const location = useLocation();
    const background = location.state?.background;

    return (
        <>
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

            <Suspense fallback={<PageLoader />}>
                <Routes location={background || location}>
                    <Route path="/"                   element={<ErrorBoundary><Home /></ErrorBoundary>} />
                    <Route path="/login"              element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                    <Route path="/register"           element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                    <Route path="/ipo/result"         element={<ErrorBoundary><ResultChecker /></ErrorBoundary>} />
                    <Route path="/nepse"              element={<ErrorBoundary><Nepse /></ErrorBoundary>} />
                    <Route path="/nepse/company/:symbol" element={<ErrorBoundary><CompanyDetail /></ErrorBoundary>} />
                    <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
                    <Route path="/terms" element={<ErrorBoundary><TermsOfService /></ErrorBoundary>} />
                    <Route path="/disclaimer" element={<ErrorBoundary><Disclaimer /></ErrorBoundary>} />
                    <Route path="/settings" element={
                        <ErrorBoundary><ProtectedRoute><Settings /></ProtectedRoute></ErrorBoundary>
                    }>
                        <Route index element={<ProfileSettings />} />
                        <Route path="accounts" element={<AccountsSettings />} />
                        <Route path="accounts/add" element={<AddAccountSettings />} />
                        <Route path="accounts/:id/info" element={<AccountInfo />} />
                    </Route>
                    <Route path="/dashboard" element={
                        <ErrorBoundary><ProtectedRoute><Dashboard /></ProtectedRoute></ErrorBoundary>
                    } />
                    <Route path="/ipo/apply" element={
                        <ErrorBoundary><ProtectedRoute><IPOApply /></ProtectedRoute></ErrorBoundary>
                    } />
                    <Route path="/history" element={
                        <ErrorBoundary><ProtectedRoute><History /></ProtectedRoute></ErrorBoundary>
                    } />
                    <Route path="/portfolio" element={
                        <ErrorBoundary><ProtectedRoute><Portfolio /></ProtectedRoute></ErrorBoundary>
                    } />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>

            {/* Render modal auth overlay above the current page */}
            {background && (
                <Suspense fallback={null}>
                    <ErrorBoundary>
                        <Routes>
                            <Route path="/login" element={<Auth />} />
                            <Route path="/register" element={<Auth />} />
                        </Routes>
                    </ErrorBoundary>
                </Suspense>
            )}
        </>
    );
};

const App = () => {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <ThemeProvider>
                    <AuthProvider>
                        <AccountProvider>
                            <NotificationProvider>
                                <AccountSync />
                                <AppContent />
                            </NotificationProvider>
                        </AccountProvider>
                    </AuthProvider>
                </ThemeProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
};

export default App;