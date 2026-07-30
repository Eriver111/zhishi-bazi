const { requireAuth } = require('../../lib/auth.js');
const { listPaidReports } = require('../../lib/supabase.js');

function safeReport(row) {
  return {
    report_type: row.report_type,
    report_key: row.report_key,
    label: row.label,
    report_params: row.report_params,
    paid_at: row.paid_at
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    const reports = await listPaidReports(user.uid);
    return res.status(200).json({ reports: reports.map(safeReport) });
  } catch (_) {
    return res.status(500).json({ error: 'Unable to list reports' });
  }
};
