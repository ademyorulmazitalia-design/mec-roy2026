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

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica in background ricevuta:', payload);

  if (payload.notification) {
    return; // Se c'è già la notifica, il sistema la mostra da solo
  }

  const titolo = payload.data?.title || 'MEC-ROY';
  const corpo = payload.data?.body || 'Ricordati di registrare le ore!';
  const icona = payload.data?.icon || 'images/logo-192.png';
  const url = payload.data?.url || '/';

  const opzioni = {
    body: corpo,
    icon: icona,
    badge: 'images/logo-192.png',
    vibrate: [200, 100, 200],
    data: { url: url }
  };

  self.registration.showNotification(titolo, opzioni);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlDaAprire = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlDaAprire);
    })
  );
});