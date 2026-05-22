import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "./AccountContext";
import { getHistoryApi, getCdscSummaryApi } from "../api/ipo";

const NotificationContext = createContext(null);

const NOTIF_KEY = (id) => `dk-notifs-${id}`;
const READ_KEY  = (id) => `dk-notifs-read-${id}`;

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

const TYPE = {
  ALLOTTED:        "ALLOTTED",
  NOT_ALLOTTED:    "NOT_ALLOTTED",
  RESULT_PUBLISHED:"RESULT_PUBLISHED",
  APP_FAILED:      "APP_FAILED",
  IPO_CLOSING_SOON:"IPO_CLOSING_SOON",
  NEW_IPO:         "NEW_IPO",
};

const buildId = (...parts) => parts.join("-");

const deriveFromHistory = (items) => {
  const notifs = [];
  for (const item of items) {
    if (item.status === "FAILED") {
      notifs.push({
        id:        buildId("fail", item.id),
        type:      TYPE.APP_FAILED,
        title:     "Application failed",
        body:      item.companyName || "Unknown company",
        detail:    item.statusMessage || null,
        timestamp: item.appliedAt,
        shareId:   item.shareId,
      });
    }
    if (item.resultStatus === "ALLOTTED") {
      notifs.push({
        id:        buildId("allot", item.id),
        type:      TYPE.ALLOTTED,
        title:     "Shares allotted",
        body:      item.companyName || "Unknown company",
        detail:    item.allottedKitta ? `${item.allottedKitta} kitta allotted` : null,
        timestamp: item.resultCheckedAt || item.appliedAt,
        shareId:   item.shareId,
      });
    }
    if (item.resultStatus === "NOT_ALLOTTED") {
      notifs.push({
        id:        buildId("notallot", item.id),
        type:      TYPE.NOT_ALLOTTED,
        title:     "Not allotted",
        body:      item.companyName || "Unknown company",
        detail:    null,
        timestamp: item.resultCheckedAt || item.appliedAt,
        shareId:   item.shareId,
      });
    }
  }
  return notifs;
};

const deriveFromCdsc = (cdscItems, existingIds) => {
  const notifs = [];
  for (const item of cdscItems) {
    const formId = item.applicantFormId || item.companyShareId;
    if (!formId) continue;

    if (item.resultStatus === "ALLOTTED") {
      const id = buildId("cdsc-allot", formId);
      if (!existingIds.has(id)) {
        notifs.push({
          id,
          type:      TYPE.ALLOTTED,
          title:     "Shares allotted",
          body:      item.companyName || item.scrip || "Unknown company",
          detail:    item.allottedKitta ? `${item.allottedKitta} kitta allotted` : null,
          timestamp: new Date().toISOString(),
          shareId:   item.companyShareId || null,
        });
      }
    }
    if (item.resultStatus === "NOT_ALLOTTED") {
      const id = buildId("cdsc-notallot", formId);
      if (!existingIds.has(id)) {
        notifs.push({
          id,
          type:      TYPE.NOT_ALLOTTED,
          title:     "Not allotted",
          body:      item.companyName || item.scrip || "Unknown company",
          detail:    null,
          timestamp: new Date().toISOString(),
          shareId:   item.companyShareId || null,
        });
      }
    }
    if (
      item.resultStatus !== "NOT_PUBLISHED" &&
      item.resultStatus !== "ALLOTTED" &&
      item.resultStatus !== "NOT_ALLOTTED"
    ) {
      const id = buildId("cdsc-pub", formId);
      if (!existingIds.has(id)) {
        notifs.push({
          id,
          type:      TYPE.RESULT_PUBLISHED,
          title:     "Result published",
          body:      item.companyName || item.scrip || "Unknown company",
          detail:    null,
          timestamp: new Date().toISOString(),
          shareId:   item.companyShareId || null,
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
  const { activeAccount, accounts } = useAccount();

  const [notifsByAccount, setNotifsByAccount] = useState({});
  const [readByAccount,   setReadByAccount]   = useState({});
  const [loading, setLoading] = useState(false);

  const fetchedRef = useRef(new Set());

  const accountId = activeAccount?.id;

  const notifications = accountId
    ? (notifsByAccount[accountId] || [])
    : [];

  const readTimestamp = accountId
    ? (readByAccount[accountId] || 0)
    : 0;

  const unreadCount = notifications.filter(
    (n) => new Date(n.timestamp).getTime() > readTimestamp
  ).length;

  const loadForAccount = useCallback(async (acc) => {
    if (!acc) return;
    const id = acc.id;

    const storedNotifs = readStored(NOTIF_KEY(id)) || [];
    const storedRead   = readStored(READ_KEY(id))  || 0;

    setNotifsByAccount((prev) => ({ ...prev, [id]: storedNotifs }));
    setReadByAccount((prev)   => ({ ...prev, [id]: storedRead }));

    if (fetchedRef.current.has(id)) return;
    fetchedRef.current.add(id);

    setLoading(true);
    try {
      const existingIds = new Set(storedNotifs.map((n) => n.id));
      const fresh = [];

      try {
        const histRes = await getHistoryApi();
        const histItems = (Array.isArray(histRes?.data) ? histRes.data : [])
          .filter((h) => h.accountUsername === acc.username);
        fresh.push(...deriveFromHistory(histItems));
      } catch {}

      try {
        const cdscRes = await getCdscSummaryApi(id);
        const cdscItems = cdscRes?.data?.items || [];
        fresh.push(...deriveFromCdsc(cdscItems, existingIds));
      } catch {}

      const merged = mergeNotifs(storedNotifs, fresh);
      setNotifsByAccount((prev) => ({ ...prev, [id]: merged }));
      writeStored(NOTIF_KEY(id), merged);
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
    setNotifsByAccount((prev) => ({ ...prev, [accountId]: [] }));
    writeStored(NOTIF_KEY(accountId), []);
  }, [accountId]);

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