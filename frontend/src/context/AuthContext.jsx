import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, registerApi } from "../api/auth";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!stored || !token) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const persistSession = (token, username, email) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ username, email }));
    setUser({ username, email });
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const res = await loginApi(credentials);
      const { token, username, email } = res.data;
      persistSession(token, username, email);
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
      const { token, username, email } = res.data;
      persistSession(token, username, email);
      toast.success("Account created");
      navigate("/dashboard");
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        const first = Object.values(errors)[0];
        toast.error(first);
      } else {
        toast.error(err.response?.data?.message || "Registration failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    clearSession();
    toast.success("Signed out");
    navigate("/login");
  }, [clearSession, navigate]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);