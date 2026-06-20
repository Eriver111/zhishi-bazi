/**
 * /api/callback  - zpayz 支付成功异步回调
 * 验证签名 → 写入 Supabase → 返回 success
 * v3.0: 支持 credit_pack_ (10次), monthly_ (30天会员), aichat_ (5次)
 */
const crypto = require('crypto');
const { insertCredits, activateMonthly } = require('../lib/supabase.js');

const PAY_KEY = process.env.PAY_KEY || '';

module.exports = async function handler(req, res) {
  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    if (!params.sign) return res.status(200).send('no sign');

    // 验签
    const signVal = params.sign;
    const rest = { ...params };
    delete rest.sign; delete rest.sign_type;
    const sorted = Object.keys(rest).sort();
    const str = sorted.map(k => k + '=' + rest[k]).join('&');
    const expected = crypto.createHash('md5').update(str + PAY_KEY).digest('hex');

    if (expected !== signVal) return res.status(200).send('sign error');

    // ---- 判断订单类型并写入 ----
    const outTradeNo = params.out_trade_no || '';

    if (outTradeNo.startsWith('credit3_')) { const code = generateCode(); await insertCredits(code, outTradeNo, 3); }
  else if (outTradeNo.startsWith('credit10_')) { const code = generateCode(); await insertCredits(code, outTradeNo, 10); }
  else if (outTradeNo.startsWith('credit20_')) { const code = generateCode(); await insertCredits(code, outTradeNo, 20); }
  else if (outTradeNo.startsWith('monthly_')) {
      // 月度会员：30 天有效期
      const code = generateCode();
      await activateMonthly(code, outTradeNo);
      console.log('✅ 月会员已激活:', outTradeNo, '→ 兑换码:', code);
    } else if (outTradeNo.startsWith('credit_')) {
      // 次数包：10 次提问
      const code = generateCode();
      await insertCredits(code, outTradeNo, 10);
      console.log('✅ 次数包已激活(10次):', outTradeNo, '→ 兑换码:', code);
    } else if (outTradeNo.startsWith('aichat_')) {
      // 旧版：5 次提问
      const code = generateCode();
      await insertCredits(code, outTradeNo, 5);
      console.log('✅ AI旧版已激活(5次):', outTradeNo, '→ 兑换码:', code);
    }

    return res.status(200).send('success');
  } catch (e) {
    console.error('回调处理异常:', e);
    return res.status(200).send('success');
  }
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
