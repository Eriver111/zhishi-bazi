const { get } = require('../lib/payment-order-store.js');
const { isWechatOrder } = require('../lib/wechat-orders.js');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const id = (req.query || {}).order;
    if (!isWechatOrder(id)) return res.status(400).send('无效订单');
    const order = await get(id);
    if (!order || !/^\/(?:pricing\?|result\.html\?|hepan-result\.html(?:\?|$))/.test(order.return_path) ||
        /[\r\n\\]/.test(order.return_path)) return res.status(404).send('订单不存在');
    // Redirect only. Entitlements are granted exclusively by the verified callback.
    res.setHeader('Location', order.return_path);
    return res.status(302).send('');
  } catch (_) { return res.status(503).send('订单暂时无法读取，请返回网站刷新支付状态'); }
};
