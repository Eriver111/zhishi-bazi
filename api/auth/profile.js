/**
 * GET /api/auth/profile
 * Headers: Authorization: Bearer <token>
 */
const { requireAuth } = require('../../lib/auth.js');
const { getUserById, getUserCredits, getUserData, getSupabase } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var user = requireAuth(req);
    if (!user) return res.status(401).json({ error: '未登录或登录已过期' });

    var profile = await getUserById(user.uid);
    if (!profile) return res.status(404).json({ error: '用户不存在' });

    var credits = await getUserCredits(user.uid);
    var userData = await getUserData(user.uid);

    // 检查月度会员
    var isMonthly = false;
    var monthlyExpires = null;
    var db = getSupabase();
    if (db) {
      var { data: subs } = await db.from('user_subscriptions')
        .select('*').eq('user_id', user.uid)
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false }).limit(1);
      if (subs && subs.length > 0) {
        isMonthly = true;
        monthlyExpires = subs[0].expires_at;
      }
    }

    // 报告解锁数
    var reportCount = 0;
    if (userData['bazi_rpt']) reportCount++;
    if (userData['hepan_rpt']) reportCount++;

    return res.status(200).json({
      id: profile.id,
      email: profile.email,
      phone: profile.phone,
      created_at: profile.created_at,
      credits: credits,
      is_monthly: isMonthly,
      monthly_expires: monthlyExpires,
      reports: reportCount
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
