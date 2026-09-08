import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
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
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Shared in flight refresh call, so several 401s at once only trigger one refresh
let refreshPromise = null;

const attemptRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${client.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then((res) => {
        const newToken = res.data?.token;
        if (newToken) {
          localStorage.setItem("token", newToken);
        }
        return newToken;
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
        const newToken = await attemptRefresh();
        if (newToken) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
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
