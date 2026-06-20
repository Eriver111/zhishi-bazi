/**
 * /api/credits - 查询兑换码余额
 * GET ?code=xxx
 * 同时查次数表 + 订阅表，月会员返回 credits:-1
 */
const { getCreditsByCode, isMonthlyActive } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

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
