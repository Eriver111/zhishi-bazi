const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const endpointPath = require.resolve('../api/admin/dashboard.js');
const storagePath = require.resolve('../lib/supabase.js');

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function fakeDatabase(records = {}) {
  return {
    from(table) {
      let head = false;
      const builder = {
        select(_fields, options) { head = Boolean(options && options.head); return builder; }, gte() { return builder; }, order() { return builder; }, limit() { return builder; },
        then(resolve) { const rows = records[table] || []; return Promise.resolve({ data: head ? null : rows, count: head ? rows.length : null, error: null }).then(resolve); }
      };
      return builder;
    }
  };
}

async function loadHandler(db) {
  const previousEndpoint = require.cache[endpointPath];
  const previousStorage = require.cache[storagePath];
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: { getSupabase: () => db } };
  delete require.cache[endpointPath];
  const handler = require(endpointPath);
  return {
    handler,
    restore() {
      delete require.cache[endpointPath];
      if (previousEndpoint) require.cache[endpointPath] = previousEndpoint;
      if (previousStorage) require.cache[storagePath] = previousStorage; else delete require.cache[storagePath];
    }
  };
}

async function withAdminKey(value, callback) {
  const existed = Object.prototype.hasOwnProperty.call(process.env, 'ADMIN_KEY');
  const previous = process.env.ADMIN_KEY;
  if (value === undefined) delete process.env.ADMIN_KEY; else process.env.ADMIN_KEY = value;
  try { return await callback(); }
  finally { if (existed) process.env.ADMIN_KEY = previous; else delete process.env.ADMIN_KEY; }
}

test('新版后台独立存在并保留旧后台', () => {
  const html = fs.readFileSync(path.join(root, 'admin-v2.html'), 'utf8');
  assert.equal(fs.existsSync(path.join(root, 'admin.html')), true);
  ['运营总览', '用户与会员', '交易与报告', 'AI 使用', '访问流量', '用户反馈', '系统状态'].forEach(label => assert.match(html, new RegExp(label)));
  assert.match(html, /sessionStorage\.getItem\('zhishi_admin_session'\)/);
  assert.match(html, /'X-Admin-Key':state\.key/);
  assert.doesNotMatch(html, /[?&]key=/);
  assert.doesNotMatch(html, /fetch\([^\n]+(?:delete|update|grant|credit-admin)/i);
  assert.match(html, /function esc\(value\)/);
  assert.match(html, /@media\(max-width:760px\)/);
});

test('新版后台 API 在服务端未配置密钥时关闭', async () => withAdminKey(undefined, async () => {
  const loaded = await loadHandler(fakeDatabase());
  try {
    const res = response();
    await loaded.handler({ method: 'GET', headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /密钥/);
  } finally { loaded.restore(); }
}));

test('新版后台 API 拒绝错误请求头且不接受 URL 密钥', async () => withAdminKey('correct-secret', async () => {
  const loaded = await loadHandler(fakeDatabase());
  try {
    const res = response();
    await loaded.handler({ method: 'GET', headers: { 'x-admin-key': 'wrong' }, query: { key: 'correct-secret' } }, res);
    assert.equal(res.statusCode, 403);
  } finally { loaded.restore(); }
}));

test('新版后台 API 正确密钥仅返回只读数据', async () => withAdminKey('correct-secret', async () => {
  const loaded = await loadHandler(fakeDatabase());
  try {
    const res = response();
    await loaded.handler({ method: 'GET', headers: { 'x-admin-key': 'correct-secret' }, query: { range: '7' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.range, 7);
    assert.equal(res.body.system.admin_mode, 'read-only');
    assert.match(res.headers['Cache-Control'], /no-store/);
  } finally { loaded.restore(); }
}));

test('积分汇总区分已使用、剩余和累计发放', async () => withAdminKey('correct-secret', async () => {
  const loaded = await loadHandler(fakeDatabase({ user_credits: [
    { id: 1, credits: 7, total_used: 3, user_id: 8, created_at: new Date().toISOString() },
    { id: 2, credits: 0, total_used: 5, user_id: 9, created_at: new Date().toISOString() }
  ] }));
  try {
    const res = response();
    await loaded.handler({ method: 'GET', headers: { 'x-admin-key': 'correct-secret' }, query: {} }, res);
    assert.equal(res.body.summary.credits_remaining, 7);
    assert.equal(res.body.summary.credits_used, 8);
    assert.equal(res.body.summary.credits_issued, 15);
  } finally { loaded.restore(); }
}));
