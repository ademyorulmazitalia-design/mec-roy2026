// ============================================
// FIREBASE MESSAGING SERVICE WORKER
// ============================================
// Gestisce le notifiche push di Firebase Cloud Messaging
// Questo file DEVE chiamarsi "firebase-messaging-sw.js" e
// stare nella cartella principale del sito
// ============================================

importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCjVygYWWtq3FoARPQN_PufBXoUtZy1Z8g",
  authDomain: "mec-roy-2026.firebaseapp.com",
  projectId: "mec-roy-2026",
  storageBucket: "mec-roy-2026.firebasestorage.app",
  messagingSenderId: "236947448329",
  appId: "1:236947448329:web:57776a8a00011adb9fced8"
});

const messaging = firebase.messaging();

// Notifiche in background (app chiusa o in secondo piano)
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica in background:', payload);

  const titolo = payload.notification?.title || 'MEC-ROY';
  const corpo = payload.notification?.body || 'Ricordati di registrare le ore!';
  const icona = payload.notification?.icon || 'images/logo-192.png';

  self.registration.showNotification(titolo, {
    body: corpo,
    icon: icona,
    badge: 'images/logo-192.png',
    vibrate: [200, 100, 200],
    tag: 'mecroy-ore',
    requireInteraction: true,
    data: {
      url: payload.data?.url || '/'
    }
  });
});

// Click sulla notifica
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata');
  event.notification.close();

  const urlDaAprire = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlDaAprire);
      }
    })
  );
});
