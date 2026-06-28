/**
 * GET /api/auth/get-data?key=xxx (optional, returns all if omitted)
 * Headers: Authorization: Bearer <token>
 */
const { requireAuth } = require('../../lib/auth.js');
const { getUserData } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    var user = requireAuth(req);
    if (!user) return res.status(401).json({ error: '未登录' });

    var allData = await getUserData(user.uid);

    var key = (req.query && req.query.key) || '';
    if (key) {
      return res.status(200).json({ key: key, value: allData[key] || null });
    }
    return res.status(200).json({ data: allData });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
