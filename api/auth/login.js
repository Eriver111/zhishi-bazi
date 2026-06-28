/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const { verifyPassword, signToken, rateLimit } = require('../../lib/auth.js');
const { getUserByEmail } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '请填写邮箱和密码' });

    // 频率限制：同一 IP 每分钟最多 10 次尝试
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    if (!rateLimit('login_' + clientIp, 10, 60000)) {
      return res.status(429).json({ error: '登录尝试太频繁，请稍后再试' });
    }

    // 查找用户
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: '邮箱未注册，请先注册' });

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 签发 token
    const token = signToken({ uid: user.id, email: user.email });

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, phone: user.phone, created_at: user.created_at }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || '登录失败' });
  }
};
