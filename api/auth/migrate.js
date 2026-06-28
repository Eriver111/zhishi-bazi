/**
 * POST /api/auth/migrate
 * Headers: Authorization: Bearer <token>
 * Body: { codes, reports, bazi_params, free_id, bound_phone }
 */
const { requireAuth } = require('../../lib/auth.js');
const { linkCodeToUser, syncUserData, getSupabase } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var user = requireAuth(req);
    if (!user) return res.status(401).json({ error: '未登录' });

    var body = req.body || {};
    var migrated = { codes: 0, reports: 0, params: false, free_usage: false };

    // 1. 关联兑换码
    if (body.codes && Array.isArray(body.codes)) {
      for (var i = 0; i < body.codes.length; i++) {
        var code = body.codes[i];
        if (code && typeof code === 'string' && code.length >= 4) {
          try { await linkCodeToUser(code, user.uid); migrated.codes++; } catch (e) {}
        }
      }
    }

    // 2. 同步报告解锁状态
    if (body.reports) {
      var reports = body.reports;
      if (reports.bazi_rpt) {
        try {
          await syncUserData(user.uid, 'bazi_rpt', typeof reports.bazi_rpt === 'string' ? reports.bazi_rpt : JSON.stringify(reports.bazi_rpt));
          migrated.reports++;
        } catch (e) {}
      }
      if (reports.hepan_rpt) {
        try {
          await syncUserData(user.uid, 'hepan_rpt', typeof reports.hepan_rpt === 'string' ? reports.hepan_rpt : JSON.stringify(reports.hepan_rpt));
          migrated.reports++;
        } catch (e) {}
      }
    }

    // 3. 排盘参数
    if (body.bazi_params) {
      try {
        var bp = typeof body.bazi_params === 'string' ? body.bazi_params : JSON.stringify(body.bazi_params);
        await syncUserData(user.uid, 'last_bazi_params', bp);
        migrated.params = true;
      } catch (e) {}
    }

    // 4. 免费使用记录迁移
    if (body.free_id) {
      try {
        var db = getSupabase();
        if (db) {
          await db.from('free_credits_log').update({ user_id: user.uid }).eq('identifier', body.free_id).is('user_id', null);
          migrated.free_usage = true;
        }
      } catch (e) {}
    }

    // 5. 手机绑定
    if (body.bound_phone) {
      try {
        var db2 = getSupabase();
        if (db2) {
          await db2.from('phone_bindings').update({ user_id: user.uid }).eq('phone', body.bound_phone).is('user_id', null);
        }
      } catch (e) {}
    }

    // 6. 已有的 ai_chat_code 也关联
    if (body.ai_chat_code) {
      try { await linkCodeToUser(body.ai_chat_code, user.uid); migrated.codes++; } catch (e) {}
    }

    return res.status(200).json({ success: true, migrated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
