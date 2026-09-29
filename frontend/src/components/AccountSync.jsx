import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAccount } from "../hooks/useAccount";

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