# Account Report Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each logged-in user's paid BaZi deep reports and expose them from the personal center without changing guest purchases or existing credit products.

**Architecture:** A server-owned canonical report fingerprint identifies one exact chart. A new `report_orders` table stores pending and paid report orders; paid rows with a `user_id` are the permanent entitlement source. Result pages query authenticated access before showing the paywall, while the personal center lists only the current user's paid reports.

**Tech Stack:** Node.js CommonJS API handlers, Supabase/PostgreSQL, browser JavaScript, Node built-in test runner.

## Global Constraints

- New account entitlements apply to BaZi reports only; Hepan payment behavior is unchanged.
- Logged-in purchases are saved permanently; guest purchases remain local and are not attached to an account.
- The server computes the report fingerprint from normalized report parameters.
- Existing `user_data.bazi_rpt` and local guest unlock data remain readable but are not trusted as new permanent entitlements.
- Existing credit packs, subscriptions, saved charts, report rendering, and payment amounts must not regress.
- Do not push or deploy during implementation.

---

### Task 1: Canonical BaZi Report Identity

**Files:**
- Create: `lib/report-identity.js`
- Create: `tests/report-identity.test.js`

**Interfaces:**
- Consumes: raw result/payment parameter objects.
- Produces: `normalizeBaziReportParams(raw)`, `makeReportKey(type, raw)`, and `makeBaziReportLabel(params)`.

- [ ] **Step 1: Write the failing identity tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeBaziReportParams,
  makeReportKey,
  makeBaziReportLabel
} = require('../lib/report-identity.js');

test('equivalent BaZi parameters produce one stable key', () => {
  const left = { year:'1990', month:'6', day:'15', hour:'8', minute:'5', gender:'male', prov:'广东省', city:'广州市' };
  const right = { city:'广州市', gender:'male', minute:5, hour:8, day:15, month:6, year:1990, prov:'广东省' };
  assert.equal(makeReportKey('bazi', left), makeReportKey('bazi', right));
});

test('every calculation-affecting field changes the report key', () => {
  const base = { year:1990, month:6, day:15, hour:8, minute:5, gender:'male', clock:8, prov:'广东省', city:'广州市', dist:'天河区', cal:'solar', ziHourRule:'next-day' };
  for (const [field, value] of [['minute',6], ['gender','female'], ['clock',9], ['city','深圳市'], ['ziHourRule','same-day']]) {
    assert.notEqual(makeReportKey('bazi', base), makeReportKey('bazi', { ...base, [field]:value }), field);
  }
});

test('direct-pillar reports are keyed by entered pillars and gender', () => {
  const params = normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', monthPillar:'壬午', dayPillar:'乙卯', hourPillar:'丁亥', gender:'female' });
  assert.deepEqual(params.pillars, { year:'庚午', month:'壬午', day:'乙卯', hour:'丁亥' });
  assert.match(makeBaziReportLabel(params), /坤造/);
});

test('invalid gender or incomplete pillars are rejected', () => {
  assert.throws(() => normalizeBaziReportParams({ year:1990, month:6, day:15, hour:8, gender:'unknown' }), /gender/);
  assert.throws(() => normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', gender:'male' }), /pillars/);
});
```

- [ ] **Step 2: Run the identity tests and verify they fail**

Run: `node --test tests/report-identity.test.js`  
Expected: FAIL because `lib/report-identity.js` does not exist.

- [ ] **Step 3: Implement canonical normalization and SHA-256 keys**

```js
const crypto = require('crypto');

const LOCATION_FIELDS = ['prov', 'city', 'dist'];

function int(value, name, fallback) {
  if ((value === '' || value === null || value === undefined) && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error('invalid ' + name);
  return parsed;
}

function text(value) {
  return String(value || '').trim();
}

function normalizeBaziReportParams(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const gender = text(raw.gender);
  if (gender !== 'male' && gender !== 'female') throw new Error('invalid gender');
  const mode = text(raw.mode || raw.cal) === 'pillars' ? 'pillars' : text(raw.cal || 'solar');

  if (mode === 'pillars') {
    const source = raw.enteredPillars || raw.pillars || {};
    const pair = (position, ganKey, zhiKey) => {
      const value = source[position];
      if (typeof value === 'string') return value;
      if (value && value.gan && value.zhi) return text(value.gan) + text(value.zhi);
      const named = text(raw[position + 'Pillar']);
      return named || text(raw[ganKey]) + text(raw[zhiKey]);
    };
    const pillars = {
      year: pair('year', 'yg', 'yz'),
      month: pair('month', 'mg', 'mz'),
      day: pair('day', 'dg', 'dz'),
      hour: pair('hour', 'hg', 'hz')
    };
    if (Object.values(pillars).some(value => !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(value))) {
      throw new Error('invalid pillars');
    }
    const result = { mode, gender, pillars, timing:text(raw.timing || 'unknown') };
    if (result.timing === 'matched') {
      result.year = int(raw.year, 'year');
      result.month = int(raw.month, 'month');
      result.day = int(raw.day, 'day');
      result.hour = int(raw.hour, 'hour');
      result.clock = int(raw.clock, 'clock', result.hour);
    }
    return result;
  }

  const result = {
    mode,
    year: int(raw.year, 'year'),
    month: int(raw.month, 'month'),
    day: int(raw.day, 'day'),
    hour: int(raw.hour, 'hour'),
    minute: int(raw.minute, 'minute', 0),
    clock: int(raw.clock, 'clock', int(raw.hour, 'hour')),
    gender,
    ziHourRule: text(raw.ziHourRule || raw.zi_hour_rule || 'same-day')
  };
  LOCATION_FIELDS.forEach(field => { result[field] = text(raw[field]); });
  return result;
}

function makeReportKey(type, raw) {
  if (type !== 'bazi') throw new Error('unsupported report type');
  const normalized = normalizeBaziReportParams(raw);
  const identity = normalized.mode === 'pillars'
    ? { mode:normalized.mode, gender:normalized.gender, pillars:normalized.pillars }
    : normalized;
  return crypto.createHash('sha256').update(type + '\n' + JSON.stringify(identity)).digest('hex');
}

function makeBaziReportLabel(params) {
  const prefix = params.gender === 'male' ? '乾造' : '坤造';
  if (params.mode === 'pillars') return prefix + ' · ' + Object.values(params.pillars).join(' ');
  return prefix + ' · ' + params.year + '年' + params.month + '月' + params.day + '日';
}

module.exports = { normalizeBaziReportParams, makeReportKey, makeBaziReportLabel };
```

- [ ] **Step 4: Run the identity tests**

Run: `node --test tests/report-identity.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit the identity module**

```bash
git add lib/report-identity.js tests/report-identity.test.js
git commit -m "feat: add canonical report identity"
```

### Task 2: Persistent Report Order Storage

**Files:**
- Modify: `schema.sql`
- Modify: `lib/supabase.js`
- Create: `tests/report-order-store.test.js`

**Interfaces:**
- Consumes: `order_id`, optional authenticated `user_id`, canonical `report_key`, normalized params, label, and amount.
- Produces: `createReportOrder`, `markReportOrderPaid`, `getReportOrder`, `hasPaidReport`, and `listPaidReports`.

- [ ] **Step 1: Add failing store tests with a fake Supabase query builder**

Test these exact behaviors in `tests/report-order-store.test.js`:

```js
test('createReportOrder stores a pending row without overwriting a paid row', async () => {
  const row = await store.createReportOrder({
    order_id:'bazi_order_1', user_id:7, report_type:'bazi',
    report_key:'a'.repeat(64), report_params:{year:1990}, label:'乾造 · 1990年6月15日', amount:9.9
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
```

- [ ] **Step 2: Run the store tests and verify they fail**

Run: `node --test tests/report-order-store.test.js`  
Expected: FAIL because the storage functions are not exported.

- [ ] **Step 3: Add the idempotent database schema**

Append to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS report_orders (
  order_id      VARCHAR(96) PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id),
  report_type   VARCHAR(16) NOT NULL,
  report_key    VARCHAR(64) NOT NULL,
  report_params JSONB NOT NULL,
  label         VARCHAR(160) NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_orders_access
  ON report_orders(user_id, report_type, report_key, status);
CREATE INDEX IF NOT EXISTS idx_report_orders_user_paid
  ON report_orders(user_id, paid_at DESC);
```

- [ ] **Step 4: Implement the five storage functions**

Use Supabase queries with these signatures:

```js
async function getReportOrder(orderId) {
  const db = getSupabase();
  if (!db) return memStore.reportOrders[orderId] || null;
  const { data, error } = await db.from('report_orders').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createReportOrder(order) {
  const existing = await getReportOrder(order.order_id);
  if (existing) return existing;
  const row = { ...order, status:'pending', created_at:new Date().toISOString(), paid_at:null };
  const db = getSupabase();
  if (!db) {
    memStore.reportOrders[row.order_id] = row;
    saveStore();
    return row;
  }
  const { data, error } = await db.from('report_orders').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function markReportOrderPaid(orderId, paidAt) {
  const existing = await getReportOrder(orderId);
  if (!existing) return null;
  if (existing.status === 'paid') return existing;
  const patch = { status:'paid', paid_at:paidAt || new Date().toISOString() };
  const db = getSupabase();
  if (!db) {
    Object.assign(existing, patch);
    saveStore();
    return existing;
  }
  const { data, error } = await db.from('report_orders').update(patch).eq('order_id', orderId).select().single();
  if (error) throw error;
  return data;
}

async function hasPaidReport(userId, reportType, reportKey) {
  if (!userId) return false;
  const db = getSupabase();
  if (!db) {
    return Object.values(memStore.reportOrders).some(row =>
      row.user_id === userId && row.report_type === reportType &&
      row.report_key === reportKey && row.status === 'paid');
  }
  const { data, error } = await db.from('report_orders').select('order_id')
    .eq('user_id', userId).eq('report_type', reportType)
    .eq('report_key', reportKey).eq('status', 'paid').limit(1);
  if (error) throw error;
  return !!(data && data.length);
}

async function listPaidReports(userId) {
  const fields = 'report_type,report_key,report_params,label,paid_at';
  const db = getSupabase();
  if (!db) {
    return Object.values(memStore.reportOrders)
      .filter(row => row.user_id === userId && row.status === 'paid')
      .sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))
      .map(row => ({ report_type:row.report_type, report_key:row.report_key,
        report_params:row.report_params, label:row.label, paid_at:row.paid_at }));
  }
  const { data, error } = await db.from('report_orders').select(fields)
    .eq('user_id', userId).eq('status', 'paid').order('paid_at', { ascending:false });
  if (error) throw error;
  return data || [];
}
```

For the local fallback, add `reportOrders` to `memStore` and `.data-store.json` persistence so local development follows the same interface.

- [ ] **Step 5: Run the store tests**

Run: `node --test tests/report-order-store.test.js`  
Expected: PASS.

- [ ] **Step 6: Run existing payment tests**

Run: `node --test tests/payment-flow.test.js`  
Expected: all existing tests PASS.

- [ ] **Step 7: Commit storage**

```bash
git add schema.sql lib/supabase.js tests/report-order-store.test.js
git commit -m "feat: persist deep report orders"
```

### Task 3: Bind BaZi Order Creation to the Account

**Files:**
- Modify: `api/create-order.js`
- Modify: `tests/payment-flow.test.js`

**Interfaces:**
- Consumes: `token` and `report_params` from the browser.
- Produces: either `{ already_unlocked:true, report_key }` or the existing payment response plus the full server report key.

- [ ] **Step 1: Add failing order creation tests**

Add tests proving:

```js
test('logged-in BaZi order is stored against the authenticated account', async () => {
  // Mock verifyToken => { uid: 7 }, make gateway return success,
  // and assert createReportOrder receives user_id 7 and status pending.
});

test('already-owned BaZi report returns without calling the gateway', async () => {
  // Mock hasPaidReport => true and count global.fetch calls.
  assert.equal(res.body.already_unlocked, true);
  assert.equal(fetchCalls, 0);
});

test('guest BaZi order remains allowed with a null user_id', async () => {
  // No token; assert createReportOrder receives user_id null.
});
```

- [ ] **Step 2: Run the new payment tests and verify they fail**

Run: `node --test tests/payment-flow.test.js`  
Expected: the three new tests FAIL.

- [ ] **Step 3: Replace the short client hash as the entitlement identity**

In the BaZi branch of `api/create-order.js`:

```js
const normalized = normalizeBaziReportParams(body.report_params || body);
const reportKey = makeReportKey('bazi', normalized);
const label = makeBaziReportLabel(normalized);
if (userId && await hasPaidReport(userId, 'bazi', reportKey)) {
  return res.status(200).json({ already_unlocked: true, report_type:'bazi', report_key:reportKey });
}
const orderId = 'bazi_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
await createReportOrder({
  order_id:orderId, user_id:userId, report_type:'bazi', report_key:reportKey,
  report_params:normalized, label, amount:9.9
});
```

Keep the gateway order ID short and ASCII. Continue ignoring browser-supplied prices.

- [ ] **Step 4: Run payment tests**

Run: `node --test tests/payment-flow.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit order binding**

```bash
git add api/create-order.js tests/payment-flow.test.js
git commit -m "feat: bind report orders to accounts"
```

### Task 4: Finalize Paid Report Orders Idempotently

**Files:**
- Modify: `api/callback.js`
- Modify: `api/check-order.js`
- Modify: `tests/payment-flow.test.js`

**Interfaces:**
- Consumes: verified gateway callbacks or verified paid polling responses.
- Produces: one durable `paid` report order and the existing browser polling response.

- [ ] **Step 1: Add failing callback and recovery tests**

```js
test('signed paid BaZi callback marks its report order paid', async () => {
  // Provide a valid MD5 signature, TRADE_SUCCESS, exact 9.9 amount.
  // Assert markReportOrderPaid(orderId) is called once.
});

test('report callback with wrong amount does not grant access', async () => {
  // Use 0.01 and assert markReportOrderPaid is not called.
});

test('paid report polling repairs a missed callback', async () => {
  // Mock gateway paid and getReportOrder pending.
  // Assert markReportOrderPaid is called and response status is paid.
});
```

- [ ] **Step 2: Run payment tests and verify the new tests fail**

Run: `node --test tests/payment-flow.test.js`  
Expected: new report finalization tests FAIL.

- [ ] **Step 3: Add report handling to the callback**

After signature, success status, product, and amount validation:

```js
const reportProduct = getReportProduct(outTradeNo);
if (reportProduct) {
  const order = await getReportOrder(outTradeNo);
  if (!order || order.report_type !== reportProduct.type) return res.status(200).send('order error');
  await markReportOrderPaid(outTradeNo, new Date().toISOString());
  return res.status(200).send('success');
}
```

Preserve the existing credit and subscription callback branches unchanged.

- [ ] **Step 4: Add the polling recovery path**

After gateway order, number, amount, and type checks pass:

```js
const order = await getReportOrder(orderId);
if (order) await markReportOrderPaid(orderId, new Date().toISOString());
return res.status(200).json({
  orderId,
  status:'paid',
  report_type:reportProduct.type,
  report_key:order ? order.report_key : legacyReportKey,
  token:signToken(orderId, order ? order.report_key : legacyReportKey)
});
```

Keep the exact legacy Hepan checks and response intact.

- [ ] **Step 5: Run payment tests**

Run: `node --test tests/payment-flow.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit payment finalization**

```bash
git add api/callback.js api/check-order.js tests/payment-flow.test.js
git commit -m "feat: finalize report entitlements"
```

### Task 5: Authenticated Access and Report List APIs

**Files:**
- Create: `api/reports/access.js`
- Create: `api/reports/index.js`
- Create: `tests/report-api.test.js`

**Interfaces:**
- Consumes: bearer token and raw report parameters.
- Produces: `GET /api/reports/access?...` returning `{ unlocked, report_key }`; `GET /api/reports` returning `{ reports:[...] }`.

- [ ] **Step 1: Write failing API authorization tests**

Cover:

```js
test('report access rejects a missing token with 401', async () => {
  const handler = loadHandler('api/reports/access.js', { requireAuth:() => null }, {});
  const res = response();
  await handler({ method:'GET', query:{} }, res);
  assert.equal(res.statusCode, 401);
});

test('report access returns true only for the authenticated canonical key', async () => {
  let received;
  const handler = loadHandler(
    'api/reports/access.js',
    { requireAuth:() => ({ uid:7 }) },
    { hasPaidReport:async (...args) => { received = args; return true; } }
  );
  const res = response();
  await handler({ method:'GET', query:{ year:'1990', month:'6', day:'15', hour:'8', gender:'male' } }, res);
  assert.equal(res.body.unlocked, true);
  assert.equal(received[0], 7);
  assert.equal(received[1], 'bazi');
  assert.match(received[2], /^[0-9a-f]{64}$/);
});

test('report list returns only the safe paid-row shape', async () => {
  const handler = loadHandler(
    'api/reports/index.js',
    { requireAuth:() => ({ uid:7 }) },
    { listPaidReports:async userId => {
      assert.equal(userId, 7);
      return [{ report_type:'bazi', report_key:'a'.repeat(64),
        report_params:{ year:1990, month:6, day:15, hour:8, gender:'male' },
        label:'乾造 · 1990年6月15日', paid_at:'2026-07-30T12:00:00.000Z' }];
    } }
  );
  const res = response();
  await handler({ method:'GET' }, res);
  assert.equal(res.body.reports.length, 1);
  assert.deepEqual(Object.keys(res.body.reports[0]).sort(),
    ['label','paid_at','report_key','report_params','report_type']);
});
```

At the top of the test file, implement `response()` using the same response double as `tests/payment-flow.test.js`, and implement `loadHandler()` by temporarily replacing the `require.cache` entries for `lib/auth.js` and `lib/supabase.js`, then restoring them after requiring the handler.

The expected list item shape is:

```js
{
  report_type:'bazi',
  report_key:'...',
  label:'乾造 · 1990年6月15日',
  report_params:{...},
  paid_at:'2026-07-30T12:00:00.000Z'
}
```

- [ ] **Step 2: Run API tests and verify they fail**

Run: `node --test tests/report-api.test.js`  
Expected: FAIL because both handlers are missing.

- [ ] **Step 3: Implement the access handler**

Use `requireAuth(req)`, `normalizeBaziReportParams`, `makeReportKey`, and `hasPaidReport`. Return 400 for invalid params, 401 for no token, and 200 for both locked and unlocked valid requests.

- [ ] **Step 4: Implement the list handler**

Use `requireAuth(req)` and `listPaidReports(user.uid)`. Return only `report_type`, `report_key`, `label`, `report_params`, and `paid_at`.

- [ ] **Step 5: Run API tests**

Run: `node --test tests/report-api.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit report APIs**

```bash
git add api/reports/access.js api/reports/index.js tests/report-api.test.js
git commit -m "feat: expose purchased report APIs"
```

### Task 6: Restore Account Access on the Result Page

**Files:**
- Modify: `js/paywall.js`
- Modify: `result.html`
- Modify: `tests/payment-ui-contract.test.js`

**Interfaces:**
- Consumes: `Auth.getToken()`, current `_baziPayParams`, and report API responses.
- Produces: automatic account unlock, authenticated order creation, and an accurate guest/account purchase notice.

- [ ] **Step 1: Add failing browser contract tests**

Add assertions that:

```js
assert.match(paywallSource, /Authorization/);
assert.match(paywallSource, /Auth\.getToken\(\)/);
assert.match(paywallSource, /\/api\/reports\/access/);
assert.match(paywallSource, /already_unlocked/);
assert.match(paywallSource, /登录后购买可在个人中心长期查看/);
```

Add a VM test where the access endpoint returns `{ unlocked:true }` and assert `rptPaywall` is removed without creating an order.

Add a direct-pillar VM case using `enteredPillars` and assert two different pillar sets do not share the same local guest unlock key.

- [ ] **Step 2: Run UI payment tests and verify they fail**

Run: `node --test tests/payment-ui-contract.test.js`  
Expected: new account restore tests FAIL.

- [ ] **Step 3: Send the token and complete report parameters when creating an order**

In `initPaywall(bp)`, preserve every supplied report field instead of rebuilding only year/month/day/hour/gender:

```js
_baziPayParams = JSON.parse(JSON.stringify(bp));
_baziHash = makeLocalReportKey(_baziPayParams);
```

Implement `makeLocalReportKey` by flattening the four direct pillars into their gan/zhi strings, sorting object keys, and serializing the result. This replaces the current `hp()` helper so local guest unlocks cannot leak between different direct-pillar charts.

Build:

```js
const orderBody = {
  report_params:_baziPayParams,
  token:typeof Auth !== 'undefined' && Auth.isLoggedIn() ? Auth.getToken() : '',
  amount:9.9,
  description:'八字完整分析报告'
};
```

If the response contains `already_unlocked`, close the modal and call `unlock({ persistLocal:true, persistCloud:false })`.

- [ ] **Step 4: Query account access before rendering the paywall**

Add `restoreAccountAccess()`:

```js
function restoreAccountAccess() {
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) return Promise.resolve(false);
  const query = reportSearchParams(_baziPayParams);
  return fetch('/api/reports/access?' + query.toString(), {
    headers:{ Authorization:'Bearer ' + Auth.getToken() }
  }).then(r => r.ok ? r.json() : { unlocked:false })
    .then(data => {
      if (data.unlocked) { unlock({ persistLocal:true, persistCloud:false }); return true; }
      return false;
    });
}
```

`reportSearchParams` must flatten direct pillars as `yg`, `yz`, `mg`, `mz`, `dg`, `dz`, `hg`, and `hz`, while copying `mode`, `timing`, `gender`, and any matched timing fields.

Initialize the paywall only after this promise resolves. On network failure, show the normal paywall with a retryable status rather than silently granting access.

- [ ] **Step 5: Preserve guest local unlock and stop writing new `bazi_rpt` cloud keys**

Keep `iru()` and `sru()` for guest compatibility. Remove the new-account `Auth.syncData('bazi_rpt', ...)` write from `unlock()`.

- [ ] **Step 6: Run UI payment tests**

Run: `node --test tests/payment-ui-contract.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit result access restoration**

```bash
git add js/paywall.js result.html tests/payment-ui-contract.test.js
git commit -m "feat: restore purchased reports on results"
```

### Task 7: Show Purchased Reports in the Personal Center

**Files:**
- Modify: `profile.html`
- Create: `tests/profile-report-library.test.js`

**Interfaces:**
- Consumes: `GET /api/reports`.
- Produces: escaped report cards linking back to the matching result page.

- [ ] **Step 1: Write failing personal-center contract tests**

Verify:

```js
assert.match(profile, /\/api\/reports/);
assert.match(profile, /我的深度报告/);
assert.match(profile, /查看报告/);
assert.doesNotMatch(profile, /deleteReport/);
```

Run a VM render with two report rows and assert both labels are escaped and both links contain only their own normalized parameters.

- [ ] **Step 2: Run the profile test and verify it fails**

Run: `node --test tests/profile-report-library.test.js`  
Expected: FAIL because the report section is absent.

- [ ] **Step 3: Load reports independently of credits and saved charts**

Add a third request:

```js
var p3 = fetch('/api/reports', {
  headers:{ Authorization:'Bearer ' + Auth.getToken() }
}).then(function(r){ return r.ok ? r.json() : { reports:[] }; });
```

Use `Promise.allSettled` or per-request fallbacks so a report-list failure does not hide credits or saved charts.

- [ ] **Step 4: Render escaped report cards**

Add small helpers:

```js
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function reportUrl(report) {
  var params = report.report_params || {};
  var query = new URLSearchParams();
  if (params.mode === 'pillars' && params.pillars) {
    var keys = { year:['yg','yz'], month:['mg','mz'], day:['dg','dz'], hour:['hg','hz'] };
    Object.keys(keys).forEach(function(position) {
      var value = params.pillars[position] || '';
      query.set(keys[position][0], value.charAt(0));
      query.set(keys[position][1], value.charAt(1));
    });
    query.set('mode', 'pillars');
    query.set('timing', params.timing || 'unknown');
  }
  ['year','month','day','hour','clock','minute','gender','cal','prov','city','dist','ziHourRule']
    .forEach(function(key) {
      if (params[key] !== undefined && params[key] !== '') query.set(key, params[key]);
    });
  return '/result?' + query.toString();
}
```

Render title, paid date, and a “查看报告” link. Do not add delete behavior for paid entitlements.

- [ ] **Step 5: Run profile report tests**

Run: `node --test tests/profile-report-library.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit the report library UI**

```bash
git add profile.html tests/profile-report-library.test.js
git commit -m "feat: list purchased reports in profile"
```

### Task 8: Full Regression and Manual Browser Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-30-account-report-library-mobile-pdf-customer-service-design.md` only if verified behavior differs from the approved design.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: a verified account report library ready for the separate mobile-PDF and customer-card plans.

- [ ] **Step 1: Run the focused report and payment suites**

Run:

```bash
node --test tests/report-identity.test.js tests/report-order-store.test.js tests/report-api.test.js tests/payment-flow.test.js tests/payment-ui-contract.test.js tests/profile-report-library.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Run the entire automated suite**

Run: `node --test tests/*.test.js`  
Expected: all tests PASS.

- [ ] **Step 3: Start the local website**

Run: `node server.js`  
Expected: server prints `OK` and the result/profile routes return HTTP 200.

- [ ] **Step 4: Verify the logged-in lifecycle in a browser**

Check in order:

1. Open one BaZi result while logged in.
2. Create a test paid row through the local test fixture or test database.
3. Refresh the result and confirm no paywall appears.
4. Open `/profile` and confirm the report card appears.
5. Open the report from the card and confirm it remains unlocked.
6. Open the same result as a different account and confirm it remains locked.

- [ ] **Step 5: Verify guest compatibility**

Check that a logged-out user can still create a report order, poll payment, unlock locally, and refresh in the same browser without any report appearing in an account.

- [ ] **Step 6: Inspect the worktree**

Run: `git status --short`  
Expected: only intentional files are modified; `.superpowers/brainstorm/` remains untracked and untouched.

- [ ] **Step 7: Commit any verification-only fixes**

```bash
git add schema.sql lib/report-identity.js lib/supabase.js api/create-order.js api/callback.js api/check-order.js api/reports js/paywall.js result.html profile.html tests/report-identity.test.js tests/report-order-store.test.js tests/report-api.test.js tests/payment-flow.test.js tests/payment-ui-contract.test.js tests/profile-report-library.test.js
git commit -m "test: verify account report library"
```

Skip this commit when verification produces no file changes.
