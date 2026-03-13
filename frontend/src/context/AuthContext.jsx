import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi, registerApi } from "../api/auth";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const navigate = useNavigate();

  const login = async (credentials) => {
    try {
      const res = await loginApi(credentials);
      const { token, username, email } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({ username, email }));
      setUser({ username, email });
      toast.success("Logged in successfully");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    }
  };

  const register = async (data) => {
    try {
      const res = await registerApi(data);
      const { token, username, email } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({ username, email }));
      setUser({ username, email });
      toast.success("Account created successfully");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);