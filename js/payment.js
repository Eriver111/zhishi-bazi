/**
 * 支付模块 - zpayz 支付集成
 * 5元 = 5次提问
 */

const PAY_CONFIG = {
  apiUrl: '/api/create-order',
  checkUrl: '/api/check-order',
  price: 5,
  productName: 'AI命理咨询·5次提问'
};

/**
 * 发起支付 - 创建订单并跳转支付页面
 */
async function startPayment() {
  try {
    showToast('正在创建订单...', 'info');

    const resp = await fetch(PAY_CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'ai-chat',
        money: PAY_CONFIG.price,
        name: PAY_CONFIG.productName
      })
    });

    const data = await resp.json();

    if (data.error) {
      showToast('创建订单失败: ' + data.error, 'error');
      return;
    }

    closeModal('modalBuy');

    if (data.pay_url) {
      // 存储订单号用于后续轮询
      localStorage.setItem('pendingOrderId', data.out_trade_no);
      // 跳转到支付页面
      window.location.href = data.pay_url;
    } else if (data.qrcode) {
      // 如果有二维码（某些支付方式），显示二维码
      showQRCodeModal(data);
    } else {
      showToast('订单已创建，请完成支付', 'info');
      // 开始轮询
      startPolling(data.out_trade_no);
    }
  } catch (e) {
    console.error('支付请求失败:', e);
    showToast('网络错误，请重试', 'error');
  }
}

/**
 * 轮询检查支付状态
 */
function startPolling(outTradeNo) {
  let attempts = 0;
  const maxAttempts = 60; // 最多轮询 2 分钟

  const poll = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(poll);
      showToast('支付超时，如已付款请联系客服', 'error');
      return;
    }

    try {
      const resp = await fetch(PAY_CONFIG.checkUrl + '?out_trade_no=' + outTradeNo);
      const data = await resp.json();

      if (data.paid) {
        clearInterval(poll);
        localStorage.removeItem('pendingOrderId');
        // 激活成功
        handlePaymentSuccess(data.code, data.credits);
      }
    } catch (e) {
      console.error('轮询失败:', e);
    }
  }, 2000);
}

/**
 * 支付成功处理
 */
function handlePaymentSuccess(code, credits) {
  // 保存兑换码和次数
  if (code) {
    localStorage.setItem('bazi_code', code);
    updateCreditsDisplay(credits || 5);
    showCodeModal(code);
  }
  enableChat();
}

/**
 * 显示兑换码模态框（动态创建 + 醒目警告）
 */
function showCodeModal(code) {
  // 如果弹窗 HTML 不存在，动态创建
  if (!document.getElementById('modalCode')) {
    var overlay = document.createElement('div');
    overlay.id = 'modalCode';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.85);align-items:center;justify-content:center';
    overlay.innerHTML =
      '<div style="background:linear-gradient(180deg,#111320 0%,#0d1525 100%);border:2px solid rgba(201,168,76,.3);border-radius:16px;padding:32px 28px 24px;text-align:center;max-width:400px;width:90%;position:relative;box-shadow:0 0 60px rgba(201,168,76,.15)">' +
        '<button onclick="document.getElementById(\'modalCode\').remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--tx2);font-size:22px;cursor:pointer">&times;</button>' +
        '<div style="font-size:40px;margin-bottom:8px">🧧</div>' +
        '<h3 id="modalCodeTitle" style="color:var(--gold-l);font-size:20px;font-weight:900;margin-bottom:4px;letter-spacing:2px">激活成功</h3>' +
        '<p id="modalCodeDesc" style="color:var(--tx2);font-size:13px;margin-bottom:16px;line-height:1.6">你的兑换码（可用于恢复次数）：</p>' +
        '<div style="background:rgba(201,168,76,.08);border:2px dashed rgba(201,168,76,.3);border-radius:10px;padding:14px 16px;margin-bottom:12px">' +
          '<span id="modalCodeValue" style="font-size:28px;font-weight:900;color:#e8d070;letter-spacing:4px;font-family:monospace;word-break:break-all">' + code + '</span>' +
        '</div>' +
        '<p style="color:#e07050;font-size:14px;font-weight:700;margin-bottom:16px;line-height:1.5">⚠️ 请立即截图或复制兑换码<br><span style="font-size:12px;color:#c99">关闭此窗口后将无法找回！</span></p>' +
        '<div style="display:flex;gap:10px">' +
          '<button onclick="(function(){var c=document.getElementById(\'modalCodeValue\').textContent;navigator.clipboard.writeText(c).then(function(){alert(\'✅ 兑换码已复制！\\n\\n请粘贴到安全的地方保存。\')})})()" style="flex:1;padding:14px 20px;font-size:16px;font-weight:700;background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.1));color:#e8d070;border:1px solid rgba(201,168,76,.4);border-radius:10px;cursor:pointer;letter-spacing:2px;font-family:inherit">📋 复制兑换码</button>' +
          '<button onclick="document.getElementById(\'modalCode\').remove()" style="flex:1;padding:14px 20px;font-size:14px;font-weight:600;background:rgba(255,255,255,.04);color:var(--tx2);border:1px solid rgba(255,255,255,.1);border-radius:10px;cursor:pointer;letter-spacing:2px;font-family:inherit">我知道了</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    return;
  }

  // 已有 HTML（兼容旧版页面）
  document.getElementById('modalCodeValue').textContent = code;
  document.getElementById('modalCodeTitle').textContent = '🧧 激活成功';
  document.getElementById('modalCodeDesc').textContent = '你的兑换码（可用于恢复次数）：';
  showModal('modalCode');
}

/**
 * 手动兑换码
 */
async function redeemCode() {
  const input = document.getElementById('redeemCodeInput');
  const code = input.value.trim();

  if (!code) {
    showToast('请输入兑换码', 'error');
    return;
  }

  try {
    const resp = await fetch('/api/credits?code=' + encodeURIComponent(code));
    const data = await resp.json();

    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    if (data.credits > 0) {
      localStorage.setItem('bazi_code', code);
      updateCreditsDisplay(data.credits);
      enableChat();
      showToast('兑换成功！剩余 ' + data.credits + ' 次', 'success');
      closeModal('modalRedeem');
    } else {
      showToast('该兑换码次数已用完', 'error');
    }
  } catch (e) {
    showToast('网络错误，请重试', 'error');
  }
}

/**
 * 检查兑换码余额
 */
async function checkCredits(code) {
  if (!code) return 0;
  try {
    const resp = await fetch('/api/credits?code=' + encodeURIComponent(code));
    const data = await resp.json();
    return data.credits || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 页面加载时恢复状态
 */
async function restoreSession() {
  // 检查 URL 参数中的订单号（支付回调返回时）
  const urlParams = new URLSearchParams(window.location.search);
  const outTradeNo = urlParams.get('out_trade_no');

  if (outTradeNo) {
    // 清理 URL 参数
    window.history.replaceState({}, document.title, window.location.pathname);
    startPolling(outTradeNo);
    return;
  }

  // 检查本地存储的订单号（从支付页面返回时）
  const pendingOrderId = localStorage.getItem('pendingOrderId');
  if (pendingOrderId) {
    startPolling(pendingOrderId);
    return;
  }

  // 检查本地存储的兑换码
  const savedCode = localStorage.getItem('bazi_code');
  if (savedCode) {
    const credits = await checkCredits(savedCode);
    if (credits > 0) {
      updateCreditsDisplay(credits);
      enableChat();
    } else {
      // 次数已用完
      updateCreditsDisplay(0);
    }
  }
}
