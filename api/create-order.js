const { selectMethod, assertBrowserSupport } = require('../lib/payment-channels.js');
const { create } = require('../lib/xunhu-orders.js');

const SITE = (process.env.SITE_URL || 'https://zhishi.online').trim();

function buildBaziReturnUrl(params) {
  const query = new URLSearchParams();
  if (params.mode === 'pillars') {
    const keys = {
      year: ['yg', 'yz'],
      month: ['mg', 'mz'],
      day: ['dg', 'dz'],
      hour: ['hg', 'hz']
    };
    Object.keys(keys).forEach(position => {
      const pillar = params.pillars[position];
      query.set(keys[position][0], pillar.charAt(0));
      query.set(keys[position][1], pillar.charAt(1));
    });
    query.set('mode', 'pillars');
    query.set('timing', params.timing);
  } else {
    if (params.mode === 'lunar') query.set('cal', 'lunar');
    query.set('zishi', params.ziHourRule === 'next-day' ? '1' : '0');
    query.set('solar', params.trueSolarTime === 'disabled' ? '0' : '1');
  }
  ['year', 'month', 'day', 'hour', 'clock', 'minute', 'gender', 'prov', 'city', 'dist']
    .forEach(key => {
      if (params[key] !== undefined && params[key] !== '') query.set(key, params[key]);
    });
  if (params.mode !== 'pillars' && Number.isFinite(Number(params.clock)) && !Number.isInteger(Number(params.clock))) {
    query.set('report_clock_normalized', '1');
  }
  return SITE + '/result.html?' + query.toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const method = selectMethod(body.payment_method, process.env, body.mode);
    assertBrowserSupport(method, req, process.env);
    let userId = null;
    if (body.token) {
      try {
        const { verifyToken } = require('../lib/auth.js');
        userId = verifyToken(body.token)?.uid || null;
      } catch (_) {}
    }
    const result = await create(body, userId, req, buildBaziReturnUrl, process.env, method);
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'EXTERNAL_BROWSER_REQUIRED') return res.status(409).json({ error: error.message, code: error.code });
    if (error.code === 'PAYMENT_METHOD_UNAVAILABLE') return res.status(503).json({ error: error.message, code: error.code });
    if (error.code === 'INVALID_REPORT_PARAMS') return res.status(400).json({ error: '缺少或无效的报告参数' });
    if (error.code === 'PAYMENT_UNAVAILABLE') {
      return res.status(502).json({ error: '所选支付方式暂不可用，请重新选择或稍后重试', code: error.code });
    }
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};
