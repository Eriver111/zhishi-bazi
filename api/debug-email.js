/**
 * GET /api/debug-email - 诊断邮件配置
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var aid = process.env.ALI_AK_ID || '';
  var asecret = process.env.ALI_AK_SECRET || '';
  var mfrom = process.env.MAIL_FROM || '';
  var site = process.env.SITE_URL || '';

  return res.status(200).json({
    has_id: !!aid,
    id_len: aid.length,
    id_prefix: aid.slice(0, 5) + '...',
    has_secret: !!asecret,
    secret_len: asecret.length,
    mail_from: mfrom,
    site_url: site
  });
};
