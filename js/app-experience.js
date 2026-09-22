(function () {
  'use strict';
  var mobile = window.matchMedia('(max-width: 700px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;
  // Legacy decorative introductions must not delay the mobile input screen.
  if (mobile.matches && document.getElementById('pageLoader')) {
    document.body.classList.remove('loading');
    document.body.classList.add('loaded');
  }
  var pendingLink, resetTimer, intentTimer;
  var warmed = Object.create(null);
  var publicPages = ['/', '/paipan', '/hepan', '/ziwei', '/liuyao', '/meihua', '/face', '/palm', '/fengshui', '/fortune'];
  function route(path) { return path.replace(/\.html$/, '').replace(/^\/index$/, '/') || '/'; }
  function localLink(target) {
    var link = target && target.closest && target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') ||
        link.hasAttribute('data-no-app-navigation')) return null;
    var url;
    try { url = new URL(link.href, location.href); } catch (_) { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    return { link: link, url: url };
  }
  function resetNavigation() {
    clearTimeout(resetTimer);
    root.classList.remove('app-is-navigating');
    if (pendingLink) {
      pendingLink.classList.remove('is-pending');
      pendingLink.removeAttribute('aria-busy');
    }
    pendingLink = null;
  }
  document.addEventListener('click', function (event) {
    if (!mobile.matches || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var destination = localLink(event.target);
    if (!destination) return;
    var samePage = route(destination.url.pathname) === route(location.pathname) && destination.url.search === location.search;
    if (samePage) {
      if (!destination.url.hash && destination.link.closest('.mobile-app-nav')) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
      return;
    }
    // Keep native navigation, form state and browser back/forward restoration.
    // No delayed location assignment or blocking overlay.
    resetNavigation();
    pendingLink = destination.link;
    pendingLink.classList.add('is-pending');
    pendingLink.setAttribute('aria-busy', 'true');
    root.classList.add('app-is-navigating');
    resetTimer = setTimeout(resetNavigation, 5000);
  });
  window.addEventListener('pageshow', resetNavigation);
  window.addEventListener('pagehide', resetNavigation);

  function warm(target) {
    if (!mobile.matches || !navigator.onLine) return;
    var connection = navigator.connection;
    if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) return;
    var destination = localLink(target);
    if (!destination || destination.url.search || destination.url.hash ||
        publicPages.indexOf(route(destination.url.pathname)) < 0 ||
        route(destination.url.pathname) === route(location.pathname)) return;
    var href = destination.url.href;
    if (warmed[href] && Date.now() - warmed[href] < 30000) return;
    var worker = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!worker) return;
    warmed[href] = Date.now();
    worker.postMessage({ type: 'WARM_PUBLIC_PAGE', url: href });
  }
  document.addEventListener('pointerover', function (event) {
    if (event.pointerType === 'touch') return;
    clearTimeout(intentTimer);
    intentTimer = setTimeout(function () { warm(event.target); }, 100);
  }, { passive: true });
  document.addEventListener('pointerout', function () { clearTimeout(intentTimer); }, { passive: true });
  document.addEventListener('pointerdown', function (event) { if (event.isPrimary && event.button === 0) warm(event.target); }, { passive: true });
  document.addEventListener('focusin', function (event) { warm(event.target); });

  // Hide the bottom bar only while an editable field and a real on-screen
  // keyboard are present; zoom and collapsing browser chrome are not keyboards.
  var viewport = window.visualViewport;
  var fullHeight = Math.max(window.innerHeight, viewport ? viewport.height : 0);
  var viewportFrame;
  function updateKeyboard() {
    viewportFrame = null;
    var focused = document.activeElement;
    var editable = focused && focused.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), [contenteditable="true"]');
    var height = viewport ? viewport.height : window.innerHeight;
    if (!editable) fullHeight = Math.max(window.innerHeight, height);
    var keyboard = mobile.matches && editable && (!viewport || viewport.scale === 1) && fullHeight - height > 150;
    root.classList.toggle('app-keyboard-open', !!keyboard);
  }
  function queueKeyboard() {
    if (!viewportFrame) viewportFrame = requestAnimationFrame(updateKeyboard);
  }
  if (viewport) viewport.addEventListener('resize', queueKeyboard, { passive: true });
  window.addEventListener('resize', queueKeyboard, { passive: true });
  document.addEventListener('focusin', queueKeyboard);
  document.addEventListener('focusout', queueKeyboard);
  window.addEventListener('pageshow', queueKeyboard);
  window.addEventListener('orientationchange', function () {
    fullHeight = window.innerHeight;
    queueKeyboard();
  });
})();
