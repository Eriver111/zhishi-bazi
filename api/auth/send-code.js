/**
 * POST /api/auth/send-code
 * Body: { email }
 * 发送6位验证码到邮箱，60秒内同一邮箱不可重复发送
 */
const crypto = require('crypto');
const { sendCode } = require('../../lib/email.js');
const { getUserByEmail } = require('../../lib/supabase.js');
const { rateLimit, getClientIp } = require('../../lib/auth.js');

// 验证码存储（内存 + 文件持久化，服务器重启不丢）
const path = require('path');
const CODES_FILE = path.join(__dirname, '..', '..', '.verification-codes.json');
const _codes = {};

// 启动时从文件加载
(function loadCodes() {
  try {
    if (fs.existsSync(CODES_FILE)) {
      var loaded = JSON.parse(fs.readFileSync(CODES_FILE, 'utf-8'));
      var now = Date.now();
      for (var k in loaded) {
        if (now - loaded[k].ts < 300000) _codes[k] = loaded[k];
      }
      console.log('[verify-codes] 从文件加载 ' + Object.keys(_codes).length + ' 个有效验证码');
    }
  } catch(e) { /* 忽略 */ }
})();

function saveCodes() {
  try { fs.writeFileSync(CODES_FILE, JSON.stringify(_codes), 'utf-8'); } catch(e) {}
}

// 定期清理过期验证码
setInterval(function () {
  var now = Date.now();
  var cleaned = false;
  for (var k in _codes) {
    if (now - _codes[k].ts > 300000) { delete _codes[k]; cleaned = true; }
  }
  if (cleaned) saveCodes();
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
    var clientIp = getClientIp(req);
    if (!rateLimit('sc_ip_' + clientIp, 3, 60000)) {
      return res.status(429).json({ error: '发送太频繁，请 1 分钟后重试' });
    }

    // 邮箱频率限制：同一邮箱 60 秒内不重复发
    if (!rateLimit('sc_em_' + email, 1, 60000)) {
      return res.status(429).json({ error: '验证码已发送，请 60 秒后重试' });
    }

    var code = generateCode();
    _codes[email] = { code: code, ts: Date.now() };
    saveCodes();

    // 尝试发送邮件，失败时降级为直接显示验证码
    try {
      await sendCode(email, code);
    } catch (e) {
      console.error('DM发送失败:', e.message);
      return res.status(200).json({ success: true, dev_code: code, dev_note: '邮件服务暂不可用，请使用下方验证码' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};

// 暴露验证函数给 register.js 使用
module.exports.verifyCode = function (email, code) {
  var entry = _codes[email];
  if (!entry) return false;
  if (Date.now() - entry.ts > 300000) { delete _codes[email]; saveCodes(); return false; }
  if (entry.code !== String(code)) return false;
  delete _codes[email]; saveCodes(); // 验证成功即销毁
  return true;
};
