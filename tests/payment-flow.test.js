const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const createOrderPath = path.join(root, 'api', 'create-order.js');
const callbackPath = path.join(root, 'api', 'callback.js');
const checkOrderPath = path.join(root, 'api', 'check-order.js');
const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));
const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
const { normalizeBaziReportParams, makeReportKey } = require(path.join(root, 'lib', 'report-identity.js'));

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

function loadFreshWithMocks(modulePath, mocks) {
  const resolved = require.resolve(modulePath);
  const previousModule = require.cache[resolved];
  const previousMocks = new Map();
  delete require.cache[resolved];
  for (const [modulePath, mock] of Object.entries(mocks)) {
    previousMocks.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports: mock
    };
  }
  const handler = require(resolved);
  return {
    handler,
    restore() {
      if (previousModule) require.cache[resolved] = previousModule;
      else delete require.cache[resolved];
      for (const [modulePath, previous] of previousMocks) {
        if (previous) require.cache[modulePath] = previous;
        else delete require.cache[modulePath];
      }
    }
  };
}

function withPaymentEnv(fn) {
  const previous = {
    PAY_PID: process.env.PAY_PID,
    PAY_KEY: process.env.PAY_KEY,
    SITE_URL: process.env.SITE_URL
  };
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

test('create-order preserves the gateway QR content and QR image as different fields', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let postedBody = '';
    global.fetch = async (_url, options) => {
      postedBody = String(options.body);
      return {
        async text() {
          return JSON.stringify({
            code: 1,
            msg: 'success',
            O_id: 'gateway-1',
            trade_no: 'credit10_example',
            payurl: 'https://cashier.example/pay/1',
            payurl2: '',
            qrcode: 'alipays://platformapi/startapp?saId=10000007',
            img: 'https://zpayz.cn/qrcode/example.jpg'
          });
        }
      };
    };

    try {
      const handler = loadFresh(createOrderPath);
      const req = {
        method: 'POST',
        body: { mode: 'credit_10', amount: 9.9, name: 'AI进阶包·10次' },
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'Desktop Browser' }
      };
      const res = jsonResponse();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.pay_url, 'https://cashier.example/pay/1');
      assert.equal(res.body.qr_content, 'alipays://platformapi/startapp?saId=10000007');
      assert.equal(res.body.qr_image, 'https://zpayz.cn/qrcode/example.jpg');
      assert.equal(res.body.qrcode, 'alipays://platformapi/startapp?saId=10000007');
      assert.match(postedBody, /clientip=203\.0\.113\.7/);
      assert.match(postedBody, /device=pc/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('create-order reports a gateway failure instead of turning mapi.php into a payment QR', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ async text() { return '<html>gateway unavailable</html>'; } });

    try {
      const handler = loadFresh(createOrderPath);
      const req = {
        method: 'POST',
        body: { mode: 'credit_10', amount: 9.9, name: 'AI进阶包·10次' },
        headers: { 'x-forwarded-for': '203.0.113.8', 'user-agent': 'Desktop Browser' }
      };
      const res = jsonResponse();

      await handler(req, res);

      assert.equal(res.statusCode, 502);
      assert.equal(res.body.error, '支付服务返回异常，请稍后重试');
      assert.equal(res.body.pay_url, undefined);
      assert.equal(res.body.qrcode, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('create-order converts a Chinese hepan identity into a safe short gateway order number', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let gatewayOrderId = '';
    let postedMoney = '';
    global.fetch = async (_url, options) => {
      const form = new URLSearchParams(String(options.body));
      gatewayOrderId = form.get('out_trade_no') || '';
      postedMoney = form.get('money') || '';
      return {
        async text() {
          return JSON.stringify({
            code: 1,
            msg: 'success',
            O_id: 'gateway-hepan-1',
            trade_no: gatewayOrderId,
            payurl: 'https://cashier.example/pay/hepan',
            payurl2: '',
            qrcode: 'alipays://platformapi/startapp?saId=10000007',
            img: 'https://zpayz.cn/qrcode/hepan.jpg'
          });
        }
      };
    };

    try {
      const handler = loadFresh(createOrderPath);
      const req = {
        method: 'POST',
        body: {
          hash: '甲|子|乙|丑|婚恋',
          amount: 0.01,
          description: '合盘完整分析报告'
        },
        headers: {
          referer: 'https://zhishi.online/hepan-result.html?p1=example&p2=example',
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'Desktop Browser'
        }
      };
      const res = jsonResponse();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.match(gatewayOrderId, /^hepan_[a-z0-9]+_[0-9a-f]{6}$/);
      assert.ok(gatewayOrderId.length <= 32);
      assert.equal(res.body.out_trade_no, gatewayOrderId);
      assert.equal(postedMoney, '13.9');
      assert.equal(res.body.amount, 13.9);
      assert.equal(res.body.report_key, gatewayOrderId.split('_').pop());
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('create-order ignores a browser-supplied BaZi report price and charges the fixed server price', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let postedMoney = '';
    global.fetch = async (_url, options) => {
      postedMoney = new URLSearchParams(String(options.body)).get('money') || '';
      return {
        async text() {
          return JSON.stringify({
            code: 1,
            msg: 'success',
            O_id: 'gateway-bazi-1',
            trade_no: 'bazi_example',
            payurl: 'https://cashier.example/pay/bazi',
            payurl2: '',
            qrcode: 'alipays://platformapi/startapp?saId=10000007',
            img: 'https://zpayz.cn/qrcode/bazi.jpg'
          });
        }
      };
    };

    try {
      const handler = loadFresh(createOrderPath);
      const req = {
        method: 'POST',
        body: {
          year: 1990,
          month: 6,
          day: 15,
          hour: 8,
          gender: 'female',
          amount: 0.01,
          description: '八字完整分析报告'
        },
        headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'Desktop Browser' }
      };
      const res = jsonResponse();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(postedMoney, '9.9');
      assert.equal(res.body.amount, 9.9);
      assert.match(res.body.out_trade_no, /^bazi_[a-z0-9]+_/);
      assert.equal(res.body.report_key, makeReportKey('bazi', req.body));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('logged-in BaZi order is stored against the authenticated account', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let storedOrder = null;
    const { handler, restore } = loadFreshWithMocks(createOrderPath, {
      [authPath]: { verifyToken: () => ({ uid: 7 }) },
      [supabasePath]: {
        hasPaidReport: async () => false,
        createReportOrder: async (order) => {
          storedOrder = { ...order, status: order.status || 'pending' };
          return storedOrder;
        }
      }
    });
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          payurl: 'https://cashier.example/pay/bazi-account',
          qrcode: 'alipays://platformapi/startapp?saId=10000007'
        });
      }
    });

    const reportParams = {
      year: 1990, month: 6, day: 15, hour: 8, gender: 'female'
    };
    try {
      const res = jsonResponse();
      await handler({
        method: 'POST',
        body: { token: 'account-token', report_params: reportParams, amount: 0.01 },
        headers: { 'x-forwarded-for': '203.0.113.11', 'user-agent': 'Desktop Browser' }
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(storedOrder.user_id, 7);
      assert.equal(storedOrder.status, 'pending');
      assert.equal(storedOrder.report_type, 'bazi');
      assert.deepEqual(storedOrder.report_params, normalizeBaziReportParams(reportParams));
      assert.equal(storedOrder.report_key, makeReportKey('bazi', reportParams));
      assert.equal(res.body.report_key, storedOrder.report_key);
    } finally {
      global.fetch = originalFetch;
      restore();
    }
  });
});

test('already-owned BaZi report returns without calling the gateway', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let fetchCalls = 0;
    const { handler, restore } = loadFreshWithMocks(createOrderPath, {
      [authPath]: { verifyToken: () => ({ uid: 7 }) },
      [supabasePath]: {
        hasPaidReport: async () => true,
        createReportOrder: async () => { throw new Error('owned report must not create an order'); }
      }
    });
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error('owned report must not call the gateway');
    };

    const reportParams = {
      year: 1990, month: 6, day: 15, hour: 8, gender: 'female'
    };
    try {
      const res = jsonResponse();
      await handler({
        method: 'POST',
        body: { token: 'account-token', report_params: reportParams },
        headers: { 'x-forwarded-for': '203.0.113.12', 'user-agent': 'Desktop Browser' }
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.already_unlocked, true);
      assert.equal(res.body.report_key, makeReportKey('bazi', reportParams));
      assert.equal(fetchCalls, 0);
    } finally {
      global.fetch = originalFetch;
      restore();
    }
  });
});

test('guest BaZi order remains allowed with a null user_id', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = global.fetch;
    let storedOrder = null;
    const { handler, restore } = loadFreshWithMocks(createOrderPath, {
      [supabasePath]: {
        hasPaidReport: async () => false,
        createReportOrder: async (order) => {
          storedOrder = { ...order, status: order.status || 'pending' };
          return storedOrder;
        }
      }
    });
    global.fetch = async () => ({
      async text() {
        return JSON.stringify({
          code: 1,
          payurl: 'https://cashier.example/pay/bazi-guest',
          qrcode: 'alipays://platformapi/startapp?saId=10000007'
        });
      }
    });

    const reportParams = {
      year: 1990, month: 6, day: 15, hour: 8, gender: 'female'
    };
    try {
      const res = jsonResponse();
      await handler({
        method: 'POST',
        body: { report_params: reportParams },
        headers: { 'x-forwarded-for': '203.0.113.13', 'user-agent': 'Desktop Browser' }
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(storedOrder.user_id, null);
      assert.equal(storedOrder.status, 'pending');
      assert.equal(res.body.report_key, storedOrder.report_key);
    } finally {
      global.fetch = originalFetch;
      restore();
    }
  });
});

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
