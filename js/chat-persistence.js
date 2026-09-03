(function (root) {
  'use strict';

  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function(key) {
      return JSON.stringify(key) + ':' + stable(value[key]);
    }).join(',') + '}';
  }

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function chartIdentity(mode, chartData) {
    chartData = chartData || {};
    var identity = { mode: mode };
    if (mode === 'hepan' || chartData.type === 'hepan') {
      // 合盘必须把甲乙双方都纳入身份。旧实现只记录 type=hepan，导致所有
      // 合盘共用同一条历史会话，上一对双方的回答会被带进下一对合盘。
      identity.type = 'hepan';
      identity.relationType = chartData.relationType || '';
      identity.person1 = personIdentity(chartData.person1);
      identity.person2 = personIdentity(chartData.person2);
    } else if (chartData.fourPillars) {
      identity.gender = chartData.birthInfo && chartData.birthInfo.gender;
      identity.pillars = ['year', 'month', 'day', 'hour'].map(function(pos) {
        var p = chartData.fourPillars[pos] || {};
        return String(p.gan || '') + String(p.zhi || '');
      });
    } else {
      // 紫微等体系只取出生与本盘字段，排除每年变化的运限内容。
      ['birthInfo', 'solarDate', 'lunarDate', 'gender', 'mingGong', 'bodyPalace',
        'bodyPalaceZhi', 'wuxingJu', 'palaces', 'type'].forEach(function(key) {
        if (chartData[key] !== undefined) identity[key] = chartData[key];
      });
    }
    return mode + ':' + hash(stable(identity));
  }

  function personIdentity(person) {
    person = person || {};
    var birth = person.birthInfo || {};
    return {
      name: String(person.name || birth.name || ''),
      gender: person.gender || birth.gender || '',
      pillars: ['year', 'month', 'day', 'hour'].map(function(pos) {
        var p = (person.fourPillars && person.fourPillars[pos]) || {};
        return String(p.gan || '') + String(p.zhi || '');
      })
    };
  }

  function authReady() {
    return new Promise(function(resolve) {
      function check() {
        if (root.Auth && typeof root.Auth.ready === 'function') {
          root.Auth.ready(function() { resolve(root.Auth.isLoggedIn()); });
        } else setTimeout(check, 150);
      }
      check();
    });
  }

  async function load(mode, chartData) {
    var loggedIn = await authReady();
    var chartKey = chartIdentity(mode, chartData);
    if (!loggedIn) return { logged_in: false, chart_key: chartKey, messages: [] };
    var response = await fetch('/api/chat-history?mode=' + encodeURIComponent(mode) + '&chart_key=' + encodeURIComponent(chartKey), {
      headers: { 'Authorization': 'Bearer ' + root.Auth.getToken() },
      cache: 'no-store'
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || '历史对话读取失败');
    data.logged_in = true;
    data.chart_key = chartKey;
    return data;
  }

  function decorate(body, mode, chartData, conversationId) {
    body.chat_type = mode;
    body.chart_key = chartIdentity(mode, chartData);
    if (conversationId) body.conversation_id = conversationId;
    return body;
  }

  root.ChatPersistence = {
    chartIdentity: chartIdentity,
    load: load,
    decorate: decorate
  };
})(window);
