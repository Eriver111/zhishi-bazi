const { requireAuth } = require('../../lib/auth.js');
const { normalizeBaziReportParams, makeReportKey } = require('../../lib/report-identity.js');
const { hasPaidReport } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  let reportParams;
  let reportKey;
  try {
    reportParams = normalizeBaziReportParams(req.query || {});
    reportKey = makeReportKey('bazi', reportParams);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid report parameters' });
  }

  try {
    const unlocked = await hasPaidReport(user.uid, 'bazi', reportKey);
    return res.status(200).json({ unlocked: !!unlocked, report_key: reportKey });
  } catch (_) {
    return res.status(500).json({ error: 'Unable to check report access' });
  }
};
