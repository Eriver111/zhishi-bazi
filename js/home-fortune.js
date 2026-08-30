(function () {
  'use strict';

  var tip = document.querySelector('[data-home-fortune-tip]');
  var title = document.querySelector('[data-home-fortune-title]');
  var meta = document.querySelector('[data-home-fortune-meta]');
  if (!tip) return;

  function show(message) {
    tip.textContent = message;
  }

  function renderHuangli(data) {
    var h = data && data.huangli;
    if (!h) return;
    if (title) title.textContent = '今日黄历';
    if (meta) meta.textContent = h.dayGZ + '日 · ' + h.jianchu + ' · ' + h.chong;
    var yi = Array.isArray(h.yi) ? h.yi.slice(0, 3).join('、') : '';
    var ji = Array.isArray(h.ji) ? h.ji.slice(0, 2).join('、') : '';
    show('宜：' + (yi || '按计划稳步推进') + '；忌：' + (ji || '暂无特别禁忌') + '。登录后可查看专属运势。');
  }

  function loadPublicHuangli() {
    return fetch('/api/fortune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function (response) {
      if (!response.ok) throw new Error('huangli request failed');
      return response.json();
    }).then(renderHuangli).catch(function () {
      if (meta) meta.textContent = '今日黄历暂时未能载入';
    });
  }

  function start() {
    if (!window.Auth) return setTimeout(start, 250);
    Auth.ready(function () {
      if (!Auth.isLoggedIn()) {
        return;
      }
      Auth.getData('saved_charts').then(function (raw) {
        var charts = [];
        try { charts = JSON.parse(raw || '[]'); } catch (error) {}
        var chart = charts[0];
        if (!chart || !chart.params) {
          show('今日黄历已展示；完成一次八字排盘并保存后，还可查看专属今日运势。');
          return;
        }
        show('正在参照你的命盘生成今日提醒…');
        return fetch('/api/fortune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.getToken() },
          body: JSON.stringify({
            params: chart.params,
            label: chart.label || '',
            dayGan: chart.dayGan || '',
            dayZhi: chart.dayZhi || ''
          })
        }).then(function (response) {
          if (!response.ok) throw new Error('fortune request failed');
          return response.json();
        }).then(function (data) {
          if (data && data.huangli && meta) {
            meta.textContent = data.huangli.dayGZ + '日 · ' + data.huangli.jianchu + ' · ' + data.huangli.chong;
          }
          if (title) title.textContent = '专属今日运势';
          show(data && data.fortune && data.fortune.tip ? data.fortune.tip : '今天没有特别强的变化信号，按原计划推进即可。');
        });
      }).catch(function () {
        show('今日运势暂时未能载入，稍后再试即可。');
      });
    });
  }

  loadPublicHuangli().then(start);
})();
