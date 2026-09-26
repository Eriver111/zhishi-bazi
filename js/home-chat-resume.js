(function () {
  'use strict';
  var card = document.getElementById('homeChatResume');
  if (!card || !window.ChatResume) return;
  function render() {
    var row = ChatResume.read();
    card.hidden = !row;
    if (!row) { card.removeAttribute('href'); card.querySelector('[data-chat-preview]').textContent = ''; return; }
    var question = row.messages.filter(function(m) { return m.role === 'user'; }).pop();
    card.href = ChatResume.href(row);
    card.querySelector('[data-chat-preview]').textContent = question.content.replace(/\s+/g, ' ').slice(0, 70);
    card.querySelector('[data-chat-kind]').textContent = { bazi: '八字', hepan: '合盘', ziwei: '紫微', liuren: '六壬' }[row.type] + ' · 接着上次聊';
  }
  card.addEventListener('click', function(event) { var href = card.getAttribute('href'); render(); if (card.hidden || card.getAttribute('href') !== href) event.preventDefault(); });
  window.addEventListener('storage', render);
  window.addEventListener('zhishi:identitychange', function() { card.hidden = true; setTimeout(render, 0); });
  window.addEventListener('zhishi:chat-resume', render);
  window.addEventListener('pageshow', render);
  window.addEventListener('focus', render);
  if (window.Auth) { Auth.ready(render); Auth.onLogin(render); }
})();
