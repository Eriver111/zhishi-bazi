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
 * 显示兑换码模态框
 */
function showCodeModal(code) {
  document.getElementById('modalCodeValue').textContent = code;
  document.getElementById('modalCodeTitle').textContent = '🧧 激活成功';
  document.getElementById('modalCodeDesc').textContent =
    '你的兑换码（请妥善保管，可用于恢复次数）：';
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
