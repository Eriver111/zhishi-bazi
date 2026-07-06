/**
 * /api/check-order.js — 前端轮询支付状态
 * 支持：排盘报告 / 合盘 / AI 积分包 / 月会员
 * v3.1: 增加文件降级恢复，解决 Supabase 故障时兑换码丢失问题
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getCreditsByOrderId } = require('../lib/supabase.js');

const PAY_PID = process.env.PAY_PID || '';
const PAY_KEY = process.env.PAY_KEY || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi';
const FALLBACK_DIR = path.join(__dirname, '..', '.fallback-codes');

/** 从文件降级存储中尝试恢复兑换码 */
function recoverFromFallback(orderId) {
  try {
    const safeName = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(FALLBACK_DIR, safeName + '.json');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.code) {
      console.log('[check-order] 从文件降级恢复兑换码:', orderId, '→', data.code);
      return {
        code: data.code,
        credits: data.type === 'monthly' ? -1 : (data.credits || 5),
        _type: data.type === 'monthly' ? 'monthly' : 'credits',
        _fromFallback: true
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const orderId = (req.query && (req.query.orderId || req.query.out_trade_no)) || '';

    if (!orderId) return res.status(400).json({ error: '缺少 orderId' });

    // ---- v3.0 AI 积分订单：查 Supabase + 文件降级 ----
    const isCreditOrder = orderId.startsWith('aichat_') ||
      orderId.startsWith('credit_') ||
      orderId.startsWith('credit3_') ||
      orderId.startsWith('credit10_') ||
      orderId.startsWith('credit20_') ||
      orderId.startsWith('monthly_');

    if (isCreditOrder) {
      // 1. 优先查 Supabase
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

      // 2. Supabase 未查到 → 查文件降级存储（Supabase 故障时的保底恢复）
      const fallback = recoverFromFallback(orderId);
      if (fallback) {
        return res.status(200).json({
          paid: true,
          code: fallback.code,
          credits: fallback.credits,
          _type: fallback._type,
          status: 'paid',
          _recovered: true
        });
      }

      return res.status(200).json({ paid: false, status: 'pending' });
    }

    // ---- 原有逻辑：查询 zpayz (bazi/hepan/rpt 订单) ----
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
