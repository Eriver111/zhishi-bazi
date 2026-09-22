const crypto = require('crypto');
const gateway = require('./xunhu-payment.js');
const store = require('./payment-order-store.js');
const { getCreditProduct, generateCode } = require('./payment-contract.js');
const { normalizeBaziReportParams, makeReportKey, makeBaziReportLabel } = require('./report-identity.js');

const PREFIXES = { credit_3: 'credit3_', credit_10: 'credit10_', credit_20: 'credit20_',
  credit_pack: 'credit_', monthly: 'monthly_', 'ai-chat': 'aichat_' };
const TITLES = { credit_3: '知时 AI 提问 3 次', credit_10: '知时 AI 提问 10 次',
  credit_20: '知时 AI 提问 20 次', credit_pack: '知时 AI 提问 10 次',
  monthly: '知时 AI 会员 30 天', 'ai-chat': '知时 AI 提问 5 次' };

function isWechatOrder(id) { return /^wx_[a-f0-9]{24}$/.test(String(id)); }

async function create(body, userId, req, buildBaziReturnUrl, env = process.env) {
  const site = new URL(env.SITE_URL || 'https://zhishi.online');
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('Invalid site origin');
  }
  const cfg = gateway.config(env);
  const order = {
    order_id: 'wx_' + crypto.randomBytes(12).toString('hex'),
    provider: 'xunhu', payment_method: 'wechat', provider_appid: cfg.appid,
    user_id: userId || null, channel: /^[a-zA-Z0-9_-]{1,32}$/.test(body.channel || '') ? body.channel : null,
    status: 'pending', kind: '', amount_cents: 0, title: '', credits: null, days: null,
    report_type: null, report_key: null, report_params: null, label: null, redemption_code: null
  };
  if (Object.hasOwn(PREFIXES, body.mode)) {
    const product = getCreditProduct(PREFIXES[body.mode]);
    Object.assign(order, { kind: product.type, amount_cents: Math.round(product.amount * 100),
      title: TITLES[body.mode], credits: product.credits || null, days: product.days || null,
      redemption_code: generateCode(), return_path: '/pricing?paid=' + order.order_id });
  } else if (!body.year && body.hash) {
    if (typeof body.hash !== 'string' || body.hash.length > 2000) throw new Error('Invalid report identity');
    Object.assign(order, { kind: 'report', amount_cents: 1390, title: '知时合盘分析报告',
      report_type: 'hepan', report_key: crypto.createHash('sha256').update(body.hash).digest('hex'),
      report_params: { hash: body.hash }, label: '合盘分析报告', return_path: '/hepan-result.html' });
    try {
      const ref = new URL((req.headers || {}).referer || '');
      if (ref.origin === site.origin && /^\/hepan-result(?:\.html)?$/.test(ref.pathname)) order.return_path += ref.search;
    } catch (_) { /* Anonymous callers can return to the report entry. */ }
  } else {
    let params;
    try { params = normalizeBaziReportParams(body.report_params || body); }
    catch (_) { const error = new Error('缺少或无效的报告参数'); error.code = 'INVALID_REPORT_PARAMS'; throw error; }
    const key = makeReportKey('bazi', params);
    if (userId && await require('./supabase.js').hasPaidReport(userId, 'bazi', key)) {
      return { already_unlocked: true, report_type: 'bazi', report_key: key };
    }
    const returnUrl = new URL(buildBaziReturnUrl(params));
    Object.assign(order, { kind: 'report', amount_cents: 990, title: '知时八字完整分析报告',
      report_type: 'bazi', report_key: key, report_params: params, label: makeBaziReportLabel(params),
      return_path: returnUrl.pathname + returnUrl.search });
  }
  // Save before contacting the gateway. A storage failure must never produce a payable order.
  await store.create(order);
  const payment = await gateway.createPayment(order, site.origin, env);
  return { ...payment, orderId: order.order_id, out_trade_no: order.order_id,
    amount: order.amount_cents / 100, mode: body.mode, report_key: order.report_key,
    status: 'pending' };
}

module.exports = { create, isWechatOrder };
