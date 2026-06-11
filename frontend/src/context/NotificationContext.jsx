import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "./AccountContext";
import { getHistoryApi } from "../api/ipo";
import ipoData from "../ipo_data.json";
import { bsToAd, nowNepal } from "../dateUtils";

const NotificationContext = createContext(null);

const NOTIF_KEY   = (id) => `dk-notifs-${id}`;
const READ_KEY    = (id) => `dk-notifs-read-${id}`;
const DELETED_KEY = (id) => `dk-notifs-deleted-${id}`;

const readStored = (key) => {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const buildId = (...parts) => parts.join("-");

const msToDhm = (ms) => {
  const totalMins = Math.floor(ms / 60000);
  return {
    days: Math.floor(totalMins / 1440),
    hrs:  Math.floor((totalMins % 1440) / 60),
    mins: totalMins % 60,
  };
};

const closingDetail = (closeDateBs) => {
  try {
    const closeAd = bsToAd(closeDateBs);
    const diff    = closeAd - nowNepal();
    if (diff <= 0) return "Closed";
    const { days, hrs, mins } = msToDhm(diff);
    if (days > 0) return `Closes in ${days}d`;
    if (hrs  > 0) return `Closes in ${hrs}h`;
    if (mins > 0) return `Closes in ${mins}m`;
    return "Closing soon";
  } catch {
    return null;
  }
};

const openingDetail = (openDateBs) => {
  try {
    const openAd = bsToAd(openDateBs);
    const diff   = openAd - nowNepal();
    if (diff <= 0) return "Opens today";
    const { days, hrs } = msToDhm(diff);
    if (days > 0) return `Opens in ${days}d`;
    if (hrs  > 0) return `Opens in ${hrs}h`;
    return "Opening soon";
  } catch {
    return null;
  }
};

const deriveIpoNotifs = (deletedIds) => {
  const notifs = [];
  const now    = nowNepal();

  for (const ipo of ipoData) {
    let closeAd, openAd;
    try {
      closeAd = bsToAd(ipo.closeDate);
      openAd  = bsToAd(ipo.openDate);
    } catch (e) {
      console.error(`dateUtils: ${e.message}`);
      continue;
    }

    if (ipo.status === "open") {
      if (closeAd < now) continue;
      const diffClose  = closeAd - now;
      const { days }   = msToDhm(diffClose);
      if (days <= 3) {
        const id = buildId("ipo-closing", ipo.id);
        if (!deletedIds.has(id)) {
          notifs.push({
            id,
            type:      "IPO_CLOSING_SOON",
            title:     "Closing soon",
            body:      ipo.companyName,
            detail:    closingDetail(ipo.closeDate),
            timestamp: new Date(closeAd.getTime() - 3 * 86400000).toISOString(),
            ipoId:     ipo.id,
          });
        }
      }
    }

    if (ipo.status === "upcoming") {
      if (openAd < now) continue;
      const id = buildId("ipo-upcoming", ipo.id);
      if (!deletedIds.has(id)) {
        notifs.push({
          id,
          type:      "NEW_IPO",
          title:     "Upcoming IPO",
          body:      ipo.companyName,
          detail:    openingDetail(ipo.openDate),
          timestamp: new Date(openAd.getTime() - 7 * 86400000).toISOString(),
          ipoId:     ipo.id,
        });
      }
    }
  }

  return notifs;
};

const deriveFromHistory = (items, deletedIds) => {
  const notifs = [];
  for (const item of items) {
    if (item.status === "FAILED") {
      const id = buildId("fail", item.id);
      if (!deletedIds.has(id)) {
        notifs.push({
          id,
          type:      "APP_FAILED",
          title:     "Application failed",
          body:      item.companyName || "Unknown company",
          detail:    item.statusMessage || null,
          timestamp: item.appliedAt,
          shareId:   item.shareId,
        });
      }
    }
  }
  return notifs;
};

const mergeNotifs = (existing, incoming) => {
  const map = new Map(existing.map((n) => [n.id, n]));
  for (const n of incoming) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
};

export const NotificationProvider = ({ children }) => {
  const { activeAccount } = useAccount();

  const [notifsByAccount, setNotifsByAccount] = useState({});
  const [readByAccount,   setReadByAccount]   = useState({});
  const [loading, setLoading] = useState(false);

  const fetchedRef = useRef(new Set());

  const accountId = activeAccount?.id;

  const notifications = accountId ? (notifsByAccount[accountId] || []) : [];
  const readTimestamp = accountId ? (readByAccount[accountId] || 0) : 0;

  const unreadCount = notifications.filter(
    (n) => new Date(n.timestamp).getTime() > readTimestamp
  ).length;

  const loadForAccount = useCallback(async (acc) => {
    if (!acc) return;
    const id = acc.id;

    const storedNotifs  = readStored(NOTIF_KEY(id))   || [];
    const storedRead    = readStored(READ_KEY(id))     || 0;
    const storedDeleted = readStored(DELETED_KEY(id))  || [];
    const deletedIds    = new Set(storedDeleted);

    const ipoNotifs = deriveIpoNotifs(deletedIds);
    const merged    = mergeNotifs(storedNotifs, ipoNotifs);

    setNotifsByAccount((prev) => ({ ...prev, [id]: merged }));
    setReadByAccount((prev)   => ({ ...prev, [id]: storedRead }));
    writeStored(NOTIF_KEY(id), merged);

    if (fetchedRef.current.has(id)) return;
    fetchedRef.current.add(id);

    setLoading(true);
    try {
      const histRes   = await getHistoryApi();
      const histItems = (Array.isArray(histRes?.data) ? histRes.data : [])
        .filter((h) => h.accountUsername === acc.username);
      const histNotifs = deriveFromHistory(histItems, deletedIds);
      const mergedAll  = mergeNotifs(merged, histNotifs);
      setNotifsByAccount((prev) => ({ ...prev, [id]: mergedAll }));
      writeStored(NOTIF_KEY(id), mergedAll);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeAccount) loadForAccount(activeAccount);
  }, [activeAccount?.id]);

  const markAllRead = useCallback(() => {
    if (!accountId) return;
    const now = Date.now();
    setReadByAccount((prev) => ({ ...prev, [accountId]: now }));
    writeStored(READ_KEY(accountId), now);
  }, [accountId]);

  const clearAll = useCallback(() => {
    if (!accountId) return;
    const current    = notifsByAccount[accountId] || [];
    const deletedIds = current.map((n) => n.id);
    const existing   = readStored(DELETED_KEY(accountId)) || [];
    const merged     = [...new Set([...existing, ...deletedIds])];
    writeStored(DELETED_KEY(accountId), merged);
    setNotifsByAccount((prev) => ({ ...prev, [accountId]: [] }));
    writeStored(NOTIF_KEY(accountId), []);
  }, [accountId, notifsByAccount]);

  const refresh = useCallback(() => {
    if (!activeAccount) return;
    fetchedRef.current.delete(activeAccount.id);
    loadForAccount(activeAccount);
  }, [activeAccount, loadForAccount]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      readTimestamp,
      loading,
      markAllRead,
      clearAll,
      refresh,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);