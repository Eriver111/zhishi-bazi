/**
 * GET /api/channel-stats?ch=knowbazi&key=ADMIN_KEY
 * 渠道分成统计——给渠道商看的实时数据
 */
const { getSupabase } = require('../lib/supabase.js');

const COMMISSION = {
  'credit_3': 0.20,   // 4.9元体验包 → 20%
  'credit_10': 0.30,  // 9.9元进阶包 → 30%
  'credit_20': 0.35,  // 14.9元专业包 → 35%
  'monthly': 0.40,    // 29.9元月度会员 → 40%
  'renewal': 0.20     // 续费 → 20%
};

const PRICES = {
  'credit_3': 4.9, 'credit_10': 9.9, 'credit_20': 14.9, 'monthly': 29.9
};

function getTypeFromOrderId(oid) {
  if (!oid) return 'unknown';
  if (oid.startsWith('credit3_')) return 'credit_3';
  if (oid.startsWith('credit10_')) return 'credit_10';
  if (oid.startsWith('credit20_')) return 'credit_20';
  if (oid.startsWith('monthly_')) return 'monthly';
  if (oid.startsWith('credit_')) return 'credit_10';
  if (oid.startsWith('aichat_')) return 'credit_10';
  return 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var key = (req.query && req.query.key) || '';
  var adminKey = process.env.ADMIN_KEY || 'zhishi-admin-2026';
  if (key !== adminKey) return res.status(401).json({ error: 'key required' });

  var channel = (req.query && req.query.ch) || 'knowbazi';

  try {
    var db = getSupabase();
    if (!db) return res.json({ error: 'DB not available' });

    // 查询该渠道的积分订单
    var { data: credits } = await db.from('user_credits')
      .select('*').eq('channel', channel).order('created_at', { ascending: false }).limit(500);

    // 查询该渠道的月度会员
    var { data: subs } = await db.from('user_subscriptions')
      .select('*').eq('channel', channel).order('created_at', { ascending: false }).limit(200);

    var orders = [];
    var totalCommission = 0;
    var stats = { credit_3:0, credit_10:0, credit_20:0, monthly:0, renewal:0, total:0, gmv:0 };

    if (credits) {
      credits.forEach(function(c) {
        var type = getTypeFromOrderId(c.order_id);
        var price = PRICES[type] || 9.9;
        var rate = COMMISSION[type] || 0.25;
        var comm = +(price * rate).toFixed(2);
        totalCommission += comm;
        stats[type] = (stats[type]||0) + 1;
        stats.total++;
        stats.gmv += price;
        orders.push({ date: c.created_at, order_id: c.order_id, type: type, price: price, commission: comm, code: c.code });
      });
    }

    if (subs) {
      subs.forEach(function(s) {
        var type = 'monthly';
        var price = 29.9;
        var rate = COMMISSION.monthly;
        var comm = +(price * rate).toFixed(2);
        totalCommission += comm;
        stats.monthly = (stats.monthly||0) + 1;
        stats.total++;
        stats.gmv += price;
        orders.push({ date: s.created_at, order_id: s.order_id, type: 'monthly', price: price, commission: comm, code: s.code });
      });
    }

    orders.sort(function(a,b) { return (b.date||'').localeCompare(a.date||''); });

    return res.status(200).json({
      channel: channel,
      totalOrders: stats.total,
      totalGMV: +stats.gmv.toFixed(2),
      totalCommission: +totalCommission.toFixed(2),
      breakdown: {
        credit_3:  { count: stats.credit_3||0, price: 4.9,  rate: '20%', subtotal: +((stats.credit_3||0)*4.9*0.20).toFixed(2) },
        credit_10: { count: stats.credit_10||0,price: 9.9,  rate: '30%', subtotal: +((stats.credit_10||0)*9.9*0.30).toFixed(2) },
        credit_20: { count: stats.credit_20||0,price: 14.9, rate: '35%', subtotal: +((stats.credit_20||0)*14.9*0.35).toFixed(2) },
        monthly:   { count: stats.monthly||0,  price: 29.9, rate: '40%', subtotal: +((stats.monthly||0)*29.9*0.40).toFixed(2) }
      },
      orders: orders.slice(0, 100)
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};