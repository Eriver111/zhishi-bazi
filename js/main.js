/**
 * 知时 v4 - 首页交互
 * 公历/农历双模式
 */
var currentMode = 'solar';

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', function() {
  initSolarSelects();
  initLunarSelects();
  initPillarSelects();
  initProvince();
  initHourSelects();
  initEvents();
  initChartName();
  // 页面初始：隐藏面板中的字段禁用，防止浏览器校验
  var lp = document.getElementById('lunarPanel');
  if (lp) setPanelFields(lp, true);
  var pp = document.getElementById('pillarsPanel');
  if (pp) setPanelFields(pp, true);
});

function readChartName() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return '案例1';
  var input = document.getElementById('chartName');
  var value = input ? String(input.value || '').trim().slice(0, 20) : '';
  return value || '案例1';
}

function initChartName() {
  var input = document.getElementById('chartName');
  if (!input) return;
  input.addEventListener('input', function() { input.dataset.userEdited = '1'; });

  function setNextLoggedInName() {
    if (typeof Auth === 'undefined') return setTimeout(setNextLoggedInName, 300);
    Auth.ready(function() {
      if (!Auth.isLoggedIn() || input.dataset.userEdited || input.dataset.restored) return;
      Auth.getData('saved_charts').then(function(raw) {
        if (input.dataset.userEdited || input.dataset.restored) return;
        var charts = [];
        try { charts = JSON.parse(raw || '[]'); } catch(e) {}
        var max = 0;
        charts.forEach(function(chart) {
          var explicit = String(chart && chart.name || '').trim();
          if (!explicit && chart && chart.params) {
            try { explicit = new URLSearchParams(chart.params).get('name') || ''; } catch(e) {}
          }
          var match = explicit.match(/^案例\s*(\d+)$/);
          if (match) max = Math.max(max, parseInt(match[1], 10) || 0);
        });
        input.value = '案例' + (max + 1);
      }).catch(function() {});
    });
  }
  setNextLoggedInName();
}

function initSolarSelects() {
  var yS = document.getElementById('sYear');
  for (var y = 2025; y >= 1900; y--) {
    var o = document.createElement('option'); o.value = y; o.textContent = y + '年'; yS.appendChild(o);
  }
  var mS = document.getElementById('sMonth');
  for (var m = 1; m <= 12; m++) {
    var o = document.createElement('option'); o.value = m; o.textContent = m + '月'; mS.appendChild(o);
  }
  // 分钟选项
  var minS = document.getElementById('sMinute');
  if (minS) for (var i = 0; i < 60; i++) {
    var o = document.createElement('option'); o.value = i; o.textContent = String(i).padStart(2,'0') + '分'; minS.appendChild(o);
  }
}

function initHourSelects() {
  var hourMap = {24: [
    {v:0,l:'子',c:23,t:'23点（晚子时）'},{v:0,l:'子',c:0,t:' 0点（早子时）'},
    {v:1,l:'丑',c:1,t:' 1点'},{v:1,l:'丑',c:2,t:' 2点'},
    {v:2,l:'寅',c:3,t:' 3点'},{v:2,l:'寅',c:4,t:' 4点'},
    {v:3,l:'卯',c:5,t:' 5点'},{v:3,l:'卯',c:6,t:' 6点'},
    {v:4,l:'辰',c:7,t:' 7点'},{v:4,l:'辰',c:8,t:' 8点'},
    {v:5,l:'巳',c:9,t:' 9点'},{v:5,l:'巳',c:10,t:'10点'},
    {v:6,l:'午',c:11,t:'11点'},{v:6,l:'午',c:12,t:'12点'},
    {v:7,l:'未',c:13,t:'13点'},{v:7,l:'未',c:14,t:'14点'},
    {v:8,l:'申',c:15,t:'15点'},{v:8,l:'申',c:16,t:'16点'},
    {v:9,l:'酉',c:17,t:'17点'},{v:9,l:'酉',c:18,t:'18点'},
    {v:10,l:'戌',c:19,t:'19点'},{v:10,l:'戌',c:20,t:'20点'},
    {v:11,l:'亥',c:21,t:'21点'},{v:11,l:'亥',c:22,t:'22点'}
  ]};

  var groups = {};
  hourMap[24].forEach(function(sc) {
    var gid = sc.l + '时';
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(sc);
  });

  ['sHour','lHour'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">选择时辰</option>';
    var hourLabels = ['23:00-01:00','01:00-03:00','03:00-05:00','05:00-07:00','07:00-09:00',
      '09:00-11:00','11:00-13:00','13:00-15:00','15:00-17:00','17:00-19:00',
      '19:00-21:00','21:00-23:00'];
    var idx = 0;
    Object.keys(groups).forEach(function(name) {
      var og = document.createElement('optgroup');
      og.label = name + ' ' + hourLabels[idx];
      groups[name].forEach(function(sc) {
        var o = document.createElement('option');
        o.value = sc.v; o.setAttribute('data-clock', sc.c);
        o.textContent = sc.t;
        og.appendChild(o);
      });
      sel.appendChild(og);
      idx++;
    });
  });
}

function initLunarSelects() {
  var yS = document.getElementById('lYear');
  for (var y = 2025; y >= 1900; y--) {
    var o = document.createElement('option'); o.value = y;
    o.textContent = y + '年（' + LunarCalendar.ANIMALS[(y-4)%12] + '年）';
    yS.appendChild(o);
  }
}

function initPillarSelects() {
  var gans = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var zhis = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var ids = [
    ['pYearGan', gans], ['pYearZhi', zhis],
    ['pMonthGan', gans], ['pMonthZhi', zhis],
    ['pDayGan', gans], ['pDayZhi', zhis],
    ['pHourGan', gans], ['pHourZhi', zhis]
  ];
  ids.forEach(function(item) {
    var select = document.getElementById(item[0]);
    if (!select) return;
    item[1].forEach(function(value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  });
}

function initProvince() {
  var pS = document.getElementById('province');
  if (!pS || typeof REGION_DATA === 'undefined') return;
  Object.keys(REGION_DATA).forEach(function(p) {
    var o = document.createElement('option'); o.value = p; o.textContent = p; pS.appendChild(o);
  });

  // 二级联动
  var cS = document.getElementById('city');
  var dS = document.getElementById('district');
  pS.addEventListener('change', function() {
    var p = this.value;
    cS.innerHTML = '<option value="">选择城市</option>';
    dS.innerHTML = '<option value="">选择区县</option>';
    cS.disabled = true; dS.disabled = true;
    if (!p || !REGION_DATA[p]) return;
    Object.keys(REGION_DATA[p]).forEach(function(c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; cS.appendChild(o);
    });
    cS.disabled = false;
  });
  cS.addEventListener('change', function() {
    var p = pS.value, c = this.value;
    dS.innerHTML = '<option value="">选择区县</option>';
    dS.disabled = true;
    if (!p || !c || !REGION_DATA[p] || !REGION_DATA[p][c]) return;
    REGION_DATA[p][c].forEach(function(d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d; dS.appendChild(o);
    });
    dS.disabled = false;
  });
}

function initEvents() {
  var sY = document.getElementById('sYear');
  var sM = document.getElementById('sMonth');
  var lY = document.getElementById('lYear');
  var lM = document.getElementById('lMonth');
  var form = document.getElementById('birthForm');
  if (sY) sY.addEventListener('change', function() { updateSolarDays(); });
  if (sM) sM.addEventListener('change', function() { updateSolarDays(); });
  if (lY) lY.addEventListener('change', function() { updateLunarMonths(); });
  if (lM) lM.addEventListener('change', function() { updateLunarDays(); });
  if (form) form.addEventListener('submit', handleSubmit);
}

// ---- 公历日期联动 ----
function updateSolarDays() {
  var ys = document.getElementById('sYear');
  var ms = document.getElementById('sMonth');
  var dS = document.getElementById('sDay');
  if (!ys || !ms || !dS) return;
  var y = parseInt(ys.value);
  var m = parseInt(ms.value);
  if (!y || !m) { dS.innerHTML = '<option value="">选择日期</option>'; return; }
  var max = new Date(y, m, 0).getDate();
  var cur = dS.value;
  dS.innerHTML = '<option value="">选择日期</option>';
  for (var d = 1; d <= max; d++) {
    var o = document.createElement('option'); o.value = d; o.textContent = d + '日'; dS.appendChild(o);
  }
  if (cur && parseInt(cur) <= max) dS.value = cur;
}

// ---- 农历月份联动 ----
function updateLunarMonths() {
  var y = parseInt(document.getElementById('lYear').value);
  var mS = document.getElementById('lMonth');
  var prev = document.getElementById('lunarPreview');
  if (!y) { mS.innerHTML = '<option value="">选择月份</option>'; prev.classList.remove('show'); return; }

  // 查该年闰月
  var leapMonth = LunarCalendar.leapMonth(y);

  mS.innerHTML = '<option value="">选择月份</option>';
  var LM = LunarCalendar.LUNAR_MONTH;
  for (var m = 1; m <= 12; m++) {
    var o = document.createElement('option'); o.value = m;
    o.textContent = LM[m-1] + '月';
    mS.appendChild(o);
    if (m === leapMonth) {
      var o2 = document.createElement('option');
      o2.value = 'r' + m; // 闰月标记
      o2.textContent = '闰' + LM[m-1] + '月';
      mS.appendChild(o2);
    }
  }
  updateLunarDays();
}

// ---- 农历日期联动 ----
function updateLunarDays() {
  var y = parseInt(document.getElementById('lYear').value);
  var mV = document.getElementById('lMonth').value;
  var dS = document.getElementById('lDay');
  var prev = document.getElementById('lunarPreview');
  if (!y || !mV) { dS.innerHTML = '<option value="">选择日期</option>'; prev.classList.remove('show'); return; }

  var lm = parseInt(mV);
  var isLeap = false;
  if (mV.startsWith('r')) { lm = parseInt(mV.substring(1)); isLeap = true; }

  // 用 LunarCalendar 查该月有多少天
  var maxDay;
  try { maxDay = LunarCalendar.lunarMonthDays(y, lm, isLeap); } catch(e) { maxDay = 29; }

  dS.innerHTML = '<option value="">选择日期</option>';
  var LD = LunarCalendar.LUNAR_DAY;
  for (var d = 1; d <= maxDay; d++) {
    var o = document.createElement('option'); o.value = d; o.textContent = LD[d]; dS.appendChild(o);
  }

  // 预览：农历 → 公历
  var ld = parseInt(dS.value);
  if (ld > 0) showLunarPreview(y, lm, ld, isLeap);
}

// 公历日变更时显示对应农历
document.addEventListener('change', function(e) {
  if (e.target.id === 'sYear' || e.target.id === 'sMonth' || e.target.id === 'sDay') {
    showSolarLunarHint();
  }
  if (e.target.id === 'lDay') {
    var y = parseInt(document.getElementById('lYear').value);
    var mV = document.getElementById('lMonth').value;
    var ld = parseInt(e.target.value);
    if (y && mV && ld) {
      var lm = parseInt(mV), isLeap = mV.startsWith('r');
      if (isLeap) lm = parseInt(mV.substring(1));
      showLunarPreview(y, lm, ld, isLeap);
    }
  }
});

function showSolarLunarHint() {
  var y = parseInt(document.getElementById('sYear').value);
  var m = parseInt(document.getElementById('sMonth').value);
  var d = parseInt(document.getElementById('sDay').value);
  var prev = document.getElementById('lunarPreview');
  if (!prev) return;
  if (!y || !m || !d) { prev.classList.remove('show'); return; }
  try {
    var lr = LunarCalendar.solarToLunar(y, m, d);
    prev.textContent = '对应农历：' + lr.yearName + ' ' + lr.monthName + lr.dayName;
    prev.classList.add('show');
  } catch(e) { prev.classList.remove('show'); }
}

function showLunarPreview(ly, lm, ld, isLeap) {
  var prev = document.getElementById('lunarPreview');
  if (!prev) return;
  try {
    var sr = LunarCalendar.lunarToSolar(ly, lm, ld, isLeap);
    prev.textContent = '对应公历：' + sr.year + '年' + sr.month + '月' + sr.day + '日';
    prev.classList.add('show');
  } catch(e) { prev.classList.remove('show'); }
}

// ---- 模式切换（带动画）----
function switchMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;
  var oldPanel = document.querySelector('.mode-panel.active');
  var panelIds = { solar:'solarPanel', lunar:'lunarPanel', pillars:'pillarsPanel' };
  var newPanel = document.getElementById(panelIds[mode]);
  if (!newPanel) return;

  document.querySelectorAll('.mode-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-mode') === mode);
  });

  if (oldPanel !== newPanel) {
    // 隐藏旧面板、显示新面板
    if (oldPanel) oldPanel.classList.remove('active');
    newPanel.classList.add('active');

    // 禁用隐藏面板的所有表单字段，避免浏览器 HTML5 校验拦截
    if (oldPanel) setPanelFields(oldPanel, true);
    setPanelFields(newPanel, false);
  }

  document.querySelectorAll('.calendar-only-fields').forEach(function(el) {
    el.hidden = mode === 'pillars';
    el.querySelectorAll('select, input').forEach(function(field) {
      if (mode === 'pillars') {
        field.setAttribute('data-calendar-was-disabled', field.disabled ? 'true' : 'false');
        field.disabled = true;
      } else if (field.hasAttribute('data-calendar-was-disabled')) {
        field.disabled = field.getAttribute('data-calendar-was-disabled') === 'true';
        field.removeAttribute('data-calendar-was-disabled');
      }
    });
  });

  var preview = document.getElementById('lunarPreview');
  if (preview) preview.classList.remove('show');
}

function setPanelFields(panel, disabled) {
  var fields = panel.querySelectorAll('select, input');
  for (var i = 0; i < fields.length; i++) {
    if (disabled) {
      fields[i].setAttribute('data-was-required', fields[i].hasAttribute('required'));
      fields[i].removeAttribute('required');
      fields[i].disabled = true;
    } else {
      if (fields[i].getAttribute('data-was-required') === 'true') {
        fields[i].setAttribute('required', '');
      }
      fields[i].removeAttribute('data-was-required');
      fields[i].disabled = false;
    }
  }
}

function resetSubmitButton(btn) {
  if (!btn) return;
  btn.classList.remove('loading');
  btn.textContent = '起盘推演';
}

function readDirectPillars() {
  return {
    year: { gan: document.getElementById('pYearGan').value, zhi: document.getElementById('pYearZhi').value },
    month: { gan: document.getElementById('pMonthGan').value, zhi: document.getElementById('pMonthZhi').value },
    day: { gan: document.getElementById('pDayGan').value, zhi: document.getElementById('pDayZhi').value },
    hour: { gan: document.getElementById('pHourGan').value, zhi: document.getElementById('pHourZhi').value }
  };
}

function renderPillarErrors(errors) {
  ['year', 'month', 'day', 'hour'].forEach(function(position) {
    var message = errors[position] || '';
    var error = document.querySelector('[data-error-for="' + position + '"]');
    if (error) error.textContent = message;
    var column = document.querySelector('[data-pillar="' + position + '"]');
    if (column) {
      column.querySelectorAll('select').forEach(function(select) {
        select.setAttribute('aria-invalid', message ? 'true' : 'false');
      });
    }
  });
}

function buildDirectResultParams(pillars, gender, candidate) {
  var params = PillarInput.toSearchParams(pillars);
  params.set('mode', 'pillars');
  params.set('timing', candidate ? 'matched' : 'unknown');
  params.set('gender', gender);
  params.set('name', readChartName());
  if (candidate) {
    params.set('year', candidate.year);
    params.set('month', candidate.month);
    params.set('day', candidate.day);
    params.set('hour', candidate.hourIndex);
    params.set('clock', candidate.clock);
  }
  return params;
}

function navigateToDirectResult(pillars, gender, candidate) {
  var params = buildDirectResultParams(pillars, gender, candidate);
  try { localStorage.setItem('last_bazi_params', params.toString()); } catch(e) {}
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    try { Auth.syncData('last_bazi_params', params.toString()); } catch(e) {}
  }
  window.location.href = 'result?' + params.toString();
}

function appendPillarCandidateText(container, tagName, text, className) {
  var element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  container.appendChild(element);
  return element;
}

function renderPillarCandidates(matches, pillars, gender) {
  var container = document.getElementById('pillarCandidates');
  if (!container) return;
  container.innerHTML = '';
  container.hidden = false;

  if (matches.length) {
    appendPillarCandidateText(container, 'h3', '请选择对应的出生时间', 'pillar-candidates-title');
    matches.slice(0, 2).forEach(function(match) {
      var button = appendPillarCandidateText(
        container,
        'button',
        match.year + '年' + match.month + '月' + match.day + '日 · ' + match.hourName + '（' + match.hourRange + '）',
        'pillar-candidate'
      );
      button.type = 'button';
      button.addEventListener('click', function() {
        navigateToDirectResult(pillars, gender, match);
      });
    });
    var midpoint = String(matches[0].clock).padStart(2, '0') + ':00';
    appendPillarCandidateText(
      container,
      'p',
      '确认后将采用该时辰的中点 ' + midpoint + ' 起盘。',
      'pillar-midpoint-notice'
    );
    return;
  }

  appendPillarCandidateText(
    container,
    'p',
    '近 200 年内未找到完全匹配的出生时间。请检查四柱，或先查看不含精确出生时点的基础命盘。',
    'pillar-no-match'
  );
  var actions = appendPillarCandidateText(container, 'div', '', 'pillar-candidate-actions');
  var back = appendPillarCandidateText(actions, 'button', '返回检查四柱', 'pillar-action pillar-action-secondary');
  back.type = 'button';
  back.addEventListener('click', function() {
    container.hidden = true;
    var first = document.getElementById('pYearGan');
    if (first) first.focus();
  });
  var basic = appendPillarCandidateText(actions, 'button', '仅查看基础命盘', 'pillar-action pillar-action-primary');
  basic.type = 'button';
  basic.addEventListener('click', function() {
    navigateToDirectResult(pillars, gender);
  });
}

function clearPillarCandidates() {
  var container = document.getElementById('pillarCandidates');
  if (!container) return;
  container.hidden = true;
  container.innerHTML = '';
}

function handleDirectSubmit(gender, btn) {
  clearPillarCandidates();
  var normalized = PillarInput.normalize(readDirectPillars());
  renderPillarErrors(normalized.errors);
  if (!normalized.ok) {
    resetSubmitButton(btn);
    return;
  }

  var matches = PillarReverseLookup.findRecentMatches({
    pillars: normalized.pillars,
    calculator: BaZiCalculator,
    gender: gender
  });
  renderPillarCandidates(matches, normalized.pillars, gender);
  resetSubmitButton(btn);
}

// ---- 提交 ----
function handleSubmit(e) {
  e.preventDefault();
  var btn = document.querySelector('.submit');
  btn.classList.add('loading');
  btn.textContent = '正在分析...';

  var year, month, day, hour, clock, minute, gender, prov, city, dist;

  gender = document.querySelector('input[name="gender"]:checked');
  if (!gender) { alert('请选择性别'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return; }
  gender = gender.value;

  if (currentMode === 'pillars') {
    handleDirectSubmit(gender, btn);
    return;
  }

  prov = document.getElementById('province').value;
  city = document.getElementById('city') ? document.getElementById('city').value : '';
  dist = document.getElementById('district') ? document.getElementById('district').value : '';
  var hasAnyLocation = !!(prov || city || dist);
  var hasCompleteLocation = !!(prov && city && dist);
  if (hasAnyLocation && !hasCompleteLocation) {
    alert('请完整选择省、市、县'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return;
  }
  if (hasCompleteLocation) {
    try {
      if (typeof CountyLongitudeData === 'undefined') throw new Error('县级经度数据未加载');
      CountyLongitudeData.resolveLocation({ province:prov, city:city, district:dist }, { allowFallback:false });
    } catch (locationError) {
      alert('县级经度未匹配，请重新选择出生地'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return;
    }
  }

  if (currentMode === 'solar') {
    year = parseInt(document.getElementById('sYear').value);
    month = parseInt(document.getElementById('sMonth').value);
    day = parseInt(document.getElementById('sDay').value);
    hour = parseInt(document.getElementById('sHour').value);

    if (!year || !month || !day || isNaN(hour)) {
      alert('请完整填写所有信息'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return;
    }

    var hSel = document.getElementById('sHour');
    clock = hSel && hSel.selectedOptions[0] ? hSel.selectedOptions[0].getAttribute('data-clock') : null;
    var mEl = document.getElementById('sMinute');
    minute = (mEl && mEl.value) ? parseInt(mEl.value) || 0 : 0;
  } else {
    var ly = parseInt(document.getElementById('lYear').value);
    var mV = document.getElementById('lMonth').value;
    var ld = parseInt(document.getElementById('lDay').value);
    var lm = parseInt(mV);
    var isLeap = mV.startsWith('r');
    if (isLeap) lm = parseInt(mV.substring(1));

    if (!ly || !mV || !ld) { alert('请完整填写农历信息'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return; }

    try {
      var sr = LunarCalendar.lunarToSolar(ly, lm, ld, isLeap);
      year = sr.year; month = sr.month; day = sr.day;
    } catch(e) {
      alert('农历转换失败，请重试'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return;
    }
    hour = parseInt(document.getElementById('lHour').value);
    var lhSel = document.getElementById('lHour');
    clock = lhSel.selectedOptions[0] ? lhSel.selectedOptions[0].getAttribute('data-clock') : null;
    minute = parseInt(document.getElementById('lMinute').value) || 0;
  }

  if (!year || !month || !day || isNaN(hour) || !gender) {
    alert('请完整填写所有信息'); btn.classList.remove('loading'); btn.textContent='起盘推演'; return;
  }

  var params = new URLSearchParams({ year:year, month:month, day:day, hour:hour, gender:gender });
  params.set('name', readChartName());
  if (clock) params.set('clock', clock);
  if (minute) params.set('minute', minute);
  if (prov) params.set('prov', prov);
  if (city) params.set('city', city);
  if (dist) params.set('dist', dist);
  if (hasCompleteLocation && typeof CountyLongitudeData !== 'undefined') params.set('geo_v', CountyLongitudeData.VERSION);
  // 子时换日
  var zishi = document.getElementById('zishiHuanri');
  if (zishi && zishi.checked) params.set('zishi', '1');
  // 真太阳时开关（默认开启，不勾时传0）
  var solarEl = document.getElementById('solarEnabled');
  if (solarEl && !solarEl.checked) params.set('solar', '0');

  // 登录用户：保存排盘参数到云端
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    try { Auth.syncData('last_bazi_params', params.toString()); } catch(e) {}
  }
  // 本地也存一份（向后兼容）
  try { localStorage.setItem('last_bazi_params', params.toString()); } catch(e) {}

  setTimeout(function() {
    window.location.href = 'result?' + params.toString();
  }, 600);
}

// 登录用户：页面加载时恢复上次排盘参数
(function restoreBaziParams() {
  if (typeof Auth === 'undefined') return setTimeout(restoreBaziParams, 500);
  var attempts = 0;
  function tryRestore() {
    attempts++;
    if (!Auth.isLoggedIn()) return;
    Auth.getData('last_bazi_params').then(function(val) {
      if (!val) return;
      var p = new URLSearchParams(val);
      var year = p.get('year'), month = p.get('month'), day = p.get('day');
      if (!year || !month || !day) return;
      var setVal = function(id, value) { var el = document.getElementById(id); if (el && value) el.value = value; };
      setVal('sYear', year);
      setVal('sMonth', month);
      // 触发生日选项更新
      if (typeof updateSolarDays === 'function') { try { updateSolarDays(); } catch(e) {} }
      setVal('sDay', day);
      var hour = p.get('hour'); if (hour) setVal('sHour', hour);
      var minute = p.get('minute'); if (minute) setVal('sMinute', minute);
      if (p.get('gender')) {
        var r = document.querySelector('input[name="gender"][value="' + p.get('gender') + '"]');
        if (r) r.checked = true;
      }
      // 如果年份没填进去且没超过重试次数，说明 select 还没渲染完
      var yearEl = document.getElementById('sYear');
      if ((!yearEl || !yearEl.value) && attempts < 10) {
        setTimeout(tryRestore, 500);
      }
    }).catch(function(){});
  }
  setTimeout(tryRestore, 800);
})();
