const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(root, 'lib', 'auth.js'));
const supabasePath = require.resolve(path.join(root, 'lib', 'supabase.js'));

function response() {
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

function loadHandler(relativePath, authMock, supabaseMock) {
  const handlerPath = path.join(root, relativePath);
  const resolved = require.resolve(handlerPath);
  const previousHandler = require.cache[resolved];
  const previousAuth = require.cache[authPath];
  const previousSupabase = require.cache[supabasePath];
  delete require.cache[resolved];
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true, exports: authMock
  };
  require.cache[supabasePath] = {
    id: supabasePath, filename: supabasePath, loaded: true, exports: supabaseMock
  };
  try {
    return require(resolved);
  } finally {
    if (previousHandler) require.cache[resolved] = previousHandler;
    else delete require.cache[resolved];
    if (previousAuth) require.cache[authPath] = previousAuth;
    else delete require.cache[authPath];
    if (previousSupabase) require.cache[supabasePath] = previousSupabase;
    else delete require.cache[supabasePath];
  }
}

test('report access rejects a missing token with 401', async () => {
  const handler = loadHandler('api/reports/access.js', { requireAuth: () => null }, {});
  const res = response();

  await handler({ method: 'GET', query: {}, headers: {} }, res);

  assert.equal(res.statusCode, 401);
});

test('report access returns true only for the authenticated canonical key', async () => {
  let received;
  const handler = loadHandler(
    'api/reports/access.js',
    { requireAuth: () => ({ uid: 7 }) },
    { hasPaidReport: async (...args) => { received = args; return true; } }
  );
  const res = response();

  await handler({
    method: 'GET',
    query: { year: '1990', month: '6', day: '15', hour: '8', gender: 'male', user_id: '999' },
    headers: {}
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['report_key', 'unlocked']);
  assert.equal(res.body.unlocked, true);
  assert.equal(received[0], 7);
  assert.equal(received[1], 'bazi');
  assert.match(received[2], /^[0-9a-f]{64}$/);
});

test('report access rejects invalid parameters with 400', async () => {
  const handler = loadHandler(
    'api/reports/access.js',
    { requireAuth: () => ({ uid: 7 }) },
    { hasPaidReport: async () => { throw new Error('must not query invalid reports'); } }
  );
  const res = response();

  await handler({ method: 'GET', query: { gender: 'male' }, headers: {} }, res);

  assert.equal(res.statusCode, 400);
});

test('report list returns only the safe paid-row shape', async () => {
  const handler = loadHandler(
    'api/reports/index.js',
    { requireAuth: () => ({ uid: 7 }) },
    { listPaidReports: async userId => {
      assert.equal(userId, 7);
      return [{
        report_type: 'bazi',
        report_key: 'a'.repeat(64),
        report_params: { year: 1990, month: 6, day: 15, hour: 8, gender: 'male' },
        label: '乾造 · 1990年6月15日',
        paid_at: '2026-07-30T12:00:00.000Z',
        user_id: 7,
        payment_reference: 'private'
      }];
    } }
  );
  const res = response();

  await handler({ method: 'GET', query: { user_id: '999' }, headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reports.length, 1);
  assert.deepEqual(Object.keys(res.body.reports[0]).sort(),
    ['label', 'paid_at', 'report_key', 'report_params', 'report_type']);
});

test('report list rejects a missing token with 401', async () => {
  const handler = loadHandler('api/reports/index.js', { requireAuth: () => null }, {});
  const res = response();

  await handler({ method: 'GET', headers: {} }, res);

  assert.equal(res.statusCode, 401);
});
