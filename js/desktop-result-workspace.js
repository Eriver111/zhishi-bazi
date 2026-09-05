(function () {
  'use strict';

  var recentRoot = document.getElementById('desktopRecentCharts');
  var currentLabel = document.getElementById('desktopCurrentChart');
  var aiEntry = document.getElementById('desktopAiEntry');

  function cleanText(value, fallback) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 24) : fallback;
  }

  function chartName(chart, index) {
    var params = new URLSearchParams(chart && chart.params || '');
    if (chart && chart.type === 'hepan') {
      return cleanText((chart.p1Name || '甲方') + ' × ' + (chart.p2Name || '乙方'), '合盘档案');
    }
    return cleanText(params.get('name') || chart.name || String(chart.label || '').split('·')[0], '案例' + (index + 1));
  }

  function chartMeta(chart) {
    if (chart && chart.type === 'hepan') return '合盘 · ' + cleanText(chart.relationType, '关系分析');
    var params = new URLSearchParams(chart && chart.params || '');
    if (params.get('mode') === 'pillars') return '四柱直排';
    if (params.get('year')) return params.get('year') + '.' + params.get('month') + '.' + params.get('day');
    return '个人命盘';
  }

  function currentParams() {
    var params = new URLSearchParams(location.search);
    params.delete('report_year');
    return params.toString();
  }

  function renderRecent(raw) {
    if (!recentRoot) return;
    var charts = [];
    try { charts = JSON.parse(raw || '[]'); } catch (e) {}
    charts = charts.filter(function (chart) { return chart && chart.params; }).slice(0, 5);
    if (!charts.length) {
      recentRoot.innerHTML = '<p class="desktop-workbench__muted">暂无档案，完成排盘后会自动保存</p>';
      return;
    }
    var activeParams = currentParams();
    recentRoot.replaceChildren();
    charts.forEach(function (chart, index) {
      var link = document.createElement('a');
      var isHepan = chart.type === 'hepan';
      link.href = (isHepan ? '/hepan-result?' : '/result?') + chart.params;
      link.className = 'desktop-recent-chart' + (chart.params === activeParams ? ' is-current' : '');
      var name = document.createElement('strong');
      var meta = document.createElement('small');
      name.textContent = chartName(chart, index);
      meta.textContent = chartMeta(chart);
      link.append(name, meta);
      recentRoot.appendChild(link);
    });
  }

  function loadArchives() {
    if (!recentRoot || !window.Auth) return;
    Auth.ready(function () {
      if (!Auth.isLoggedIn()) return;
      Auth.getData('saved_charts').then(renderRecent).catch(function () {
        recentRoot.innerHTML = '<p class="desktop-workbench__muted">档案暂时无法加载</p>';
      });
    });
  }

  function bindAI() {
    if (!aiEntry) return;
    aiEntry.addEventListener('click', function () {
      var fab = document.getElementById('aiFab');
      if (fab) fab.click();
    });
  }

  function setCurrentName() {
    if (!currentLabel) return;
    var name = new URLSearchParams(location.search).get('name');
    currentLabel.textContent = cleanText(name, '当前命盘');
  }

  setCurrentName();
  bindAI();
  loadArchives();
})();
