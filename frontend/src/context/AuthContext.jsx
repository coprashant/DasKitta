import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, registerApi, deleteAccountApi, logoutApi } from "../api/auth";
import { attemptRefresh } from "../api/client";
import { setToken, clearToken } from "../api/tokenStore";
import { registerPushSubscription } from "../api/notifications";
import toast from "react-hot-toast";
const AuthContext = createContext(null);

const SESSION_HINT_KEY = "session_hint";

const hasNetworkConnection = () => {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine !== false;
};

const isNetworkError = (error) => !error?.response;

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
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const navigate = useNavigate();
  const onLoginRef  = useRef(null);
  const onLogoutRef = useRef(null);
  const registerOnLogin  = useCallback((fn) => { onLoginRef.current  = fn; }, []);
  const registerOnLogout = useCallback((fn) => { onLogoutRef.current = fn; }, []);

  const clearSession = useCallback(() => {
    clearToken();
    clearSessionHint();
    setIsOfflineSession(false);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async ({ allowOfflineFallback = false } = {}) => {
    if (!hasSessionHint()) {
      clearToken();
      setIsOfflineSession(false);
      setUser(null);
      return false;
    }

    if (!hasNetworkConnection()) {
      if (allowOfflineFallback) {
        setIsOfflineSession(true);
      }
      return false;
    }

    try {
      const data = await attemptRefresh();

      if (data?.token) {
        setSessionHint();
        setIsOfflineSession(false);
        setUser({ username: data.username, email: data.email });
        return true;
      }
    } catch (error) {
      if (allowOfflineFallback && isNetworkError(error)) {
        setIsOfflineSession(true);
        return false;
      }
    }

    clearSession();
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
      restoreSession();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isOfflineSession, restoreSession]);

  const persistSession = (token, username, email) => {
    setToken(token);
    setSessionHint();
    setIsOfflineSession(false);
    setUser({ username, email });
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
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.loginIdentifier || "Login failed";
      toast.error(msg);
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
export const useAuth = () => useContext(AuthContext);