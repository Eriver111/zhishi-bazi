/**
 * 认证模块 — JWT 签发/验证 · 密码哈希 · requireAuth 中间件 · 频率限制
 * v1.0
 */
const crypto = require('crypto');

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi-change-me';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;  // 24 小时

// ============ JWT ============

function signToken(payload) {
  const p = { ...payload, iat: Date.now(), exp: Date.now() + TOKEN_EXPIRY };
  const str = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(str).digest('hex').slice(0, 16);
  return 'tk_' + str + '.' + sig;
}

function verifyToken(token) {
  if (!token || !token.startsWith('tk_')) return null;
  const raw = token.slice(3);
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const payloadStr = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadStr).digest('hex').slice(0, 16);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

// ============ 密码哈希 ============

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const salt = parts[0];
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === parts[1];
}

// ============ requireAuth 中间件 ============

function requireAuth(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return verifyToken(token);
}

// ============ 简易频率限制（内存） ============

const _rl = {};

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = _rl[key];
  if (!entry || now - entry.start > windowMs) {
    _rl[key] = { start: now, count: 1 };
    return true; // 允许
  }
  entry.count++;
  return entry.count <= max;
}

// 清理（每 10 分钟清理过期条目）
setInterval(function () {
  var now = Date.now();
  for (var k in _rl) {
    if (now - _rl[k].start > 600000) delete _rl[k];
  }
}, 600000).unref();

module.exports = { signToken, verifyToken, hashPassword, verifyPassword, requireAuth, rateLimit };
