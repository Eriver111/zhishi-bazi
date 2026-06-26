/**
 * 知时 v4 - 首页交互
 * 公历/农历双模式
 */
var currentMode = 'solar';

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', function() {
  initSolarSelects();
  initLunarSelects();
  initProvince();
  initHourSelects();
  initEvents();
  // 页面初始：农历面板隐藏，禁用内部字段防止浏览器校验
  var lp = document.getElementById('lunarPanel');
  if (lp) setPanelFields(lp, true);
});

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
  try { maxDay = LunarCalendar.monthDays(y, lm); } catch(e) { maxDay = 29; }

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
  if (!y || !m || !d) { prev.classList.remove('show'); return; }
  try {
    var lr = LunarCalendar.solarToLunar(y, m, d);
    prev.textContent = '对应农历：' + lr.yearName + ' ' + lr.monthName + lr.dayName;
    prev.classList.add('show');
  } catch(e) { prev.classList.remove('show'); }
}

function showLunarPreview(ly, lm, ld, isLeap) {
  var prev = document.getElementById('lunarPreview');
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
  var newId = mode === 'solar' ? 'solarPanel' : 'lunarPanel';
  var newPanel = document.getElementById(newId);

  document.querySelectorAll('.mode-tab').forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-mode') === mode);
  });

  if (oldPanel === newPanel) return;

  // 隐藏旧面板、显示新面板
  oldPanel.classList.remove('active');
  newPanel.classList.add('active');

  // 禁用隐藏面板的所有表单字段，避免浏览器 HTML5 校验拦截
  if (oldPanel) setPanelFields(oldPanel, true);
  if (newPanel) setPanelFields(newPanel, false);

  document.getElementById('lunarPreview').classList.remove('show');
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

  prov = document.getElementById('province').value;
  city = document.getElementById('city') ? document.getElementById('city').value : '';
  dist = document.getElementById('district') ? document.getElementById('district').value : '';

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
  if (clock) params.set('clock', clock);
  if (minute) params.set('minute', minute);
  if (prov) params.set('prov', prov);
  if (city) params.set('city', city);
  if (dist) params.set('dist', dist);
  // 子时换日
  var zishi = document.getElementById('zishiHuanri');
  if (zishi && zishi.checked) params.set('zishi', '1');
  // 真太阳时开关（默认开启，不勾时传0）
  var solarEl = document.getElementById('solarEnabled');
  if (solarEl && !solarEl.checked) params.set('solar', '0');

  setTimeout(function() {
    window.location.href = 'result?' + params.toString();
  }, 600);
}