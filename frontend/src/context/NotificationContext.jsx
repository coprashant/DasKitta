import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useAccount } from "./AccountContext";
import {
  clearNotificationsApi,
  deleteNotificationApi,
  getNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from "../api/notifications";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeAccount } = useAccount();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const requestSeqRef = useRef(0);

  const readIds = useMemo(
      () => new Set(notifications.filter((n) => n.isRead).map((n) => n.id)),
      [notifications]
  );

  const unreadCount = useMemo(
      () => notifications.filter((n) => !readIds.has(n.id)).length,
      [notifications, readIds]
  );

  const normalizeNotification = useCallback((notification) => ({
    ...notification,
    timestamp: notification.createdAt ?? notification.timestamp ?? null,
  }), []);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestSeqRef.current;
    setLoading(true);

    try {
      const response = await getNotificationsApi();
      if (requestSeqRef.current !== requestId) return;
      const items = Array.isArray(response?.data) ? response.data : [];
      setNotifications(items.map(normalizeNotification));
    } catch {
      if (requestSeqRef.current === requestId) {
        setNotifications((current) => current);
      }
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [normalizeNotification, user]);

  useEffect(() => {
    loadNotifications();
  }, [user?.username, activeAccount?.id, loadNotifications]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notifId) => {
    let snapshot = [];
    setNotifications((current) => {
      snapshot = current;
      return current.map((notification) => (
          notification.id === notifId ? { ...notification, isRead: true } : notification
      ));
    });

    try {
      await markNotificationReadApi(notifId);
    } catch {
      setNotifications(snapshot);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    let snapshot = [];
    setNotifications((current) => {
      snapshot = current;
      return current.map((notification) => ({ ...notification, isRead: true }));
    });

    try {
      await markAllNotificationsReadApi();
    } catch {
      setNotifications(snapshot);
    }
  }, []);

  const removeNotif = useCallback(async (notifId) => {
    let snapshot = [];
    setNotifications((current) => {
      snapshot = current;
      return current.filter((notification) => notification.id !== notifId);
    });

    try {
      await deleteNotificationApi(notifId);
    } catch {
      setNotifications(snapshot);
    }
  }, []);

  const clearAll = useCallback(async () => {
    let snapshot = [];
    setNotifications((current) => {
      snapshot = current;
      return [];
    });

    try {
      await clearNotificationsApi();
    } catch {
      setNotifications(snapshot);
    }
  }, []);

  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    readIds,
    loading,
    markAsRead,
    markAllRead,
    removeNotif,
    clearAll,
    refresh,
  }), [notifications, unreadCount, readIds, loading, markAsRead, markAllRead, removeNotif, clearAll, refresh]);

  return (
      <NotificationContext.Provider value={contextValue}>
        {children}
      </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);