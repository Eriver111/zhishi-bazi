(function () {
  'use strict';
  var refreshers = [];
  function byId(id) { return document.getElementById(id); }
  function option(id) {
    var el = byId(id), selected = el && el.selectedOptions && el.selectedOptions[0];
    return el && el.value !== '' && selected ? selected.textContent.trim() : '';
  }
  function row(id) { var el = byId(id); return el && el.closest('.row'); }
  function unique(nodes) { return nodes.filter(function (n, i) { return n && nodes.indexOf(n) === i; }); }
  function makeEditor(root, name, groups, describe) {
    if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;
    var bank = document.createElement('div'); bank.className = 'chart-field-bank'; bank.hidden = true;
    var summary = document.createElement('div'); summary.className = 'chart-summary';
    var dialog = document.createElement('dialog'); dialog.className = 'chart-editor';
    dialog.innerHTML = '<div class="chart-editor-head"><h2></h2><button type="button">完成</button></div><div class="chart-editor-slot"></div>';
    dialog.setAttribute('aria-label', name + '出生信息');
    var slot = dialog.querySelector('.chart-editor-slot'), active = null, opener = null;
    root.appendChild(bank); root.appendChild(dialog);
    var anchor = root.querySelector('.person-step-action,.submit');
    root.insertBefore(summary, anchor || bank);
    Object.keys(groups).forEach(function (key) {
      var group = groups[key], wrapper = document.createElement('div');
      wrapper.dataset.chartField = key;
      unique(group.nodes).forEach(function (node) { wrapper.appendChild(node); });
      bank.appendChild(wrapper); group.element = wrapper;
      var button = document.createElement('button'); button.type = 'button'; button.className = 'chart-summary-row';
      button.dataset.chartOpen = key; button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = '<span>' + group.title + '</span><b></b><i aria-hidden="true">›</i>';
      button.addEventListener('click', function () {
        if (active) bank.appendChild(active);
        active = wrapper; opener = button; slot.appendChild(wrapper);
        var details = wrapper.querySelector('details'); if (details) details.open = true;
        dialog.querySelector('h2').textContent = name + ' · ' + group.title;
        dialog.showModal();
      });
      summary.appendChild(button); group.button = button;
    });
    function refresh() {
      var descriptions = describe();
      Object.keys(groups).forEach(function (key) { groups[key].button.querySelector('b').textContent = descriptions[key]; });
      root.querySelectorAll('select,input[type=number]').forEach(function (field) {
        var label = field.closest('.field') && field.closest('.field').querySelector('label');
        if (label && !label.contains(field)) { label.htmlFor = field.id; field.setAttribute('aria-label', label.textContent.trim()); }
      });
    }
    dialog.querySelector('.chart-editor-head button').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      if (active) bank.appendChild(active); active = null; refresh();
      if (window.ZhishiInputFlow) window.ZhishiInputFlow.refresh();
      if (opener) opener.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    root.addEventListener('change', refresh); root.addEventListener('input', refresh);
    root.addEventListener('click', function () { requestAnimationFrame(refresh); });
    new MutationObserver(function (records) {
      if (records.some(function (r) { return r.target.tagName === 'SELECT' || r.target.tagName === 'OPTION'; })) refresh();
    }).observe(root, { childList: true, subtree: true });
    refreshers.push(refresh); refresh();
  }
  function initHepan() {
    ['p1', 'p2'].forEach(function (pid) {
      var root = byId(pid + 'Form'); if (!root) return;
      var section = byId(pid + 'Section'), identity = document.createElement('div'); identity.className = 'chart-identity-line';
      var nameRow = row('name-' + pid), gender = root.querySelector('.radio-group');
      root.prepend(identity); if (nameRow) identity.appendChild(nameRow);
      if (gender) {
        var genderRow = gender.closest('.row'); identity.appendChild(gender); if (genderRow) genderRow.remove();
        gender.querySelectorAll('span').forEach(function (span) { span.textContent = span.closest('label').querySelector('input').value === 'male' ? '男' : '女'; });
      }
      makeEditor(root, pid === 'p1' ? '甲方' : '乙方', {
        time: { title: '出生时间', nodes: [section.querySelector('.mode-tabs'), byId('solarPanel-' + pid), byId('lunarPanel-' + pid)] },
        location: { title: '出生地点', nodes: [row('province-' + pid), row('city-' + pid), row('district-' + pid)] },
        settings: { title: '排盘设置', nodes: [root.querySelector('.birth-advanced')] }
      }, function () {
        var lunar = (pid === 'p1' ? window.modeP1 : window.modeP2) === 'lunar', pre = lunar ? 'l' : 's';
        var date = [option(pre + 'Year-' + pid), option(pre + 'Month-' + pid), option(pre + 'Day-' + pid)];
        var hour = option(pre + 'Hour-' + pid), minute = byId(pre + 'Minute-' + pid).value;
        return {
          time: date.every(Boolean) && hour ? (lunar ? '农历 ' : '公历 ') + date.join('') + ' · ' + hour + (minute ? minute + '分' : '') : '请选择日期与时间',
          location: [option('province-' + pid), option('city-' + pid), option('district-' + pid)].filter(Boolean).join(' · ') || '请选择出生地',
          settings: (byId('solarEnabled-' + pid).checked ? '真太阳时' : '北京时间') + ' · ' + (byId('zishiHuanri-' + pid).checked ? '23点换日' : '区分早晚子时')
        };
      });
    });
    var wrap = document.querySelector('.hepan-wrap');
    if (wrap) wrap.addEventListener('click', function () { requestAnimationFrame(refreshAll); });
  }
  function initZiwei() {
    var root = byId('zwBirthCard'); if (!root) return;
    var identity = document.createElement('div'); identity.className = 'chart-identity-line';
    identity.innerHTML = '<span class="studio-birth-label">出生信息</span>';
    var gender = root.querySelector('.radio-group'), genderRow = gender.closest('.row');
    identity.appendChild(gender); genderRow.remove(); root.prepend(identity);
    var title = root.querySelector('.card-title'); if (title) title.remove();
    makeEditor(root, '紫微', {
      time: { title: '出生时间', nodes: [root.querySelector('.zw-calendar-tabs'), byId('zwSolarPanel'), byId('zwLunarPanel'), row('zwH')] },
      location: { title: '出生地点', nodes: [row('zwProv'), row('zwCity'), row('zwDist')] },
      settings: { title: '排盘设置', nodes: [root.querySelector('.zw-correction-row')] }
    }, function () {
      var lunar = window.currentZwCalendar === 'lunar';
      return {
        time: (lunar ? '农历 ' : '公历 ') + option(lunar ? 'zwLY' : 'zwY') + '年 ' + option(lunar ? 'zwLM' : 'zwM') + (lunar ? ' ' : '月 ') + option(lunar ? 'zwLD' : 'zwD') + (lunar ? '' : '日') + ' · ' + option('zwH') + ' ' + option('zwMin') + '分',
        location: [option('zwProv'), option('zwCity'), option('zwDist')].filter(Boolean).join(' · ') || '请核对出生地',
        settings: (byId('zwSolarEnabled').checked ? '真太阳时' : '北京时间') + ' · ' + (byId('zwZishiHuanri').checked ? '23点换日' : '区分早晚子时')
      };
    });
    var grid = byId('zwGrid'), tabs = byId('studioZwTabs'), reader = byId('zwPalaceReader');
    function readPalace(cell) {
      grid.querySelectorAll('.palace').forEach(function (other) { other.classList.toggle('reader-selected', other === cell); other.setAttribute('aria-pressed', other === cell ? 'true' : 'false'); });
      var zhi = cell.dataset.zhi, chart = window._currentZi;
      var palace = chart && chart.palaces.find(function (p) { return p.earthlyBranch === zhi; });
      reader.replaceChildren();
      var eyebrow = document.createElement('small'); eyebrow.textContent = '宫位速览 · ' + zhi; reader.appendChild(eyebrow);
      var heading = document.createElement('h3'); heading.textContent = cell.querySelector('.pname').textContent; reader.appendChild(heading);
      if (palace) {
        [['主星', palace.majorStars], ['辅星', palace.minorStars], ['杂曜', palace.adjectiveStars]].forEach(function (item) {
          var p = document.createElement('p'); p.textContent = item[0] + '：' + (item[1] || []).map(function (s) { return s.name + (s.brightness ? '（' + s.brightness + '）' : '') + (s.mutagen ? ' · 化' + s.mutagen : ''); }).join('、');
          if (!item[1] || !item[1].length) p.textContent = item[0] + '：无'; reader.appendChild(p);
        });
      }
      reader.hidden = false;
    }
    new MutationObserver(function () {
      var cells = grid.querySelectorAll('.palace'); if (!cells.length) return;
      byId('studioZwEmpty').hidden = true; tabs.hidden = false;
      cells.forEach(function (cell) {
        if (cell.dataset.readerBound) return;
        cell.dataset.readerBound = 'true'; cell.tabIndex = 0; cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', '查看' + cell.querySelector('.pname').textContent + ' · ' + cell.dataset.zhi); cell.setAttribute('aria-pressed', 'false');
        cell.addEventListener('click', function () { readPalace(cell); });
        cell.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cell.click(); } });
      });
      readPalace(grid.querySelector('.palace.ming') || cells[0]);
    }).observe(grid, { childList: true });
    var buttons = Array.from(tabs.querySelectorAll('button'));
    function select(button) {
      buttons.forEach(function (b) { var active = b === button; b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; });
      document.querySelectorAll('[data-zw-panel]').forEach(function (panel) { panel.hidden = panel.dataset.zwPanel !== button.dataset.zwView; });
    }
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { select(button); });
      button.addEventListener('keydown', function (event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); var next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        select(buttons[next]); buttons[next].focus();
      });
    });
    root.querySelector('.submit').addEventListener('click', function () { select(buttons[0]); });
  }
  function initLiuyao() {
    var question = byId('question'); if (!question) return;
    var progress = byId('studioCastProgress'), result = byId('result');
    function refresh() {
      var count = Number(window.tossCount) || 0;
      progress.setAttribute('aria-label', '已完成 ' + count + ' / 6 爻');
      progress.querySelectorAll('span').forEach(function (el, i) { el.classList.toggle('done', i < count); el.classList.toggle('current', i === count); });
      document.querySelectorAll('.studio-steps li').forEach(function (el, i) { if (i === (count >= 6 ? 2 : count || question.value.trim() ? 1 : 0)) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
      byId('studioRestart').hidden = count < 6;
    }
    question.addEventListener('input', refresh);
    new MutationObserver(refresh).observe(byId('tossLog'), { childList: true });
    byId('studioRestart').addEventListener('click', function () {
      // A new casting is an explicit action. Refresh never triggers an AI request or a purchase.
      location.reload();
    });
    byId('tossBtn').addEventListener('click', function () { if (question.value.trim()) question.readOnly = true; });
    new MutationObserver(function () {
      var toggle = result.querySelector('.detail-toggle');
      if (toggle && !toggle.dataset.studioBound) {
        toggle.dataset.studioBound = 'true'; toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', function () { toggle.setAttribute('aria-expanded', String(toggle.nextElementSibling.classList.contains('open'))); });
      }
    }).observe(result, { childList: true });
    refresh();
  }
  function refreshAll() { refreshers.forEach(function (fn) { fn(); }); }
  function init() { initHepan(); initZiwei(); initLiuyao(); }
  window.ChartExperience = { refresh: refreshAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
