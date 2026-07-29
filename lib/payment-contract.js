const crypto = require('crypto');

const CREDIT_PRODUCTS = [
  { prefix: 'credit3_', amount: 4.9, credits: 3, type: 'credits' },
  { prefix: 'credit10_', amount: 9.9, credits: 10, type: 'credits' },
  { prefix: 'credit20_', amount: 14.9, credits: 20, type: 'credits' },
  { prefix: 'credit_', amount: 9.9, credits: 10, type: 'credits' },
  { prefix: 'aichat_', amount: 5, credits: 5, type: 'credits' },
  { prefix: 'monthly_', amount: 29.9, days: 30, type: 'monthly' }
];

const REPORT_PRODUCTS = [
  { prefix: 'bazi_', amount: 9.9, type: 'bazi' },
  { prefix: 'hepan_', amount: 13.9, type: 'hepan' }
];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeGatewayPayment(data) {
  data = data && typeof data === 'object' ? data : {};
  const payUrl = nonEmptyString(data.payurl) || nonEmptyString(data.qrcode);
  const qrContent = nonEmptyString(data.qrcode) || nonEmptyString(data.payurl);
  const qrImage = nonEmptyString(data.img);
  return { payUrl, qrContent, qrImage };
}

function paymentResponseFields(data) {
  const normalized = normalizeGatewayPayment(data);
  return {
    pay_url: normalized.payUrl,
    qr_content: normalized.qrContent,
    qr_image: normalized.qrImage,
    // Keep the documented gateway meaning for older clients.
    qrcode: normalized.qrContent
  };
}

function getClientIp(req) {
  const headers = (req && req.headers) || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const firstForwarded = String(forwarded).split(',')[0].trim();
  return firstForwarded ||
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) ||
    '127.0.0.1';
}

function getDevice(req) {
  const headers = (req && req.headers) || {};
  const userAgent = String(headers['user-agent'] || headers['User-Agent'] || '');
  return /Android|iPhone|iPad|iPod|webOS/i.test(userAgent) ? 'mobile' : 'pc';
}

function signingString(params) {
  return Object.keys(params || {})
    .filter(key => key !== 'sign' && key !== 'sign_type')
    .filter(key => params[key] !== '' && params[key] !== null && params[key] !== undefined)
    .sort()
    .map(key => key + '=' + params[key])
    .join('&');
}

function md5Sign(params, key) {
  return crypto.createHash('md5').update(signingString(params) + key).digest('hex');
}

function isSuccessfulGatewayStatus(data) {
  return !!data && (String(data.status) === '1' || data.trade_status === 'TRADE_SUCCESS');
}

function getCreditProduct(orderId) {
  const id = String(orderId || '');
  return CREDIT_PRODUCTS.find(product => id.startsWith(product.prefix)) || null;
}

function getReportProduct(orderId) {
  const id = String(orderId || '');
  return REPORT_PRODUCTS.find(product => id.startsWith(product.prefix)) || null;
}

function getOrderUserId(orderId) {
  const match = String(orderId || '').match(/_u(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

function isExpectedAmount(product, money) {
  if (!product) return false;
  const actual = Number(money);
  return Number.isFinite(actual) && Math.abs(actual - product.amount) < 0.001;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += chars[bytes[index] % chars.length];
  }
  return code;
}

module.exports = {
  generateCode,
  getClientIp,
  getCreditProduct,
  getDevice,
  getOrderUserId,
  getReportProduct,
  isExpectedAmount,
  isSuccessfulGatewayStatus,
  md5Sign,
  normalizeGatewayPayment,
  paymentResponseFields,
  signingString
};
