/**
 * 合盘付费遮罩层逻辑（与 paywall.js 统一）
 * 付费板块: 相合相克, 相处密码, 未来三年, 宜忌指南
 * 一次付费永久解锁，13.9 元。
 */
var HEPAN_PAID_DRAWERS = ['hp-drawer-4', 'hp-drawer-5', 'hp-drawer-6', 'hp-drawer-7'];
var HEPAN_PAYWALL_KEY = 'hepan_paywall';
var HEPAN_PENDING_KEY = 'hepan_pending';
var HEPAN_API_BASE = '/api';
var HEPAN_POLL_INTERVAL = 3000;

var _hepanOrderId = null;
var _hepanHash = null;
var _hepanPollTimer = null;

// ═══ 初始化 ═══
function initHePanPaywall(p1, p2, relationType) {
  _hepanHash = hashHePanParams(p1, p2, relationType);

  // 1. 检查 localStorage 是否有有效解锁记录
  var saved = readHePanSaved();
  if (saved && saved.hepanHash === _hepanHash) {
    verifyHePanAndUnlock(saved.token);
    return;
  }

  // 2. 检查是否有待确认的支付订单（页面重载后恢复）
  var pending = recoverHePanPendingOrder();
  if (pending) {
    _hepanOrderId = pending.orderId;
    // hash 不一致说明参数变了，清除旧的
    if (pending.hepanHash !== _hepanHash) {
      clearHePanPendingOrder();
      showHePanPaywall();
      return;
    }
    resumeHePanPayment(pending.orderId);
    return;
  }

  // 3. 显示付费墙
  showHePanPaywall();
}

// ═══ hash ═══
function hashHePanParams(p1, p2, rel) {
  var k = [p1.dayGan, p1.dayZhi, p1.gender, p2.dayGan, p2.dayZhi, p2.gender, rel].join('|');
  var h = 0;
  for (var i = 0; i < k.length; i++) { h = ((h << 5) - h) + k.charCodeAt(i); h = h | 0; }
  return String(Math.abs(h));
}

// ═══ 显示/隐藏付费墙 ═══
function showHePanPaywall() {
  HEPAN_PAID_DRAWERS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var body = el.querySelector('.drawer-body');
    if (!body || body.querySelector('.paywall-overlay')) return;
    el.classList.add('hp-drawer-open');
    var title = el.querySelector('h2');
    var t = title ? title.textContent : '付费内容';
    var ov = document.createElement('div');
    ov.className = 'paywall-overlay';
    ov.innerHTML = '<div class="paywall-card"><div class="paywall-card-title">' + t + '</div>'
      + '<div class="paywall-card-sub">付费解锁 查看完整合盘报告</div>'
      + '<div class="paywall-price" style="margin-top:18px;margin-bottom:14px">'
      + '<span class="paywall-current">13.9 元</span>'
      + '<span class="paywall-one-time" style="display:block;font-size:10px;color:var(--text-dim);margin-top:2px">一次付费，永久解锁</span></div>'
      + '<button class="paywall-btn" onclick="startHePanPay()">解锁合盘报告</button></div>';
    body.classList.add('paywall-active');
    body.appendChild(ov);
  });
}

function hideHePanPaywall() {
  HEPAN_PAID_DRAWERS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var ov = el.querySelector('.paywall-overlay');
    if (ov) ov.remove();
    var body = el.querySelector('.drawer-body');
    if (body) body.classList.remove('paywall-active');
  });
}

function showHePanDownloadBtn() {
  var s = document.getElementById('scoreBanner');
  if (!s || s.querySelector('.hp-download-btn')) return;
  var b = document.createElement('div');
  b.className = 'hp-download-btn';
  b.style.cssText = 'margin-top:16px';
  b.innerHTML = '<button onclick="downloadHePanReport()" style="display:inline-block;padding:10px 28px;background:rgba(100,180,120,.12);border:1px solid rgba(100,180,120,.22);color:#7ec87e;font-size:14px;border-radius:10px;cursor:pointer;letter-spacing:2px">下载合盘报告 PDF</button>';
  s.appendChild(b);
}

// ═══ 开始支付（与 paywall.js startPay 统一） ═══
function startHePanPay() {
  if (_hepanOrderId) {
    // 已有订单，重新显示二维码
    showHePanQrModal(null, 13.9, true);
    return;
  }

  var btns = document.querySelectorAll('.paywall-btn');
  btns.forEach(function(b) { b.disabled = true; b.textContent = '创建订单中...'; });

  fetch(HEPAN_API_BASE + '/create-order.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 13.9, description: '知时合盘报告解锁', hash: _hepanHash })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data && data.orderId) {
      _hepanOrderId = data.orderId;
      // 保存待确认订单，防止页面重载后丢失
      saveHePanPendingOrder(_hepanOrderId, _hepanHash);
      var qr = data.qrcode || data.payUrl || '';
      showHePanQrModal(qr, 13.9, false);
      startHePanPolling();
    } else {
      alert('创建订单失败: ' + ((data && data.error) || '未知错误'));
      btns.forEach(function(b) { b.disabled = false; b.textContent = '解锁合盘报告'; });
    }
  })
  .catch(function(e) {
    alert('网络错误，请检查网络后重试');
    btns.forEach(function(b) { b.disabled = false; b.textContent = '解锁合盘报告'; });
  });
}

// ═══ 轮询支付状态（与 paywall.js startPolling 统一） ═══
function startHePanPolling() {
  stopHePanPolling();
  _hepanPollTimer = setInterval(function() {
    if (!_hepanOrderId) return;
    fetch(HEPAN_API_BASE + '/check-order.js?orderId=' + encodeURIComponent(_hepanOrderId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // paywall.js 用 data.status === 'paid'，保持一致
        if ((data && data.paid) || (data && data.status === 'paid')) {
          stopHePanPolling();
          clearHePanPendingOrder();
          var token = data.token || data.transactionId || _hepanOrderId;
          saveHePanState({ token: token, hepanHash: _hepanHash });
          hideHePanPaywall();
          showHePanDownloadBtn();
          closeHePanQrModal();
        }
      })
      .catch(function() {});
  }, HEPAN_POLL_INTERVAL);
}

function stopHePanPolling() {
  if (_hepanPollTimer) { clearInterval(_hepanPollTimer); _hepanPollTimer = null; }
}

// ═══ 支付成功后恢复（页面重载时） ═══
function resumeHePanPayment(orderId) {
  showHePanVerifying();
  var start = Date.now();
  var MAX = 25000;

  function poll() {
    fetch(HEPAN_API_BASE + '/check-order.js?orderId=' + encodeURIComponent(orderId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if ((data && data.paid) || (data && data.status === 'paid')) {
          clearHePanPendingOrder();
          hideHePanVerifying();
          var token = data.token || data.transactionId || orderId;
          saveHePanState({ token: token, hepanHash: _hepanHash });
          hideHePanPaywall();
          showHePanDownloadBtn();
        } else if (Date.now() - start > MAX) {
          hideHePanVerifying();
          showHePanPaywall();
        } else {
          setTimeout(poll, 2000);
        }
      })
      .catch(function() {
        if (Date.now() - start > MAX) {
          hideHePanVerifying();
          showHePanPaywall();
        } else {
          setTimeout(poll, 2000);
        }
      });
  }
  poll();
}

// ═══ 手动检查支付（循环重试） ═══
function checkHePanPaymentManually() {
  if (!_hepanOrderId) {
    // 尝试从 pending 恢复
    var p = recoverHePanPendingOrder();
    if (p) { _hepanOrderId = p.orderId; } else { alert('未找到订单，请重新创建'); return; }
  }
  resumeHePanPayment(_hepanOrderId);
}

// ═══ token 验证（与 paywall.js verifyAndUnlock 统一） ═══
function verifyHePanAndUnlock(token) {
  fetch(HEPAN_API_BASE + '/verify-token.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, baziHash: _hepanHash.slice(0, 6) })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data && data.valid) {
      hideHePanPaywall();
      showHePanDownloadBtn();
    } else {
      clearHePanSaved();
      showHePanPaywall();
    }
  })
  .catch(function() {
    // 网络不可用，信任本地状态
    hideHePanPaywall();
    showHePanDownloadBtn();
  });
}

// ═══ 二维码弹窗 ═══
function showHePanQrModal(qrUrl, amount, isReopen) {
  hideHePanQrModal();
  var qrSrc = qrUrl;
  if (qrUrl && qrUrl.indexOf('http') === 0) {
    qrSrc = 'https://api.quickchart.io/qr?size=220&text=' + encodeURIComponent(qrUrl);
  }
  var m = document.createElement('div');
  m.id = 'hepanQrModal';
  m.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7)" onclick="closeHePanQrModal()"></div>'
    + '<div style="position:relative;background:linear-gradient(180deg,#1a1a2e,#0f0f18);border:1px solid rgba(201,168,76,.18);border-radius:18px;padding:32px 28px 24px;width:90%;max-width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">'
    + '<div style="position:absolute;top:14px;right:18px;font-size:22px;color:rgba(255,255,255,.25);cursor:pointer;line-height:1" onclick="closeHePanQrModal()">✕</div>'
    + '<div style="font-size:20px;color:#e0c860;letter-spacing:4px;margin-bottom:6px">扫码支付</div>'
    + '<div style="font-size:28px;color:#e0c860;font-weight:900;letter-spacing:2px;margin-bottom:16px">￥' + amount + '</div>'
    + (qrSrc ? '<img src="' + qrSrc + '" style="width:200px;height:200px;border-radius:12px;border:1px solid rgba(255,255,255,.08);margin-bottom:14px" alt="二维码" onerror="this.outerHTML=\'<div style=\\\'width:200px;height:200px;margin:0 auto 14px;line-height:200px;color:rgba(200,180,120,.3);font-size:13px\\\'>二维码加载失败</div>\'">' : '<div style="width:200px;height:200px;margin:0 auto 14px;line-height:200px;color:rgba(200,180,120,.3);font-size:13px;border:1px dashed rgba(255,255,255,.06);border-radius:12px">二维码加载中…</div>')
    + '<div style="font-size:12px;color:rgba(180,170,150,.5);margin-bottom:12px">支付完成后将自动解锁全部合盘内容</div>'
    + '<button onclick="closeHePanQrModal();checkHePanPaymentManually()" style="display:inline-block;padding:8px 24px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;font-size:13px;border-radius:8px;cursor:pointer;letter-spacing:2px">我已付过款，刷新状态</button>'
    + '</div>';
  document.body.appendChild(m);
}

function closeHePanQrModal() { var m = document.getElementById('hepanQrModal'); if (m) m.remove(); }
function hideHePanQrModal() { closeHePanQrModal(); }

// ═══ "验证支付中"弹窗 ═══
function showHePanVerifying() {
  hideHePanVerifying();
  var m = document.createElement('div');
  m.id = 'hepanVerifyModal';
  m.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center';
  m.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div>'
    + '<div style="position:relative;background:linear-gradient(180deg,#1a1a2e,#0f0f18);border:1px solid rgba(201,168,76,.18);border-radius:18px;padding:36px 32px;width:90%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">'
    + '<div style="width:40px;height:40px;margin:0 auto 18px;border:3px solid rgba(224,200,96,.15);border-top-color:#e0c860;border-radius:50%;animation:hepan-spin .8s linear infinite"></div>'
    + '<div style="font-size:17px;color:#e0c860;letter-spacing:2px;margin-bottom:6px">正在确认支付</div>'
    + '<div style="font-size:12px;color:rgba(180,170,150,.4)">请稍候，支付状态确认中…</div></div>';
  document.body.appendChild(m);
}

function hideHePanVerifying() { var m = document.getElementById('hepanVerifyModal'); if (m) m.remove(); }

// ═══ localStorage ═══
function readHePanSaved() {
  try { var r = localStorage.getItem(HEPAN_PAYWALL_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}

function saveHePanState(obj) {
  try { localStorage.setItem(HEPAN_PAYWALL_KEY, JSON.stringify(obj)); } catch(e) {}
}

function clearHePanSaved() {
  try { localStorage.removeItem(HEPAN_PAYWALL_KEY); } catch(e) {}
}

function saveHePanPendingOrder(orderId, hepanHash) {
  try {
    localStorage.setItem(HEPAN_PENDING_KEY, JSON.stringify({ orderId: orderId, hepanHash: hepanHash, savedAt: Date.now() }));
  } catch(e) {}
}

function recoverHePanPendingOrder() {
  try {
    var r = localStorage.getItem(HEPAN_PENDING_KEY);
    if (!r) return null;
    var o = JSON.parse(r);
    if (Date.now() - o.savedAt > 900000) { localStorage.removeItem(HEPAN_PENDING_KEY); return null; }
    return o;
  } catch(e) { return null; }
}

function clearHePanPendingOrder() {
  try { localStorage.removeItem(HEPAN_PENDING_KEY); } catch(e) {}
}
