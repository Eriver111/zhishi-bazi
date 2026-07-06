/**
 * /api/recover-codes - 管理员手动恢复文件降级的兑换码到 Supabase
 * POST { key: "zhishi-admin-2026", action: "list"|"recover"|"recover-all" }
 *
 * 用于 Supabase 故障恢复后，将文件降级保存的兑换码批量写回数据库
 */
const fs = require('fs');
const path = require('path');
const { insertCredits, activateMonthly, getCreditsByOrderId } = require('../lib/supabase.js');

const ADMIN_KEY = process.env.ADMIN_KEY || 'zhishi-admin-2026';
const FALLBACK_DIR = path.join(__dirname, '..', '.fallback-codes');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const body = req.body || {};
    const { key, action } = body;

    if (key !== ADMIN_KEY) {
      return res.status(403).json({ error: '密钥错误' });
    }

    // ---- 列出所有降级文件 ----
    if (action === 'list') {
      const codes = listFallbackCodes();
      return res.status(200).json({ count: codes.length, codes });
    }

    // ---- 恢复单个 ----
    if (action === 'recover') {
      const orderId = body.orderId;
      if (!orderId) return res.status(400).json({ error: '缺少 orderId' });
      const result = await recoverSingle(orderId);
      return res.status(200).json(result);
    }

    // ---- 恢复全部 ----
    if (action === 'recover-all') {
      const codes = listFallbackCodes();
      const results = [];
      for (const c of codes) {
        results.push(await recoverSingle(c.order_id));
      }
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return res.status(200).json({ total: codes.length, succeeded, failed, results });
    }

    return res.status(400).json({ error: '未知 action，支持: list | recover | recover-all' });

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
};

function listFallbackCodes() {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) return [];
    const files = fs.readdirSync(FALLBACK_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(FALLBACK_DIR, f), 'utf-8'));
      return { file: f, ...data };
    });
  } catch (e) {
    return [];
  }
}

async function recoverSingle(orderId) {
  const safeName = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(FALLBACK_DIR, safeName + '.json');

  try {
    if (!fs.existsSync(filePath)) {
      return { orderId, success: false, error: '降级文件不存在' };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // 检查是否已在 Supabase 中
    const existing = await getCreditsByOrderId(orderId);
    if (existing && !existing._recovered) {
      // 已在 Supabase 中，清理降级文件
      fs.unlinkSync(filePath);
      return { orderId, code: data.code, success: true, action: 'deleted-fallback', note: '已在数据库中' };
    }

    // 写入 Supabase
    let result;
    if (data.type === 'monthly') {
      result = await activateMonthly(data.code, orderId, data.days || 30);
    } else {
      result = await insertCredits(data.code, orderId, data.credits || 5);
    }

    if (result) {
      // 成功后删除降级文件
      fs.unlinkSync(filePath);
      return { orderId, code: data.code, success: true, action: 'migrated-to-db' };
    } else {
      return { orderId, code: data.code, success: false, error: 'Supabase 写入失败，数据库可能仍不可用' };
    }
  } catch (e) {
    return { orderId, success: false, error: e.message };
  }
}
