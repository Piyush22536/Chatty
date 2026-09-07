import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// ---------------------------------------------------------------------------
// Firebase client SDK configuration
// Values come from: Firebase Console → Project Settings → General → Your apps
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// messaging() is only available in browser contexts
let messaging = null;
if (typeof window !== "undefined" && "Notification" in window) {
  messaging = getMessaging(app);
}

// ---------------------------------------------------------------------------
// Request notification permission + get FCM token
// Returns the token string, or null if permission denied / not supported.
// ---------------------------------------------------------------------------
export async function requestNotificationPermission() {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Notification permission denied");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      ),
    });

    console.log("[FCM] Token obtained:", token);
    return token;
  } catch (err) {
    console.error("[FCM] Error getting token:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Listen for foreground messages (tab is open + in focus)
// Calls the provided callback with the message payload.
// ---------------------------------------------------------------------------
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

export { messaging };
