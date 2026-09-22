// Channel switches affect new orders only. Historical callbacks remain valid.
function enabled(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function availableMethods(env = process.env) {
  const methods = [];
  if (enabled(env.PAY_WECHAT_ENABLED, true) && env.XUNHU_APPID && env.XUNHU_APPSECRET && env.XUNHU_API_URL) {
    methods.push({ id: 'wechat', label: '微信支付', in_app_supported: enabled(env.XUNHU_WECHAT_IN_APP_ENABLED, false) });
  }
  // Explicit opt-in: a remaining legacy key must not re-enable the banned channel.
  if (enabled(env.PAY_ALIPAY_ENABLED, false) && env.PAY_PID && env.PAY_KEY) {
    methods.push({ id: 'alipay', label: '支付宝' });
  }
  return methods;
}

function selectMethod(requested, env = process.env) {
  const methods = availableMethods(env);
  const preferred = requested || env.PAY_DEFAULT_METHOD || 'wechat';
  if (methods.some(item => item.id === preferred)) return preferred;
  if (!requested && methods.length) return methods[0].id;
  const error = new Error('该支付方式暂不可用，请刷新后选择其他支付方式');
  error.code = 'PAYMENT_METHOD_UNAVAILABLE';
  throw error;
}

function assertBrowserSupport(method, req, env = process.env) {
  const ua = String((req.headers || {})['user-agent'] || '');
  if (method === 'wechat' && /MicroMessenger/i.test(ua) && !enabled(env.XUNHU_WECHAT_IN_APP_ENABLED, false)) {
    const error = new Error('请点击微信右上角“…”选择“在浏览器打开”，再进行付款');
    error.code = 'EXTERNAL_BROWSER_REQUIRED';
    throw error;
  }
}

module.exports = { availableMethods, selectMethod, assertBrowserSupport };
