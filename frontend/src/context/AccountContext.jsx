import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAccountsApi } from "../api/accounts";
import { useAuth } from "./AuthContext";

const AccountContext = createContext(null);

// only the id is kept client side, not name, boid, dp code etc
const STORAGE_KEY = "dk-active-account-id";
const ORDER_KEY = "dk-account-order";

const readStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

const readOrder = () => {
  try {
    const s = localStorage.getItem(ORDER_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

const applyOrder = (list, order) => {
  if (!order.length) return list;
  const map = new Map(list.map((a) => [a.id, a]));
  const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id));
  const seen = new Set(order);
  const appended = list.filter((a) => !seen.has(a.id));
  return [...ordered, ...appended];
};

// no response means the request never reached the server, ie offline
const resolveErrorMessage = (error, fallback) => {
  if (!error?.response) {
    return "No internet connection. Check your network and try again.";
  }
  return error?.response?.data?.message || fallback;
};

export const AccountProvider = ({ children }) => {
  const { user, isReady } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccountState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setActiveAccount = useCallback((acc) => {
    setActiveAccountState(acc);
    if (acc) {
      localStorage.setItem(STORAGE_KEY, String(acc.id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const reorderAccounts = useCallback((newList) => {
    setAccounts(newList);
    localStorage.setItem(ORDER_KEY, JSON.stringify(newList.map((a) => a.id)));
  }, []);

  // deliberate logout, not a fetch failure, so this clears everything
  const resetAccounts = useCallback(() => {
    setAccounts([]);
    setActiveAccountState(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    setLoading(false);
  }, []);

  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getAccountsApi();
      const list = Array.isArray(res?.data) ? res.data : [];
      const ordered = applyOrder(list, readOrder());
      setAccounts(ordered);

      if (ordered.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        setActiveAccountState(null);
        return;
      }

      setActiveAccountState((prev) => {
        const wantedId = prev ? prev.id : readStoredId();
        const still = ordered.find((a) => String(a.id) === String(wantedId));
        const next = still ?? ordered[0];
        localStorage.setItem(STORAGE_KEY, String(next.id));
        return next;
      });
    } catch (err) {
      // keep whatever accounts and active account were already loaded
      // a failed refresh should not erase good state, only flag the error
      setError(resolveErrorMessage(err, "Could not load accounts"));
    } finally {
      setLoading(false);
    }
  }, []);

  // wait for the real session check before the first fetch, dont trust a guess
  // login and logout already trigger refreshAccounts through account sync
  useEffect(() => {
    if (!isReady) return;
    if (user) {
      refreshAccounts();
    } else {
      resetAccounts();
    }
  }, [isReady]);

  return (
      <AccountContext.Provider value={{
        accounts,
        activeAccount,
        setActiveAccount,
        loading,
        error,
        refreshAccounts,
        refetch: refreshAccounts,
        resetAccounts,
        reorderAccounts,
      }}>
        {children}
      </AccountContext.Provider>
  );
};

export const useAccount = () => useContext(AccountContext);