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

  // ⛔ Se il payload ha "notification", il sistema la mostra già da solo
  // → il Service Worker non deve rimostrarla (evita il doppio)
  if (payload.notification) {
    console.log('ℹ️ Notification presente, il sistema la mostra da solo');
    return;
  }

  // ✅ Altrimenti (solo data), la mostriamo noi
  const titolo = payload.data?.title || 'MEC-ROY';
  const corpo = payload.data?.body || 'Ricordati di registrare le ore!';
  const icona = payload.data?.icon || 'images/logo-192.png';
  const url = payload.data?.url || '/';

  const opzioni = {
    body: corpo,
    icon: icona,
    badge: 'images/logo-192.png',
    vibrate: [200, 100, 200],
    tag: 'mecroy-ore',
    renotify: true,
    requireInteraction: true,
    silent: false,
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
