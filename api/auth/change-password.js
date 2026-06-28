/**
 * POST /api/auth/change-password
 * Headers: Authorization: Bearer <token>
 * Body: { old_password, new_password }
 */
const { requireAuth, hashPassword, verifyPassword } = require('../../lib/auth.js');
const { getSupabase } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var user = requireAuth(req);
    if (!user) return res.status(401).json({ error: '未登录' });

    var { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) return res.status(400).json({ error: '请填写旧密码和新密码' });
    if (new_password.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });

    var db = getSupabase();
    if (!db) return res.status(500).json({ error: '数据库不可用' });

    var { data: u } = await db.from('users').select('password').eq('id', user.uid).single();
    if (!u) return res.status(404).json({ error: '用户不存在' });
    if (!verifyPassword(old_password, u.password)) return res.status(400).json({ error: '旧密码错误' });

    var hashed = hashPassword(new_password);
    await db.from('users').update({ password: hashed }).eq('id', user.uid);

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
