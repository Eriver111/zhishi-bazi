const { config } = require('./xunhu-payment.js');

// Channel switches affect new orders only. Historical callbacks remain valid.
function enabled(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function availableMethods(env = process.env, mode) {
  return [
    { id: 'wechat', label: '微信支付', in_app_supported: enabled(env.XUNHU_WECHAT_IN_APP_ENABLED, false) },
    { id: 'alipay', label: '支付宝', in_app_supported: false }
  ].filter(({ id }) => {
    if (mode === 'monthly' && id !== 'alipay') return false;
    if (!enabled(env[id === 'wechat' ? 'PAY_WECHAT_ENABLED' : 'PAY_ALIPAY_ENABLED'], id === 'wechat')) return false;
    try { config(env, id); return true; } catch (_) { return false; }
  });
}

function selectMethod(requested, env = process.env, mode) {
  const methods = availableMethods(env, mode);
  const hasRequest = requested !== undefined && requested !== '';
  const preferred = hasRequest ? requested : env.PAY_DEFAULT_METHOD || 'wechat';
  if (methods.some(item => item.id === preferred)) return preferred;
  if (!hasRequest && methods.length) return methods[0].id;
  const error = new Error(mode === 'monthly'
    ? (methods.length ? '月度会员仅支持支付宝付款' : '月度会员仅支持支付宝，目前暂不可购买')
    : '该支付方式暂不可用，请刷新后选择其他支付方式');
  error.code = 'PAYMENT_METHOD_UNAVAILABLE';
  throw error;
}

function assertBrowserSupport(method, req, env = process.env) {
  const ua = String((req.headers || {})['user-agent'] || '');
  if (/MicroMessenger/i.test(ua) &&
      (method === 'alipay' || !enabled(env.XUNHU_WECHAT_IN_APP_ENABLED, false))) {
    const error = new Error('请点击微信右上角“…”选择“在浏览器打开”，再进行付款');
    error.code = 'EXTERNAL_BROWSER_REQUIRED';
    throw error;
  }
}

module.exports = { availableMethods, selectMethod, assertBrowserSupport };
