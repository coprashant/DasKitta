import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddAccount from "./pages/AddAccount";
import IPOApply from "./pages/IPOApply";
import ResultChecker from "./pages/ResultChecker";
import History from "./pages/History";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/accounts/add" element={
            <ProtectedRoute><AddAccount /></ProtectedRoute>
          } />
          <Route path="/ipo/apply" element={
            <ProtectedRoute><IPOApply /></ProtectedRoute>
          } />
          <Route path="/ipo/result" element={
            <ProtectedRoute><ResultChecker /></ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute><History /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;