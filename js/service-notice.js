(function () {
  'use strict';
  function addNote(button, report) {
    if (button.dataset.serviceNoted) return;
    button.dataset.serviceNoted = 'true';
    var note = document.createElement('div');
    note.className = 'service-purchase-note';
    note.innerHTML = '<strong>购买前请了解</strong><p>内容仅供传统文化学习与娱乐交流，AI 解读可能有误，不保证现实结果。</p><p>' +
      (report ? '本次仅解锁对应报告，不包含 AI 提问次数。' : 'AI 次数或会员与单独收费的报告相互独立。') +
      '</p><a href="/disclaimer#purchase" target="_blank" rel="noopener">免责声明与购买须知</a>';
    button.insertAdjacentElement('beforebegin', note);
  }
  function refresh() {
    document.querySelectorAll('#rptPaywall button[onclick*="startRP"],#hepanPaywall button[onclick*="hstartPay"],#hpPaywall button[onclick*="startHPay"]')
      .forEach(function (button) { addNote(button, true); });
    document.querySelectorAll('.pricing-card .pricing-btn,.chat-buy-bar button[onclick*="Buy"]')
      .forEach(function (button) { addNote(button, false); });
    var bar = document.querySelector('.bottombar'), footer = document.querySelector('.service-footer');
    if (bar && footer && footer.parentNode !== bar) bar.appendChild(footer);
  }
  function init() {
    refresh();
    var pending = false;
    new MutationObserver(function (records) {
      if (pending || !records.some(function (r) { return r.addedNodes.length; })) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; refresh(); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
