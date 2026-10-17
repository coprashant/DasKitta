// access token lives in memory only, never in local storage
// this way a future xss bug cant just read the token out of storage
let accessToken = null;

export const getToken = () => accessToken;

export const setToken = (token) => {
    accessToken = token;
};

export const clearToken = () => {
    accessToken = null;
};

// Cached user data is used only to restore UI state for a valid session hint.
// It is never treated as proof of successful backend authentication.
export const readCachedUser = () => {
    try {
        const raw = localStorage.getItem("session_user");
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;

        const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
        const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
        if (!username && !email) return null;

        return {
            username: username || null,
            email: email || null,
        };
    } catch {
        return null;
    }
};

export const writeCachedUser = (user) => {
    try {
        if (!user) {
            localStorage.removeItem("session_user");
            return;
        }
        const nextUser = {
            username: typeof user.username === "string" ? user.username.trim() : null,
            email: typeof user.email === "string" ? user.email.trim() : null,
        };
        if (!nextUser.username && !nextUser.email) {
            localStorage.removeItem("session_user");
            return;
        }
        localStorage.setItem("session_user", JSON.stringify(nextUser));
    } catch {
        // ignore storage errors in restricted or private browser contexts
    }
};

export const clearCachedUser = () => {
    try {
        localStorage.removeItem("session_user");
    } catch {
        // ignore storage errors in restricted or private browser contexts
    }
};