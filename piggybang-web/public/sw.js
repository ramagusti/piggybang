// PiggyBang! service worker: push notifications only (no offline cache).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data.json();
  } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title || "PiggyBang!", {
      body: d.body,
      tag: d.tag, // same tag replaces the previous notification instead of stacking
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: d.url || "/app/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data.url;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((t) => "focus" in t);
      return open ? open.navigate(url).then((t) => (t || open).focus()) : self.clients.openWindow(url);
    }),
  );
});
