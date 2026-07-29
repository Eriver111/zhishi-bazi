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
    return /^https?:\/\/(?:www\.)?zpayz\.cn\/mapi\.php(?:[?#]|$)/i.test(clean(value));
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
    if (!qrContent && payUrl) qrContent = payUrl;

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
    image.alt = '支付宝付款二维码';
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

  return {
    isGatewayApiUrl: isGatewayApiUrl,
    renderQr: renderQr,
    resolvePayment: resolvePayment
  };
});
