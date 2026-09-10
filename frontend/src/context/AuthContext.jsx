import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, registerApi, deleteAccountApi, logoutApi } from "../api/auth";
import { attemptRefresh } from "../api/client";
import { setToken, clearToken } from "../api/tokenStore";
import { registerPushSubscription } from "../api/notifications";
import toast from "react-hot-toast";
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // true once the initial session check against the refresh cookie is done
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const onLoginRef  = useRef(null);
  const onLogoutRef = useRef(null);
  const registerOnLogin  = useCallback((fn) => { onLoginRef.current  = fn; }, []);
  const registerOnLogout = useCallback((fn) => { onLogoutRef.current = fn; }, []);

  // on load ask the server if the refresh cookie still gives a valid session
  // no token or user data is ever trusted from local storage
  useEffect(() => {
    let active = true;
    attemptRefresh()
        .then((data) => {
          if (!active) return;
          if (data?.token) {
            setUser({ username: data.username, email: data.email });
          }
        })
        .catch(() => {
          // no valid session, stay logged out
        })
        .finally(() => {
          if (active) setIsReady(true);
        });
    return () => { active = false; };
  }, []);

  const persistSession = (token, username, email) => {
    setToken(token);
    setUser({ username, email });
  };
  const clearSession = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);
  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const res = await loginApi(credentials);
      const { token, username, email } = res.data;
      persistSession(token, username, email);
      if (onLoginRef.current) await onLoginRef.current();
      registerPushSubscription().catch(() => {});
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.username || "Login failed";
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