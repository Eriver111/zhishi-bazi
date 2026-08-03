// 知时 Service Worker v12 — 缓存优先+后台更新，兼顾速度与新鲜度
var CACHE_NAME = 'zhishi-v12';

// 只预缓存真正存在的静态资源
var STATIC_ASSETS = [
  '/css/style.css', '/css/landing.css', '/css/auth.css',
  '/css/theme-light.css?v=3', '/css/theme-light-results.css?v=2',
  '/css/interactions.css', '/css/poster.css',
  '/js/bazi.js?v=1781962250', '/js/mo-xing-he.js?v=1781962250',
  '/js/ai-chat-integration.js?v=1781962250',
  '/js/vendor/html2canvas.min.js', '/js/vendor/jspdf.umd.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[sw] 预缓存部分失败（不影响使用）:', err.message);
      });
    })
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

// 策略：HTML始终走网络；JS/CSS缓存优先+后台更新；其他缓存优先
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  var path = url.pathname;

  // HTML 始终走网络（保证最新页面结构）
  if (path.endsWith('.html') || path === '/') {
    e.respondWith(fetch(e.request));
    return;
  }

  // JS/CSS：stale-while-revalidate（缓存秒开+后台静默更新）
  if (path.endsWith('.js') || path.endsWith('.css')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          // 后台发起网络请求更新缓存
          var fetchPromise = fetch(e.request).then(function(response) {
            cache.put(e.request, response.clone());
            return response;
          }).catch(function() { /* 网络失败，忽略 */ });
          // 立即返回缓存（有就秒开），没有则等网络
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 图片/字体等：缓存优先
  e.respondWith(
    caches.match(e.request).then(function(r) { return r || fetch(e.request); })
  );
});
