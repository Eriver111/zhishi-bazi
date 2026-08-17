# Bazi Ten-Chart Audit Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze and independently judge 10 new, stratified charts, compare them with the website's strength/Yong-Xi-Ji/pattern results, publish a classified discrepancy report, and stop before any rule change.

**Architecture:** A small audit harness enforces phase order with hashes: case inputs and independent rulings are frozen before engine output can be captured. The first round lives in its own immutable directory, checks against every prior audit ID/pillar tuple, and produces machine-readable engine results plus a human-readable comparison report. This plan has no task that edits the Bazi rule engine.

**Tech Stack:** Node.js scripts, JSON/CSV/Markdown audit artifacts, existing `BaZiCalculator` public APIs, Node test runner, Git commits as freeze checkpoints.

**Spec:** `docs/superpowers/specs/2026-08-17-county-longitude-and-bazi-audit-design.md`

## Global Constraints

- Start only after the county-longitude implementation plan passes automated and browser acceptance.
- Use exactly 10 new cases, stratified rather than unconstrained random sampling.
- Do not reuse a prior formal audit case ID or identical four-pillar tuple.
- Independent rulings must be frozen before engine results are revealed or generated.
- Judge strength, useful god, favorable gods, unfavorable gods, and pattern with explicit evidence.
- Classify differences only as `明确程序错误`, `证据不足`, `流派口径差异`, or `数据或排盘问题`.
- Stop and report after the batch; do not edit `js/bazi.js`, `js/bazi-chain.js`, `js/structural.js`, or report business rules.
- Even an apparent program defect requires user approval before a failing product test or fix is created.
- Preserve untracked `qa-deep-report-preview.html` and `scripts/audit-p3-baseline-drift.js`.

## File Map

- Create `scripts/bazi-audit-round.js`: prepare/freeze/capture/verify/report phase gate.
- Create `tests/bazi-audit-round.test.js`: no-reuse, schema, hashing, phase order, and mutation-prohibition tests.
- Create `audits/bazi/registry.json`: immutable registry of formal rounds and used pillar hashes.
- Create `audits/bazi/round-01/cases.json`: 10 complete inputs and expected coverage tags, without website conclusions.
- Create `audits/bazi/round-01/independent-rulings.md`: frozen independent judgments and evidence.
- Create `audits/bazi/round-01/freeze.json`: hashes, engine commit, longitude version, and freeze timestamps.
- Create `audits/bazi/round-01/engine-results.json`: captured website facts after ruling freeze.
- Create `audits/bazi/round-01/comparison.csv`: field-level differences.
- Create `audits/bazi/round-01/report.md`: user-facing first-round findings and proposed actions.

---

### Task 1: Build the phase-gated audit harness

**Files:**
- Create: `scripts/bazi-audit-round.js`
- Create: `tests/bazi-audit-round.test.js`
- Create: `audits/bazi/registry.json`

**Interfaces:**
- Consumes: a round directory containing `cases.json` and later `independent-rulings.md`.
- Produces: commands `prepare`, `freeze-rulings`, `capture-engine`, `verify`, and `render-report` with SHA-256 phase gates.

- [ ] **Step 1: Write failing phase-order tests**

Use a temporary fixture and assert:

```js
assert.throws(() => captureEngine(roundWithoutFreeze), /先冻结独立判断/);
assert.throws(() => freezeRulings(roundWithDuplicatePillars), /案例已在历史批次使用/);
assert.throws(() => verifyRound(roundWithChangedRulings), /独立判断哈希不一致/);
```

Also assert `capture-engine` refuses when Git reports tracked changes in `js/bazi.js`, `js/bazi-chain.js`, or `js/structural.js` after the recorded engine commit.

- [ ] **Step 2: Run the harness test and verify failure**

Run: `node --test tests/bazi-audit-round.test.js`  
Expected: FAIL because the harness does not exist.

- [ ] **Step 3: Implement schemas and SHA-256 phase gates**

Define a case as:

```js
{
  id: 'R01-C01',
  birth: { year:1990, month:7, day:12, clock:18, minute:0, gender:'male' },
  location: { province:'...', city:'...', district:'...' },
  solarDataVersion: 'county-centroid-v1',
  pillars: ['年柱','月柱','日柱','时柱'],
  coverageTags: ['明确身强']
}
```

`freeze-rulings` records SHA-256 for cases and rulings plus UTC timestamps. `capture-engine` checks those hashes before loading the calculator. `registry.json` stores round ID, case IDs, canonical pillar hashes, and status.

- [ ] **Step 4: Add prior-audit collision scanning**

Seed the used-pillar set by parsing formal prior artifacts including `_blind20`, `_blindtest_*`, `_baseline_22.csv`, `_baseline_p15_6.csv`, and `_p5` attack sets where a complete four-pillar tuple exists. Refuse both duplicate IDs and duplicate canonical strings like `甲子|丙寅|...`.

- [ ] **Step 5: Run harness tests**

Run: `node --test tests/bazi-audit-round.test.js`  
Expected: PASS for valid phase order and all refusal cases.

- [ ] **Step 6: Commit the audit infrastructure**

```powershell
git add -- scripts/bazi-audit-round.js tests/bazi-audit-round.test.js audits/bazi/registry.json
git commit -m "test: add phase-gated bazi audit harness"
```

### Task 2: Select and freeze 10 stratified birth cases

**Files:**
- Create: `audits/bazi/round-01/cases.json`
- Modify: `audits/bazi/registry.json`
- Test: `tests/bazi-audit-round.test.js`

**Interfaces:**
- Consumes: county resolver version `county-centroid-v1`, public calendar calculation only for deriving final pillars, and the used-case registry.
- Produces: exactly 10 immutable inputs with verified true-solar-time pillars and coverage tags; no strength/Yong-Xi-Ji/pattern output.

- [ ] **Step 1: Generate a candidate pool without querying judgment APIs**

The preparation path may call calendar/four-pillar calculation to confirm dates and true solar time, but it must prohibit calls to `calcDayMasterStrength`, `getYongJi`, `getCongGe`, and `getPattern`. Generate candidates across seasons, day masters, genders, longitude extremes, and near-boundary clocks.

- [ ] **Step 2: Select exactly 10 cases by observable structure**

Use raw pillars/month command/root/exposure observations only to fill these required tags across the batch:

```text
明确身强, 明确身弱, 从格疑似, 从格边界, 专旺疑似或边界,
调候优先, 格局与旺衰冲突, 月令临界, 透干/根气临界, 制化临界
```

One case may carry multiple tags, but every tag must appear at least once. Include multiple seasons and at least six distinct day masters.

- [ ] **Step 3: Verify location and pillar facts**

For each case assert county-level direct match, dataset version, true solar time, date offset, and final four pillars. Reject any case whose location falls back or duplicates a historical pillar tuple.

- [ ] **Step 4: Run prepare verification**

Run: `node scripts/bazi-audit-round.js prepare audits/bazi/round-01`  
Expected: `cases=10 unique=10 priorCollisions=0 countyMatches=10 coverage=complete judgmentsRead=0`.

- [ ] **Step 5: Commit the cases before any judgment or engine capture**

```powershell
git add -- audits/bazi/round-01/cases.json audits/bazi/registry.json
git commit -m "test: freeze bazi audit round 1 cases"
```

### Task 3: Write and freeze independent rulings

**Files:**
- Create: `audits/bazi/round-01/independent-rulings.md`
- Create: `audits/bazi/round-01/freeze.json`

**Interfaces:**
- Consumes: only `cases.json`, final pillars, month/season facts, and traditional reasoning; it must not consume website judgment output.
- Produces: one complete independent ruling per case and immutable hashes proving freeze order.

- [ ] **Step 1: Write all 10 independent rulings**

Each case section must use this exact field set:

```markdown
## R01-C01
- 旺衰：结论；月令、通根、透干、得助、受制依据
- 用神：五行；为什么先取它
- 喜神：五行列表；如何协助用神
- 忌神：五行列表；具体加重什么问题
- 格局：名称与成/破/边界；月令取格和制化依据
- 争议点：没有则写“无”；有则列可接受的另一口径
```

Do not include engine scores, method enum values, or quoted website wording.

- [ ] **Step 2: Self-check rulings against raw chart facts**

Confirm every stated stem, branch, hidden stem, root, combine/clash, seasonal fact, and transformation prerequisite exists in the frozen input. Correct factual mistakes before freezing.

- [ ] **Step 3: Freeze rulings and engine provenance**

Run: `node scripts/bazi-audit-round.js freeze-rulings audits/bazi/round-01`  
Expected: writes `freeze.json` with case/ruling hashes, current engine file hashes, current Git commit, `county-centroid-v1`, and a ruling timestamp earlier than any engine-capture timestamp.

- [ ] **Step 4: Commit the independent freeze checkpoint**

```powershell
git add -- audits/bazi/round-01/independent-rulings.md audits/bazi/round-01/freeze.json
git commit -m "test: freeze independent bazi audit rulings"
```

### Task 4: Capture website engine results after the freeze

**Files:**
- Create: `audits/bazi/round-01/engine-results.json`
- Modify: `audits/bazi/round-01/freeze.json`

**Interfaces:**
- Consumes: frozen cases/rulings hashes and public calculator APIs.
- Produces: raw and normalized engine results for strength, Cong status, Yong/Xi/Ji, and pattern without changing product code.

- [ ] **Step 1: Verify the pre-capture gate**

Run: `node scripts/bazi-audit-round.js verify audits/bazi/round-01 --phase pre-capture`  
Expected: PASS with unchanged case/ruling hashes and engine files matching the freeze record.

- [ ] **Step 2: Capture each website conclusion**

For a fresh chart object per API call sequence, save:

```js
{
  strength: { level, score, detail },
  cong: { isCong, name, source },
  yongJi: { yongShen, xiShen, jiShen, method, primaryReason, evidence },
  pattern: { name, type, status, establishConditions, breakReasons }
}
```

Preserve raw evidence in JSON; do not interpret or edit it during capture.

- [ ] **Step 3: Record capture timestamp and hashes**

Run: `node scripts/bazi-audit-round.js capture-engine audits/bazi/round-01`  
Expected: `captured=10 rulingHash=unchanged engineHash=unchanged` and a capture timestamp later than the ruling freeze.

- [ ] **Step 4: Commit engine evidence separately**

```powershell
git add -- audits/bazi/round-01/engine-results.json audits/bazi/round-01/freeze.json
git commit -m "test: capture bazi audit round 1 engine results"
```

### Task 5: Classify differences and publish the round report

**Files:**
- Create: `audits/bazi/round-01/comparison.csv`
- Create: `audits/bazi/round-01/report.md`
- Modify: `audits/bazi/registry.json`

**Interfaces:**
- Consumes: frozen independent rulings and raw engine results.
- Produces: field-level classifications, impact analysis, suggested corrections, and a mandatory user-approval stop.

- [ ] **Step 1: Build a field-level comparison table**

Use columns:

```text
case_id,field,independent,engine,match,classification,evidence,impact,suggested_action
```

Compare strength, Yong, Xi, Ji, pattern name, and pattern status separately. Do not mark a whole chart wrong because one field differs.

- [ ] **Step 2: Investigate every mismatch without editing rules**

For each mismatch, trace raw pillars, strength detail, Cong decision, pattern conditions, Yong/Xi/Ji evidence, and relevant source lines. Assign exactly one approved category. If the evidence cannot establish a single answer, use `证据不足` or `流派口径差异`, not `明确程序错误`.

- [ ] **Step 3: Write the user-facing report**

The report begins with counts and then includes:

1. Ten-case summary table.
2. Confirmed matches.
3. Each disputed field with independent basis and website basis.
4. Classification and affected mechanism/case range.
5. A proposed minimal correction for discussion only.
6. An explicit line: `本轮未修改命理引擎，等待用户逐项确认。`

- [ ] **Step 4: Verify round integrity and prohibited changes**

Run: `node scripts/bazi-audit-round.js verify audits/bazi/round-01 --phase reported`  
Expected: `cases=10 hashes=valid engineFiles=unchanged classifications=valid reportStop=true`.

- [ ] **Step 5: Run audit and full regressions**

Run: `node --test tests/bazi-audit-round.test.js` and the repository full test command.  
Expected: audit tests PASS; no new product-test failure because this plan did not alter product rules.

- [ ] **Step 6: Commit the report and stop**

```powershell
git add -- audits/bazi/round-01/comparison.csv audits/bazi/round-01/report.md audits/bazi/registry.json
git commit -m "docs: report bazi audit round 1 findings"
```

Do not start a product fix, second batch, push, or deployment. Present the report to the user and wait for explicit approval on each proposed correction.

