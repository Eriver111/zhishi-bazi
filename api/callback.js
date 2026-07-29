/**
 * /api/callback - zpayz 支付成功回调
 * 验证签名→生成兑换码→写入Supabase（带重试）
 * v4.1: 移除文件降级（磁盘IOPS杀手），仅依赖Supabase
 */
const { insertCredits, activateMonthly, getCreditsByOrderId } = require('../lib/supabase.js');
const {
  generateCode,
  getCreditProduct,
  getOrderUserId,
  isExpectedAmount,
  md5Sign
} = require('../lib/payment-contract.js');

const PAY_KEY = process.env.PAY_KEY || '';

module.exports = async function handler(req, res) {
  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    if (!params.sign) return res.status(200).send('no sign');

    // 验签
    const signVal = params.sign;
    const expected = md5Sign(params, PAY_KEY);
    if (expected !== signVal) {
      console.error('[callback] 验签失败:', params.out_trade_no);
      return res.status(200).send('sign error');
    }

    const outTradeNo = params.out_trade_no || '';
    if (params.trade_status !== 'TRADE_SUCCESS') {
      return res.status(200).send('success');
    }
    // 从订单号提取 userId（格式: credit10_u123_xxx_yyy，比 URL 查询参数可靠）
    var userId = getOrderUserId(outTradeNo);
    // URL 查询参数作为备用
    if (!userId) userId = (params.uid || (req.query && req.query.uid)) ? parseInt(params.uid || (req.query && req.query.uid)) : null;
    const channel = params.ch || (req.query && req.query.ch) || '';

    if (!outTradeNo) {
      console.error('[callback] 缺少 out_trade_no');
      return res.status(200).send('success');
    }

    const product = getCreditProduct(outTradeNo);
    if (product && !isExpectedAmount(product, params.money)) {
      console.error('[callback] 订单金额不匹配:', outTradeNo, params.money);
      return res.status(200).send('amount error');
    }

    // ---- 防重入：检查订单是否已处理 ----
    const existing = await getCreditsByOrderId(outTradeNo);
    if (existing) {
      console.log('[callback] 订单已处理，跳过:', outTradeNo, '→ 已有兑换码:', existing.code);
      return res.status(200).send('success');
    }

    const code = generateCode();

    // ---- 根据订单前缀生成对应兑换码 ----
    var stored = true;
    if (outTradeNo.startsWith('credit3_')) {
      stored = await doInsertWithRetry(code, outTradeNo, 3, userId, channel);
    } else if (outTradeNo.startsWith('credit10_')) {
      stored = await doInsertWithRetry(code, outTradeNo, 10, userId, channel);
    } else if (outTradeNo.startsWith('credit20_')) {
      stored = await doInsertWithRetry(code, outTradeNo, 20, userId, channel);
    } else if (outTradeNo.startsWith('monthly_')) {
      stored = await doMonthlyWithRetry(code, outTradeNo, 30, userId, channel);
    } else if (outTradeNo.startsWith('credit_')) {
      stored = await doInsertWithRetry(code, outTradeNo, 10, userId, channel);
    } else if (outTradeNo.startsWith('aichat_')) {
      stored = await doInsertWithRetry(code, outTradeNo, 5, userId, channel);
    } else {
      console.log('[callback] 非积分订单，跳过:', outTradeNo);
    }

    if (!stored) {
      return res.status(503).send('fail');
    }
    return res.status(200).send('success');
  } catch (e) {
    console.error('[callback] 回调异常:', e.message);
    return res.status(503).send('fail');
  }
};

async function doInsertWithRetry(code, oid, count, userId, channel, retries) {
  retries = retries || 0;
  const MAX_RETRIES = 3;
  try {
    const result = await insertCredits(code, oid, count, channel, userId);
    if (result) { console.log('[callback] 积分写入成功:', oid, '→', code); return true; }
    if (retries < MAX_RETRIES) {
      console.log('[callback] 写入重试 ' + (retries + 1) + '/' + MAX_RETRIES + ':', oid);
      await sleep(250 * (retries + 1));
      return doInsertWithRetry(code, oid, count, userId, channel, retries + 1);
    }
    console.error('[callback] 积分写入失败（已重试' + MAX_RETRIES + '次）:', oid, code);
    return false;
  } catch (e) {
    console.error('[callback] doInsertWithRetry异常:', oid, e.message);
    if (retries < MAX_RETRIES) {
      await sleep(250 * (retries + 1));
      return doInsertWithRetry(code, oid, count, userId, channel, retries + 1);
    }
    return false;
  }
}

async function doMonthlyWithRetry(code, oid, days, userId, channel, retries) {
  retries = retries || 0;
  const MAX_RETRIES = 3;
  try {
    const result = await activateMonthly(code, oid, days, channel, userId);
    if (result) { console.log('[callback] 月度会员写入成功:', oid, '→', code); return true; }
    if (retries < MAX_RETRIES) {
      console.log('[callback] 月度会员写入重试 ' + (retries + 1) + '/' + MAX_RETRIES + ':', oid);
      await sleep(250 * (retries + 1));
      return doMonthlyWithRetry(code, oid, days, userId, channel, retries + 1);
    }
    console.error('[callback] 月度会员写入失败（已重试' + MAX_RETRIES + '次）:', oid, code);
    return false;
  } catch (e) {
    console.error('[callback] doMonthlyWithRetry异常:', oid, e.message);
    if (retries < MAX_RETRIES) {
      await sleep(250 * (retries + 1));
      return doMonthlyWithRetry(code, oid, days, userId, channel, retries + 1);
    }
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
