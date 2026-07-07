/**
 * /api/callback - zpayz 支付成功回调
 * 验证签名→生成兑换码→写入Supabase(带文件降级)→关联登录用户
 *
 * v3.1: 防重入保护 + 错误日志 + 文件降级 + 写入重试
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { insertCredits, activateMonthly, getCreditsByOrderId } = require('../lib/supabase.js');

const PAY_KEY = process.env.PAY_KEY || '';

// 文件降级存储路径
const FALLBACK_DIR = path.join(__dirname, '..', '.fallback-codes');
const CALLBACK_LOG = path.join(__dirname, '..', 'callback-errors.log');

function logError(msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}` + (data ? ' ' + JSON.stringify(data) : '') + '\n';
  try { fs.appendFileSync(CALLBACK_LOG, line); } catch (_) {}
  console.error(line.trim());
}

function saveFallbackCode(code, orderId, type, meta) {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    const file = path.join(FALLBACK_DIR, orderId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify({
      code, order_id: orderId, type,
      credits: meta.credits, days: meta.days,
      created_at: new Date().toISOString(),
      recovered: false
    }, null, 2));
    console.log('[callback] 文件降级保存成功:', file);
    return true;
  } catch (e) {
    logError('文件降级保存失败', { orderId, error: e.message });
    return false;
  }
}

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
    if (expected !== signVal) {
      logError('验签失败', { out_trade_no: params.out_trade_no });
      return res.status(200).send('sign error');
    }

    const outTradeNo = params.out_trade_no || '';
    // uid/ch 可能在 URL query 中（由 create-order.js notify_url 拼入），也可能在 body 中
    const userId = (params.uid || (req.query && req.query.uid)) ? parseInt(params.uid || (req.query && req.query.uid)) : null;
    const channel = params.ch || (req.query && req.query.ch) || '';

    if (!outTradeNo) {
      logError('缺少 out_trade_no');
      return res.status(200).send('success');
    }

    // ---- 防重入：检查订单是否已处理 ----
    const existing = await getCreditsByOrderId(outTradeNo);
    if (existing) {
      console.log('[callback] 订单已处理，跳过:', outTradeNo, '→ 已有兑换码:', existing.code);
      return res.status(200).send('success');
    }

    const code = generateCode();
    let success = false;
    let orderType = 'unknown';

    // ---- 根据订单前缀生成对应兑换码 ----
    if (outTradeNo.startsWith('credit3_')) {
      orderType = 'credit3';
      success = await doInsertWithRetry(code, outTradeNo, 3, userId, channel);
    } else if (outTradeNo.startsWith('credit10_')) {
      orderType = 'credit10';
      success = await doInsertWithRetry(code, outTradeNo, 10, userId, channel);
    } else if (outTradeNo.startsWith('credit20_')) {
      orderType = 'credit20';
      success = await doInsertWithRetry(code, outTradeNo, 20, userId, channel);
    } else if (outTradeNo.startsWith('monthly_')) {
      orderType = 'monthly';
      success = await doMonthlyWithRetry(code, outTradeNo, 30, userId, channel);
    } else if (outTradeNo.startsWith('credit_')) {
      orderType = 'credit';
      success = await doInsertWithRetry(code, outTradeNo, 10, userId, channel);
    } else if (outTradeNo.startsWith('aichat_')) {
      orderType = 'aichat';
      success = await doInsertWithRetry(code, outTradeNo, 5, userId, channel);
    } else {
      // 未识别的订单类型（如 bazi_/hepan_/rpt_），不做兑换码生成
      console.log('[callback] 非积分订单，跳过兑换码生成:', outTradeNo);
      return res.status(200).send('success');
    }

    if (!success) {
      // Supabase 写入失败 → 文件降级保存
      logError('兑换码写入失败，启动文件降级', { code, orderId: outTradeNo, type: orderType });
      const fallbackMeta = orderType === 'monthly'
        ? { days: 30 }
        : { credits: orderType === 'credit3' ? 3 : orderType === 'credit20' ? 20 : orderType === 'credit10' ? 10 : orderType === 'credit' ? 10 : 5 };
      saveFallbackCode(code, outTradeNo, orderType, fallbackMeta);
    } else {
      console.log('[callback] 兑换码生成成功:', outTradeNo, '→', code);
    }

    return res.status(200).send('success');
  } catch (e) {
    logError('回调处理异常', { error: e.message, stack: e.stack });
    return res.status(200).send('success');
  }
};

// ---- 带重试的写入 ----
async function doInsertWithRetry(code, oid, count, userId, channel, retries) {
  retries = retries || 0;
  const MAX_RETRIES = 3;

  try {
    const result = await insertCredits(code, oid, count, channel, userId);
    if (result) {
      // userId 已在 insertCredits 中直接写入，不再需要 linkUser 补绑
      return true;
    }
    if (retries < MAX_RETRIES) {
      console.log('[callback] 写入重试 ' + (retries + 1) + '/' + MAX_RETRIES + ':', oid);
      await sleep(1000 * (retries + 1)); // 递增等待
      return doInsertWithRetry(code, oid, count, userId, channel, retries + 1);
    }
    return false;
  } catch (e) {
    logError('doInsertWithRetry异常', { code, oid, error: e.message });
    if (retries < MAX_RETRIES) {
      await sleep(1000 * (retries + 1));
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
    if (result) {
      // userId 已在 activateMonthly 中直接写入
      return true;
    }
    if (retries < MAX_RETRIES) {
      console.log('[callback] 月度会员写入重试 ' + (retries + 1) + '/' + MAX_RETRIES + ':', oid);
      await sleep(1000 * (retries + 1));
      return doMonthlyWithRetry(code, oid, days, userId, channel, retries + 1);
    }
    return false;
  } catch (e) {
    logError('doMonthlyWithRetry异常', { code, oid, error: e.message });
    if (retries < MAX_RETRIES) {
      await sleep(1000 * (retries + 1));
      return doMonthlyWithRetry(code, oid, days, userId, channel, retries + 1);
    }
    return false;
  }
}

async function linkUser(table, code, userId) {
  try {
    const db = require('../lib/supabase.js').getSupabase();
    if (db) {
      await db.from(table).update({ user_id: userId }).eq('code', code).is('user_id', null);
    }
  } catch (e) { /* 非致命 */ }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return code;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
