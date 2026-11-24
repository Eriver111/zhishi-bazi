const crypto = require('crypto');

function sign(params, secret) {
  const parts = Object.keys(params).filter(key => key !== 'hash')
    .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
    .sort().map(key => {
      if (!['string', 'number'].includes(typeof params[key])) throw new Error('Invalid signature field');
      return key + '=' + params[key];
    });
  return crypto.createHash('md5').update(parts.join('&') + secret, 'utf8').digest('hex');
}

function verify(params, secret) {
  if (!secret || !params || !/^[a-f0-9]{32}$/i.test(String(params.hash || ''))) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sign(params, secret), 'hex'), Buffer.from(params.hash, 'hex'));
  } catch (_) { return false; }
}

function orderMethod(id) {
  if (typeof id !== 'string') return null;
  if (/^wx_[a-f0-9]{24}$/.test(id)) return 'wechat';
  if (/^ali_[a-f0-9]{24}$/.test(id)) return 'alipay';
  return null;
}

function credentials(env, method) {
  const prefix = method === 'alipay' ? 'XUNHU_ALIPAY_' : 'XUNHU_';
  return {
    appid: String(env[prefix + 'APPID'] || '').trim(),
    secret: String(env[prefix + 'APPSECRET'] || '').trim()
  };
}

function config(env = process.env, method = 'wechat') {
  const { appid, secret } = credentials(env, method);
  const gatewayUrl = method === 'alipay' ? env.XUNHU_ALIPAY_API_URL : env.XUNHU_API_URL;
  if (!appid || !secret || !gatewayUrl) throw new Error('Payment configuration unavailable');
  const url = new URL(gatewayUrl.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid payment gateway');
  if (url.pathname === '/') url.pathname = '/payment/do.html';
  if (url.pathname !== '/payment/do.html') throw new Error('Invalid payment gateway path');
  return { appid, secret, url: url.href };
}

function moneyCents(value) {
  const text = String(value === undefined ? '' : value);
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function safeHttps(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch (_) { return ''; }
}

async function createPayment(order, site, env = process.env) {
  const method = order.payment_method;
  const cfg = config(env, method);
  const returnUrl = site + '/api/payment-return?order=' + order.order_id;
  const params = {
    version: '1.1', appid: cfg.appid, trade_order_id: order.order_id,
    total_fee: (order.amount_cents / 100).toFixed(2), title: order.title,
    time: Math.floor(Date.now() / 1000), nonce_str: crypto.randomBytes(16).toString('hex'),
    notify_url: site + '/api/payment-notify', return_url: returnUrl, callback_url: returnUrl
  };
  if (params.notify_url.length > 128 || returnUrl.length > 128) throw new Error('Payment return URL too long');
  params.hash = sign(params, cfg.secret);
  const response = await fetch(cfg.url, {
    method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(12000), redirect: 'error'
  });
  if (!response.ok) throw new Error('Payment gateway unavailable');
  const data = await response.json();
  if (String(data.errcode) !== '0' || !verify(data, cfg.secret)) throw new Error('Invalid gateway response');
  const payUrl = safeHttps(data.url);
  const qrImage = safeHttps(data.url_qrcode);
  if (!payUrl && !qrImage) throw new Error('Missing payment destination');
  return { pay_url: payUrl, qr_image: qrImage, qr_content: '', qrcode: '',
    payment_method: method, payment_provider: 'xunhu' };
}

module.exports = { sign, verify, config, credentials, orderMethod, moneyCents, createPayment };
