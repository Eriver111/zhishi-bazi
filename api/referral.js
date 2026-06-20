/**
 * /api/referral - 分享奖励
 * GET ?ref=xxx&visitor=yyy → 给 referrer 加 1 次免费额度
 */
const { getSupabase } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const ref = (req.query && req.query.ref) || '';
    const visitor = (req.query && req.query.visitor) || '';

    if (!ref || !visitor) return res.status(400).json({ error: '缺少参数' });
    // 不能自己邀请自己
    if (ref === visitor) return res.status(200).json({ success: false, reason: 'self' });

    const db = getSupabase();
    const key = 'ref_' + ref + '_' + visitor;

    if (db) {
      // 检查是否已使用过
      const { data: existing } = await db.from('free_credits_log').select('*').eq('identifier', key).single();
      if (existing) return res.status(200).json({ success: false, reason: 'used' });

      // 记录使用
      await db.from('free_credits_log').insert({ identifier: key, used_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

      // 给 referrer 加额度：在其 free_credits_log 中减 1（因为 trackFreeUsage 是加计数，我们反向减）
      const { data: refData } = await db.from('free_credits_log').select('*').eq('identifier', ref).single();
      if (refData && refData.used_count > 0) {
        await db.from('free_credits_log').update({ used_count: refData.used_count - 1, updated_at: new Date().toISOString() }).eq('identifier', ref);
      }
    }

    return res.status(200).json({ success: true, message: '分享成功，已获得1次额外提问机会！' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};