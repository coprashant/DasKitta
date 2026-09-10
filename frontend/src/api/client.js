import axios from "axios";
import { getToken, setToken, clearToken } from "./tokenStore";

const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
    withCredentials: true,
});

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
                clearToken();
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
                // fall through to session clear below
            }
        }

        const isUnauthorized = status === 401 || status === 403;

        if (isUnauthorized && !isAuthRequest && !isAlreadyAtLogin) {
            clearSession();
            window.location.href = "/login";
        }

        return Promise.reject(error);
    }
);

export default client;