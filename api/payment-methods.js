const { availableMethods } = require('../lib/payment-channels.js');
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const methods = availableMethods();
  const preferred = process.env.PAY_DEFAULT_METHOD || 'wechat';
  return res.status(200).json({ methods,
    default_method: methods.some(item => item.id === preferred) ? preferred : (methods[0] || {}).id || null });
};
