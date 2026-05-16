import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAccountsApi } from "../api/accounts";

const AccountContext = createContext(null);

const STORAGE_KEY = "dk-active-account";

const readStored = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export const AccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccountState] = useState(readStored);
  const [loading, setLoading] = useState(true);

  const setActiveAccount = useCallback((acc) => {
    setActiveAccountState(acc);
    if (acc) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const resetAccounts = useCallback(() => {
    setAccounts([]);
    setActiveAccountState(null);
    localStorage.removeItem(STORAGE_KEY);
    setLoading(false);
  }, []);

  const refreshAccounts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      resetAccounts();
      return;
    }

    setLoading(true);
    try {
      const res = await getAccountsApi();
      const list = Array.isArray(res?.data) ? res.data : [];
      setAccounts(list);

      if (list.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        setActiveAccountState(null);
        return;
      }

      setActiveAccountState((prev) => {
        if (!prev) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list[0]));
          return list[0];
        }
        const still = list.find((a) => a.id === prev.id);
        const next = still ?? list[0];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      setAccounts([]);
      setActiveAccountState(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, [resetAccounts]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return (
    <AccountContext.Provider value={{
      accounts,
      activeAccount,
      setActiveAccount,
      loading,
      refreshAccounts,
      resetAccounts,
    }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => useContext(AccountContext);