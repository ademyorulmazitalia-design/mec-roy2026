// ============================================
// SERVICE WORKER - MEC-ROY Gestione Ore
// ============================================

const CACHE_NAME = 'mecroy-cache-v1';

// File da mettere in cache (per funzionamento offline)
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './images/logo.png',
  './images/logo-192.png',
  './images/logo-512.png'
];

// ============================================
// INSTALLAZIONE
// ============================================
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: installazione...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: cache aperta');
      return cache.addAll(FILES_TO_CACHE);
    }).then(() => {
      console.log('✅ Service Worker: installato');
      return self.skipWaiting();
    })
  );
});

// ============================================
// ATTIVAZIONE
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: attivazione...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: rimuovo cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: attivato');
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH - STRATEGIA "NETWORK FIRST"
// ============================================
self.addEventListener('fetch', (event) => {
  // Non gestire richieste a Firebase
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic') ||
      event.request.url.includes('cdnjs')) {
    return;
  }
  
  // Per HTML, JS, CSS → SEMPRE dalla rete (aggiornamento automatico)
  const url = event.request.url;
  const isHTML = url.endsWith('.html') || url.endsWith('/') || url.includes('index.html');
  const isJS = url.endsWith('.js');
  const isCSS = url.endsWith('.css');
  
  if (isHTML || isJS || isCSS) {
    // NETWORK FIRST: prova la rete, se fallisce usa la cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Salva in cache per uso offline
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Se la rete fallisce (offline), usa la cache
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Per immagini e altri file → prima la cache, poi la rete
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
