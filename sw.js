// 知时 Service Worker v62 — lightweight mobile shell and intent-based navigation.
var CACHE_NAME = 'zhishi-v62';

// 只预缓存真正存在的静态资源
var STATIC_ASSETS = [
  '/css/style.css', '/css/landing.css', '/css/auth.css',
  '/css/theme-light.css?v=5', '/css/theme-light-forms.css?v=5', '/css/theme-light-results.css?v=5',
  '/css/mobile-app-shell.css?v=32', '/js/mobile-app-shell.js?v=11',
  '/css/app-experience.css?v=1', '/js/app-experience.js?v=1'
];
var SHELL_ASSETS = STATIC_ASSETS.slice(-4);
var PUBLIC_PAGES = ['/', '/paipan', '/hepan', '/ziwei', '/liuyao', '/meihua', '/face', '/palm', '/fengshui', '/fortune'];
var warmPages = new Map();
var warming = new Map();
var WARM_TTL = 30000;
function publicPage(value) {
  var url;
  try { url = new URL(value, self.location.origin); } catch (_) { return null; }
  if (url.origin !== self.location.origin || url.search || url.hash) return null;
  var path = url.pathname.replace(/\.html$/, '').replace(/^\/index$/, '/') || '/';
  return PUBLIC_PAGES.indexOf(path) >= 0 ? url : null;
}
function pruneWarmPages() {
  warmPages.forEach(function(entry, key) { if (Date.now() - entry.time >= WARM_TTL) warmPages.delete(key); });
}

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
      return Promise.all(keys.filter(function(k) { return k.indexOf('zhishi-') === 0 && k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (!e.data || e.data.type !== 'WARM_PUBLIC_PAGE' || !e.source || !e.source.url) return;
  if (new URL(e.source.url).origin !== self.location.origin) return;
  var url = publicPage(e.data.url);
  if (!url) return;
  pruneWarmPages();
  if (warmPages.has(url.href) || warming.has(url.href) || warming.size >= 2) return;
  var task = fetch(url.href, { credentials: 'omit', cache: 'no-store' }).then(function(response) {
    if (!response.ok || response.redirected || !/text\/html/i.test(response.headers.get('content-type') || '')) return;
    // Keep only a short-lived, one-use public document in worker memory.
    // Query strings, account pages, API responses and reports never enter here.
    if (warmPages.size >= 3) warmPages.delete(warmPages.keys().next().value);
    warmPages.set(url.href, { response: response, time: Date.now() });
  }).catch(function() {}).finally(function() { warming.delete(url.href); });
  warming.set(url.href, task);
  e.waitUntil(task);
});

// 策略：HTML和代码资源优先取最新版本；断网时再回退缓存。
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  var path = url.pathname;

  if (e.request.method !== 'GET' || url.origin !== self.location.origin || path.indexOf('/api/') === 0) return;

  // Navigation may consume a recently warmed public page once. Never cache
  // birth parameters, payment returns, personal data or authenticated HTML.
  if (e.request.mode === 'navigate' || path.endsWith('.html') || path === '/') {
    pruneWarmPages();
    var eligible = e.request.mode === 'navigate' && publicPage(url.href);
    if (eligible && (warmPages.has(url.href) || warming.has(url.href))) {
      // A quick tap can navigate before the pointer-down prefetch finishes.
      // Reuse that request instead of competing with it for bandwidth.
      e.respondWith(Promise.resolve(warming.get(url.href)).then(function() {
        pruneWarmPages();
        var warm = warmPages.get(url.href);
        warmPages.delete(url.href);
        return warm ? warm.response : fetch(e.request);
      }));
      return;
    }
    e.respondWith(fetch(e.request));
    return;
  }

  // Only explicitly versioned shell bundles use cache-first. Algorithm and
  // payment scripts retain network-first so current fixes are not hidden.
  if (SHELL_ASSETS.indexOf(path + url.search) >= 0) {
    e.respondWith(caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(e.request).then(function(hit) {
        return hit || fetch(e.request).then(function(response) {
          if (response.ok) e.waitUntil(cache.put(e.request, response.clone()));
          return response;
        });
      });
    }));
    return;
  }

  // JS/CSS：network-first，避免部署后的第一次访问仍命中旧交互。
  if (path.endsWith('.js') || path.endsWith('.css')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(e.request).then(function(response) {
            if (response && response.ok) e.waitUntil(cache.put(e.request, response.clone()));
            return response;
          }).catch(function() {
            return cache.match(e.request).then(function(hit) { return hit || Response.error(); });
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
