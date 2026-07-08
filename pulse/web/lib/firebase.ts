/**
 * Firebase Cloud Messaging — guarded. Push is only wired up when the
 * NEXT_PUBLIC_FIREBASE_* env vars are present; otherwise Pulse falls back to
 * the browser Notification API so "enable notifications" still works in a demo.
 *
 * We avoid a hard dependency on `firebase` so the app builds with zero setup.
 * When you're ready, `npm i firebase` and fill in the env vars.
 */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function fcmConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

/**
 * Request notification permission. Registers the FCM service worker when
 * configured; otherwise just uses the native permission prompt.
 */
export async function requestPushPermission(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  if (fcmConfigured() && "serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      // When `firebase` is installed, retrieve the FCM token here and POST it to
      // the backend so the server can push deadline alerts:
      //   const token = await getToken(messaging, { vapidKey });
      //   await fetch(`${API}/notifications/register`, { method: "POST", body: token })
    } catch {
      /* ignore — fall back to local notifications */
    }
  }
  return "granted";
}

/** Show a local notification (used for demo nudges). */
export function showLocalNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.png" });
  }
}
