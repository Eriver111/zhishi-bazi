/**
 * /api/create-order
 * 统一支付下单：排盘报告 + 合盘 + AI次数包 + AI月会员
 * v3.0: 新增 mode: 'credit_pack' (¥9.9/10次), 'monthly' (¥29.9/30天)
 */
const crypto = require('crypto');

const PAY_URL = process.env.PAY_API_URL || 'https://zpayz.cn/mapi.php';
const PAY_PID = process.env.PAY_PID || '';
const PAY_KEY = process.env.PAY_KEY || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi';
const SITE = process.env.SITE_URL || 'https://www.knowbazi.online';

// v3.0 定价
const PRICING = {
  credit_pack: { amount: 9.9, credits: 10, label: 'AI提问·10次', prefix: 'credit_' },
  monthly: { amount: 29.9, days: 30, label: 'AI会员·30天', prefix: 'monthly_' },
  ai_chat: { amount: 5, credits: 5, label: 'AI提问·5次', prefix: 'aichat_' },
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { year, month, day, hour, gender, amount, hash, description, money, name, mode } = body;

    // ---- v3.0 AI 付费模式（次数包 + 月会员） ----
    if (mode === 'credit_pack' || mode === 'monthly' || mode === 'ai-chat') {
      const pricing = PRICING[mode] || PRICING.ai_chat;
      const payAmount = pricing.amount;
      const payName = name || pricing.label;
      const orderId = pricing.prefix + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
      const returnUrl = SITE + '/result.html?paid=' + orderId;

      if (!PAY_PID || !PAY_KEY) {
        return res.status(200).json({
          pay_url: null, out_trade_no: orderId, test_mode: true,
          amount: payAmount, mode: mode
        });
      }

      const payParams = {
        pid: PAY_PID, type: 'alipay',
        out_trade_no: orderId, notify_url: SITE + '/api/callback',
        return_url: returnUrl, name: payName, money: String(payAmount)
      };
      payParams.sign = md5Sign(payParams, PAY_KEY);
      payParams.sign_type = 'MD5';

      const payUrl = PAY_URL + '?' + Object.keys(payParams)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(payParams[k]))
        .join('&');

      return res.status(200).json({
        pay_url: payUrl, out_trade_no: orderId, amount: payAmount, mode: mode, status: 'pending'
      });
    }

    // ---- 旧版报告支付（POST zpayz 拿真实支付链接） ----
    if (!year && !hash && (money || amount)) {
      const payAmount = money || amount || 5;
      const payName = name || description || 'AI命理咨询·5次提问';
      const orderId = 'rpt_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
      if (!PAY_PID || !PAY_KEY) {
        return res.status(200).json({
          pay_url: null, out_trade_no: orderId,
          test_mode: true, message: '支付未配置，测试模式'
        });
      }
      const payParams = {
        pid: PAY_PID, type: 'alipay',
        out_trade_no: orderId, notify_url: SITE + '/api/callback',
        return_url: SITE + '/result.html?paid=' + orderId, name: payName, money: String(payAmount)
      };
      payParams.sign = md5Sign(payParams, PAY_KEY);
      payParams.sign_type = 'MD5';

      // POST to zpayz to get real payment URL (same as old site)
      const formBody = Object.keys(payParams).map(k =>
        encodeURIComponent(k) + '=' + encodeURIComponent(payParams[k])
      ).join('&');
      try {
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
        if (data.code !== 1) {
          return res.status(502).json({ error: data.msg || '支付下单失败' });
        }
        const payUrl = data.payurl || data.qrcode || '';
        const qrcode = data.qrcode || data.payurl || '';
        return res.status(200).json({ orderId, out_trade_no: orderId, amount: payAmount, qrcode, payUrl, status: 'pending' });
      } catch (e) {
        return res.status(502).json({ error: 'zpayz请求失败: ' + e.message });
      }
    }

    // ---- 合盘模式 ----
    const isHePan = !year && !!hash;
    if (isHePan) {
      const payAmount = amount || 13.9;
      const payName = description || '知时 · 合盘报告';
      const orderId = 'hepan_' + Date.now().toString(36) + '_' + hash.slice(0, 6);
      const notifyUrl = SITE + '/api/callback';
      const ref = (req.headers.referer || '').split('?')[1] || '';
      const hprUrl = SITE + '/hepan-result.html?' + ref;

      const payParams = {
        pid: PAY_PID, type: 'alipay',
        out_trade_no: orderId, notify_url: notifyUrl,
        return_url: hprUrl, name: payName, money: String(payAmount)
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
        if (data.code !== 1) {
          return res.status(502).json({ error: data.msg || '支付下单失败' });
        }
        qrcode = data.qrcode || data.payurl || '';
        payUrl = data.payurl || data.qrcode || '';
      } catch (e) {
        return res.status(502).json({ error: 'zpayz请求失败: ' + e.message });
      }

      return res.status(200).json({ orderId, amount: payAmount, qrcode, payUrl, status: 'pending' });
    }

    // ---- 个人排盘模式 ----
    if (!year || !month || !day || hour === undefined || !gender) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const payAmount = amount || 9.9;
    const bzHash = makeHash({ year, month, day, hour, gender });
    const orderId = 'bazi_' + Date.now().toString(36) + '_' + bzHash.slice(0, 6);
    const notifyUrl = SITE + '/api/callback';
    const returnUrl = SITE + '/result.html?year=' + year + '&month=' + month + '&day=' + day + '&hour=' + hour + '&gender=' + gender;

    const payParams = {
      pid: PAY_PID, type: 'alipay',
      out_trade_no: orderId, notify_url: notifyUrl,
      return_url: returnUrl, name: '知时 · 完整分析报告', money: String(payAmount)
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
      if (data.code !== 1) {
        return res.status(502).json({ error: data.msg || '支付下单失败' });
      }
      qrcode = data.qrcode || data.payurl || '';
      payUrl = data.payurl || data.qrcode || '';
    } catch (e) {
      return res.status(502).json({ error: 'zpayz请求失败: ' + e.message });
    }

    return res.status(200).json({ orderId, amount: payAmount, qrcode, payUrl, status: 'pending' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function md5Sign(params, key) {
  const sorted = Object.keys(params).sort();
  const str = sorted.map(k => k + '=' + params[k]).join('&');
  return crypto.createHash('md5').update(str + key).digest('hex');
}

function makeHash(p) {
  const s = [p.year, p.month, p.day, p.hour, p.gender].join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'bz_' + Math.abs(h).toString(36);
}
