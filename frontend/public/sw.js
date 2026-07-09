/* SalDesk Service Worker */
const CACHE = 'saldesk-v2';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  /* Navegacao (HTML) — network-first, para nunca ficar preso a uma versao antiga.
     So usa a cache se estiver offline. */
  const isNavigation = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, resClone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* Ficheiros estaticos com hash (JS/CSS/imagens) — cache-first, ja sao
     naturalmente versionados pelo nome do ficheiro. */
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

/* Push Notifications */
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const title = data.title || 'SalDesk';
  const options = {
    body:    data.body || '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag || 'saldesk',
    data:    data.url ? { url: data.url } : {},
    vibrate: [200, 100, 200],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
