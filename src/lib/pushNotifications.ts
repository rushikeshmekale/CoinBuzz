// Push notification helpers — registration, subscription, permission

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (e) {
    console.warn("SW registration failed:", e);
    return null;
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  const perm = await Notification.requestPermission();
  return perm;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!PUBLIC_VAPID_KEY) {
    // No VAPID key — use local-only notifications (no server push)
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });
    return subscription;
  } catch (e) {
    console.warn("Push subscription failed:", e);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
}

/** Show a local notification immediately (works when browser is open) */
export async function showLocalNotification(title: string, body: string, url = "/alerts") {
  const perm = await requestPushPermission();
  if (perm !== "granted") return;

  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url },
    tag: `alert-${Date.now()}`,
  } as NotificationOptions);
}
