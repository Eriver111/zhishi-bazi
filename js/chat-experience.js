(function () {
  'use strict';
  var input, messages, store, key, latest, status, chartContext, pending = '', controller, timer, ready = false;
  function context() {
    if (typeof currentChatContext === 'function') return currentChatContext();
    if (typeof currentZiweiChart === 'function') return { type: 'ziwei', data: currentZiweiChart() };
    return { type: 'liuren', data: typeof currentLiurenChart === 'function' ? currentLiurenChart() : null };
  }
  function nearBottom() { return !messages || messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80; }
  function resizeInput() {
    if (!input) return;
    input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px';
  }
  function save() {
    if (!ready || !key || store.sync()) return;
    store.set(key, { draft: input.value, mode: AI.mode, top: messages.scrollTop,
      messages: AI.messages.slice(-40), pending: pending });
  }
  function init() {
    if (ready) return;
    store = window.ZhishiPageState;
    input = document.getElementById('input'); messages = document.getElementById('messages');
    if (!store || !input || !messages || typeof AI === 'undefined') return;
    ready = true;
    var ctx = chartContext = context();
    // Include the birth descriptor as well as the existing conversation key.
    key = ctx.data ? 'chat:' + ChatPersistence.chartIdentity(ctx.type, ctx.data) + ':' + JSON.stringify({
      birth: ctx.data.birthInfo || {},
      person1: ctx.data.person1 && ctx.data.person1.birthInfo || {},
      person2: ctx.data.person2 && ctx.data.person2.birthInfo || {}
    }) : null;
    status = document.createElement('div'); status.className = 'chat-connection-status'; status.setAttribute('role', 'status'); status.hidden = true;
    input.closest('.bottombar').prepend(status);
    latest = document.createElement('button'); latest.type = 'button'; latest.className = 'chat-latest'; latest.textContent = '有新回复 · 回到底部'; latest.hidden = true;
    latest.onclick = function () { messages.scrollTop = messages.scrollHeight; latest.hidden = true; };
    input.closest('.bottombar').prepend(latest);
    var saved = key && store.get(key);
    if (saved) {
      AI.resumePending = !!saved.pending;
      input.value = saved.draft || saved.pending || '';
      if (saved.mode && saved.mode !== AI.mode && ['simple','pro'].indexOf(saved.mode) >= 0) toggleMode();
      if (!AI.messages.length && Array.isArray(saved.messages)) saved.messages.forEach(function (m) {
        if (m && (m.role === 'user' || m.role === 'ai') && typeof m.content === 'string') addMsg(m.role, m.content);
      });
      if (saved.pending) { status.textContent = '上次提问尚未确认完成，请先查看历史记录，再决定是否重试。'; status.hidden = false; }
      requestAnimationFrame(function () { messages.scrollTop = Math.max(0, Number(saved.top) || 0); });
    }
    resizeInput();
    input.addEventListener('input', function () { resizeInput(); clearTimeout(timer); timer = setTimeout(save, 200); });
    messages.addEventListener('scroll', function () { if (nearBottom()) latest.hidden = true; }, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    store.onReset(function () {
      clearTimeout(timer); if (controller) controller.abort();
      pending = ''; input.value = ''; AI.messages = []; AI.isWaiting = false; AI.conversationId = ''; AI.historyLoaded = false;
      hideThinking(); document.getElementById('sendBtn').disabled = false;
      messages.querySelectorAll('.msg').forEach(function (node) { node.remove(); });
      var empty = document.getElementById('emptyState'); if (empty) empty.style.display = '';
      status.hidden = true; latest.hidden = true; resizeInput();
      // A stale chart held by this page must not be carried into a new account.
      key = null;
    });
  }
  function connection() {
    if (!ready) return;
    status.hidden = navigator.onLine;
    if (!navigator.onLine) status.textContent = '网络已断开，输入内容会暂存于本次标签页。';
  }
  window.ChatExperience = {
    hasContext: function () { return !!chartContext; },
    context: function () { init(); return chartContext; },
    beforeAppend: function (role) { init(); return role === 'user' || nearBottom(); },
    afterAppend: function (follow) {
      if (!messages) return;
      if (follow) { messages.scrollTop = messages.scrollHeight; if (latest) latest.hidden = true; }
      else if (latest) latest.hidden = false;
    },
    start: function (text) { init(); pending = text; if (status) status.hidden = true; resizeInput(); save(); },
    finish: function (failed) {
      if (failed && input && !input.value) input.value = pending;
      pending = ''; resizeInput(); save();
    },
    request: function (url, options) {
      init(); var generation = store.epoch(); controller = new AbortController();
      var activeController = controller;
      var timeout = setTimeout(function () { activeController.abort(); }, 300000);
      return fetch(url, Object.assign({}, options, { signal: activeController.signal })).then(function (response) {
        return response.json();
      }).then(function (data) {
        if (store.epoch() !== generation) { var error = new Error('Account changed'); error.name = 'IdentityChangedError'; throw error; }
        return data;
      }).catch(function (error) {
        if (store.epoch() !== generation) {
          // DOMException.name is read-only for an aborted fetch.
          var changed = new Error('Account changed'); changed.name = 'IdentityChangedError'; throw changed;
        }
        throw error;
      }).finally(function () { clearTimeout(timeout); if (controller === activeController) controller = null; });
    },
    escape: function (text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  };
  document.addEventListener('DOMContentLoaded', init);
})();
