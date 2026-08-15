const { requireAuth } = require('../../lib/auth.js');
const { normalizeBaziReportParams, makeReportKey } = require('../../lib/report-identity.js');
const { getPaidReportAccess, hasPaidReport } = require('../../lib/supabase.js');

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
    const access = getPaidReportAccess
      ? await getPaidReportAccess(user.uid, 'bazi', reportKey)
      : { unlocked: await hasPaidReport(user.uid, 'bazi', reportKey), paid_at: null };
    return res.status(200).json({
      unlocked: !!(access && access.unlocked),
      report_key: reportKey,
      paid_at: access && access.paid_at ? access.paid_at : null
    });
  } catch (_) {
    return res.status(500).json({ error: 'Unable to check report access' });
  }
};
