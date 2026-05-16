import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAccount } from "../context/AccountContext";

const AccountSync = () => {
  const { registerOnLogin, registerOnLogout } = useAuth();
  const { refreshAccounts, resetAccounts } = useAccount();

  useEffect(() => {
    registerOnLogin(refreshAccounts);
    registerOnLogout(resetAccounts);
  }, [registerOnLogin, registerOnLogout, refreshAccounts, resetAccounts]);

  return null;
};

export default AccountSync;