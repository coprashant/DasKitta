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

  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccountsApi();
      const list = Array.isArray(res?.data) ? res.data : [];
      setAccounts(list);

      setActiveAccountState((prev) => {
        if (!prev && list.length > 0) {
          const first = list[0];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
          return first;
        }
        if (prev && list.length > 0) {
          const still = list.find((a) => a.id === prev.id);
          if (still) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(still));
            return still;
          }
          const first = list[0];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
          return first;
        }
        if (list.length === 0) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return prev;
      });
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return (
    <AccountContext.Provider value={{ accounts, activeAccount, setActiveAccount, loading, refreshAccounts }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => useContext(AccountContext);