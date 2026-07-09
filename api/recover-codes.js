/**
 * /api/recover-codes - 找回兑换码 + 管理员孤儿码管理
 * POST { phone } → 用户通过手机号找回
 * POST { action:'list-orphans', key } → 管理员查看孤儿码
 * POST { action:'link', code, userId, key } → 管理员关联孤儿码
 */
const fs = require('fs');
const path = require('path');
const { getSupabase, insertCredits, activateMonthly, getCreditsByOrderId } = require('../lib/supabase.js');

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

    // ======== 用户：通过手机号找回兑换码 ========
    const { phone } = body;
    if (phone && !action) {
      if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
      const db = getSupabase();
      if (!db) return res.status(500).json({ error: '服务暂不可用' });

      const { data: bindings } = await db.from('phone_bindings').select('code').eq('phone', phone);
      const boundCodes = (bindings || []).map(b => b.code);

      let results = [];
      if (boundCodes.length > 0) {
        const { data: credits } = await db.from('user_credits').select('code,credits,total_used,created_at').in('code', boundCodes).gt('credits', 0);
        if (credits) results = credits.map(c => ({ ...c, type: 'credits' }));

        const { data: subs } = await db.from('user_subscriptions').select('code,starts_at,expires_at,created_at').in('code', boundCodes).gt('expires_at', new Date().toISOString());
        if (subs) subs.forEach(s => results.push({ code: s.code, credits: -1, type: 'monthly', expires_at: s.expires_at, created_at: s.created_at }));
      }

      return res.status(200).json({
        found: results.length > 0,
        codes: results,
        message: results.length > 0 ? '找到 ' + results.length + ' 个兑换码' : '未找到关联的兑换码，请确认手机号是否正确，或联系客服'
      });
    }

    // ======== 管理员功能 ========
    if (key !== ADMIN_KEY) return res.status(403).json({ error: '密钥错误' });

    // 列出孤儿码
    if (action === 'list-orphans') {
      const db = getSupabase();
      if (!db) return res.status(500).json({ error: '数据库不可用' });
      const { data: orphans } = await db.from('user_credits')
        .select('code,credits,order_id,created_at').is('user_id', null).gt('credits', 0)
        .order('created_at', { ascending: false }).limit(200);
      return res.status(200).json({ orphans: orphans || [], count: (orphans || []).length });
    }

    // 关联兑换码到用户
    if (action === 'link') {
      const { code, userId } = body;
      if (!code || !userId) return res.status(400).json({ error: '缺少 code 或 userId' });
      const db = getSupabase();
      if (!db) return res.status(500).json({ error: '数据库不可用' });
      const { error } = await db.from('user_credits').update({ user_id: userId }).eq('code', code).is('user_id', null);
      if (error) return res.status(500).json({ error: '关联失败' });
      return res.status(200).json({ success: true, message: '兑换码 ' + code + ' 已关联到用户 ' + userId });
    }

    // 批量关联所有孤儿码（通过 phone_bindings 匹配）
    if (action === 'link-by-phone') {
      const db = getSupabase();
      if (!db) return res.status(500).json({ error: '数据库不可用' });

      // 获取所有绑定记录
      const { data: bindings } = await db.from('phone_bindings').select('phone,code');
      if (!bindings || bindings.length === 0) return res.status(200).json({ linked: 0, message: '无绑定记录' });

      // 获取所有孤儿码
      const { data: orphans } = await db.from('user_credits').select('code').is('user_id', null).gt('credits', 0);
      if (!orphans || orphans.length === 0) return res.status(200).json({ linked: 0, message: '无孤儿码' });

      // 匹配
      const orphanSet = new Set(orphans.map(o => o.code));
      let linked = 0;
      for (const b of bindings) {
        if (orphanSet.has(b.code)) {
          const { error } = await db.from('user_credits').update({ user_id: null }).eq('code', b.code); // 需要知道 userId
          // Note: phone_bindings 没有 user_id，所以无法自动关联。需要用户登录后手动激活。
        }
      }

      return res.status(200).json({ linked, message: '已关联 ' + linked + ' 个兑换码' });
    }

    // ======== 降级文件管理（旧功能保留） ========
    if (action === 'list') {
      const codes = listFallbackCodes();
      return res.status(200).json({ count: codes.length, codes });
    }

    if (action === 'recover') {
      const orderId = body.orderId;
      if (!orderId) return res.status(400).json({ error: '缺少 orderId' });
      const result = await recoverSingle(orderId);
      return res.status(200).json(result);
    }

    if (action === 'recover-all') {
      const codes = listFallbackCodes();
      const results = [];
      for (const c of codes) results.push(await recoverSingle(c.order_id));
      const succeeded = results.filter(r => r.success).length;
      return res.status(200).json({ total: codes.length, succeeded, failed: results.length - succeeded, results });
    }

    return res.status(400).json({ error: '未知 action' });

  } catch (e) {
    return res.status(500).json({ error: '服务异常，请稍后重试' });
  }
};

function listFallbackCodes() {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) return [];
    return fs.readdirSync(FALLBACK_DIR).filter(f => f.endsWith('.json')).map(f => {
      try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(FALLBACK_DIR, f), 'utf-8')) }; }
      catch (_) { return { file: f, error: 'parse error' }; }
    });
  } catch (e) { return []; }
}

async function recoverSingle(orderId) {
  const safeName = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(FALLBACK_DIR, safeName + '.json');
  try {
    if (!fs.existsSync(filePath)) return { orderId, success: false, error: '文件不存在' };
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const existing = await getCreditsByOrderId(orderId);
    if (existing && !existing._recovered) { fs.unlinkSync(filePath); return { orderId, code: data.code, success: true }; }
    let result = data.type === 'monthly'
      ? await activateMonthly(data.code, orderId, data.days || 30)
      : await insertCredits(data.code, orderId, data.credits || 5);
    if (result) { fs.unlinkSync(filePath); return { orderId, code: data.code, success: true }; }
    return { orderId, code: data.code, success: false, error: '写入失败' };
  } catch (e) { return { orderId, success: false, error: e.message }; }
}
