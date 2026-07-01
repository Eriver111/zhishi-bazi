/**
 * POST /api/auth/register
 * Body: { email, password, code, phone? }
 * 需要先调用 /api/auth/send-code 获取邮箱验证码
 */
const { hashPassword, signToken, rateLimit } = require('../../lib/auth.js');
const { getUserByEmail, createUser, bumpFreeUsageByUser } = require('../../lib/supabase.js');
const { verifyCode } = require('./send-code.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, code, phone, _verify_only } = req.body || {};

    if (!email || !code) return res.status(400).json({ error: '请填写邮箱和验证码' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    // 开发模式：跳过验证码校验（用 dev_code）
    var isDev = process.env.NODE_ENV === 'development';
    if (!isDev || code !== '888888') {
      if (!verifyCode(email, code)) {
        return res.status(400).json({ error: '验证码错误或已过期，请重新获取' });
      }
    }

    // 仅验证模式（从邮件链接点过来的）
    if (_verify_only) {
      return res.status(200).json({ verified: true });
    }

    // 完整注册校验
    if (!password) return res.status(400).json({ error: '请设置密码' });
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
