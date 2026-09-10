import client from "./client";

const isPushSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const bufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer || []);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const normalizeSubscription = (subscription) => {
  if (!subscription) return null;
  if (typeof subscription.toJSON === "function") {
    return subscription.toJSON();
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: bufferToBase64Url(subscription.getKey("p256dh")),
      auth: bufferToBase64Url(subscription.getKey("auth")),
    },
  };
};

export const getNotificationsApi = () => client.get("/notifications");

export const markNotificationReadApi = (id) => client.patch(`/notifications/${id}/read`);

export const markAllNotificationsReadApi = () => client.patch("/notifications/read-all");

export const deleteNotificationApi = (id) => client.delete(`/notifications/${id}`);

export const clearNotificationsApi = () => client.delete("/notifications");

export const subscribeToPushApi = (payload) => client.post("/notifications/subscribe", payload);

export const registerPushSubscription = async () => {
  if (!isPushSupported()) {
    return false;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") {
    return false;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await subscribeToPushApi(normalizeSubscription(subscription));
  return true;
};