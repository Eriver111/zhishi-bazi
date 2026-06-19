/**
 * 应用初始化 & 八字表单逻辑
 */

// 当前日历模式
let currentCalendar = 'solar';

/**
 * 应用初始化
 */
(function init() {
  initSolarCalendar();
  initLunarCalendar();
  initProvinceSelect();
  initGenderSelect();

  // 恢复会话
  if (typeof restoreSession === 'function') {
    restoreSession();
  }
})();

/**
 * 切换公历/农历
 */
function switchCalendar(mode) {
  currentCalendar = mode;
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('panelSolar').classList.toggle('active', mode === 'solar');
  document.getElementById('panelLunar').classList.toggle('active', mode === 'lunar');
}

/**
 * 初始化公历选择器
 */
function initSolarCalendar() {
  const now = new Date();
  const curYear = now.getFullYear();

  // 年份 1900-2100
  const yearSel = document.getElementById('solarYear');
  for (let y = curYear; y >= 1900; y--) {
    yearSel.appendChild(new Option(y + '年', y));
  }
  yearSel.value = '1990';

  // 月份 1-12
  const monthSel = document.getElementById('solarMonth');
  for (let m = 1; m <= 12; m++) {
    monthSel.appendChild(new Option(m + '月', m));
  }
  monthSel.value = '6';
  monthSel.addEventListener('change', updateSolarDays);

  // 日（动态）
  updateSolarDays();

  // 时辰
  const hourSel = document.getElementById('solarHour');
  const hours = [
    '00-01 子时', '01-03 丑时', '03-05 寅时', '05-07 卯时',
    '07-09 辰时', '09-11 巳时', '11-13 午时', '13-15 未时',
    '15-17 申时', '17-19 酉时', '19-21 戌时', '21-23 亥时', '23-24 子时'
  ];
  hours.forEach((h, i) => {
    hourSel.appendChild(new Option(h, i));
  });
  hourSel.value = '6'; // 默认午时
}

function updateSolarDays() {
  const year = parseInt(document.getElementById('solarYear').value);
  const month = parseInt(document.getElementById('solarMonth').value);
  const daySel = document.getElementById('solarDay');
  const curDay = daySel.value;

  const daysInMonth = new Date(year, month, 0).getDate();
  daySel.innerHTML = '';
  for (let d = 1; d <= daysInMonth; d++) {
    daySel.appendChild(new Option(d + '日', d));
  }
  if (curDay && parseInt(curDay) <= daysInMonth) {
    daySel.value = curDay;
  } else {
    daySel.value = '15';
  }
}

/**
 * 初始化农历选择器
 */
function initLunarCalendar() {
  const curYear = new Date().getFullYear();

  ['lunarYear', 'lunarYear'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    for (let y = curYear; y >= 1900; y--) {
      sel.appendChild(new Option(y + '年', y));
    }
    sel.value = '1990';
  });

  ['lunarMonth', 'lunarMonth'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    for (let m = 1; m <= 12; m++) {
      sel.appendChild(new Option(m + '月', m));
    }
    sel.value = '6';
  });

  updateLunarDays();
  document.getElementById('lunarMonth').addEventListener('change', updateLunarDays);

  const lunarHour = document.getElementById('lunarHour');
  const hours = [
    '00-01 子时', '01-03 丑时', '03-05 寅时', '05-07 卯时',
    '07-09 辰时', '09-11 巳时', '11-13 午时', '13-15 未时',
    '15-17 申时', '17-19 酉时', '19-21 戌时', '21-23 亥时', '23-24 子时'
  ];
  hours.forEach((h, i) => {
    lunarHour.appendChild(new Option(h, i));
  });
  lunarHour.value = '6';
}

function updateLunarDays() {
  const daySel = document.getElementById('lunarDay');
  const curDay = daySel.value;
  daySel.innerHTML = '';
  for (let d = 1; d <= 30; d++) {
    daySel.appendChild(new Option(d + '日', d));
  }
  if (curDay && parseInt(curDay) <= 30) {
    daySel.value = curDay;
  } else {
    daySel.value = '15';
  }
}

/**
 * 初始化省份选择器
 */
function initProvinceSelect() {
  const provSel = document.getElementById('province');
  if (!provSel || typeof REGION_DATA === 'undefined') return;

  Object.keys(REGION_DATA).forEach(prov => {
    provSel.appendChild(new Option(prov, prov));
  });
}

function updateCities() {
  const prov = document.getElementById('province').value;
  const citySel = document.getElementById('city');
  const districtSel = document.getElementById('district');

  citySel.innerHTML = '<option value="">请选择城市</option>';
  districtSel.innerHTML = '<option value="">请先选择城市</option>';
  districtSel.disabled = true;

  if (!prov || typeof REGION_DATA === 'undefined') {
    citySel.disabled = true;
    return;
  }

  citySel.disabled = false;
  const cities = REGION_DATA[prov];
  if (cities) {
    Object.keys(cities).forEach(city => {
      citySel.appendChild(new Option(city, city));
    });
  }
}

function updateDistricts() {
  const prov = document.getElementById('province').value;
  const city = document.getElementById('city').value;
  const districtSel = document.getElementById('district');

  districtSel.innerHTML = '<option value="">请选择区/县</option>';

  if (!prov || !city || typeof REGION_DATA === 'undefined') {
    districtSel.disabled = true;
    return;
  }

  districtSel.disabled = false;
  const districts = REGION_DATA[prov]?.[city];
  if (districts) {
    districts.forEach(d => {
      districtSel.appendChild(new Option(d, d));
    });
  }
}

/**
 * 初始化性别选择
 */
function initGenderSelect() {
  // 使用 CSS :has() 选择器自动处理，无需额外 JS
}

/**
 * 记录八字信息
 */
function setBaziInfo() {
  let info = {};

  if (currentCalendar === 'solar') {
    info.calendar = 'solar';
    info.year = document.getElementById('solarYear').value;
    info.month = document.getElementById('solarMonth').value;
    info.day = document.getElementById('solarDay').value;
    info.hour = document.getElementById('solarHour').value;
    info.minute = document.getElementById('solarMinute').value || '0';
  } else {
    info.calendar = 'lunar';
    info.year = document.getElementById('lunarYear').value;
    info.month = document.getElementById('lunarMonth').value;
    info.day = document.getElementById('lunarDay').value;
    info.hour = document.getElementById('lunarHour').value;
    const leapRadio = document.querySelector('input[name="leapMonth"]:checked');
    info.isLeap = leapRadio ? leapRadio.value : '0';
  }

  const genderRadio = document.querySelector('input[name="gender"]:checked');
  info.gender = genderRadio ? genderRadio.value : 'male';

  info.province = document.getElementById('province').value;
  info.city = document.getElementById('city').value;
  info.district = document.getElementById('district').value;

  chatState.baziInfo = info;

  // 生成八字摘要
  const summary = buildBaziSummary(info);
  showToast('八字信息已记录', 'success');

  // 如果有兑换码，发送一条系统消息
  if (chatState.credits > 0 && chatState.messages.length === 0) {
    addMessage('ai',
      '🧧 **八字信息已记录**\n\n' + summary +
      '\n\n你可以开始提问了！比如：\n' +
      '• 我的八字五行缺什么？\n' +
      '• 我的喜用神是什么？\n' +
      '• 今年的运势如何？\n' +
      '• 适合什么行业和职业？'
    );
  }
}

function buildBaziSummary(info) {
  let parts = [];
  if (info.calendar === 'solar') {
    parts.push(`公历 ${info.year}年${info.month}月${info.day}日 ${getHourLabel(info.hour)}`);
  } else {
    const leapLabel = info.isLeap === '1' ? '闰' : '';
    parts.push(`农历 ${info.year}年${leapLabel}${info.month}月${info.day}日 ${getHourLabel(info.hour)}`);
  }
  parts.push(`性别：${info.gender === 'male' ? '男' : '女'}`);
  if (info.province) {
    let location = info.province;
    if (info.city) location += ' ' + info.city;
    if (info.district && info.district !== info.city) location += ' ' + info.district;
    parts.push(`出生地：${location}`);
  }
  return parts.join('  |  ');
}

function getHourLabel(hourVal) {
  const labels = [
    '子时(23-01)', '丑时(01-03)', '寅时(03-05)', '卯时(05-07)',
    '辰时(07-09)', '巳时(09-11)', '午时(11-13)', '未时(13-15)',
    '申时(15-17)', '酉时(17-19)', '戌时(19-21)', '亥时(21-23)', '子时(23-24)'
  ];
  return labels[parseInt(hourVal)] || '未知时辰';
}

/* ============================================
   通用 UI 工具
   ============================================ */

/**
 * 显示/关闭模态框
 */
function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// 点击模态框外部关闭
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
});

/**
 * Toast 提示
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
