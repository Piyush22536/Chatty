/* eslint-disable no-undef */
// ---------------------------------------------------------------------------
// Firebase Cloud Messaging Service Worker
//
// Place this file at: frontend/public/firebase-messaging-sw.js
// It MUST be at the root of your domain (served as /firebase-messaging-sw.js)
// so the browser can register it with the correct scope.
//
// This worker runs in the background and handles push messages when the app
// tab is closed or not in focus.
// ---------------------------------------------------------------------------

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ⚠️  Replace with your actual Firebase config values.
//    These cannot use import.meta.env because service workers don't go through Vite.
firebase.initializeApp({
  apiKey: "REPLACE_WITH_VITE_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_VITE_FIREBASE_PROJECT_ID",
  messagingSenderId: "REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Handle background push messages — shows a native OS notification
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message:", payload);

  const { title, body, icon } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title || "New message", {
    body: body || "You have a new message",
    icon: icon || "/avatar.png",
    badge: "/badge.png",
    data: {
      url: data.url || "/",
    },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  });
});

// When the user clicks the notification, open / focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a tab is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
