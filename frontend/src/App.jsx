import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home/Home";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import AddAccount from "./pages/AddAccount/AddAccount";
import IPOApply from "./pages/IPOApply/IPOApply";
import ResultChecker from "./pages/ResultChecker/ResultChecker";
import History from "./pages/History/History";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/ipo/result" element={<ResultChecker />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/accounts/add" element={
            <ProtectedRoute><AddAccount /></ProtectedRoute>
          } />
          <Route path="/ipo/apply" element={
            <ProtectedRoute><IPOApply /></ProtectedRoute>
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