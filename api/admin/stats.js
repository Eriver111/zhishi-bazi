/**
 * /api/admin/stats - 管理员统计
 * GET ?key=xxx 返回注册用户、付费、浏览量等数据
 */
const { getSupabase } = require('../lib/supabase.js');

const ADMIN_KEY = process.env.ADMIN_KEY || 'zhishi-admin-2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = (req.query && req.query.key) || '';
  if (key !== ADMIN_KEY) return res.status(403).json({ error: '密钥错误' });

  try {
    const db = getSupabase();
    if (!db) return res.status(500).json({ error: '数据库不可用' });

    // 并行查询所有统计
    const [
      userCount,
      todayUsers,
      creditStats,
      monthlyActive,
      chatCount,
      recentUsers,
      creditHistory,
      dailySignups,
      pageViews
    ] = await Promise.all([
      // 总注册用户
      db.from('users').select('*', { count: 'exact', head: true }),
      // 今日新注册
      db.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart()),
      // 积分销售统计
      db.from('user_credits').select('credits,total_used,created_at'),
      // 有效月度会员数
      db.from('user_subscriptions').select('*', { count: 'exact', head: true })
        .gte('expires_at', new Date().toISOString()),
      // 总提问数
      db.from('chat_history').select('*', { count: 'exact', head: true }),
      // 最近10个注册用户
      db.from('users').select('id,email,phone,created_at').order('created_at', { ascending: false }).limit(10),
      // 积分购买记录
      db.from('user_credits').select('code,credits,created_at,channel').order('created_at', { ascending: false }).limit(20),
      // 近7天每日注册数
      db.from('users').select('created_at').gte('created_at', daysAgo(7)),
      // 页面浏览量（from page_views table if exists, else empty）
      db.from('page_views').select('path,count,date').order('date', { ascending: false }).limit(100)
        .catch(() => ({ data: [], error: null }))
    ]);

    // 计算积分销售汇总
    var totalCreditsSold = 0;
    var totalUsed = 0;
    if (creditStats.data) {
      creditStats.data.forEach(function(r) {
        totalCreditsSold += (r.credits || 0);
        totalUsed += (r.total_used || 0);
      });
    }

    // 近7天每日注册
    var dailyMap = {};
    for (var i = 0; i < 7; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().slice(0,10)] = 0;
    }
    if (dailySignups.data) {
      dailySignups.data.forEach(function(u) {
        var day = (u.created_at || '').slice(0,10);
        if (dailyMap[day] !== undefined) dailyMap[day]++;
      });
    }
    var dailyArray = Object.keys(dailyMap).sort().map(function(k) {
      return { date: k, count: dailyMap[k] };
    });

    // 页面浏览统计
    var pvData = pageViews.data || [];
    var totalPV = pvData.reduce(function(s, r) { return s + (r.count || 0); }, 0);
    var todayPV = pvData.filter(function(r) { return r.date === new Date().toISOString().slice(0,10); })
      .reduce(function(s, r) { return s + (r.count || 0); }, 0);

    return res.status(200).json({
      total_users: userCount.count || 0,
      today_new_users: todayUsers.count || 0,
      total_credits_sold: totalCreditsSold,
      total_credits_used: totalUsed,
      monthly_active: monthlyActive.count || 0,
      total_chats: chatCount.count || 0,
      total_page_views: totalPV,
      today_page_views: todayPV,
      recent_users: recentUsers.data || [],
      credit_history: creditHistory.data || [],
      daily_signups: dailyArray,
      page_views: pvData.slice(0, 20)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function todayStart() {
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
