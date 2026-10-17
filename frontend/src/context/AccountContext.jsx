import { createContext, useState, useEffect, useCallback } from "react";
import { getAccountsApi } from "../api/accounts";
import { useAuth } from "../hooks/useAuth";

export const AccountContext = createContext(null);

// only the id is kept client side, not name, boid, dp code etc
const STORAGE_KEY = "dk-active-account-id";
const ORDER_KEY = "dk-account-order";
const CACHE_KEY = "dk-account-cache";

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

const readCachedAccounts = () => {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return [];

    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((account) => sanitizeAccountForCache(account))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const writeCachedAccounts = (list) => {
  try {
    const safeList = Array.isArray(list)
      ? list.map((account) => sanitizeAccountForCache(account)).filter(Boolean)
      : [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(safeList));
  } catch {
    // storage may be unavailable in some restricted contexts
  }
};

const clearCachedAccounts = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage may be unavailable in some restricted contexts
  }
};

const sanitizeAccountForCache = (account) => {
  if (!account || typeof account !== "object") return null;

  const rawId = account.id ?? account.accountId;
  if (rawId === undefined || rawId === null || rawId === "") return null;

  const username = typeof account.username === "string" ? account.username.trim() : "";
  const fullName = typeof account.fullName === "string" ? account.fullName.trim() : "";

  return {
    id: String(rawId),
    ...(username ? { username } : {}),
    ...(fullName ? { fullName } : {}),
  };
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
  const { isReady, isOfflineSession, isAuthenticated } = useAuth();
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
    writeCachedAccounts(newList);
    localStorage.setItem(ORDER_KEY, JSON.stringify(newList.map((a) => a.id)));
  }, []);

  // deliberate logout, not a fetch failure, so this clears everything
  const resetAccounts = useCallback(() => {
    setAccounts([]);
    setActiveAccountState(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    clearCachedAccounts();
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
      writeCachedAccounts(ordered);

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

  useEffect(() => {
    if (!isReady || !isAuthenticated || accounts.length > 0) return;

    const cachedAccounts = readCachedAccounts();
    if (cachedAccounts.length) {
      const ordered = applyOrder(cachedAccounts, readOrder());
      setAccounts(ordered);

      const storedId = readStoredId();
      const fallback = ordered.find((a) => String(a.id) === String(storedId)) ?? ordered[0] ?? null;
      setActiveAccountState(fallback);
    }
  }, [isReady, isAuthenticated, accounts.length]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;

    if (isOfflineSession) {
      setLoading(false);
      return;
    }

    refreshAccounts();
  }, [isReady, isAuthenticated, isOfflineSession, refreshAccounts]);

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