// ============================================
// SERVICE WORKER - MEC-ROY Gestione Ore
// ============================================

const CACHE_NAME = 'mecroy-cache-v1';

// File da mettere in cache (funzionamento offline)
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
// FETCH (intercetta richieste)
// ============================================
self.addEventListener('fetch', (event) => {
  // Non gestire richieste a Firebase
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se è in cache, restituisci dalla cache
      if (response) {
        return response;
      }
      
      // Altrimenti scarica dalla rete
      return fetch(event.request).then((response) => {
        // Se la risposta non è valida, restituiscila così com'è
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Altrimenti salva in cache per la prossima volta
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      });
    })
  );
});
