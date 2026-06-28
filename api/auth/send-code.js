/**
 * POST /api/auth/send-code
 * Body: { email }
 * 发送6位验证码到邮箱，60秒内同一邮箱不可重复发送
 */
const crypto = require('crypto');
const { sendCode } = require('../../lib/email.js');
const { getUserByEmail } = require('../../lib/supabase.js');
const { rateLimit } = require('../../lib/auth.js');

// 内存存储验证码（5分钟过期，服务器重启丢失，可接受）
const _codes = {};

// 定期清理过期验证码
setInterval(function () {
  var now = Date.now();
  for (var k in _codes) {
    if (now - _codes[k].ts > 300000) delete _codes[k];
  }
}, 60000).unref();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6位数字
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var email = (req.body && req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 检查是否已注册
    var existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: '该邮箱已注册' });

    // IP 频率限制：同一 IP 每分钟最多发 3 封
    var clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    if (!rateLimit('sc_ip_' + clientIp, 3, 60000)) {
      return res.status(429).json({ error: '发送太频繁，请 1 分钟后重试' });
    }

    // 邮箱频率限制：同一邮箱 60 秒内不重复发
    if (!rateLimit('sc_em_' + email, 1, 60000)) {
      return res.status(429).json({ error: '验证码已发送，请 60 秒后重试' });
    }

    var code = generateCode();
    _codes[email] = { code: code, ts: Date.now() };

    // 尝试发送邮件
    try {
      await sendCode(email, code);
    } catch (e) {
      console.error('DM发送失败:', e.body || e.message || e);
      // 降级：阿里云挂了的话，开发模式下直接返回验证码
      if (process.env.NODE_ENV === 'development' || !process.env.ALI_AK_ID) {
        return res.status(200).json({ success: true, dev_code: code });
      }
      var errMsg = e.body && e.body.Message ? '邮件发送失败：' + e.body.Message : '邮件发送失败，请检查发信地址是否已审核通过';
      return res.status(500).json({ error: errMsg });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// 暴露验证函数给 register.js 使用
module.exports.verifyCode = function (email, code) {
  var entry = _codes[email];
  if (!entry) return false;
  if (Date.now() - entry.ts > 300000) { delete _codes[email]; return false; }
  if (entry.code !== String(code)) return false;
  delete _codes[email]; // 验证成功即销毁
  return true;
};
