/**
 * GET /api/auth/verify?token=xxx 或 Authorization: Bearer xxx
 */
const { verifyToken } = require('../../lib/auth.js');
const { getUserById } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var token = (req.query && req.query.token) || '';
    if (!token) {
      var header = req.headers['authorization'] || '';
      token = header.startsWith('Bearer ') ? header.slice(7) : '';
    }
    if (!token) return res.status(200).json({ valid: false, reason: 'no_token' });

    var payload = verifyToken(token);
    if (!payload) return res.status(200).json({ valid: false, reason: 'invalid' });

    // 可选：检查用户是否仍存在
    var user = await getUserById(payload.uid);
    if (!user) return res.status(200).json({ valid: false, reason: 'user_deleted' });

    return res.status(200).json({ valid: true, user: { id: user.id, email: user.email, phone: user.phone } });
  } catch (e) {
    return res.status(200).json({ valid: false, reason: 'error' });
  }
};
