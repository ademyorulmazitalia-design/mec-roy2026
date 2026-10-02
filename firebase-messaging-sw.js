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

// ============================================
// NOTIFICHE IN BACKGROUND (app chiusa o in secondo piano)
// ============================================
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica in background:', payload);

  // ⚠️ IMPORTANTE: leggiamo da payload.data, NON da payload.notification
  // perché la Cloud Function manda solo "data" per evitare il doppio.
  // Se per sicurezza arriva anche "notification", lo usiamo come fallback.
  const titolo = payload.data?.title
              || payload.notification?.title
              || 'MEC-ROY';
  const corpo = payload.data?.body
             || payload.notification?.body
             || 'Ricordati di registrare le ore!';
  const icona = payload.data?.icon
             || payload.notification?.icon
             || 'images/logo-192.png';
  const url = payload.data?.url
           || payload.notification?.click_action
           || '/';

  const opzioni = {
    body: corpo,
    icon: icona,
    badge: 'images/logo-192.png',
    vibrate: [200, 100, 200],
    tag: 'mecroy-ore',
    renotify: true,          // 🔔 fa suonare di nuovo anche con stesso "tag"
    requireInteraction: true, // 📌 resta finché non la tocchi
    silent: false,           // 🔊 forza il suono
    data: { url: url }
  };

  self.registration.showNotification(titolo, opzioni);
});

// ============================================
// CLICK SULLA NOTIFICA
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata');
  event.notification.close();

  const urlDaAprire = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se c'è già una finestra aperta dell'app, la focusa
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti ne apre una nuova
      if (clients.openWindow) {
        return clients.openWindow(urlDaAprire);
      }
    })
  );
});
