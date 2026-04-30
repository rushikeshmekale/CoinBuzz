// CoinBuzz Service Worker — handles push notifications when browser is closed
const CACHE_NAME = "coinbuzz-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Handle push notifications from server
self.addEventListener("push", (e) => {
  let data = {
    title: "CoinBuzz Alert",
    body: "A price alert triggered",
    symbol: "",
    url: "/alerts",
  };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: `alert-${data.symbol}-${Date.now()}`,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/alerts" },
    actions: [
      { action: "view", title: "View Alerts" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;

  const url = e.notification.data?.url || "/alerts";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

// Background sync for checking alerts when app is offline
self.addEventListener("sync", (e) => {
  if (e.tag === "check-alerts") {
    e.waitUntil(Promise.resolve());
  }
});
// 🌐 Optional caching (for offline feel)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => {
      return res || fetch(event.request);
    }),
  );
});
