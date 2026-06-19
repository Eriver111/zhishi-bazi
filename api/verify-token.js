/**
 * /api/verify-token.js  — 解码自包含 token，验证有效性
 * GET 方式：token 和 baziHash 放 URL 查询参数
 */
const crypto = require('crypto');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'knowbazi';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 同时支持 POST JSON body 和 GET query（兼容两种调用方式）
    var token, baziHash;
    if (req.body && req.body.token) {
      token = req.body.token;
      baziHash = req.body.baziHash;
    } else if (req.query) {
      token = req.query.token;
      baziHash = req.query.baziHash;
    }
    if (!token) return res.status(200).json({ valid: false, reason: 'no_token' });

    const result = verify(token, baziHash);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(200).json({ valid: false, reason: 'error', msg: e.message });
  }
};

function verify(token, baziHash) {
  if (!token.startsWith('tk_')) return { valid: false, reason: 'invalid' };
  const raw = token.slice(3);
  const dotIdx = raw.lastIndexOf('.');
  if (dotIdx < 0) return { valid: false, reason: 'invalid' };
  const ps = raw.slice(0, dotIdx), sig = raw.slice(dotIdx + 1);
  const exp = crypto.createHmac('sha256', TOKEN_SECRET).update(ps).digest('hex').slice(0, 16);
  if (sig !== exp) return { valid: false, reason: 'invalid' };
  let p;
  try { p = JSON.parse(Buffer.from(ps, 'base64url').toString()); }
  catch (e) { return { valid: false, reason: 'invalid' }; }
  if (Date.now() > p.exp) return { valid: false, reason: 'expired' };
  if (baziHash && p.bh !== baziHash) return { valid: false, reason: 'mismatch' };
  return { valid: true, orderId: p.oid };
}
