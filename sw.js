// 知时 Service Worker — 离线缓存 + PWA
// 策略：只缓存静态资源，HTML 走网络保证用户始终拿到最新版
const CACHE_NAME = 'zhishi-v3';

// 只缓存静态资源，不缓存 HTML 页面
const STATIC_ASSETS = [
  '/css/style.css', '/css/landing.css', '/css/auth.css', '/css/result.css',
  '/js/auth.js', '/js/result.js', '/js/bazi.js', '/js/main.js',
  '/js/hepan-core.js', '/js/hepan-paywall.js', '/js/ai-chat-integration.js',
  '/js/characters.js', '/js/pro-analysis.js', '/js/payment.js', '/js/paywall.js',
  '/js/mo-xing-he.js', '/js/bg-animation.js', '/js/effects.js', '/js/lunar.js',
  '/js/region.js', '/js/nav.js',
  '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(STATIC_ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// HTML 始终从网络获取，静态资源用缓存回退
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }));
  }
});
