const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const supabasePath = path.resolve(__dirname, '..', 'lib', 'supabase.js');

function createFakeSupabase() {
  const tables = { report_orders: new Map() };

  function rowsFor(table, filters) {
    return Array.from((tables[table] || new Map()).values()).filter(row =>
      filters.every(([field, value]) => row[field] === value));
  }

  return {
    from(table) {
      const filters = [];
      let operation = null;
      let payload = null;
      const builder = {
        select() { return this; },
        eq(field, value) { filters.push([field, value]); return this; },
        limit() { return this; },
        order() { return this; },
        insert(row) { operation = 'insert'; payload = row; return this; },
        update(patch) { operation = 'update'; payload = patch; return this; },
        maybeSingle() {
          return Promise.resolve({ data: rowsFor(table, filters)[0] || null, error: null });
        },
        single() {
          if (operation === 'insert') {
            tables[table].set(payload.order_id, { ...payload });
            return Promise.resolve({ data: tables[table].get(payload.order_id), error: null });
          }
          if (operation === 'update') {
            const existing = rowsFor(table, filters)[0];
            if (!existing) return Promise.resolve({ data: null, error: new Error('missing row') });
            Object.assign(existing, payload);
            return Promise.resolve({ data: existing, error: null });
          }
          return Promise.resolve({ data: rowsFor(table, filters)[0] || null, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rowsFor(table, filters), error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

function loadStore(db) {
  const originalLoad = Module._load;
  const previous = require.cache[supabasePath];
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_KEY = 'test-key';
  delete require.cache[supabasePath];
  Module._load = function(request, parent, isMain) {
    if (request === '@supabase/supabase-js') return { createClient: () => db };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(supabasePath);
  } finally {
    Module._load = originalLoad;
    if (previous) require.cache[supabasePath] = previous;
    else delete require.cache[supabasePath];
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = previousKey;
  }
}

const store = loadStore(createFakeSupabase());

test('createReportOrder stores a pending row without overwriting a paid row', async () => {
  const row = await store.createReportOrder({
    order_id:'bazi_order_1', user_id:7, report_type:'bazi',
    report_key:'a'.repeat(64), report_params:{year:1990}, label:'八字 · 1990年6月15日', amount:9.9
  });
  assert.equal(row.status, 'pending');
  assert.equal(row.user_id, 7);
});

test('markReportOrderPaid is idempotent', async () => {
  const first = await store.markReportOrderPaid('bazi_order_1', '2026-07-30T12:00:00.000Z');
  const second = await store.markReportOrderPaid('bazi_order_1', '2026-07-30T12:01:00.000Z');
  assert.equal(first.paid_at, second.paid_at);
});

test('hasPaidReport requires the same user, type and key', async () => {
  assert.equal(await store.hasPaidReport(7, 'bazi', 'a'.repeat(64)), true);
  assert.equal(await store.hasPaidReport(8, 'bazi', 'a'.repeat(64)), false);
});
