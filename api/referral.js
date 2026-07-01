/**
 * /api/referral - 分享奖励 + 邀请码兑换
 * GET ?ref=xxx&visitor=yyy → 给 referrer 加 1 次免费额度（旧版）
 * POST {inviteCode} → 登录用户输入邀请码，双方各得积分
 */
const { getSupabase } = require('../lib/supabase.js');
const { requireAuth } = require('../lib/auth.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // === POST: 登录用户输入邀请码 ===
  if (req.method === 'POST') {
    try {
      var authUser = requireAuth(req);
      if (!authUser || !authUser.uid) return res.status(401).json({ error: '请先登录' });
      var myUid = authUser.uid;
      var myCode = myUid.substring(0,8);
      var inviteCode = (req.body && req.body.inviteCode || '').trim();

      if (!inviteCode || inviteCode.length < 4) return res.status(400).json({ error: '请输入有效的邀请码' });
      if (inviteCode === myCode) return res.status(400).json({ error: '不能输入自己的邀请码' });

      var db = getSupabase();
      if (db) {
        // 防重复
        var dupKey = 'inv_' + inviteCode + '_' + myUid;
        var { data: exist } = await db.from('free_credits_log').select('*').eq('identifier', dupKey).single();
        if (exist) return res.status(200).json({ success: false, reason: 'used', message: '你已经使用过这个邀请码了' });

        // 记录使用
        await db.from('free_credits_log').insert({ identifier: dupKey, used_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

        // 给被邀请人（当前用户）加额度
        var { data: myData } = await db.from('free_credits_log').select('*').eq('identifier', myUid).single();
        if (myData && myData.used_count > 0) {
          await db.from('free_credits_log').update({ used_count: myData.used_count - 2 }).eq('identifier', myUid);
        }

        // 给邀请人加额度
        var { data: refData } = await db.from('free_credits_log').select('*').eq('identifier', inviteCode).single();
        if (refData && refData.used_count > 0) {
          await db.from('free_credits_log').update({ used_count: refData.used_count - 2 }).eq('identifier', inviteCode);
        }

        return res.status(200).json({ success: true, message: '邀请码兑换成功！你和邀请人各获得 2 次积分。' });
      }
      return res.status(200).json({ success: true, message: '兑换成功（离线模式）' });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // === GET: 旧版分享链接 ===
  try {
    const ref = (req.query && req.query.ref) || '';
    const visitor = (req.query && req.query.visitor) || '';
    if (!ref || !visitor) return res.status(400).json({ error: '缺少参数' });
    if (ref === visitor) return res.status(200).json({ success: false, reason: 'self' });

    const db = getSupabase();
    if (!global._refLog) global._refLog = {};
    const memKey = ref + "_" + visitor;
    if (global._refLog[memKey]) return res.status(200).json({ success: false, reason: "used" });
    global._refLog[memKey] = true;
    const key = 'ref_' + ref + '_' + visitor;

    if (db) {
      const { data: existing } = await db.from('free_credits_log').select('*').eq('identifier', key).single();
      if (existing) return res.status(200).json({ success: false, reason: 'used' });
      await db.from('free_credits_log').insert({ identifier: key, used_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      const { data: refData } = await db.from('free_credits_log').select('*').eq('identifier', ref).single();
      if (refData && refData.used_count > 0) {
        await db.from('free_credits_log').update({ used_count: refData.used_count - 2, updated_at: new Date().toISOString() }).eq('identifier', ref);
      }
    }
    return res.status(200).json({ success: true, message: '分享成功，已获得1次额外提问机会！' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};