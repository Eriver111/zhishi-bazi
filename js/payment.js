(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PaymentFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function isGatewayApiUrl(value) {
    // An order-creation API is never a customer-facing cashier URL.
    // Check the endpoint shape without embedding any provider's hostname.
    return /^https?:\/\/[^/?#]+\/(?:[^?#]*\/)?mapi\.php(?:[?#]|$)/i.test(clean(value));
  }

  function isSafePaymentDestination(value) {
    var text = clean(value);
    return /^(?:https?:\/\/|alipays?:\/\/)/i.test(text) && !isGatewayApiUrl(text);
  }

  function isSafeImageUrl(value) {
    return /^https:\/\//i.test(clean(value));
  }

  function looksLikeImageUrl(value) {
    var text = clean(value);
    return isSafeImageUrl(text) && (
      /\.(?:png|jpe?g|gif|webp)(?:[?#]|$)/i.test(text) ||
      /\/qrcode\//i.test(text) ||
      /api\.quickchart\.io\/qr/i.test(text) ||
      /api\.qrserver\.com\/v1\/create-qr-code/i.test(text)
    );
  }

  function resolvePayment(data) {
    data = data && typeof data === 'object' ? data : {};
    var rawPayUrl = clean(data.pay_url);
    if (isGatewayApiUrl(rawPayUrl)) {
      return { payUrl: '', qrContent: '', qrImageUrl: '' };
    }

    var explicitImage = clean(data.qr_image || data.img);
    var legacyQr = clean(data.qrcode);
    var qrContent = clean(data.qr_content);
    var payUrl = isSafePaymentDestination(rawPayUrl) ? rawPayUrl : '';

    if (!qrContent && legacyQr && !looksLikeImageUrl(legacyQr)) qrContent = legacyQr;
    if (!payUrl && isSafePaymentDestination(qrContent)) payUrl = qrContent;
    if (!qrContent && payUrl && data.payment_method !== 'wechat') qrContent = payUrl;

    if (!isSafePaymentDestination(qrContent)) qrContent = '';

    var qrImageUrl = '';
    if (isSafeImageUrl(explicitImage)) {
      qrImageUrl = explicitImage;
    } else if (!data.qr_content && looksLikeImageUrl(legacyQr)) {
      qrImageUrl = legacyQr;
    } else if (qrContent) {
      qrImageUrl = 'https://api.quickchart.io/qr?size=220&text=' + encodeURIComponent(qrContent);
    }

    return { payUrl: payUrl, qrContent: qrContent, qrImageUrl: qrImageUrl };
  }

  function renderQr(container, data, options) {
    var resolved = resolvePayment(data);
    if (!container) return resolved;
    var size = options && options.size ? options.size : 200;
    var failureText = options && options.failureText
      ? options.failureText
      : '二维码加载失败，请稍后重试';

    container.replaceChildren();
    if (!resolved.qrImageUrl) {
      var unavailable = document.createElement('p');
      unavailable.textContent = '支付服务暂未返回可用二维码，请稍后重试';
      unavailable.style.cssText = 'color:#333;padding:20px;text-align:center;line-height:1.6';
      container.appendChild(unavailable);
      return resolved;
    }

    var image = document.createElement('img');
    image.src = resolved.qrImageUrl;
    image.alt = methodLabel(data) + '付款二维码';
    image.width = size;
    image.height = size;
    image.style.cssText = 'display:block;width:' + size + 'px;height:' + size + 'px;border-radius:8px';
    image.addEventListener('error', function() {
      container.replaceChildren();
      var failed = document.createElement('p');
      failed.textContent = failureText;
      failed.style.cssText = 'color:#333;padding:20px;text-align:center;line-height:1.6';
      container.appendChild(failed);
    }, { once: true });
    container.appendChild(image);
    return resolved;
  }

  function methodLabel(data) { return data && data.payment_method === 'wechat' ? '微信' : '支付宝'; }

  async function request(url, options) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 15000);
    try { return await fetch(url, Object.assign({}, options, { signal: controller.signal, cache: 'no-store' })); }
    finally { clearTimeout(timer); }
  }

  function chooseMethod(methods, preferred) {
    if (!methods.length) return Promise.reject(new Error('支付暂不可用，请稍后重试或联系客服'));
    if (methods.length === 1) return Promise.resolve(methods[0].id);
    return new Promise(function(resolve, reject) {
      var previous = document.activeElement;
      var dialog = document.createElement('dialog');
      dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:min(340px,90vw);padding:24px;border:1px solid var(--bd,#ddd);border-radius:18px;background:var(--zh-paper,#fffaf1);color:var(--tx,#342c24);box-shadow:0 16px 60px #0003';
      dialog.setAttribute('aria-label', '选择支付方式');
      var title = document.createElement('h3');
      title.textContent = '选择支付方式';
      title.style.cssText = 'margin:0 0 18px;font-size:18px';
      dialog.appendChild(title);
      function done(method) {
        dialog.close(); dialog.remove();
        if (previous && previous.focus) previous.focus();
        if (method) resolve(method); else reject(new Error('已取消支付'));
      }
      methods.sort(function(a, b) { return Number(b.id === preferred) - Number(a.id === preferred); }).forEach(function(method) {
        var button = document.createElement('button');
        button.type = 'button'; button.textContent = method.id === 'wechat' ? '微信支付' : '支付宝';
        button.style.cssText = 'display:block;width:100%;padding:14px;margin:10px 0;border:1px solid var(--bd,#ddd);border-radius:10px;background:var(--bg,#f4eee0);color:inherit;font:inherit;cursor:pointer';
        button.addEventListener('click', function() { done(method.id); });
        dialog.appendChild(button);
      });
      var cancel = document.createElement('button');
      cancel.textContent = '取消'; cancel.type = 'button';
      cancel.style.cssText = 'display:block;margin:14px auto 0;padding:8px 24px;background:none;border:0;color:inherit;font:inherit';
      cancel.addEventListener('click', function() { done(); }); dialog.appendChild(cancel);
      dialog.addEventListener('cancel', function(event) { event.preventDefault(); done(); });
      document.body.appendChild(dialog); dialog.showModal();
    });
  }

  async function createOrder(body) {
    var response = await request('/api/payment-methods');
    if (!response.ok) throw new Error('暂时无法获取支付方式，请稍后重试');
    var data = await response.json();
    var methods = Array.isArray(data.methods) ? data.methods.filter(function(m) { return m && (m.id === 'wechat' || m.id === 'alipay'); }) : [];
    var method = await chooseMethod(methods, data.default_method);
    var selected = methods.find(function(m) { return m.id === method; });
    if (method === 'wechat' && /MicroMessenger/i.test(navigator.userAgent) && selected.in_app_supported !== true) {
      throw new Error('请点击微信右上角“…”选择“在浏览器打开”，再进行付款');
    }
    var created = await request('/api/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, body, { payment_method: method })) });
    if (created.ok) {
      var order = await created.clone().json();
      if (order.purchase_receipt) {
        // Persist before exposing a payable link. Registration must survive leaving the cashier.
        if (typeof Auth === 'undefined' || !Auth.rememberPurchase) throw new Error('请刷新页面后重新发起支付');
        Auth.rememberPurchase(order.purchase_receipt);
      }
    }
    return created;
  }

  function openCashier(data) {
    var payment = resolvePayment(data);
    if (/Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) && payment.payUrl) {
      window.location.href = payment.payUrl; return;
    }
    if (!payment.qrImageUrl) throw new Error('支付服务未返回可用二维码，请稍后重试');
    var old = document.getElementById('paymentCashier'); if (old) old.remove();
    var dialog = document.createElement('dialog'); dialog.id = 'paymentCashier';
    dialog.setAttribute('aria-label', '扫码支付');
    dialog.style.cssText = 'position:fixed;inset:0;margin:auto;padding:24px;border:1px solid var(--bd,#ddd);border-radius:16px;background:var(--zh-paper,#fffaf1);color:var(--tx,#342c24);text-align:center';
    var title = document.createElement('p'); title.textContent = '请用' + methodLabel(data) + '扫码支付 ¥' + data.amount;
    dialog.appendChild(title);
    var qr = document.createElement('div'); qr.style.cssText = 'width:200px;margin:16px auto'; dialog.appendChild(qr);
    renderQr(qr, data);
    var note = document.createElement('p'); note.textContent = '支付后自动到账'; dialog.appendChild(note);
    var close = document.createElement('button'); close.textContent = '关闭'; close.type = 'button';
    close.style.cssText = 'padding:10px 26px;background:none;color:inherit;border:1px solid var(--bd,#ddd);border-radius:8px';
    close.addEventListener('click', function() { dialog.close(); }); dialog.appendChild(close);
    document.body.appendChild(dialog); dialog.showModal();
  }

  return {
    createOrder: createOrder,
    openCashier: openCashier,
    methodLabel: methodLabel,
    isGatewayApiUrl: isGatewayApiUrl,
    renderQr: renderQr,
    resolvePayment: resolvePayment
  };
});
