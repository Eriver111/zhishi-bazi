// 知时 Service Worker v23 — 代码资源网络优先，避免更新后首屏仍展示旧功能。
var CACHE_NAME = 'zhishi-v28';

// 只预缓存真正存在的静态资源
var STATIC_ASSETS = [
  '/css/style.css', '/css/landing.css', '/css/auth.css',
  '/css/theme-light.css?v=3', '/css/theme-light-results.css?v=3',
  '/css/interactions.css', '/css/poster.css',
  '/js/bazi.js?v=20260831d', '/js/mo-xing-he.js?v=1781962250',
  '/js/ai-chat-integration.js?v=20260830a', '/js/chart-calibration.js?v=9', '/js/result.js?v=20',
  '/js/payment.js', '/js/payment.js?v=2', '/js/paywall.js?v=10',
  '/js/hepan-paywall.js?v=2',
  '/js/vendor/html2canvas.min.js?v=2', '/js/vendor/jspdf.umd.min.js?v=2',
  '/js/report-pdf.js?v=3'
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

// 策略：HTML和代码资源优先取最新版本；断网时再回退缓存。
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  var path = url.pathname;

  // HTML 始终走网络（保证最新页面结构）
  if (path.endsWith('.html') || path === '/') {
    e.respondWith(fetch(e.request));
    return;
  }

  // JS/CSS：network-first，避免部署后的第一次访问仍命中旧交互。
  if (path.endsWith('.js') || path.endsWith('.css')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(e.request).then(function(response) {
            if (response && response.ok) cache.put(e.request, response.clone());
            return response;
          }).catch(function() {
            return cache.match(e.request);
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
