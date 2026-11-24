const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const callbackPath = path.join(root, 'api', 'callback.js');
const checkOrderPath = path.join(root, 'api', 'check-order.js');
const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));

function jsonResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function loadFresh(modulePath, supabaseMock) {
  const resolved = require.resolve(modulePath);
  const previousSupabase = require.cache[supabasePath];
  delete require.cache[resolved];
  if (supabaseMock) {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: supabaseMock
    };
  }
  const loaded = require(resolved);
  if (previousSupabase) require.cache[supabasePath] = previousSupabase;
  else delete require.cache[supabasePath];
  return loaded;
}

function withPaymentEnv(fn) {
  const previous = {
    PAY_ALIPAY_ENABLED: process.env.PAY_ALIPAY_ENABLED,
    PAY_DEFAULT_METHOD: process.env.PAY_DEFAULT_METHOD,
    PAY_PID: process.env.PAY_PID,
    PAY_KEY: process.env.PAY_KEY,
    SITE_URL: process.env.SITE_URL
  };
  process.env.PAY_ALIPAY_ENABLED = 'true';
  process.env.PAY_DEFAULT_METHOD = 'alipay';
  process.env.PAY_PID = 'merchant';
  process.env.PAY_KEY = 'secret';
  process.env.SITE_URL = 'https://zhishi.online';
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('callback signature verification ignores empty fields documented as unsigned', async () => {
  await withPaymentEnv(async () => {
    let inserted = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        inserted += 1;
        return { code: 'ABCDEFGH', credits: 10 };
      },
      activateMonthly: async () => null
    });
    const req = {
      method: 'GET',
      query: {
        pid: 'merchant',
        money: '9.90',
        out_trade_no: 'credit10_u12_abc_123',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        buyer: '',
        param: '',
        sign_type: 'MD5',
        sign: '2c0dee244442dcfe52f95043ca7e90fa'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'success');
    assert.equal(inserted, 1);
  });
});

test('callback asks the gateway to retry when a paid credit order cannot be stored', async () => {
  await withPaymentEnv(async () => {
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (fn) => { fn(); return 0; };
    let attempts = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        attempts += 1;
        return null;
      },
      activateMonthly: async () => null
    });
    const req = {
      method: 'GET',
      query: {
        money: '9.90',
        out_trade_no: 'credit10_u12_abc_123',
        pid: 'merchant',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        sign_type: 'MD5',
        sign: '2c0dee244442dcfe52f95043ca7e90fa'
      }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.setTimeout = originalSetTimeout;
    }

    assert.equal(attempts, 4);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body, 'fail');
  });
});

test('callback never grants credits for a signed transaction that is not successful', async () => {
  await withPaymentEnv(async () => {
    let inserted = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        inserted += 1;
        return { code: 'ABCDEFGH', credits: 10 };
      },
      activateMonthly: async () => null
    });
    const req = {
      method: 'GET',
      query: {
        money: '9.90',
        out_trade_no: 'credit10_u12_abc_123',
        pid: 'merchant',
        trade_status: 'TRADE_CLOSED',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'ad82c355c2982a23d61fb57234311200'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'success');
    assert.equal(inserted, 0);
  });
});

test('callback refuses to grant a product whose paid amount does not match its fixed price', async () => {
  await withPaymentEnv(async () => {
    let inserted = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        inserted += 1;
        return { code: 'ABCDEFGH', credits: 10 };
      },
      activateMonthly: async () => null
    });
    const req = {
      method: 'GET',
      query: {
        money: '0.01',
        out_trade_no: 'credit10_u12_abc_123',
        pid: 'merchant',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'd0b881327a22f6b6a5e3059f249a5ae6'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'amount error');
    assert.equal(inserted, 0);
  });
});

test('callback requires an explicit TRADE_SUCCESS status before granting credits', async () => {
  await withPaymentEnv(async () => {
    let inserted = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        inserted += 1;
        return { code: 'ABCDEFGH', credits: 10 };
      },
      activateMonthly: async () => null
    });
    const req = {
      method: 'GET',
      query: {
        money: '9.90',
        out_trade_no: 'credit10_u12_abc_123',
        pid: 'merchant',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'ba91b78132c45bdea69627945438878a'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'success');
    assert.equal(inserted, 0);
  });
});

test('valid current Hepan callback acknowledges success without a persisted report row', async () => {
  await withPaymentEnv(async () => {
    const handler = loadFresh(callbackPath, {
      getReportOrder: async () => null,
      markReportOrderPaid: async () => {
        throw new Error('current Hepan orders are not persisted report rows');
      }
    });
    const req = {
      method: 'GET',
      query: {
        money: '13.90',
        out_trade_no: 'hepan_example_abcdef',
        pid: 'merchant',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'e0979c3af52d31a7fa04d086888109c9'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'success');
  });
});

test('signed paid BaZi callback marks its report order paid', async () => {
  await withPaymentEnv(async () => {
    let paidOrderId = '';
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => ({ order_id: 'bazi_example_abcdef', report_type: 'bazi', status: 'pending' }),
      markReportOrderPaid: async (orderId) => {
        paidOrderId = orderId;
        return { order_id: orderId, report_type: 'bazi', status: 'paid' };
      },
      insertCredits: async () => { throw new Error('report callback must not grant credits'); },
      activateMonthly: async () => { throw new Error('report callback must not activate monthly access'); }
    });
    const req = {
      method: 'GET',
      query: {
        money: '9.90',
        out_trade_no: 'bazi_example_abcdef',
        pid: 'merchant',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'cae2c4fa2e39a4d4fc7ba551ee06622b'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'success');
    assert.equal(paidOrderId, 'bazi_example_abcdef');
  });
});

test('report callback with wrong amount does not grant access', async () => {
  await withPaymentEnv(async () => {
    let marked = 0;
    const handler = loadFresh(callbackPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => ({ order_id: 'bazi_example_abcdef', report_type: 'bazi', status: 'pending' }),
      markReportOrderPaid: async () => { marked += 1; return null; },
      insertCredits: async () => { throw new Error('report callback must not grant credits'); },
      activateMonthly: async () => { throw new Error('report callback must not activate monthly access'); }
    });
    const req = {
      method: 'GET',
      query: {
        money: '0.01',
        out_trade_no: 'bazi_example_abcdef',
        pid: 'merchant',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
        sign_type: 'MD5',
        sign: 'c1b4ad7c4fce1d3f97cfa9194ad013ca'
      }
    };
    const res = jsonResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'amount error');
    assert.equal(marked, 0);
  });
});

test('check-order never mints credits from polling when the callback record is missing', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          msg: '查询订单号成功！',
          trade_no: 'gateway-trade-1',
          out_trade_no: 'credit10_u12_abc_123',
          type: 'alipay',
          pid: 'merchant',
          addtime: '2026-07-29 10:00:00',
          endtime: '2026-07-29 10:01:00',
          name: 'AI进阶包·10次',
          money: '9.90',
          status: '1',
          param: '',
          buyer: ''
        });
      }
    });
    let inserted = 0;
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null,
      insertCredits: async () => {
        inserted += 1;
        return null;
      },
      activateMonthly: async () => null
    });
    const req = { method: 'GET', query: { out_trade_no: 'credit10_u12_abc_123' } };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.paid, false);
    assert.equal(res.body.status, 'pending');
    assert.equal(inserted, 0);
  });
});

test('paid report polling repairs a missed callback', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let paidOrderId = '';
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'bazi_example_abcdef',
          money: '9.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => ({
        order_id: 'bazi_example_abcdef', report_type: 'bazi', report_key: 'saved-report-key', status: 'pending'
      }),
      markReportOrderPaid: async (orderId) => {
        paidOrderId = orderId;
        return { order_id: orderId, status: 'paid' };
      }
    });
    const res = jsonResponse();

    try {
      await handler({
        method: 'GET',
        query: { out_trade_no: 'bazi_example_abcdef', expected_type: 'bazi' }
      }, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'paid');
    assert.equal(res.body.report_key, 'saved-report-key');
    assert.equal(paidOrderId, 'bazi_example_abcdef');
  });
});

test('report polling does not repair a pending order stored with a different report type', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let marked = 0;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'bazi_example_abcdef',
          money: '9.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => ({
        order_id: 'bazi_example_abcdef', report_type: 'hepan', report_key: 'wrong-type-key', status: 'pending'
      }),
      markReportOrderPaid: async () => { marked += 1; return null; }
    });
    const res = jsonResponse();

    try {
      await handler({
        method: 'GET',
        query: { out_trade_no: 'bazi_example_abcdef', expected_type: 'bazi' }
      }, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'invalid');
    assert.equal(marked, 0);
  });
});

test('check-order rejects an unsupported legacy report order without querying the gateway', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let queried = 0;
    global.fetch = async () => {
      queried += 1;
      throw new Error('unsupported orders must not reach the gateway');
    };
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null
    });
    const req = { method: 'GET', query: { out_trade_no: 'rpt_legacy_123' } };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'invalid');
    assert.equal(queried, 0);
  });
});

test('check-order restores a paid legacy Hepan report only with its exact product name and price', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'rpt_legacy_123',
          name: '合盘完整分析报告',
          money: '13.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => null,
      markReportOrderPaid: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'rpt_legacy_123', expected_type: 'hepan' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'paid');
    assert.equal(res.body.report_type, 'hepan');
    assert.equal(res.body.report_key, 'legacy');
  });
});

test('check-order refuses a legacy Hepan order with an unrelated product name', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'rpt_legacy_123',
          name: '其他商品',
          money: '13.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'rpt_legacy_123', expected_type: 'hepan' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'pending');
  });
});

test('check-order only unlocks a paid BaZi report at its fixed price', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'bazi_example_abcdef',
          money: '9.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null,
      getReportOrder: async () => null,
      markReportOrderPaid: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'bazi_example_abcdef', expected_type: 'bazi' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'paid');
    assert.equal(res.body.report_type, 'bazi');
    assert.equal(typeof res.body.token, 'string');
  });
});

test('check-order refuses a paid report whose gateway amount is wrong', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          out_trade_no: 'hepan_example_abcdef',
          money: '0.01',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'hepan_example_abcdef', expected_type: 'hepan' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'pending');
  });
});

test('check-order requires the gateway to return the exact report order number', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          money: '9.90',
          status: '1'
        });
      }
    });
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'bazi_example_abcdef', expected_type: 'bazi' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'pending');
  });
});

test('check-order refuses to unlock a different report type', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let queried = 0;
    global.fetch = async () => {
      queried += 1;
      throw new Error('type mismatch must be rejected before querying');
    };
    const handler = loadFresh(checkOrderPath, {
      getCreditsByOrderId: async () => null
    });
    const req = {
      method: 'GET',
      query: { out_trade_no: 'bazi_example_abcdef', expected_type: 'hepan' }
    };
    const res = jsonResponse();

    try {
      await handler(req, res);
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'invalid');
    assert.equal(queried, 0);
  });
});

test('browser payment resolver displays a gateway QR image without encoding the image URL', () => {
  const PaymentFlow = require('../js/payment.js');
  const resolved = PaymentFlow.resolvePayment({
    pay_url: 'https://cashier.example/pay/1',
    qr_content: 'alipays://platformapi/startapp?saId=10000007',
    qr_image: 'https://zpayz.cn/qrcode/example.jpg'
  });

  assert.deepEqual(resolved, {
    payUrl: 'https://cashier.example/pay/1',
    qrContent: 'alipays://platformapi/startapp?saId=10000007',
    qrImageUrl: 'https://zpayz.cn/qrcode/example.jpg'
  });
});

test('browser payment resolver encodes QR content exactly once when no image is supplied', () => {
  const PaymentFlow = require('../js/payment.js');
  const content = 'alipays://platformapi/startapp?saId=10000007&clientVersion=10.6';
  const resolved = PaymentFlow.resolvePayment({
    pay_url: 'https://cashier.example/pay/2',
    qr_content: content,
    qrcode: content
  });

  const qrUrl = new URL(resolved.qrImageUrl);
  assert.equal(qrUrl.origin + qrUrl.pathname, 'https://api.quickchart.io/qr');
  assert.equal(qrUrl.searchParams.get('text'), content);
  assert.equal(resolved.payUrl, 'https://cashier.example/pay/2');
  assert.equal(resolved.qrContent, content);
});

test('browser payment resolver refuses the mapi API endpoint as a customer payment destination', () => {
  const PaymentFlow = require('../js/payment.js');
  const resolved = PaymentFlow.resolvePayment({
    pay_url: 'https://zpayz.cn/mapi.php?pid=merchant',
    qrcode: 'https://api.quickchart.io/qr?text=https%3A%2F%2Fzpayz.cn%2Fmapi.php'
  });

  assert.deepEqual(resolved, { payUrl: '', qrContent: '', qrImageUrl: '' });
});
