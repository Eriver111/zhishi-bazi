/**
 * POST /api/auth/register
 * Body: { email, password, phone? }
 */
const { hashPassword, signToken, rateLimit } = require('../../lib/auth.js');
const { getUserByEmail, createUser, bumpFreeUsageByUser } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, phone } = req.body || {};

    // 验证
    if (!email || !password) return res.status(400).json({ error: '请填写邮箱和密码' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    // 频率限制：同一 IP 每小时最多 5 次注册
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    if (!rateLimit('reg_' + clientIp, 5, 3600000)) {
      return res.status(429).json({ error: '注册太频繁，请稍后再试' });
    }

    // 检查邮箱是否已注册
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: '该邮箱已注册，请直接登录' });

    // 创建用户
    const hashed = hashPassword(password);
    const user = await createUser(email, hashed, phone || null);

    // 新注册用户赠送 3 次免费提问（注册激励）
    try { await bumpFreeUsageByUser(user.id); await bumpFreeUsageByUser(user.id); await bumpFreeUsageByUser(user.id); } catch (e) {}

    // 签发 token
    const token = signToken({ uid: user.id, email: user.email });

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, phone: user.phone, created_at: user.created_at },
      bonus: 3
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || '注册失败' });
  }
};
