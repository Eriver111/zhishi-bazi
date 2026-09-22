(function () {
  'use strict';
  var key = 'zhishi_ui_state', epochKey = 'zhishi_ui_epoch';
  var ttl = 8 * 60 * 60 * 1000, listeners = [], epoch = readEpoch();
  function readEpoch() { try { return localStorage.getItem(epochKey) || 'guest'; } catch (_) { return 'session'; } }
  function sync() {
    var next = readEpoch();
    if (next === epoch) return false;
    epoch = next;
    try { sessionStorage.removeItem(key); } catch (_) {}
    listeners.forEach(function (fn) { try { fn(); } catch (_) {} });
    return true;
  }
  function entries() {
    sync();
    try {
      var data = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (data.epoch !== epoch || !Array.isArray(data.entries)) { sessionStorage.removeItem(key); return []; }
      var active = data.entries.filter(function (e) { return e && Date.now() - e.time < ttl; });
      if (active.length !== data.entries.length) write(active);
      return active;
    } catch (_) { return []; }
  }
  function write(items) {
    try {
      while (items.length > 20 || JSON.stringify(items).length > 400000) items.shift();
      sessionStorage.setItem(key, JSON.stringify({ epoch: epoch, entries: items }));
    } catch (_) { /* A full or disabled session store must not block navigation. */ }
  }
  window.ZhishiPageState = {
    get: function (name) { var entry = entries().find(function (e) { return e.name === name; }); return entry ? entry.value : null; },
    set: function (name, value) {
      // Never save an old page snapshot into a newly signed-in account.
      if (sync()) return;
      var items = entries().filter(function (e) { return e.name !== name; });
      if (JSON.stringify(value).length > 300000) return;
      items.push({ name: name, time: Date.now(), value: value }); write(items);
    },
    remove: function (name) { write(entries().filter(function (e) { return e.name !== name; })); },
    onReset: function (fn) { listeners.push(fn); },
    sync: sync,
    epoch: function () { sync(); return epoch; },
    pageKey: function (kind) {
      var params = new URLSearchParams(location.search); params.sort();
      return kind + ':' + location.pathname.replace(/\.html$/, '') + '?' + params.toString();
    }
  };
  window.addEventListener('zhishi:identitychange', sync);
  window.addEventListener('storage', function (e) { if (!e.key || e.key === epochKey) sync(); });
  window.addEventListener('pageshow', sync);
})();
