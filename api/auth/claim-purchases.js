const { requireAuth } = require('../../lib/auth.js');
const { verify } = require('../../lib/purchase-proof.js');
const store = require('../../lib/payment-order-store.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = requireAuth(req);
  if (!user || !user.uid) return res.status(401).json({ error: '请先登录' });
  const receipts = (req.body || {}).receipts;
  if (!Array.isArray(receipts) || receipts.length > 50) return res.status(400).json({ error: '购买凭证无效' });
  const results = [];
  try {
    for (const receipt of receipts) {
      if (!verify(receipt, process.env.XUNHU_APPSECRET)) {
        results.push({ order_id: receipt && receipt.order_id, status: 'invalid' });
        continue;
      }
      results.push({ order_id: receipt.order_id, status: await store.claim(receipt.order_id, user.uid) });
    }
    return res.status(200).json({ results });
  } catch (_) {
    // Never acknowledge a failed transaction: the client retains the receipt for retry.
    return res.status(503).json({ error: '购买记录暂未同步，请稍后重试，不需要重新购买' });
  }
};
