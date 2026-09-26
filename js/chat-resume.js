/* Last completed conversation on this browser; never used as payment/auth state. */
(function (root) {
  'use strict';
  var KEY = 'zhishi_last_chat_v1', TTL = 30 * 86400000;
  var routes = { bazi: '/ai-chat', hepan: '/ai-chat', ziwei: '/zw-ai-chat', liuren: '/lr-ai-chat' };
  function scope() {
    try {
      if (!root.Auth) return null;
      var user = root.Auth.getUser(), token = root.Auth.getToken();
      if (token && (!user || !user.id)) return null; // Verification still pending: never fall back to a guest.
      return (token && user ? 'user:' + user.id : 'guest') + ':' + (localStorage.getItem('zhishi_ui_epoch') || 'guest');
    } catch (_) { return null; }
  }
  function requestId() { try { return new URLSearchParams(location.search).get('resume') || ''; } catch (_) { return ''; } }
  function read() {
    try {
      var row = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!row || !scope() || row.scope !== scope() || !Object.prototype.hasOwnProperty.call(routes, row.type) ||
          !row.data || !Array.isArray(row.messages) || !row.messages.some(function(m) { return m.role === 'user'; }) ||
          !row.messages.some(function(m) { return m.role === 'ai'; }) ||
          !Number.isFinite(row.time) || Date.now() - row.time > TTL || row.time > Date.now() + 60000 ||
          !/^[a-z0-9-]{8,80}$/.test(row.id) ||
          row.chartKey !== root.ChatPersistence.chartIdentity(row.type, row.data)) return null;
      if (row.messages.some(function(m) { return !m || !['user', 'ai'].includes(m.role) || typeof m.content !== 'string'; })) return null;
      return row;
    } catch (_) { return null; }
  }
  function remember(ctx, messages, mode, conversationId, expectedScope) {
    try {
      var current = scope();
      if (!current || (expectedScope !== undefined && expectedScope !== current) || !ctx || !ctx.data ||
          !Object.prototype.hasOwnProperty.call(routes, ctx.type)) return false;
      var clean = messages.filter(function(m) { return m && ['user','ai','assistant'].includes(m.role) && typeof m.content === 'string'; })
        .slice(-40).map(function(m) { return {role: m.role === 'assistant' ? 'ai' : m.role, content: m.content}; });
      if (!clean.some(function(m) { return m.role === 'user'; }) || !clean.length || clean[clean.length - 1].role !== 'ai') return false;
      var chartKey = root.ChatPersistence.chartIdentity(ctx.type, ctx.data), previous = read();
      var same = previous && previous.chartKey === chartKey && JSON.stringify(previous.data.birthInfo || {}) === JSON.stringify(ctx.data.birthInfo || {});
      var row = { id: same ? previous.id : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        scope: current, type: ctx.type, chartKey: chartKey, data: ctx.data, messages: clean,
        mode: mode === 'pro' ? 'pro' : 'simple', conversationId: conversationId || '', time: Date.now() };
      var raw = JSON.stringify(row);
      if (raw.length > 600000) return false;
      localStorage.setItem(KEY, raw);
      root.dispatchEvent(new Event('zhishi:chat-resume'));
      return true;
    } catch (_) { return false; }
  }
  function resolve() {
    var row = read(), id = requestId();
    return row && row.id === id && location.pathname.replace(/\.html$/, '') === routes[row.type] ? row : null;
  }
  root.ChatResume = { key: KEY, scope: scope, read: read, remember: remember, requestId: requestId, resolve: resolve,
    href: function(row) { return routes[row.type] + '?resume=' + encodeURIComponent(row.id); } };
})(window);
