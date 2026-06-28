/**
 * GET /api/auth/stats?key=ADMIN_KEY
 * 查看注册用户数等统计数据
 */
const { getSupabase } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var key = (req.query && req.query.key) || '';
    var adminKey = process.env.ADMIN_KEY || 'zhishi-admin-2026';
    if (key !== adminKey) return res.status(403).json({ error: '无权访问' });

    var db = getSupabase();
    if (!db) return res.status(500).json({ error: '数据库不可用' });

    // 注册用户数
    var { count: userCount } = await db.from('users').select('*', { count: 'exact', head: true });
    // 已激活兑换码数
    var { count: codeCount } = await db.from('user_credits').select('*', { count: 'exact', head: true });
    // 月度会员数
    var { data: subs } = await db.from('user_subscriptions').select('*').gte('expires_at', new Date().toISOString());
    var activeSubs = subs ? subs.length : 0;
    // 今日注册
    var today = new Date().toISOString().slice(0, 10);
    var { count: todayCount } = await db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today);
    // 总聊天消息
    var { count: chatCount } = await db.from('chat_history').select('*', { count: 'exact', head: true });

    return res.status(200).json({
      users: userCount || 0,
      today: todayCount || 0,
      codes: codeCount || 0,
      active_subscriptions: activeSubs,
      chat_messages: chatCount || 0
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
