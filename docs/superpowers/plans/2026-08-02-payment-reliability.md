# Payment Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every site-created paid order recoverable through either gateway callback or active polling, with exactly-once fulfillment and no change to prices, Alipay routing, or the existing frontend paywall.

**Architecture:** Introduce a durable `payment_orders` ledger as the trusted source for product, amount, account, channel, and fulfillment state. Both the signed callback and the authenticated server-to-server gateway query call one idempotent fulfillment path backed by database uniqueness and an atomic Supabase RPC. Keep existing entitlement tables and public response shapes for compatibility.

**Tech Stack:** Node.js CommonJS handlers, Supabase/PostgreSQL, Node test runner, browser JavaScript, `qrcode` for server-local QR generation.

## Global Constraints

- Do not change product prices, product quantities, Alipay merchant routing, or the existing paywall behavior.
- Do not delete or overwrite existing credits, subscriptions, report orders, or local guest unlock records.
- Do not apply production database migrations or push deployment branches until all implementation tests pass and the user explicitly approves rollout.
- Every behavior change follows red-green-refactor: add one failing test, observe the expected failure, add the minimum implementation, and rerun the relevant suite.
- Each completed task is committed independently so interruption can resume from the last green commit.
- Existing untracked files `.data-store.json`, `.superpowers/sdd/task-1-brief.md`, `docs/bazi-system-spec.md`, `knowledge/fengshui_extracts/`, and `兑换码.txt` must remain untouched and uncommitted.

---

## File Structure

- Create `schema-payment-reliability.sql`: additive production migration for the payment ledger, missing report table, uniqueness, indexes, and atomic fulfillment RPC.
- Create `lib/payment-gateway.js`: timeout-bound gateway order creation/query helpers and strict paid-response validation.
- Create `lib/payment-service.js`: trusted order creation, reconciliation, and idempotent fulfillment orchestration.
- Modify `lib/supabase.js`: storage adapter methods for payment orders and atomic fulfillment RPC results.
- Modify `lib/payment-contract.js`: canonical product catalog and validated product lookup shared by all handlers.
- Modify `api/create-order.js`: persist the trusted order before calling the gateway and generate a local QR image when needed.
- Modify `api/callback.js`: verify the callback then reconcile the stored order through the shared service.
- Modify `api/check-order.js`: actively query and fulfill pending credit, monthly, BaZi, and Hepan orders.
- Modify `lib/auth.js`: fail closed on missing production token secrets and use constant-time signature comparison.
- Modify `js/payment.js`: remove QuickChart fallback and accept only server-produced HTTPS or PNG data images.
- Modify `js/paywall.js`, `js/hepan-paywall.js`, and `pricing.html`: retain pending order recovery, avoid overlapping polling, and send account context for Hepan.
- Add focused tests under `tests/` for schema contracts, gateway behavior, store behavior, reconciliation, UI QR behavior, and security configuration.

---

### Task 1: Create an isolated payment worktree and verify the baseline

**Files:**
- No production files modified.

**Interfaces:**
- Consumes: commit `dd6aeb2` containing the approved design.
- Produces: branch `feat/payment-reliability` in `.worktrees/payment-reliability` with installed dependencies and a known-green baseline.

- [ ] **Step 1: Verify the worktree directory is ignored**

Run:

```powershell
git check-ignore .worktrees
```

Expected: `.worktrees` is reported as ignored.

- [ ] **Step 2: Create the isolated branch**

Run:

```powershell
git worktree add .worktrees/payment-reliability -b feat/payment-reliability dd6aeb2
```

Expected: a new linked worktree on `feat/payment-reliability`.

- [ ] **Step 3: Install the locked project dependencies**

Run from the worktree:

```powershell
npm ci
```

Expected: install succeeds with zero audit vulnerabilities.

- [ ] **Step 4: Run the baseline suite**

Run:

```powershell
node --test tests/*.test.js
```

Expected: 299 tests pass and zero fail before payment changes begin.

---

### Task 2: Add an additive, interruption-safe database migration

**Files:**
- Create: `schema-payment-reliability.sql`
- Create: `tests/payment-schema.test.js`

**Interfaces:**
- Produces: `payment_orders` with primary key `order_id`; `report_orders` when absent; unique entitlement indexes; RPC `fulfill_payment_order(p_order_id TEXT, p_paid_at TIMESTAMPTZ)`.
- The migration is committed but not executed against production in this task.

- [ ] **Step 1: Write failing schema contract tests**

Add tests that read the SQL file and require:

```js
test('payment migration is additive and creates the durable ledger', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS payment_orders/i);
  assert.match(sql, /order_id\s+VARCHAR\(96\)\s+PRIMARY KEY/i);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)/i);
});

test('entitlement order ids are protected by unique indexes', () => {
  assert.match(sql, /UNIQUE INDEX[^;]+user_credits[^;]+order_id/is);
  assert.match(sql, /UNIQUE INDEX[^;]+user_subscriptions[^;]+order_id/is);
});

test('one RPC owns exactly-once fulfillment', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION fulfill_payment_order/i);
  assert.match(sql, /FOR UPDATE/i);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
node --test tests/payment-schema.test.js
```

Expected: FAIL because `schema-payment-reliability.sql` does not exist.

- [ ] **Step 3: Implement the additive migration**

The SQL must:

```sql
CREATE TABLE IF NOT EXISTS payment_orders (
  order_id VARCHAR(96) PRIMARY KEY,
  product_code VARCHAR(32) NOT NULL,
  product_type VARCHAR(24) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  user_id BIGINT REFERENCES users(id),
  channel VARCHAR(32) NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);
```

It must create `report_orders` with the approved schema when absent, abort before unique-index creation if duplicate non-null `order_id` values exist, create partial unique indexes for existing entitlement tables, and define a transaction-scoped RPC that locks one ledger row and returns the already-existing entitlement on repeated calls.

- [ ] **Step 4: Run schema tests and verify GREEN**

Run:

```powershell
node --test tests/payment-schema.test.js
```

Expected: all schema contract tests pass.

- [ ] **Step 5: Commit the migration contract**

```powershell
git add schema-payment-reliability.sql tests/payment-schema.test.js
git commit -m "feat: add payment reliability migration"
```

---

### Task 3: Centralize the canonical payment product catalog

**Files:**
- Modify: `lib/payment-contract.js`
- Modify: `tests/payment-flow.test.js`

**Interfaces:**
- Produces: `getProductByCode(code)`, `getProductByOrderId(orderId)`, and immutable server-owned product records `{ code, prefix, amount, type, credits?, days?, reportType? }`.
- Existing `getCreditProduct` and `getReportProduct` remain compatibility wrappers.

- [ ] **Step 1: Write failing product-catalog tests**

Add assertions that all accepted modes resolve to one canonical product, browser amounts are ignored, unknown codes return null, and returned product objects cannot be mutated.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="canonical product" tests/payment-flow.test.js
```

Expected: FAIL because the new catalog functions are absent.

- [ ] **Step 3: Implement the catalog**

Use `Object.freeze` for the catalog and each product. Include the existing prices exactly: 4.9/3 credits, 9.9/10 credits, 14.9/20 credits, 5/5 credits, 29.9/30 days, 9.9 BaZi report, and 13.9 Hepan report.

- [ ] **Step 4: Run the focused and existing payment tests**

```powershell
node --test tests/payment-flow.test.js
```

Expected: all payment-flow tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/payment-contract.js tests/payment-flow.test.js
git commit -m "refactor: centralize payment products"
```

---

### Task 4: Add payment-ledger storage adapters

**Files:**
- Modify: `lib/supabase.js`
- Create: `tests/payment-order-store.test.js`

**Interfaces:**
- Produces:

```js
createPaymentOrder(order)
getPaymentOrder(orderId)
fulfillPaymentOrder(orderId, paidAt)
```

- `createPaymentOrder` never overwrites an existing row.
- `fulfillPaymentOrder` calls `fulfill_payment_order` in Supabase and mirrors exactly-once semantics in the local memory store for tests/development.

- [ ] **Step 1: Write failing store tests**

Cover pending creation, no overwrite, first fulfillment, repeated fulfillment returning the same result, concurrent fulfillment producing one entitlement, and missing-order failure.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/payment-order-store.test.js
```

Expected: FAIL because the storage exports do not exist.

- [ ] **Step 3: Implement minimal adapters**

Add `paymentOrders` to memory defaults and persistence. For Supabase, use `insert` for creation, `maybeSingle` for lookup, and `rpc('fulfill_payment_order', { p_order_id, p_paid_at })` for fulfillment.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-order-store.test.js tests/report-order-store.test.js
```

Expected: both store suites pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/supabase.js tests/payment-order-store.test.js
git commit -m "feat: persist trusted payment orders"
```

---

### Task 5: Add timeout-bound gateway helpers

**Files:**
- Create: `lib/payment-gateway.js`
- Create: `tests/payment-gateway.test.js`

**Interfaces:**
- Produces:

```js
createGatewayOrder(params, options)
queryGatewayOrder(orderId, options)
validatePaidGatewayOrder(data, expectedOrder)
```

- `options.fetchImpl` supports deterministic tests.
- Default timeout is 8000 ms; at most one retry is allowed for timeout, network failure, HTTP 429, and HTTP 5xx.
- Business failures and JSON contract failures are not retried.

- [ ] **Step 1: Write failing gateway tests**

Cover timeout abort, one retry then success, retry ceiling, malformed JSON, wrong order number, wrong amount, wrong merchant PID, and successful validation.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/payment-gateway.test.js
```

Expected: FAIL because `lib/payment-gateway.js` is absent.

- [ ] **Step 3: Implement the helpers**

Use an `AbortController`, clear every timeout in `finally`, form-encode gateway creation requests, and never include the payment key in thrown error messages. `validatePaidGatewayOrder` must compare the configured PID, exact order ID, successful status, and fixed amount.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-gateway.test.js
```

Expected: all gateway tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/payment-gateway.js tests/payment-gateway.test.js
git commit -m "feat: bound payment gateway requests"
```

---

### Task 6: Implement one reconciliation service for callback and polling

**Files:**
- Create: `lib/payment-service.js`
- Create: `tests/payment-reconciliation.test.js`

**Interfaces:**
- Produces:

```js
registerPaymentOrder(input)
reconcileGatewayPayment(orderId, gatewayData)
reconcilePendingOrder(orderId)
```

- `registerPaymentOrder` derives product and amount from the canonical catalog.
- `reconcileGatewayPayment` validates gateway data against the stored ledger row, then calls `fulfillPaymentOrder`.
- `reconcilePendingOrder` returns an existing fulfillment immediately or actively queries the gateway and delegates to `reconcileGatewayPayment`.

- [ ] **Step 1: Write failing reconciliation tests**

Cover callback-first, polling-first with the callback completely absent, concurrent callback/polling, repeated polling, wrong amount, wrong PID, unsupported order, and temporary database failure.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/payment-reconciliation.test.js
```

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement the service with dependency injection**

Expose a factory for tests:

```js
createPaymentService({ store, gateway, now })
```

and export production wrappers using the real store and gateway. Never derive fulfillment rights from request query values or an order prefix once a ledger row exists.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-reconciliation.test.js tests/payment-order-store.test.js tests/payment-gateway.test.js
```

Expected: all reconciliation dependencies pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/payment-service.js tests/payment-reconciliation.test.js
git commit -m "feat: reconcile paid orders exactly once"
```

---

### Task 7: Persist every order before gateway creation

**Files:**
- Modify: `api/create-order.js`
- Modify: `tests/payment-flow.test.js`
- Modify: `tests/payment-ui-contract.test.js`

**Interfaces:**
- Consumes: `registerPaymentOrder`, `createGatewayOrder`.
- Produces: existing public response fields plus the same stable `out_trade_no`, `report_key`, `pay_url`, `qr_content`, and `qr_image` contracts.

- [ ] **Step 1: Write failing order-creation tests**

Require credit, monthly, BaZi, and Hepan orders to create a trusted pending ledger row before gateway fetch. Require Hepan to carry the verified login user, validated channel, report key, and reconstructable metadata. Require gateway failure to leave no entitlement.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="ledger|Hepan account" tests/payment-flow.test.js
```

Expected: FAIL because current credit/Hepan creation does not store a unified order.

- [ ] **Step 3: Refactor create-order to the shared service**

Keep all response compatibility fields. Remove trust in browser `amount`, `money`, and `name`. Validate `channel` with `^[A-Za-z0-9_-]{1,32}$`; invalid or missing values become an empty channel.

- [ ] **Step 4: Run payment creation tests**

```powershell
node --test tests/payment-flow.test.js tests/payment-ui-contract.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add api/create-order.js tests/payment-flow.test.js tests/payment-ui-contract.test.js
git commit -m "feat: record every payment before checkout"
```

---

### Task 8: Make callback and polling share exactly-once fulfillment

**Files:**
- Modify: `api/callback.js`
- Modify: `api/check-order.js`
- Modify: `tests/payment-flow.test.js`

**Interfaces:**
- Callback consumes signed gateway data and calls `reconcileGatewayPayment`.
- Polling consumes only `orderId`, calls `reconcilePendingOrder`, and returns the existing compatible credit/report response.

- [ ] **Step 1: Add failing regression tests for the user's primary bug**

Add tests named:

```js
test('paid credit polling fulfills the order when the gateway callback is completely lost', async () => {});
test('callback and polling racing for one credit order grant one entitlement', async () => {});
test('paid monthly polling fulfills the order when the gateway callback is completely lost', async () => {});
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="completely lost|racing" tests/payment-flow.test.js
```

Expected: the existing “callback-only” behavior fails the new expectations.

- [ ] **Step 3: Replace duplicated handler logic with the reconciliation service**

The callback must still return a retryable failure when fulfillment fails. The polling endpoint must not grant anything unless the server-to-server gateway query validates PID, order ID, successful status, and amount against the ledger.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-flow.test.js tests/payment-reconciliation.test.js
```

Expected: all payment and reconciliation tests pass.

- [ ] **Step 5: Commit**

```powershell
git add api/callback.js api/check-order.js tests/payment-flow.test.js
git commit -m "fix: recover paid credits without callbacks"
```

---

### Task 9: Generate desktop QR images locally

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `api/create-order.js`
- Modify: `js/payment.js`
- Modify: `tests/payment-flow.test.js`
- Modify: `tests/payment-ui-contract.test.js`

**Interfaces:**
- Server produces `qr_image` as either a gateway HTTPS image or `data:image/png;base64,...` generated from `qr_content` using `qrcode`.
- Browser no longer contacts QuickChart or any other QR generator.

- [ ] **Step 1: Write failing QR privacy/reliability tests**

Require the browser script to contain no `quickchart.io` or `qrserver.com`; require a gateway response containing only QR content to return a PNG data image; retain mobile `pay_url` behavior.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="local QR|QuickChart" tests/payment-flow.test.js tests/payment-ui-contract.test.js
```

Expected: FAIL because the browser currently constructs a QuickChart URL.

- [ ] **Step 3: Add and use `qrcode`**

Run:

```powershell
npm install qrcode --save-exact
```

Generate a 220-pixel PNG data URL on the server only when the gateway has not supplied an HTTPS QR image and valid QR content exists. Update `isSafeImageUrl` to allow only HTTPS or `data:image/png;base64,`.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-flow.test.js tests/payment-ui-contract.test.js
```

Expected: desktop QR and mobile redirect tests pass with no external QR dependency.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json api/create-order.js js/payment.js tests/payment-flow.test.js tests/payment-ui-contract.test.js
git commit -m "fix: generate payment QR images locally"
```

---

### Task 10: Add bounded abuse protection and fail-closed secrets

**Files:**
- Modify: `lib/auth.js`
- Modify: `api/create-order.js`
- Modify: `api/check-order.js`
- Create: `lib/payment-rate-limit.js`
- Create: `tests/payment-security.test.js`

**Interfaces:**
- Produces `requireProductionSecret(name, developmentFallback)` and `checkPaymentRateLimit(scope, key, limit, windowMs)`.
- Create-order default: 10 accepted attempts per client per 10 minutes.
- Check-order default: 120 accepted attempts per order/client pair per 10 minutes, matching the existing two-second polling window.

- [ ] **Step 1: Write failing security tests**

Cover missing production `TOKEN_SECRET`, `PAY_PID`, and `PAY_KEY`; constant-time token signature checking; create-order limit; check-order limit; and successful ordinary polling below the threshold.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/payment-security.test.js
```

Expected: FAIL because fail-closed secret and payment limiter modules do not exist.

- [ ] **Step 3: Implement minimal protection**

Use constant-time comparison for equal-length signatures. Keep development/test fallbacks only when `NODE_ENV !== 'production'`. Implement a bounded in-memory limiter as an immediate application guard and document that infrastructure-level limiting remains the outer production layer.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-security.test.js tests/payment-flow.test.js
```

Expected: security and payment compatibility tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/auth.js lib/payment-rate-limit.js api/create-order.js api/check-order.js tests/payment-security.test.js
git commit -m "fix: harden payment endpoints and secrets"
```

---

### Task 11: Preserve frontend recovery across refreshes and Hepan accounts

**Files:**
- Modify: `pricing.html`
- Modify: `profile.html`
- Modify: `js/paywall.js`
- Modify: `js/hepan-paywall.js`
- Modify: `tests/payment-ui-contract.test.js`
- Modify: `tests/profile-report-library.test.js`

**Interfaces:**
- Frontends retain one pending order record per product flow and resume polling after navigation/refresh.
- Hepan order creation sends `Auth.getToken()` when logged in.
- Report library receives reconstructable Hepan metadata for new purchases without changing historical local unlock behavior.

- [ ] **Step 1: Write failing recovery tests**

Cover refresh recovery after lost callback, no overlapping intervals after repeated clicks, Hepan authenticated order creation, and new Hepan report-library routing.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="refresh|overlapping|Hepan" tests/payment-ui-contract.test.js tests/profile-report-library.test.js
```

Expected: at least the authenticated Hepan and report-library tests fail.

- [ ] **Step 3: Implement compatibility changes**

Keep current localStorage keys and paywall rendering. Add account token/channel to Hepan creation, ensure every polling starter clears the previous timer, and teach profile routing to reconstruct new paid Hepan reports from safe metadata.

- [ ] **Step 4: Run and verify GREEN**

```powershell
node --test tests/payment-ui-contract.test.js tests/profile-report-library.test.js
```

Expected: UI recovery and profile tests pass.

- [ ] **Step 5: Commit**

```powershell
git add pricing.html profile.html js/paywall.js js/hepan-paywall.js tests/payment-ui-contract.test.js tests/profile-report-library.test.js
git commit -m "feat: retain payment recovery across devices"
```

---

### Task 12: Verify implementation and prepare—but do not execute—the rollout

**Files:**
- Create: `docs/payment-reliability-rollout.md`
- Modify only test files if verification exposes a genuine missing regression test.

**Interfaces:**
- Produces a rollback-safe operator checklist with read-only preflight queries, backup steps, migration command, test-order matrix, monitoring queries, and code rollback procedure.

- [ ] **Step 1: Run focused payment verification**

```powershell
node --test tests/payment-schema.test.js tests/payment-order-store.test.js tests/payment-gateway.test.js tests/payment-reconciliation.test.js tests/payment-flow.test.js tests/payment-ui-contract.test.js tests/payment-security.test.js tests/report-api.test.js tests/report-order-store.test.js tests/profile-report-library.test.js
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run the complete project suite**

```powershell
node --test tests/*.test.js
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Check repository hygiene**

```powershell
git diff --check
git status --short
git log --oneline main..HEAD
```

Expected: only planned implementation files differ from main; private and pre-existing untracked files are absent from every commit.

- [ ] **Step 4: Write the rollout checklist**

The checklist must require:

- rechecking duplicate `order_id` values immediately before migration;
- exporting `user_credits`, `user_subscriptions`, and existing report/payment tables;
- applying `schema-payment-reliability.sql` before deploying code;
- one test each for callback-first, polling-first, and repeated callback;
- confirming one entitlement row per test order;
- retaining the new additive tables during code rollback;
- no push or production mutation without explicit user approval.

- [ ] **Step 5: Commit the rollout document**

```powershell
git add docs/payment-reliability-rollout.md
git commit -m "docs: add payment reliability rollout checklist"
```

- [ ] **Step 6: Stop before production changes**

Report the branch, commit list, test counts, migration status, and remaining explicit actions. Do not push, apply SQL, or place a real payment order until the user approves rollout.
