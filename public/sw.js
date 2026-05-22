self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "CheapStays", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "CheapStays", {
      body: data.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: { url: data.url || "/notifications" },
      tag: "cheapstays-notification",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes(self.location.origin) && "focus" in win) {
          win.focus();
          win.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
