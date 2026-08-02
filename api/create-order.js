/**
 * /api/create-order
 * 统一支付下单：排盘报告 + 合盘 + AI次数包 + AI月会员
 * v3.0: 新增 mode: 'credit_pack' (¥9.9/10次), 'monthly' (¥29.9/30天)
 */
const crypto = require('crypto');
const {
  getClientIp,
  getDevice,
  md5Sign,
  normalizeGatewayPayment,
  paymentResponseFields
} = require('../lib/payment-contract.js');
const {
  normalizeBaziReportParams,
  makeReportKey,
  makeBaziReportLabel
} = require('../lib/report-identity.js');
const { createReportOrder, hasPaidReport } = require('../lib/supabase.js');

const PAY_URL = (process.env.PAY_API_URL || 'https://zpayz.cn/mapi.php').trim();
const PAY_PID = process.env.PAY_PID; if(!PAY_PID) throw new Error('PAY_PID env required');
const PAY_KEY = process.env.PAY_KEY; if(!PAY_KEY) throw new Error('PAY_KEY env required');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi-change-me';
const SITE = (process.env.SITE_URL || 'https://zhishi.online').trim();

// v3.0 定价
const PRICING = {
  credit_3: { amount: 4.9, credits: 3, label: 'AI体验包·3次', prefix: 'credit3_' },
  credit_10: { amount: 9.9, credits: 10, label: 'AI进阶包·10次', prefix: 'credit10_' },
  credit_20: { amount: 14.9, credits: 20, label: 'AI专业包·20次', prefix: 'credit20_' },
  credit_pack: { amount: 9.9, credits: 10, label: 'AI提问·10次', prefix: 'credit_' },
  monthly: { amount: 29.9, days: 30, label: 'AI会员·30天', prefix: 'monthly_' },
  ai_chat: { amount: 5, credits: 5, label: 'AI提问·5次', prefix: 'aichat_' },
};

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
  return SITE + '/result.html?' + query.toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { year, month, day, hour, gender, amount, hash, description, money, name, mode, token } = body;

    // 解析登录token获取user_id，购买后积分直接到账
    var userId = null;
    if (token) {
      try {
        const { verifyToken } = require('../lib/auth.js');
        var payload = verifyToken(token);
        if (payload && payload.uid) userId = payload.uid;
      } catch(e) {}
    }

    // ---- v3.0 AI 付费模式（次数包 + 月会员）----
    if (mode === 'credit_pack' || mode === 'monthly' || mode === 'ai-chat' || mode === 'credit_3' || mode === 'credit_10' || mode === 'credit_20') {
      const pricing = PRICING[mode] || PRICING.ai_chat;
      const payAmount = pricing.amount;
      const payName = name || pricing.label;
      const orderId = pricing.prefix + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
      // 将 userId 编码进订单号（zpayz 回调时 notify_url 查询参数可能丢失）
      var finalOrderId = orderId;
      if (userId) {
        finalOrderId = orderId.replace(pricing.prefix, pricing.prefix + "u" + userId + "_");
      }
      const returnUrl = SITE + '/pricing?paid=' + finalOrderId;

      if (!PAY_PID || !PAY_KEY) {
        return res.status(200).json({
          pay_url: null, out_trade_no: finalOrderId, test_mode: true,
          amount: payAmount, mode: mode
        });
      }

      var channel=(req.body&&req.body.channel)||"";
      const payParams = {
        pid: PAY_PID, type: "alipay",
        out_trade_no: finalOrderId, notify_url: SITE + "/api/callback",
        return_url: returnUrl, name: payName, money: String(payAmount),
        clientip: getClientIp(req), device: getDevice(req)
      };
      payParams.sign = md5Sign(payParams, PAY_KEY);
      payParams.sign_type = 'MD5';

      const formBody = Object.keys(payParams).map(k =>
        encodeURIComponent(k) + '=' + encodeURIComponent(payParams[k])
      ).join('&');

      // POST 到 zpayz 获取真实支付宝链接和二维码
      try {
        const payResp = await fetch(PAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody
        });
        const text = await payResp.text();
        let zdata;
        try { zdata = JSON.parse(text); } catch (e) {
          return res.status(502).json({ error: '支付服务返回异常，请稍后重试' });
        }
        if (String(zdata.code) !== '1') {
          return res.status(502).json({ error: zdata.msg || '支付下单失败' });
        }
        const normalized = normalizeGatewayPayment(zdata);
        if (!normalized.payUrl && !normalized.qrContent && !normalized.qrImage) {
          return res.status(502).json({ error: '支付服务未返回可用的付款地址' });
        }
        return res.status(200).json({
          out_trade_no: finalOrderId,
          ...paymentResponseFields(zdata),
          amount: payAmount, mode: mode, status: 'pending'
        });
      } catch (e) {
        return res.status(502).json({ error: '支付服务连接失败，请稍后重试' });
      }
    }

    // ---- 旧版通用金额入口已停用：报告必须走固定价格的专属订单 ----
    if (!body.report_params && !year && !hash && (money || amount)) {
      return res.status(400).json({ error: '旧版支付入口已停用，请刷新页面后重试' });
    }

    // ---- 合盘模式 ----
    const isHePan = !year && !!hash;
    if (isHePan) {
      const payAmount = 13.9;
      const payName = description || '知时 · 合盘报告';
      const safeHepanHash = crypto.createHash('sha256')
        .update(String(hash))
        .digest('hex')
        .slice(0, 6);
      const orderId = 'hepan_' + Date.now().toString(36) + '_' + safeHepanHash;
      var finalOrderId = orderId;
      var hepanChannel = (req.body && req.body.channel) || '';
      var hepanParams = [];
      if (userId) hepanParams.push('uid=' + userId);
      if (hepanChannel) hepanParams.push('ch=' + hepanChannel);
      const notifyUrl = SITE + '/api/callback' + (hepanParams.length ? '?' + hepanParams.join('&') : '');
      const ref = (req.headers.referer || '').split('?')[1] || '';
      const hprUrl = SITE + '/hepan-result.html?' + ref;

      const payParams = {
        pid: PAY_PID, type: 'alipay',
        out_trade_no: finalOrderId, notify_url: notifyUrl,
        return_url: hprUrl, name: payName, money: String(payAmount),
        clientip: getClientIp(req), device: getDevice(req)
      };
      payParams.sign = md5Sign(payParams, PAY_KEY);
      payParams.sign_type = 'MD5';

      let qrcode = '', payUrl = '';
      try {
        const formBody = Object.keys(payParams).map(k =>
          encodeURIComponent(k) + '=' + encodeURIComponent(payParams[k])
        ).join('&');
        const payResp = await fetch(PAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody
        });
        const text = await payResp.text();
        let data;
        try { data = JSON.parse(text); } catch (e) {
          return res.status(502).json({ error: 'zpayz返回: ' + text.slice(0, 300) });
        }
        if (String(data.code) !== '1') {
          return res.status(502).json({ error: data.msg || '支付下单失败' });
        }
        const normalized = normalizeGatewayPayment(data);
        qrcode = normalized.qrContent;
        payUrl = normalized.payUrl;
        var qrImage = normalized.qrImage;
      } catch (e) {
        return res.status(502).json({ error: 'zpayz请求失败: ' + e.message });
      }

      return res.status(200).json({
        orderId, out_trade_no: finalOrderId, amount: payAmount,
        report_key: safeHepanHash,
        qrcode, qr_content: qrcode, qr_image: qrImage || '', pay_url: payUrl,
        status: 'pending'
      });
    }

    // ---- 个人排盘模式 ----
    if (!body.report_params && (!year || !month || !day || hour === undefined || !gender)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    let normalized;
    try {
      normalized = normalizeBaziReportParams(body.report_params || body);
    } catch (e) {
      return res.status(400).json({ error: 'invalid report params' });
    }
    const reportKey = makeReportKey('bazi', normalized);
    const label = makeBaziReportLabel(normalized);
    if (userId && await hasPaidReport(userId, 'bazi', reportKey)) {
      return res.status(200).json({
        already_unlocked: true,
        report_type: 'bazi',
        report_key: reportKey
      });
    }

    const payAmount = 9.9;
    const orderId = 'bazi_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    try { await createReportOrder({
      order_id: orderId,
      user_id: userId,
      report_type: 'bazi',
      report_key: reportKey,
      report_params: normalized,
      label,
      amount: payAmount
    }); } catch(e) { console.error('[bazi order] createReportOrder failed:', e.message); }
    var finalOrderId = orderId;
    var baziChannel = (req.body && req.body.channel) || '';
    var baziParams = [];
    if (userId) baziParams.push('uid=' + userId);
    if (baziChannel) baziParams.push('ch=' + baziChannel);
    const notifyUrl = SITE + '/api/callback' + (baziParams.length ? '?' + baziParams.join('&') : '');
    const returnUrl = buildBaziReturnUrl(normalized);

    const payParams = {
      pid: PAY_PID, type: 'alipay',
      out_trade_no: finalOrderId, notify_url: notifyUrl,
      return_url: returnUrl, name: '知时 · 完整分析报告', money: String(payAmount),
      clientip: getClientIp(req), device: getDevice(req)
    };
    payParams.sign = md5Sign(payParams, PAY_KEY);
    payParams.sign_type = 'MD5';

    let qrcode = '', payUrl = '';
    try {
      const formBody = Object.keys(payParams).map(k =>
        encodeURIComponent(k) + '=' + encodeURIComponent(payParams[k])
      ).join('&');
      const payResp = await fetch(PAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody
      });
      const text = await payResp.text();
      let data;
      try { data = JSON.parse(text); } catch (e) {
        return res.status(502).json({ error: 'zpayz返回: ' + text.slice(0, 300) });
      }
      if (String(data.code) !== '1') {
        return res.status(502).json({ error: data.msg || '支付下单失败' });
      }
      const normalized = normalizeGatewayPayment(data);
      qrcode = normalized.qrContent;
      payUrl = normalized.payUrl;
      var qrImage = normalized.qrImage;
    } catch (e) {
      return res.status(502).json({ error: 'zpayz请求失败: ' + e.message });
    }

    return res.status(200).json({
      orderId, out_trade_no: finalOrderId, amount: payAmount,
      report_key: reportKey,
      qrcode, qr_content: qrcode, qr_image: qrImage || '', pay_url: payUrl,
      status: 'pending'
    });

  } catch (e) {
    console.error('[create-order] 500 error:', e.message, e.stack);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试', detail: e.message });
  }
};
