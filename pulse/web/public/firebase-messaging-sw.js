/* Firebase Cloud Messaging service worker.
 * Handles background push notifications. Activates only when Firebase is
 * configured and `firebase` is installed; harmless otherwise.
 */
/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { notification: { title: "Pulse", body: event.data && event.data.text() } };
  }
  const n = (data && data.notification) || {};
  const title = n.title || "Pulse";
  const options = {
    body: n.body || "You have a new update.",
    icon: "/icon.png",
    badge: "/icon.png",
    data: (data && data.data) || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
