const gateway = require('../lib/xunhu-payment.js');
const store = require('../lib/payment-order-store.js');
const { isWechatOrder } = require('../lib/wechat-orders.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).send('fail');
  try {
    const params = req.body || {};
    const cfg = gateway.config();
    if (String(params.appid) !== cfg.appid || !gateway.verify(params, cfg.secret)) return res.status(400).send('fail');
    if (!isWechatOrder(params.trade_order_id)) return res.status(400).send('fail');
    const order = await store.get(params.trade_order_id);
    const cents = gateway.moneyCents(params.total_fee);
    if (!order || order.provider !== 'xunhu' || order.payment_method !== 'wechat' ||
        order.provider_appid !== cfg.appid || cents !== order.amount_cents) return res.status(400).send('fail');
    // A return redirect or a refund notification can never unlock a purchase.
    if (params.status !== 'OD') return res.status(200).send('success');
    const transaction = String(params.open_order_id || params.transaction_id || '');
    if (!/^[a-zA-Z0-9_-]{1,96}$/.test(transaction)) return res.status(400).send('fail');
    await store.fulfill(order.order_id, cfg.appid, cents, transaction);
    return res.status(200).send('success');
  } catch (_) {
    // Non-success response makes the gateway retry; never acknowledge a lost entitlement.
    return res.status(503).send('fail');
  }
};
