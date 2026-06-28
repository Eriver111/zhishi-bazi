// 知时 Service Worker — 离线缓存 + PWA
const CACHE_NAME = 'zhishi-v2';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        '/', '/css/style.css', '/css/landing.css', '/css/auth.css',
        '/js/auth.js', '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(r) { return r || fetch(e.request); })
  );
});
