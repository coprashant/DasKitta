import { createContext, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, registerApi, deleteAccountApi, logoutApi } from "../api/auth";
import { attemptRefresh } from "../api/client";
import { setToken, clearToken, readCachedUser, writeCachedUser, clearCachedUser } from "../api/tokenStore";
import { registerPushSubscription } from "../api/notifications";
import toast from "react-hot-toast";
export const AuthContext = createContext(null);

const SESSION_HINT_KEY = "session_hint";

const hasNetworkConnection = () => {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine !== false;
};

const isNetworkLikeFailure = (error) => {
  if (!error) return false;
  if (error.response) {
    return error.response.status >= 500;
  }

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

const hasSessionHint = () => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "true";
  } catch {
    return false;
  }
};

const setSessionHint = () => {
  try {
    localStorage.setItem(SESSION_HINT_KEY, "true");
  } catch {
  }
};

const clearSessionHint = () => {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // true once the initial session check against the refresh cookie is done
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const navigate = useNavigate();
  const onLoginRef  = useRef(null);
  const onLogoutRef = useRef(null);
  const registerOnLogin  = useCallback((fn) => { onLoginRef.current  = fn ?? null; }, []);
  const registerOnLogout = useCallback((fn) => { onLogoutRef.current = fn ?? null; }, []);

  const clearSession = useCallback(() => {
    clearToken();
    clearSessionHint();
    clearCachedUser();
    setIsAuthenticated(false);
    setIsOfflineSession(false);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async ({ allowOfflineFallback = false } = {}) => {
    const cachedUser = readCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
    }

    if (!hasSessionHint()) {
      clearSession();
      return false;
    }

    if (!hasNetworkConnection()) {
      if (allowOfflineFallback) {
        setIsOfflineSession(true);
      }
      setUser(cachedUser || null);
      return false;
    }

    try {
      const data = await attemptRefresh();

      if (data?.token) {
        const nextUser = {
          username: data.username ?? cachedUser?.username ?? null,
          email: data.email ?? cachedUser?.email ?? null,
        };

        writeCachedUser(nextUser);
        setSessionHint();
        setIsAuthenticated(true);
        setIsOfflineSession(false);
        setUser(nextUser);
        return true;
      }

      if (cachedUser) {
        setUser(cachedUser);
        setIsAuthenticated(false);
        if (allowOfflineFallback) {
          setIsOfflineSession(true);
        }
        return false;
      }
    } catch (error) {
      const status = error?.response?.status;
      const isRefreshCookieFailure = status === 400 && /\/auth\/refresh(?:\?|$)/.test(String(error?.config?.url ?? ""));

      if (status === 401 || isRefreshCookieFailure) {
        clearSession();
        return false;
      }

      if (status === 403) {
        setUser(cachedUser || null);
        setIsAuthenticated(false);
        setIsOfflineSession(false);
        return false;
      }

      if (allowOfflineFallback && (status >= 500 || isNetworkLikeFailure(error))) {
        setUser(cachedUser || null);
        setIsAuthenticated(false);
        setIsOfflineSession(true);
        return false;
      }

      if (cachedUser) {
        setUser(cachedUser);
      }
      setIsAuthenticated(false);
    }

    return false;
  }, [clearSession]);

  // on load ask the server if the refresh cookie still gives a valid session
  // no token or user data is ever trusted from local storage
  useEffect(() => {
    let active = true;

    if (!hasSessionHint()) {
      setIsReady(true);
      return () => { active = false; };
    }

    restoreSession({ allowOfflineFallback: true })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => { active = false; };
  }, [restoreSession]);

  useEffect(() => {
    if (!isOfflineSession) {
      return undefined;
    }

    const handleOnline = () => {
      restoreSession({ allowOfflineFallback: true });
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isOfflineSession, restoreSession]);

  const persistSession = (token, username, email) => {
    setToken(token);
    setSessionHint();
    const nextUser = { username, email };
    writeCachedUser(nextUser);
    setIsAuthenticated(true);
    setIsOfflineSession(false);
    setUser(nextUser);
  };

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const payload = {
        loginIdentifier: (credentials?.loginIdentifier ?? credentials?.username ?? "").trim(),
        password: credentials?.password,
        rememberMe: Boolean(credentials?.rememberMe),
      };
      const res = await loginApi(payload);
      const { token, username, email } = res.data;
      persistSession(token, username, email);
      if (onLoginRef.current) await onLoginRef.current();
      registerPushSubscription().catch(() => {});
      toast.success("Signed in successfully");
      return { ok: true, username, email };
    } catch (err) {
      const data = err?.response?.data;
      const code = data?.code || null;
      const email = data?.email || null;
      const message = data?.message || data?.errors?.loginIdentifier || "Login failed";

      if (code === "UNVERIFIED_ACCOUNT") {
        return { ok: false, code, message, email };
      }

      toast.error(message);
      return { ok: false, code, message, email };
    } finally {
      setIsLoading(false);
    }
  };
  const register = async (data) => {
    setIsLoading(true);
    try {
      const res = await registerApi(data);
      toast.success("Verification code sent to your email!");
      return res.data;
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        toast.error(Object.values(errors)[0]);
      } else {
        toast.error(err.response?.data?.message || "Registration failed");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  const logout = useCallback(() => {
    // best effort, revoke the token server side too, session clears either way
    logoutApi().catch(() => {});
    clearSession();
    if (onLogoutRef.current) onLogoutRef.current();
    toast.success("Signed out");
    navigate("/", { replace: true, state: null });
  }, [clearSession, navigate]);
  // deletes account on backend then clears session same as logout
  const deleteAccount = async (password) => {
    setIsLoading(true);
    try {
      await deleteAccountApi(password);
      clearSession();
      if (onLogoutRef.current) onLogoutRef.current();
      toast.success("Account deleted");
      navigate("/", { replace: true, state: null });
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === "string" ? data : (data?.message || "Could not delete account");
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  return (
      <AuthContext.Provider value={{
        user,
        isLoading,
        isReady,
        isAuthenticated,
        isOfflineSession,
        login,
        register,
        logout,
        deleteAccount,
        registerOnLogin,
        registerOnLogout,
      }}>
        {children}
      </AuthContext.Provider>
  );
};