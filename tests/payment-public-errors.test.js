const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const PaymentFlow = require('../js/payment.js');
const SYNTHETIC_DETAIL = 'internal-provider.example pid=fixture-merchant key=fixture-only-secret trace=private-stack';

// Isolated handler execution: do not import the real store, auth or environment.
function load(name, { gateway, database = {}, authenticated = false } = {}) {
  const events = [];
  const db = {
    createReportOrder: async () => events.push('create-report'),
    hasPaidReport: async () => false,
    getReportOrder: async () => null,
    getCreditsByOrderId: async () => null,
    markReportOrderPaid: async () => events.push('mark-paid'),
    ...database
  };
  const dependencies = {
    crypto: require('node:crypto'),
    '../lib/payment-contract.js': require('../lib/payment-contract.js'),
    '../lib/report-identity.js': require('../lib/report-identity.js'),
    '../lib/supabase.js': db,
    '../lib/payment-channels.js': require('../lib/payment-channels.js'),
    '../lib/auth.js': { verifyToken: () => authenticated ? { uid: 123 } : null }
  };
  const sandbox = {
    module: { exports: {} }, URLSearchParams, Buffer,
    process: { env: { PAY_ALIPAY_ENABLED: 'true', PAY_DEFAULT_METHOD: 'alipay', PAY_PID: 'fixture-merchant', PAY_KEY: 'fixture-only-secret',
      SITE_URL: 'https://site.example', PAY_API_URL: 'https://internal-provider.example/mapi.php', TOKEN_SECRET: 'fixture-token-only' } },
    console: { log() {}, warn() {}, error() {} },
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), 'unexpected dependency: ' + id);
      return dependencies[id];
    },
    async fetch(url, options) {
      events.push('gateway');
      assert.ok(gateway, 'unexpected network access');
      return gateway(url, options);
    }
  };
  const filename = path.join(root, 'api', name + '.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return { handler: sandbox.module.exports, events };
}

function response() {
  return {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

const orders = {
  credits: { mode: 'credit_10' },
  hepan: { hash: 'synthetic-chart-pair' },
  bazi: { year: 2000, month: 6, day: 15, hour: 6, gender: 'female' }
};
const failures = {
  'raw response': async () => ({ text: async () => '<html>' + SYNTHETIC_DETAIL + '</html>' }),
  'upstream rejection': async () => ({ text: async () => JSON.stringify({ code: 0, msg: SYNTHETIC_DETAIL }) }),
  'network exception': async () => { throw new Error(SYNTHETIC_DETAIL); }
};

for (const [product, body] of Object.entries(orders)) {
  for (const [failure, gateway] of Object.entries(failures)) {
    test(`${product} order conceals ${failure} without returning a payment URL`, async () => {
      const { handler, events } = load('create-order', { gateway });
      const res = response();
      await handler({ method: 'POST', body, headers: {} }, res);
      assert.equal(res.statusCode, 502);
      assert.equal(typeof res.body.error, 'string');
      assert.doesNotMatch(JSON.stringify(res.body), /internal-provider|fixture-|private-stack|pid=|key=|<html>/);
      assert.equal(res.body.pay_url, undefined);
      assert.equal(res.body.detail, undefined);
      assert.equal(events.filter(e => e === 'gateway').length, 1);
      assert.ok(!events.includes('mark-paid'));
    });
  }
}

test('unexpected create-order exceptions do not expose detail or trigger payment', async () => {
  const { handler, events } = load('create-order', { authenticated: true,
    database: { hasPaidReport: async () => { throw new Error(SYNTHETIC_DETAIL); } } });
  const res = response();
  await handler({ method: 'POST', body: { ...orders.bazi, token: 'fixture-token' }, headers: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body)), { error: '服务器内部错误，请稍后重试' });
  assert.deepEqual(events, []);
});

for (const orderId of ['bazi_fixture_order', 'hepan_fixture_order', 'credit10_fixture_order']) {
  test(`check-order conceals dependency exceptions for ${orderId}`, async () => {
    const reject = async () => { throw new Error(SYNTHETIC_DETAIL); };
    const { handler, events } = load('check-order', { gateway: reject, database: { getCreditsByOrderId: reject } });
    const res = response();
    await handler({ method: 'GET', query: { orderId } }, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(JSON.parse(JSON.stringify(res.body)), {
      error: '暂时无法查询支付状态，请稍后重试', code: 'PAYMENT_STATUS_UNAVAILABLE'
    });
    assert.ok(!events.includes('mark-paid'));
  });
}

test('successful orders preserve actual cashier and QR destinations', async () => {
  const { handler } = load('create-order', { gateway: async () => ({ text: async () => JSON.stringify({
    code: 1, payurl: 'https://cashier.example/pay/order',
    qrcode: 'alipays://platformapi/startapp?saId=10000007',
    img: 'https://cashier.example/qrcode/order.png', msg: SYNTHETIC_DETAIL,
    key: 'fixture-only-secret', pid: 'fixture-merchant'
  }) }) });
  const res = response();
  await handler({ method: 'POST', body: orders.credits, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pay_url, 'https://cashier.example/pay/order');
  assert.equal(res.body.qr_image, 'https://cashier.example/qrcode/order.png');
  assert.equal(res.body.qr_content, 'alipays://platformapi/startapp?saId=10000007');
  assert.doesNotMatch(JSON.stringify(res.body), /fixture-only-secret|fixture-merchant|private-stack/);
});

test('generic API endpoint guard remains effective across hosts, paths and query strings', () => {
  for (const url of ['https://zpayz.cn/mapi.php?pid=fixture', 'https://other.example/mapi.php',
    'https://OTHER.example/service/MAPI.PHP?sign=fixture', 'http://other.example/mapi.php#test']) {
    assert.equal(PaymentFlow.isGatewayApiUrl(url), true);
    assert.deepEqual(PaymentFlow.resolvePayment({ pay_url: url }), { payUrl: '', qrContent: '', qrImageUrl: '' });
  }
  for (const url of ['https://cashier.example/pay/1', 'https://cashier.example/pay?return_url=/mapi.php',
    'alipays://platformapi/startapp?saId=10000007', 'https://cashier.example/qrcode/mapi.php.png']) {
    assert.equal(PaymentFlow.isGatewayApiUrl(url), false);
    assert.equal(PaymentFlow.resolvePayment({ pay_url: url }).payUrl, url);
  }
});
