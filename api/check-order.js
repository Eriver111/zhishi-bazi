/**
 * /api/check-order.js
 * Frontend payment polling for report, credit-pack and monthly orders.
 */
const crypto = require('crypto');
const { getCreditsByOrderId } = require('../lib/supabase.js');
const {
  getReportProduct,
  isExpectedAmount,
  isSuccessfulGatewayStatus
} = require('../lib/payment-contract.js');

const PAY_PID = process.env.PAY_PID || '';
const PAY_KEY = process.env.PAY_KEY || '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const orderId = query.orderId || query.out_trade_no || '';
    if (!orderId) return res.status(400).json({ error: '缺少 orderId' });

    if (isCreditOrder(orderId)) {
      const credits = await getCreditsByOrderId(orderId);
      if (credits) return sendPaidCredit(res, credits);

      // Credit fulfillment remains callback-only to avoid duplicate grants.
      return res.status(200).json({ paid: false, status: 'pending' });
    }

    const expectedType = String(query.expected_type || '');
    const isLegacyHepan = orderId.startsWith('rpt_') && expectedType === 'hepan';
    const reportProduct = getReportProduct(orderId) ||
      (isLegacyHepan ? { type: 'hepan', amount: 13.9 } : null);
    if (!reportProduct) {
      return res.status(400).json({ error: '不支持的报告订单', status: 'invalid' });
    }

    if (expectedType && expectedType !== reportProduct.type) {
      return res.status(409).json({ error: '报告类型不匹配', status: 'invalid' });
    }

    const data = await queryGatewayOrder(orderId);
    if (!isSuccessfulGatewayStatus(data)) {
      return res.status(200).json({ orderId, status: 'pending' });
    }

    if (data.out_trade_no !== orderId) {
      return res.status(409).json({ error: '订单号校验失败', status: 'pending' });
    }
    if (!isExpectedAmount(reportProduct, data.money)) {
      return res.status(409).json({ error: '订单金额校验失败', status: 'pending' });
    }
    if (isLegacyHepan && data.name !== '合盘完整分析报告') {
      return res.status(409).json({ error: '旧版报告商品校验失败', status: 'pending' });
    }

    const reportKey = isLegacyHepan
      ? 'legacy'
      : (orderId.includes('_') ? orderId.split('_').pop() : 'unknown');
    return res.status(200).json({
      orderId,
      status: 'paid',
      token: signToken(orderId, reportKey),
      report_type: reportProduct.type,
      report_key: reportKey
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function isCreditOrder(orderId) {
  return orderId.startsWith('aichat_') ||
    orderId.startsWith('credit_') ||
    orderId.startsWith('credit3_') ||
    orderId.startsWith('credit10_') ||
    orderId.startsWith('credit20_') ||
    orderId.startsWith('monthly_');
}

async function queryGatewayOrder(orderId) {
  const queryUrl = 'https://zpayz.cn/api.php?act=order&pid=' + PAY_PID
    + '&key=' + PAY_KEY
    + '&out_trade_no=' + encodeURIComponent(orderId);
  const payResp = await fetch(queryUrl);
  const text = await payResp.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('支付状态查询返回异常');
  }
}

function sendPaidCredit(res, credits) {
  return res.status(200).json({
    paid: true,
    code: credits.code,
    credits: credits.credits,
    _type: credits._type || 'credits',
    status: 'paid'
  });
}

function signToken(orderId, reportKey) {
  const payload = { oid: orderId, bh: reportKey, exp: Date.now() + 7 * 86400000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadStr)
    .digest('hex')
    .slice(0, 16);
  return 'tk_' + payloadStr + '.' + signature;
}
