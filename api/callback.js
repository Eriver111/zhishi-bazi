/**
 * /api/callback - zpayz 支付成功回调
 * 验证签名→写入Supabase→关联登录用户
 */
const crypto = require('crypto');
const { insertCredits, activateMonthly } = require('../lib/supabase.js');

const PAY_KEY = process.env.PAY_KEY || '';

module.exports = async function handler(req, res) {
  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    if (!params.sign) return res.status(200).send('no sign');

    const signVal = params.sign;
    const rest = { ...params };
    delete rest.sign; delete rest.sign_type;
    const sorted = Object.keys(rest).sort();
    const str = sorted.map(k => k + '=' + rest[k]).join('&');
    const expected = crypto.createHash('md5').update(str + PAY_KEY).digest('hex');
    if (expected !== signVal) return res.status(200).send('sign error');

    const outTradeNo = params.out_trade_no || '';
    const userId = params.uid ? parseInt(params.uid) : null;

    if (outTradeNo.startsWith('credit3_')) { const code = generateCode(); await doInsert(code, outTradeNo, 3, userId); }
    else if (outTradeNo.startsWith('credit10_')) { const code = generateCode(); await doInsert(code, outTradeNo, 10, userId); }
    else if (outTradeNo.startsWith('credit20_')) { const code = generateCode(); await doInsert(code, outTradeNo, 20, userId); }
    else if (outTradeNo.startsWith('monthly_')) {
      const code = generateCode();
      await activateMonthly(code, outTradeNo);
      if (userId) { try { var db = require('../lib/supabase.js').getSupabase(); if(db) await db.from('user_subscriptions').update({user_id:userId}).eq('code',code).is('user_id',null); } catch(e){} }
    } else if (outTradeNo.startsWith('credit_')) {
      const code = generateCode(); await doInsert(code, outTradeNo, 10, userId);
    } else if (outTradeNo.startsWith('aichat_')) {
      const code = generateCode(); await doInsert(code, outTradeNo, 5, userId);
    }
    return res.status(200).send('success');
  } catch (e) { return res.status(200).send('success'); }
};

async function doInsert(code, oid, count, userId) {
  await insertCredits(code, oid, count);
  if (userId) {
    try {
      var db = require('../lib/supabase.js').getSupabase();
      if (db) { await db.from('user_credits').update({user_id:userId}).eq('code',code).is('user_id',null); }
    } catch(e) {}
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return code;
}
