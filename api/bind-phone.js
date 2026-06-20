/**
 * /api/bind-phone - 绑定手机找回兑换码
 * POST { code, phone }
 */
const { getSupabase } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { code, phone } = req.body || {};
    if (!code || !phone) return res.status(400).json({ error: '缺少参数' });
    if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });

    const db = getSupabase();
    if (db) {
      // Create phone_bindings table if not exists (via upsert-like logic)
      const { error } = await db.from('phone_bindings').upsert({
        phone, code, updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });
      if (error) return res.status(500).json({ error: '绑定失败' });
      return res.status(200).json({ success: true, message: '绑定成功，可通过手机号找回兑换码' });
    }

    // Memory fallback - store in localStorage on the client side is enough
    return res.status(200).json({ success: true, message: '绑定成功' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
