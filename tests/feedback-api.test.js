const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');

const storagePath = require.resolve('../lib/supabase.js');
const handlerPath = require.resolve('../api/feedback.js');
const feedbackStore = require(storagePath);

const originalAppendFileSync = fs.appendFileSync;
const appendCalls = [];
fs.appendFileSync = function(...args) {
  appendCalls.push(args);
};
test.after(() => {
  fs.appendFileSync = originalAppendFileSync;
});

const handler = require(handlerPath);

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function request(body, overrides = {}) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9, 10.0.0.4',
      ...(overrides.headers || {})
    },
    body,
    ...overrides,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.9, 10.0.0.4',
      ...(overrides.headers || {})
    }
  };
}

async function withEnvironment(values, callback) {
  const previous = {};
  for (const [name, value] of Object.entries(values)) {
    previous[name] = {
      exists: Object.prototype.hasOwnProperty.call(process.env, name),
      value: process.env[name]
    };
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [name, entry] of Object.entries(previous)) {
      if (entry.exists) process.env[name] = entry.value;
      else delete process.env[name];
    }
  }
}

async function withFeedbackStore(overrides, callback) {
  const names = ['countRecentFeedback', 'createFeedback'];
  const previous = Object.fromEntries(names.map(name => [
    name,
    {
      exists: Object.prototype.hasOwnProperty.call(feedbackStore, name),
      value: feedbackStore[name]
    }
  ]));

  feedbackStore.countRecentFeedback = async () => 0;
  feedbackStore.createFeedback = async record => record;
  Object.assign(feedbackStore, overrides);

  try {
    return await callback();
  } finally {
    for (const [name, entry] of Object.entries(previous)) {
      if (entry.exists) feedbackStore[name] = entry.value;
      else delete feedbackStore[name];
    }
  }
}

function storageUnavailable(message = 'Feedback storage unavailable') {
  const error = new Error(message);
  error.code = 'FEEDBACK_STORAGE_UNAVAILABLE';
  return error;
}

test('feedback API stores normalized legacy/profile payload through shared storage without filesystem append', async () => {
  const beforeAppendCount = appendCalls.length;
  const countCalls = [];
  const stored = [];
  const createOptions = [];

  await withEnvironment({
    NODE_ENV: 'test',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, () => withFeedbackStore({
    async countRecentFeedback(clientKey, since) {
      countCalls.push({ clientKey, since });
      return 0;
    },
    async createFeedback(record, options) {
      stored.push(record);
      createOptions.push(options);
      return { id: 1, ...record };
    }
  }, async () => {
    const res = response();
    await handler(request({
      message: '  报告没有恢复  ',
      contact: '  EriverLife  ',
      page: '  profile  ',
      context: { reportId: 'report-7' }
    }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
  }));

  assert.equal(appendCalls.length, beforeAppendCount, 'feedback must never append to a filesystem file');
  assert.equal(countCalls.length, 1);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].message, '报告没有恢复');
  assert.equal(stored[0].contact, 'EriverLife');
  assert.equal(stored[0].page, 'profile');
  assert.deepEqual(stored[0].context, { reportId: 'report-7' });
  assert.match(stored[0].client_key, /^[a-f0-9]{64}$/);
  assert.equal('ip' in stored[0], false);
  assert.equal('client_ip' in stored[0], false);
  assert.equal(countCalls[0].clientKey, stored[0].client_key);
  assert.deepEqual(createOptions, [{
    since: countCalls[0].since,
    maxRecent: 5
  }]);

  const utcDate = stored[0].created_at.slice(0, 10);
  const expectedKey = crypto.createHash('sha256')
    .update('203.0.113.9' + 'rate-test-secret' + utcDate)
    .digest('hex');
  assert.equal(stored[0].client_key, expectedKey);

  const ageMs = Date.parse(stored[0].created_at) - Date.parse(countCalls[0].since);
  assert.ok(ageMs >= 599_000 && ageMs <= 601_000, 'recent-count window must be ten minutes');
});

test('feedback API rejects invalid field types, lengths, page syntax, and context shape before storage', async t => {
  const invalidBodies = [
    ['missing message', {}],
    ['non-string message', { message: 7 }],
    ['blank message', { message: ' \n ' }],
    ['message over 500 characters', { message: 'm'.repeat(501) }],
    ['non-string contact', { message: 'ok', contact: 7 }],
    ['contact over 100 characters', { message: 'ok', contact: 'c'.repeat(101) }],
    ['non-string page', { message: 'ok', page: 7 }],
    ['page over 32 characters', { message: 'ok', page: 'p'.repeat(33) }],
    ['page with unsupported characters', { message: 'ok', page: 'profile/other' }],
    ['array context', { message: 'ok', context: [] }],
    ['null context', { message: 'ok', context: null }],
    ['context over 1000 UTF-8 bytes', { message: 'ok', context: { note: 'a'.repeat(990) } }]
  ];

  await withEnvironment({
    NODE_ENV: 'test',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, () => withFeedbackStore({
    async countRecentFeedback() {
      assert.fail('invalid feedback must not query the rate-limit store');
    },
    async createFeedback() {
      assert.fail('invalid feedback must not be stored');
    }
  }, async () => {
    for (const [name, body] of invalidBodies) {
      await t.test(name, async () => {
        const res = response();
        await handler(request(body), res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.ok, false);
      });
    }
  }));
});

test('feedback API returns 413 when the raw, declared, or serialized body exceeds 4096 UTF-8 bytes', async t => {
  const cases = [
    ['raw body', request({ message: 'ok' }, { rawBody: Buffer.alloc(4097, 0x20) })],
    ['content length', request({ message: 'ok' }, { headers: { 'content-length': '4097' } })],
    ['serialized body', request({ message: '界'.repeat(1400) })]
  ];

  await withEnvironment({
    NODE_ENV: 'test',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, () => withFeedbackStore({
    async countRecentFeedback() {
      assert.fail('oversized feedback must not query the rate-limit store');
    },
    async createFeedback() {
      assert.fail('oversized feedback must not be stored');
    }
  }, async () => {
    for (const [name, req] of cases) {
      await t.test(name, async () => {
        const res = response();
        await handler(req, res);
        assert.equal(res.statusCode, 413);
        assert.equal(res.body.ok, false);
      });
    }
  }));
});

test('feedback API accepts exact field and context limits after trimming', async () => {
  const stored = [];
  const context = { note: 'a'.repeat(989) };
  assert.equal(Buffer.byteLength(JSON.stringify(context), 'utf8'), 1000);

  await withEnvironment({
    NODE_ENV: 'test',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, () => withFeedbackStore({
    async createFeedback(record) {
      stored.push(record);
      return record;
    }
  }, async () => {
    const res = response();
    await handler(request({
      message: '界'.repeat(500),
      contact: 'c'.repeat(100),
      page: 'A_12345678901234567890123456789-',
      context
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
  }));

  assert.equal(stored.length, 1);
  assert.equal(stored[0].message.length, 500);
  assert.equal(stored[0].contact.length, 100);
  assert.equal(stored[0].page.length, 32);
  assert.deepEqual(stored[0].context, context);
});

test('feedback API rate limits the sixth accepted attempt in a rolling ten-minute window', async () => {
  let createCalls = 0;

  await withEnvironment({
    NODE_ENV: 'test',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, () => withFeedbackStore({
    async countRecentFeedback() {
      return 5;
    },
    async createFeedback() {
      createCalls += 1;
    }
  }, async () => {
    const res = response();
    await handler(request({ message: 'one too many' }), res);

    assert.equal(res.statusCode, 429);
    assert.equal(res.body.ok, false);
  }));

  assert.equal(createCalls, 0);
});

test('feedback API returns 503 when production durable storage is unavailable or rejects the write', async t => {
  await withEnvironment({
    NODE_ENV: 'production',
    FEEDBACK_RATE_SECRET: 'rate-test-secret'
  }, async () => {
    await t.test('unavailable during recent count', async () => {
      await withFeedbackStore({
        async countRecentFeedback() {
          throw storageUnavailable();
        }
      }, async () => {
        const res = response();
        await handler(request({ message: 'help' }), res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.ok, false);
      });
    });

    await t.test('unavailable during create', async () => {
      await withFeedbackStore({
        async countRecentFeedback() {
          return 0;
        },
        async createFeedback() {
          throw storageUnavailable();
        }
      }, async () => {
        const res = response();
        await handler(request({ message: 'help' }), res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.ok, false);
      });
    });
  });
});

test('local feedback fallback remains process-memory only and counts the same rolling window', async () => {
  await withEnvironment({
    NODE_ENV: 'test',
    SUPABASE_URL: undefined,
    SUPABASE_KEY: undefined
  }, async () => {
    delete require.cache[storagePath];
    const localStore = require(storagePath);
    const originalWriteFileSync = fs.writeFileSync;
    let writeCalls = 0;
    fs.writeFileSync = function() {
      writeCalls += 1;
      throw new Error('feedback fallback must not write a file');
    };

    try {
      await localStore.createFeedback({
        message: 'first',
        contact: '',
        page: '',
        context: {},
        client_key: 'client-a',
        created_at: '2026-07-31T00:05:00.000Z'
      });
      await localStore.createFeedback({
        message: 'old',
        contact: '',
        page: '',
        context: {},
        client_key: 'client-a',
        created_at: '2026-07-30T23:40:00.000Z'
      });
      await localStore.createFeedback({
        message: 'other client',
        contact: '',
        page: '',
        context: {},
        client_key: 'client-b',
        created_at: '2026-07-31T00:06:00.000Z'
      });

      assert.equal(
        await localStore.countRecentFeedback('client-a', '2026-07-30T23:55:00.000Z'),
        1
      );
      assert.equal(writeCalls, 0);
    } finally {
      fs.writeFileSync = originalWriteFileSync;
      delete require.cache[storagePath];
    }
  });
});

test('production feedback storage fails closed when Supabase is not configured', async () => {
  await withEnvironment({
    NODE_ENV: 'production',
    SUPABASE_URL: undefined,
    SUPABASE_KEY: undefined
  }, async () => {
    delete require.cache[storagePath];
    const productionStore = require(storagePath);
    try {
      await assert.rejects(
        productionStore.countRecentFeedback('client-a', new Date().toISOString()),
        error => error && error.code === 'FEEDBACK_STORAGE_UNAVAILABLE'
      );
      await assert.rejects(
        productionStore.createFeedback({
          message: 'must not persist locally',
          contact: '',
          page: '',
          context: {},
          client_key: 'client-a',
          created_at: new Date().toISOString()
        }),
        error => error && error.code === 'FEEDBACK_STORAGE_UNAVAILABLE'
      );
    } finally {
      delete require.cache[storagePath];
    }
  });
});

test('memory feedback storage atomically refuses concurrent attempts beyond the limit', async () => {
  await withEnvironment({
    NODE_ENV: 'test',
    SUPABASE_URL: undefined,
    SUPABASE_KEY: undefined
  }, async () => {
    delete require.cache[storagePath];
    const localStore = require(storagePath);
    const baseRecord = {
      contact: '',
      page: '',
      context: {},
      client_key: 'client-concurrent',
      created_at: '2026-07-31T00:05:00.000Z'
    };
    try {
      for (let index = 0; index < 4; index += 1) {
        await localStore.createFeedback({ ...baseRecord, message: 'seed-' + index });
      }

      const outcomes = await Promise.allSettled([
        localStore.createFeedback(
          { ...baseRecord, message: 'attempt-a' },
          { since: '2026-07-30T23:55:00.000Z', maxRecent: 5 }
        ),
        localStore.createFeedback(
          { ...baseRecord, message: 'attempt-b' },
          { since: '2026-07-30T23:55:00.000Z', maxRecent: 5 }
        )
      ]);

      assert.deepEqual(outcomes.map(outcome => outcome.status).sort(), ['fulfilled', 'rejected']);
      const rejected = outcomes.find(outcome => outcome.status === 'rejected');
      assert.equal(rejected.reason.code, 'FEEDBACK_RATE_LIMITED');
      assert.equal(
        await localStore.countRecentFeedback('client-concurrent', '2026-07-30T23:55:00.000Z'),
        5
      );
    } finally {
      delete require.cache[storagePath];
    }
  });
});

test('configured feedback storage counts through the table and atomically inserts through Supabase RPC', async () => {
  const operations = [];
  const fakeDb = {
    from(table) {
      assert.equal(table, 'feedback');
      return {
        insert(row) {
          operations.push({ type: 'insert', row });
          return {
            select(columns) {
              assert.equal(columns, '*');
              return {
                single() {
                  return Promise.resolve({ data: { id: 42, ...row }, error: null });
                }
              };
            }
          };
        },
        select(columns, options) {
          operations.push({ type: 'select', columns, options });
          return {
            eq(field, value) {
              operations.push({ type: 'eq', field, value });
              return {
                gte(sinceField, since) {
                  operations.push({ type: 'gte', field: sinceField, value: since });
                  return Promise.resolve({ count: 4, error: null });
                }
              };
            }
          };
        }
      };
    }
    ,
    rpc(name, params) {
      operations.push({ type: 'rpc', name, params });
      return Promise.resolve({
        data: [{ accepted: true, feedback_id: 42 }],
        error: null
      });
    }
  };

  await withEnvironment({
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://feedback-storage.supabase.co',
    SUPABASE_KEY: 'service-role-test-key'
  }, async () => {
    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === '@supabase/supabase-js') {
        return { createClient: () => fakeDb };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[storagePath];
    const durableStore = require(storagePath);
    try {
      durableStore.getSupabase();
    } finally {
      Module._load = originalLoad;
    }

    const record = {
      message: 'stored durably',
      contact: 'wx',
      page: 'profile',
      context: { reportId: 'r-1' },
      client_key: 'client-a',
      created_at: '2026-07-31T00:05:00.000Z'
    };
    assert.equal(
      await durableStore.countRecentFeedback('client-a', '2026-07-30T23:55:00.000Z'),
      4
    );
    assert.deepEqual(
      await durableStore.createFeedback(record, {
        since: '2026-07-30T23:55:00.000Z',
        maxRecent: 5
      }),
      { id: 42, ...record }
    );
    delete require.cache[storagePath];
  });

  assert.deepEqual(operations, [
    {
      type: 'select',
      columns: 'id',
      options: { count: 'exact', head: true }
    },
    { type: 'eq', field: 'client_key', value: 'client-a' },
    { type: 'gte', field: 'created_at', value: '2026-07-30T23:55:00.000Z' },
    {
      type: 'rpc',
      name: 'create_feedback_rate_limited',
      params: {
        p_message: 'stored durably',
        p_contact: 'wx',
        p_page: 'profile',
        p_context: { reportId: 'r-1' },
        p_client_key: 'client-a',
        p_created_at: '2026-07-31T00:05:00.000Z',
        p_since: '2026-07-30T23:55:00.000Z',
        p_limit: 5
      }
    }
  ]);
});
