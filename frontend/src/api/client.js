import axios from "axios";
import { getToken, setToken, clearToken } from "./tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
    console.error(
        "VITE_API_BASE_URL is not set. API calls will fall back to localhost and " +
        "will fail in production. Set VITE_API_BASE_URL in your environment."
    );
}

const client = axios.create({
    baseURL: API_BASE_URL || "http://localhost:8080/api",
    withCredentials: true,
});

const isNetworkFailure = (error) => {
    if (!error) return false;
    if (error.response) return false;

    const code = String(error.code || "").toUpperCase();
    const message = String(error.message || "");
    return [
        "ERR_NETWORK",
        "ERR_INTERNET_DISCONNECTED",
        "ECONNABORTED",
        "ECONNRESET",
        "ECONNREFUSED",
        "ERR_TIMEOUT",
        "ERR_BAD_RESPONSE",
    ].includes(code) || /network|failed to fetch|timeout|load failed/i.test(message);
};

const isRefreshRequest = (url = "") => /\/auth\/refresh(?:\?|$)/.test(String(url));

const isSessionFailure = (error) => {
    const status = error?.response?.status;
    if (status === 401) return true;
    if (status !== 400) return false;

    const requestUrl = error?.config?.url ?? error?.request?.responseURL ?? "";
    return isRefreshRequest(requestUrl);
};

const isPermissionFailure = (error) => error?.response?.status === 403;

client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const PUBLIC_PATHS = ["/ipo/shares", "/auth/login", "/auth/register", "/nepse"];

const isPublicPath = (url = "") => {
    const normalizedUrl = url.toLowerCase();
    return PUBLIC_PATHS.some((p) => normalizedUrl.includes(p.toLowerCase())) || normalizedUrl.includes("/auth/");
};

const clearSession = () => {
    clearToken();
};

// Shared in flight refresh call, so several 401s at once only trigger one refresh
let refreshPromise = null;

// exported so a bootstrap check and raw fetch calls can reuse the same refresh flow
export const attemptRefresh = () => {
    if (!refreshPromise) {
        refreshPromise = axios
            .post(
                `${client.defaults.baseURL}/auth/refresh`,
                {},
                { withCredentials: true }
            )
            .then((res) => {
                const data = res.data;
                if (data?.token) {
                    setToken(data.token);
                }
                return data;
            })
            .catch((err) => {
                if (isSessionFailure(err)) {
                    clearToken();
                }
                throw err;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config ?? {};
        const url = originalRequest.url ?? "";

        const isAuthRequest = isPublicPath(url);
        const isAlreadyAtLogin = window.location.pathname === "/login";

        if (isNetworkFailure(error) || (status >= 500 && !isAuthRequest)) {
            return Promise.reject(error);
        }

        // Access token expired, try one silent refresh then retry the request once
        if (status === 401 && !isAuthRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const data = await attemptRefresh();
                if (data?.token) {
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = `Bearer ${data.token}`;
                    return client(originalRequest);
                }
            } catch (refreshError) {
                if (isSessionFailure(refreshError) && !isAlreadyAtLogin) {
                    clearSession();
                    window.location.href = "/login";
                }
                return Promise.reject(refreshError);
            }
        }

        if (status === 401 && !isAuthRequest && !isAlreadyAtLogin) {
            clearSession();
            window.location.href = "/login";
            return Promise.reject(error);
        }

        if (status === 403) {
            if (!isAuthRequest && !isAlreadyAtLogin && isPermissionFailure(error)) {
                // Do not force logout on permission-denied responses alone.
                // The refresh-token flow remains authoritative for real auth invalidation.
            }
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default client;