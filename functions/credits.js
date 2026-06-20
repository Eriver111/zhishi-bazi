/**
 * /api/credits - 查询兑换码余额
 * GET ?code=xxx
 * 返回: { code, credits, total_used }
 */

const { getCreditsByCode } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const code = (req.query && req.query.code) || '';

    if (!code) {
      return res.status(400).json({ error: '缺少兑换码' });
    }

    const credits = await getCreditsByCode(code);

    if (!credits) {
      return res.status(404).json({ error: '兑换码不存在' });
    }

    return res.status(200).json({
      code: credits.code,
      credits: credits.credits,
      total_used: credits.total_used
    });

  } catch (e) {
    console.error('查询余额失败:', e);
    return res.status(500).json({ error: '查询失败：' + e.message });
  }
};
