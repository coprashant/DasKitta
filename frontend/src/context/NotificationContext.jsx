import { createContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  clearNotificationsApi,
  deleteNotificationApi,
  getNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
} from "../api/notifications";

export const NotificationContext = createContext(null);
const FETCH_THROTTLE_MS = 60000;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const requestSeqRef = useRef(0);
  const lastFetchedAtRef = useRef(0);
  const lastFailureRef = useRef(null);
  const inFlightRef = useRef(false);

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

  const isBrowserOffline = useCallback(() => {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }, []);

  const loadNotifications = useCallback(async (force = false) => {
    if (!user) {
      setNotifications([]);
      lastFetchedAtRef.current = 0;
      setLoading(false);
      return;
    }

    if (!force && Date.now() - lastFetchedAtRef.current < FETCH_THROTTLE_MS) {
      return;
    }

    if (isBrowserOffline()) {
      setLoading(false);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    const requestId = ++requestSeqRef.current;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const response = await getNotificationsApi();
      if (requestSeqRef.current !== requestId) return;
      const items = Array.isArray(response?.data) ? response.data : [];
      setNotifications(items.map(normalizeNotification));
      lastFetchedAtRef.current = Date.now();
      lastFailureRef.current = null;
    } catch (error) {
      const isExpectedFailure = !error?.response || (error.response.status >= 500);
      const failureKey = isExpectedFailure ? "network" : "request";

      if (isExpectedFailure && lastFailureRef.current === failureKey) {
        if (requestSeqRef.current === requestId) {
          setLoading(false);
        }
        return;
      }

      lastFailureRef.current = failureKey;

      if (requestSeqRef.current === requestId) {
        setNotifications((current) => current);
      }
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
      inFlightRef.current = false;
    }
  }, [isBrowserOffline, normalizeNotification, user]);

  useEffect(() => {
    if (!user) return;
    void loadNotifications(true);
  }, [user?.username, loadNotifications]);

  useEffect(() => {
    const handleOnline = () => {
      if (document.visibilityState === "visible" && !isBrowserOffline()) {
        void loadNotifications(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isBrowserOffline()) {
        loadNotifications();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isBrowserOffline, loadNotifications]);

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
    loadNotifications(true);
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