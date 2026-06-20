/**
 * 付费遮罩层逻辑
 *
 * 付费板块: 今年运势, 婚姻感情, 财运分析, 学业分析, 近五年流年运势
 * 遮罩只盖内容区（drawer-body），标题栏可见。
 * 所有付费板块一次性解锁，9.9 元。
 */

const PAID_SECTIONS = [
  'thisYearSection',
  'marriageSection',
  'wealthSection',
  'studySection',
  'fortuneSection'
];

const SECTION_TITLES = {
  thisYearSection: '今年运势',
  marriageSection: '婚姻感情',
  wealthSection: '财运分析',
  studySection: '学业分析',
  fortuneSection: '近五年流年运势'
};

const PAYWALL_STATE_KEY = 'bazi_paywall';
const API_BASE = '/api';
const POLL_INTERVAL = 3000; // 3秒轮询

let _orderId = null;
let _baziHash = null;
let _pollTimer = null;

// ---- 初始化 ----
function initPaywall(baziParams) {
  // v3.0: 所有八字分析内容免费开放
  hidePaywall();
  if (typeof renderPaidContent === 'function') {
    try { renderPaidContent(); } catch(e) {}
  }
}

// ---- 显示遮罩 ----
function showPaywall() {
  PAID_SECTIONS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var body = el.querySelector('.drawer-body');
    if (!body) return;
    if (body.querySelector('.paywall-overlay')) return;

    el.classList.add('drawer-open');
    var arrow = el.querySelector('.drawer-arrow');
    if (arrow) arrow.style.transform = 'rotate(90deg)';

    var title = SECTION_TITLES[id] || '付费内容';

    var overlay = document.createElement('div');
    overlay.className = 'paywall-overlay';
    overlay.innerHTML = ''
      + '<div class="paywall-card">'
      +   '<div class="paywall-card-title">' + title + '</div>'
      +   '<div class="paywall-card-sub">以下内容需付费解锁后查看</div>'
      +   '<div class="paywall-price" style="margin-top:18px;margin-bottom:14px">'
      +     '<span class="paywall-current">9.9 元</span>'
      +     '<span class="paywall-one-time" style="display:block;font-size:10px;color:var(--text-dim);margin-top:2px">付费后即可下载完整报告，随时查看</span>'
      +   '</div>'
      +   '<button class="paywall-btn" onclick="startPay()">解锁全部内容</button>'
      +   '<button class="paywall-btn-check" id="checkBtnManual" onclick="checkPaymentManually()" style="display:none;margin-top:14px">我已付过款，刷新状态</button>'
      +   '<div class="paywall-tip" id="paywallTip" style="display:none;margin-top:8px"></div>'
      + '</div>';
    body.classList.add('paywall-active');
    body.appendChild(overlay);
  });
}

// ---- 隐藏所有遮罩 ----
function hidePaywall() {
  hideQrModal();
  PAID_SECTIONS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var body = el.querySelector('.drawer-body');
    if (!body) return;
    var ov = body.querySelector('.paywall-overlay');
    if (ov) ov.remove();
    body.classList.remove('paywall-active');
  });
}

// ---- 发起支付 ----
function startPay() {
  // 先停掉旧的轮询
  stopPolling();
  var allBtns = document.querySelectorAll('.paywall-btn');
  allBtns.forEach(function(b) { b.disabled = true; b.textContent = '创建订单中...'; });

  var params = getBaziParamsFromURL();

  fetch(API_BASE + '/create-order.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      year: params.year, month: params.month, day: params.day,
      hour: params.hour, gender: params.gender, amount: 9.9
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.error) {
      allBtns.forEach(function(b) { b.disabled = false; b.textContent = '创建失败，请重试'; });
      showTip('创建订单失败: ' + data.error);
      return;
    }
    _orderId = data.orderId;
    allBtns.forEach(function(b) { b.textContent = '等待支付...'; });

    // 显示「我已付过款」按钮
    var manualBtn = document.getElementById('checkBtnManual');
    if (manualBtn) manualBtn.style.display = 'block';

    // 弹出二维码
    showQrModal(data.qrcode || data.payUrl, data.amount);
    // 开始轮询
    startPolling();
  })
  .catch(function(e) {
    allBtns.forEach(function(b) { b.disabled = false; b.textContent = '网络错误，请重试'; });
    showTip('网络错误，请刷新重试');
  });
}

// ---- 轮询支付状态 ----
function startPolling() {
  stopPolling();
  _pollTimer = setInterval(function() {
    fetch(API_BASE + '/check-order.js?orderId=' + _orderId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'paid' && data.token) {
          stopPolling();
          onPaymentSuccess(data.token);
        }
      })
      .catch(function() { /* ignore */ });
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// ---- 支付成功 ----
function onPaymentSuccess(token) {
  saveToken(token, _baziHash);
  hidePaywall();
  stopPolling();
  hideQrModal();
  if (typeof renderPaidContent === 'function') {
    renderPaidContent();
  }
  // 显示下载横幅
  var banner = document.getElementById('downloadBanner');
  if (banner) banner.style.display = '';
}

// ---- 二维码弹窗 ----
function showQrModal(qrUrl, amount) {
  // 回收旧弹窗
  hideQrModal();

  // 生成二维码图片（用quickchart API把文本转成二维码）
  var qrImgSrc = 'https://api.quickchart.io/qr?size=200&text=' + encodeURIComponent(qrUrl);

  var modal = document.createElement('div');
  modal.id = 'payQrModal';
  modal.innerHTML = ''
    + '<div class="payqr-backdrop" onclick="closeQrModal()"></div>'
    + '<div class="payqr-dialog">'
    +   '<div class="payqr-close" onclick="closeQrModal()">✕</div>'
    +   '<div class="payqr-title">扫码支付 ' + amount + ' 元</div>'
    +   '<div class="payqr-sub">支付宝扫码支付</div>'
    +   '<img class="payqr-img" src="' + qrImgSrc + '" alt="支付二维码" />'
    +   '<div class="payqr-tip">支付完成后将自动解锁全部内容</div>'
    + '</div>';
  document.body.appendChild(modal);
}

function hideQrModal() {
  var old = document.getElementById('payQrModal');
  if (old) old.remove();
}

function closeQrModal() {
  hideQrModal();
  // 不停止轮询！用户可能正在支付中，只是暂时关掉弹窗
  // stopPolling 移到 onPaymentSuccess 和 startPay 新订单时调用
  var allBtns = document.querySelectorAll('.paywall-btn');
  allBtns.forEach(function(b) { b.disabled = false; b.textContent = '解锁全部内容'; });
}

// ---- 手动检查支付状态（用户付了钱但没自动解锁时用）----
function checkPaymentManually() {
  var tip = document.getElementById('paywallTip');
  if (tip) { tip.style.display = 'block'; tip.textContent = '正在查询支付状态...'; }

  // 如果有 orderId，直接用订单号查
  if (_orderId) {
    fetch(API_BASE + '/check-order.js?orderId=' + _orderId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'paid' && data.token) {
           if (tip) tip.textContent = '✓ 支付成功！正在解锁...';
           onPaymentSuccess(data.token);
         } else {
          if (tip) tip.textContent = '暂未查到支付记录，请确认是否已完成付款';
        }
      })
      .catch(function() {
        if (tip) tip.textContent = '网络错误，请稍后重试';
      });
    return;
  }

  // 没有 orderId：尝试用本地保存的 token 重新验证
  var saved = readSaved();
  if (saved && saved.token) {
    verifyAndUnlock(saved.token);
    return;
  }

  if (tip) tip.textContent = '未找到订单记录，请先点击「解锁全部内容」创建订单';
}

// ---- token 验证 ----
function verifyAndUnlock(token) {
  fetch(API_BASE + '/verify-token.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, baziHash: _baziHash })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.valid) {
      hidePaywall();
      if (typeof renderPaidContent === 'function') renderPaidContent();
      var banner = document.getElementById('downloadBanner');
      if (banner) banner.style.display = '';
    } else {
      clearSaved();
      showPaywall();
    }
  })
  .catch(function() { showPaywall(); });
}

// ---- 提示文本 ----
function showTip(msg) {
  var tip = document.getElementById('paywallTip');
  if (tip) { tip.style.display = 'block'; tip.textContent = msg; }
}

// ---- 本地存储 ----
function saveToken(token, hash) {
  var obj = { token: token, baziHash: hash, savedAt: Date.now() };
  try { localStorage.setItem(PAYWALL_STATE_KEY, JSON.stringify(obj)); } catch(e) {}
}

function readSaved() {
  try {
    var raw = localStorage.getItem(PAYWALL_STATE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() - obj.savedAt > 7 * 86400000) {
      localStorage.removeItem(PAYWALL_STATE_KEY);
      return null;
    }
    return obj;
  } catch(e) { return null; }
}

function clearSaved() {
  try { localStorage.removeItem(PAYWALL_STATE_KEY); } catch(e) {}
}

// ---- 工具 ----
function hashParams(p) {
  var s = [p.year, p.month, p.day, p.hour, p.gender].join('|');
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'bz_' + Math.abs(h).toString(36);
}

function getBaziParamsFromURL() {
  var q = new URLSearchParams(window.location.search);
  return {
    year: parseInt(q.get('year')),
    month: parseInt(q.get('month')),
    day: parseInt(q.get('day')),
    hour: parseInt(q.get('hour')),
    gender: q.get('gender')
  };
}
