/**
 * /api/credits - 查询兑换码余额
 * GET ?code=xxx
 * 同时查次数表 + 订阅表，月会员返回 credits:-1
 */
const { getCreditsByCode, isMonthlyActive } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ---- 批量生成推广兑换码（需密钥鉴权）----
  if (req.method === 'POST') {
    try {
      const { credits, action, key, batch, prefix } = req.body || {};
      if (action === 'generate') {
        // 鉴权
        const ADMIN_KEY = process.env.ADMIN_KEY || 'zhishi-admin-2026';
        if (key !== ADMIN_KEY) {
          return res.status(403).json({ error: '密钥错误，无权生成兑换码' });
        }
        const count = parseInt(credits) || 3;
        const batchSize = Math.min(parseInt(batch) || 1, 100); // 最多一次生成 100 个
        const codePrefix = prefix || ''; // 推广码不带 TEST 前缀
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const crypto = require('crypto');
        const { insertCredits } = require('../lib/supabase.js');
        const codes = [];
        const codeLen = 8;
        for (let j = 0; j < batchSize; j++) {
          const bytes = crypto.randomBytes(codeLen);
          let code = codePrefix;
          for (let i = 0; i < codeLen; i++) code += chars[bytes[i] % chars.length];
          await insertCredits(code, 'admin_' + Date.now().toString(36) + '_' + j, count);
          codes.push({ code, credits: count });
        }
        return res.status(200).json({
          generated: codes.length,
          codes: codes,
          message: '已生成 ' + codes.length + ' 个兑换码，每个 ' + count + ' 次'
        });
      }
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  try {
    const code = (req.query && req.query.code) || '';
    if (!code) return res.status(400).json({ error: '缺少兑换码' });

    // 1. 先查月度订阅
    const monthly = await isMonthlyActive(code);
    if (monthly) {
      return res.status(200).json({
        code, credits: -1,  // -1 = 月会员无限次
        is_monthly: true,
        expires_at: monthly.expires_at,
        subscription_active: true
      });
    }

    // 2. 再查次数表
    const credits = await getCreditsByCode(code);
    if (!credits) return res.status(404).json({ error: '兑换码不存在' });

    // 3. 如果次数为0，也查一下是否有已过期的月会员
    const expiredSub = await checkExpiredSubscription(code);

    return res.status(200).json({
      code: credits.code,
      credits: credits.credits,
      total_used: credits.total_used,
      is_monthly: false,
      // 提示：如果曾经是月会员但已过期
      was_monthly: !!expiredSub,
      expired_at: expiredSub ? expiredSub.expires_at : null
    });

  } catch (e) {
    console.error('查询余额失败:', e);
    return res.status(500).json({ error: '查询失败：' + e.message });
  }
};

async function checkExpiredSubscription(code) {
  try {
    const { getSupabase } = require('../lib/supabase.js');
    const db = getSupabase();
    if (!db) return null;
    const { data } = await db.from('user_subscriptions').select('*').eq('code', code)
      .order('expires_at', { ascending: false }).limit(1);
    if (data && data.length > 0 && new Date(data[0].expires_at) < new Date()) return data[0];
    return null;
  } catch(e) { return null; }
}
