const crypto = require('crypto');

// This is a binding capability, not a payment confirmation or an auth token.
// Keep it out of URLs, cashier requests, polling responses and logs.
function signature(id, expires, secret) {
  if (!secret) throw new Error('Purchase proof unavailable');
  return crypto.createHmac('sha256', secret).update('guest-purchase-v1\n' + id + '\n' + expires).digest('hex');
}
function issue(id, secret, now = Date.now()) {
  if (!/^wx_[a-f0-9]{24}$/.test(id)) throw new Error('Invalid order');
  const expires = now + 48 * 60 * 60 * 1000;
  return { order_id: id, expires_at: expires, proof: signature(id, expires, secret) };
}
function verify(receipt, secret, now = Date.now()) {
  if (!receipt || !/^wx_[a-f0-9]{24}$/.test(receipt.order_id) ||
      !Number.isSafeInteger(receipt.expires_at) || receipt.expires_at <= now ||
      !/^[a-f0-9]{64}$/.test(receipt.proof || '') || !secret) return false;
  return crypto.timingSafeEqual(Buffer.from(receipt.proof, 'hex'),
    Buffer.from(signature(receipt.order_id, receipt.expires_at, secret), 'hex'));
}
module.exports = { issue, verify };
