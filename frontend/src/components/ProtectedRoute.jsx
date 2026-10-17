import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ProtectedRoute = ({ children }) => {
    const { isReady, isAuthenticated } = useAuth();
    const location = useLocation();
    const canAccessProtectedRoute = Boolean(isAuthenticated);

    // wait for the real session check against the server, dont flash protected ui first
    if (!isReady) {
        return (
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
    }

    if (!canAccessProtectedRoute) {
        const nextBackground = location.state?.background;
        const backgroundLocation =
            nextBackground &&
            nextBackground.pathname &&
            !["/login", "/register"].includes(nextBackground.pathname) &&
            nextBackground.pathname !== location.pathname
                ? nextBackground
                : null;

        return (
            <Navigate
                to="/login"
                replace
                state={
                    backgroundLocation
                        ? {
                            background: backgroundLocation,
                            from: location,
                        }
                        : { from: location }
                }
            />
        );
    }

    return children;
};

export default ProtectedRoute;