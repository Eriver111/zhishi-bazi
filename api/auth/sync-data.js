/**
 * POST /api/auth/sync-data
 * Headers: Authorization: Bearer <token>
 * Body: { key, value }
 */
const { requireAuth } = require('../../lib/auth.js');
const { syncUserData } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var user = requireAuth(req);
    if (!user) return res.status(401).json({ error: '未登录' });

    var body = req.body || {};
    var key = body.key;
    var value = body.value;

    if (!key || value === undefined) return res.status(400).json({ error: '缺少 key 或 value' });
    if (key.length > 64) return res.status(400).json({ error: 'key 过长（最多 64 字符）' });

    var strVal = typeof value === 'string' ? value : JSON.stringify(value);
    await syncUserData(user.uid, key, strVal);

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
