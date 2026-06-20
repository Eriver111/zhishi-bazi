/**
 * /api/check-order.js — 前端轮询支付状态
 * 支持：排盘报告 / 合盘 / AI 命理咨询
 */
const crypto = require('crypto');
const { getCreditsByOrderId } = require('../lib/supabase.js');

const PAY_PID = process.env.PAY_PID || '';
const PAY_KEY = process.env.PAY_KEY || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const orderId = (req.query && (req.query.orderId || req.query.out_trade_no)) || '';

    if (!orderId) return res.status(400).json({ error: '缺少 orderId' });

    // ---- v3.0 AI 付费订单：查 Supabase ----
    if (orderId.startsWith('aichat_') || orderId.startsWith('credit_') || orderId.startsWith('monthly_')) {
      const credits = await getCreditsByOrderId(orderId);
      if (credits) {
        return res.status(200).json({
          paid: true,
          code: credits.code,
          credits: credits.credits,
          _type: credits._type || 'credits',
          status: 'paid'
        });
      }
      return res.status(200).json({ paid: false, status: 'pending' });
    }

    // ---- 原有逻辑：查询 zpayz ----
    const queryUrl = 'https://zpayz.cn/api.php?act=order&pid=' + PAY_PID
      + '&key=' + PAY_KEY
      + '&out_trade_no=' + encodeURIComponent(orderId);

    const payResp = await fetch(queryUrl);
    const text = await payResp.text();
    let data = {};
    try { data = JSON.parse(text); } catch (e) { /* ignore */ }

    if (data.status === 1) {
      const bzHash = orderId.includes('_') ? orderId.split('_').pop() : 'unknown';
      const token = signToken(orderId, bzHash);
      return res.status(200).json({ orderId, status: 'paid', token });
    }

    return res.status(200).json({ orderId, status: 'pending' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function signToken(orderId, bzHash) {
  const payload = { oid: orderId, bh: bzHash, exp: Date.now() + 7 * 86400000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadStr).digest('hex').slice(0, 16);
  return 'tk_' + payloadStr + '.' + sig;
}
