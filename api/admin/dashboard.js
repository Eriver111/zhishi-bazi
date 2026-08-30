const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getSupabase } = require('../../lib/supabase.js');

const ALLOWED_RANGES = new Set([7, 30, 90]);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: '仅支持读取数据' });

  const configuredKey = readConfiguredKey();
  if (!configuredKey) return res.status(503).json({ ok: false, error: '后台管理密钥尚未配置' });
  const suppliedKey = String((req.headers && req.headers['x-admin-key']) || '');
  if (!sameSecret(suppliedKey, configuredKey)) {
    return res.status(403).json({ ok: false, error: '管理密钥不正确' });
  }

  const db = getSupabase();
  if (!db) return res.status(503).json({ ok: false, error: '数据库暂时不可用' });

  const range = ALLOWED_RANGES.has(Number(req.query && req.query.range))
    ? Number(req.query.range) : 30;
  const now = new Date();
  const today = new Date(chinaDay(now) + 'T00:00:00+08:00');
  const since = new Date(today.getTime() - (range - 1) * 86400000);
  const warnings = [];

  try {
    const results = await Promise.all([
      safe('用户总数', () => db.from('users').select('*', { count: 'exact', head: true }), warnings),
      safe('今日注册', () => db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()), warnings),
      safe('用户趋势', () => db.from('users').select('created_at').gte('created_at', since.toISOString()).limit(10000), warnings),
      safe('最近用户', () => db.from('users').select('id,email,phone,created_at').order('created_at', { ascending: false }).limit(40), warnings),
      safe('积分汇总', () => db.from('user_credits').select('credits,total_used,user_id,created_at').limit(10000), warnings),
      safe('积分记录', () => db.from('user_credits').select('id,credits,total_used,user_id,order_id,channel,created_at').order('created_at', { ascending: false }).limit(50), warnings),
      safe('有效会员', () => db.from('user_subscriptions').select('*', { count: 'exact', head: true }).gte('expires_at', now.toISOString()), warnings),
      safe('会员记录', () => db.from('user_subscriptions').select('id,user_id,order_id,channel,starts_at,expires_at,created_at').order('created_at', { ascending: false }).limit(40), warnings),
      safe('AI消息总量', () => db.from('chat_history').select('*', { count: 'exact', head: true }), warnings),
      safe('AI消息趋势', () => db.from('chat_history').select('created_at,role,mode').gte('created_at', since.toISOString()).limit(10000), warnings),
      safe('AI会话', () => db.from('ai_conversations').select('id,user_id,mode,title,created_at,updated_at').order('updated_at', { ascending: false }).limit(40), warnings),
      safe('命盘校对质量', () => db.from('chart_calibration_events').select('event_year,domain,mechanism_key,options,selected_option,answer,match_level,actual_year,answered_at').gte('answered_at', since.toISOString()).limit(10000), warnings),
      safe('深度报告汇总', () => db.from('report_orders').select('amount,status,created_at,paid_at').limit(10000), warnings),
      safe('深度报告订单', () => db.from('report_orders').select('order_id,user_id,report_type,label,amount,status,created_at,paid_at').order('created_at', { ascending: false }).limit(50), warnings),
      safe('访问统计', () => db.from('page_views').select('date,path,count').gte('date', chinaDay(since)).order('date', { ascending: true }).limit(10000), warnings),
      safe('用户反馈', () => db.from('feedback').select('id,message,contact,page,created_at').order('created_at', { ascending: false }).limit(50), warnings)
    ]);

    const [usersTotal, usersToday, signupRows, recentUsers, creditRows, recentCredits,
      activeMembers, subscriptions, chatsTotal, chatRows, conversations, calibrationEvents, reportSummary,
      reportOrders, pageViews, feedback] = results;

    const credits = creditRows.data || [];
    const reports = reportSummary.data || [];
    const recentReports = reportOrders.data || [];
    const paidReports = reports.filter(row => row.status === 'paid');
    const pendingReports = reports.filter(row => row.status === 'pending');
    const pvRows = pageViews.data || [];
    const chats = chatRows.data || [];
    const remainingCredits = sum(credits, 'credits');
    const usedCredits = sum(credits, 'total_used');
    const paidRevenue = paidReports.reduce((total, row) => total + finite(row.amount), 0);

    return res.status(200).json({
      ok: true,
      generated_at: now.toISOString(),
      range,
      summary: {
        total_users: usersTotal.count || 0,
        today_users: usersToday.count || 0,
        active_members: activeMembers.count || 0,
        total_ai_messages: chatsTotal.count || 0,
        range_ai_messages: chats.filter(row => row.role === 'user').length,
        credits_issued: remainingCredits + usedCredits,
        credits_used: usedCredits,
        credits_remaining: remainingCredits,
        orphan_credit_records: credits.filter(row => !row.user_id && finite(row.credits) > finite(row.total_used)).length,
        paid_reports: paidReports.length,
        pending_reports: pendingReports.length,
        known_report_revenue: Number(paidRevenue.toFixed(2)),
        range_page_views: sum(pvRows, 'count'),
        feedback_count: (feedback.data || []).length
      },
      trends: buildTrends(range, since, signupRows.data || [], chats, pvRows, reports),
      traffic: buildTraffic(pvRows),
      ai_modes: countBy(chats.filter(row => row.role === 'user'), row => row.mode || '未标记'),
      calibration_quality: buildCalibrationQuality(calibrationEvents.data || []),
      recent_users: (recentUsers.data || []).map(safeUser),
      credit_history: (recentCredits.data || []).map(row => ({
        id: row.id,
        user: shortId(row.user_id),
        credits: finite(row.credits),
        used: finite(row.total_used),
        order: maskToken(row.order_id),
        channel: row.channel || '直接购买',
        created_at: row.created_at
      })),
      subscriptions: (subscriptions.data || []).map(row => ({
        id: row.id,
        user: shortId(row.user_id),
        order: maskToken(row.order_id),
        channel: row.channel || '直接购买',
        starts_at: row.starts_at,
        expires_at: row.expires_at,
        active: !row.expires_at || new Date(row.expires_at) >= now
      })),
      report_orders: recentReports.map(row => ({
        order: maskToken(row.order_id),
        user: shortId(row.user_id),
        type: row.report_type,
        label: row.label,
        amount: finite(row.amount),
        status: row.status,
        created_at: row.created_at,
        paid_at: row.paid_at
      })),
      conversations: (conversations.data || []).map(row => ({
        id: shortId(row.id),
        user: shortId(row.user_id),
        mode: row.mode || 'bazi',
        title: row.title || '命理解读',
        created_at: row.created_at,
        updated_at: row.updated_at
      })),
      feedback: (feedback.data || []).map(row => ({
        id: row.id,
        message: row.message,
        contact: maskContact(row.contact),
        page: row.page || '/',
        created_at: row.created_at
      })),
      system: {
        database: 'connected',
        admin_mode: 'read-only',
        ai_configured: Boolean(process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY),
        node: process.version,
        uptime_seconds: Math.floor(process.uptime())
      },
      warnings
    });
  } catch (error) {
    console.error('[admin dashboard]', error);
    return res.status(500).json({ ok: false, error: '后台数据读取失败' });
  }
};

function readConfiguredKey() {
  const keyFile = process.env.ADMIN_KEY_FILE
    ? path.resolve(process.env.ADMIN_KEY_FILE)
    : path.join(__dirname, '..', '..', '.admin-key');
  try {
    const fileKey = fs.readFileSync(keyFile, 'utf8').trim();
    if (fileKey) return fileKey;
  } catch (_) { /* The environment variable remains a supported fallback. */ }
  return String(process.env.ADMIN_KEY || '').trim();
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function safe(label, factory, warnings) {
  try {
    const result = await factory();
    if (result && result.error) throw result.error;
    return result || { data: [], count: 0 };
  } catch (error) {
    warnings.push(label + '暂时不可读取');
    return { data: [], count: 0 };
  }
}

function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function sum(rows, key) { return rows.reduce((total, row) => total + finite(row[key]), 0); }
function chinaDay(date) { return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
function eventDay(value) {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : chinaDay(date);
}
function shortId(value) {
  const text = String(value == null ? '' : value);
  if (!text) return '游客';
  return text.length > 12 ? text.slice(0, 6) + '…' + text.slice(-4) : text;
}
function maskToken(value) {
  const text = String(value || '');
  if (!text) return '—';
  return text.length > 12 ? text.slice(0, 6) + '…' + text.slice(-4) : text;
}
function maskContact(value) {
  const text = String(value || '');
  if (!text) return '未留下';
  if (text.includes('@')) {
    const parts = text.split('@');
    return parts[0].slice(0, 2) + '***@' + parts[1];
  }
  return text.length > 7 ? text.slice(0, 3) + '****' + text.slice(-4) : text;
}
function safeUser(row) {
  return { id: shortId(row.id), email: maskContact(row.email), phone: maskContact(row.phone), created_at: row.created_at };
}
function countBy(rows, getter) {
  const map = {};
  rows.forEach(row => { const key = getter(row); map[key] = (map[key] || 0) + 1; });
  return Object.keys(map).sort((a, b) => map[b] - map[a]).map(name => ({ name, count: map[name] }));
}
function buildTrends(range, since, signups, chats, views, reports) {
  const map = {};
  for (let offset = 0; offset < range; offset++) {
    const date = new Date(since.getTime() + offset * 86400000);
    const key = chinaDay(date);
    map[key] = { date: key, users: 0, chats: 0, views: 0, reports: 0 };
  }
  signups.forEach(row => { const key = eventDay(row.created_at); if (map[key]) map[key].users++; });
  chats.filter(row => row.role === 'user').forEach(row => { const key = eventDay(row.created_at); if (map[key]) map[key].chats++; });
  views.forEach(row => { const key = eventDay(row.date); if (map[key]) map[key].views += finite(row.count); });
  reports.filter(row => row.status === 'paid').forEach(row => { const key = eventDay(row.paid_at); if (map[key]) map[key].reports++; });
  return Object.values(map);
}
function buildTraffic(rows) {
  const grouped = {};
  rows.forEach(row => { const path = row.path || '/'; grouped[path] = (grouped[path] || 0) + finite(row.count); });
  return Object.keys(grouped).map(path => ({ path, count: grouped[path] }))
    .sort((a, b) => b.count - a.count).slice(0, 30);
}

function buildCalibrationQuality(rows) {
  const answered = rows.filter(row => row.answer === 'yes' || row.answer === 'no');
  const confirmed = answered.filter(row => row.answer === 'yes');
  const exact = confirmed.filter(row => row.match_level === 'exact').length;
  const partial = confirmed.filter(row => row.match_level === 'partial').length;
  const shifted = confirmed.filter(row => Number.isInteger(Number(row.actual_year)) && Number(row.actual_year) !== Number(row.event_year)).length;
  const mechanisms = countBy(answered, row => {
    const options = Array.isArray(row.options) ? row.options : [];
    const picked = options.find(option => option && option.key === row.selected_option);
    return (picked && picked.mechanism_key) || row.mechanism_key || (row.domain + ':general');
  }).slice(0, 12);
  const domains = countBy(answered, row => row.domain || 'change').map(item => {
    const domainRows = answered.filter(row => (row.domain || 'change') === item.name);
    const hits = domainRows.filter(row => row.answer === 'yes').length;
    const hitRate = item.count ? Math.round(hits * 100 / item.count) : 0;
    const status = item.count < 30 ? '样本不足，只观察' : (item.count < 100 ? '已有趋势，继续积累' : (hitRate < 25 ? '命中偏低，建议人工复核' : '样本可用于人工调权'));
    return { name:item.name, count:item.count, hits, hit_rate:hitRate, status };
  });
  return { answered:answered.length, confirmed:confirmed.length, denied:answered.length-confirmed.length,
    exact, partial, shifted_years:shifted, hit_rate:answered.length ? Math.round(confirmed.length * 100 / answered.length) : 0,
    mechanisms, domains };
}
