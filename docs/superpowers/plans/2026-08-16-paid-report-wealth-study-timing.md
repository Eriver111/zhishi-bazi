# Paid Report Wealth, Study, and Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a coherent, plain-Chinese paid wealth report with all five Ten-God storage types and favorable wealth directions, a three-band study conclusion, and correct direct-pillar DaYun status.

**Architecture:** Extend only the paid-report fact and narrative layer in `js/deep-report.js`, then consume the new stable fields through the existing safe renderer in `js/result.js`. Reuse the frozen `yongJi`, strength, pattern, relation events, reverse-lookup birth date, and DaYun calculator; do not recalculate core verdicts or let copy generation become a second命理 engine.

**Tech Stack:** Browser JavaScript, CommonJS Node test hooks, Node.js test runner, existing `BaZiCalculator`, `StructuralAnalysis`, `BaZiChain`, and in-app browser verification.

**Spec:** `docs/superpowers/specs/2026-08-16-paid-report-wealth-study-timing-design.md`

## Global Constraints

- Do not modify frozen strength, pattern, Yong/Xi/Ji calculation in `js/bazi.js`.
- Do not modify payment, AI endpoint/model, account access, or PDF engine behavior.
- Every production change starts with a focused failing test and a verified RED result.
- Customer-visible copy must not use abstract phrases such as “消耗、纠缠、失衡、结构张力、资源分流、承载不足、关系波动”.
- Storage activation never automatically means wealth, promotion, or a favorable result.
- A direction is favorable only when Yong/Xi/Ji and an actual wealth path support it; conflicting evidence yields no forced direction.
- Keep `.data-store.json` and `qa-deep-report-preview.html` untracked and out of commits.
- Do not push or deploy after implementation; stop at local verified preview.

---

### Task 1: Model all five Ten-God storage types

**Files:**
- Modify: `js/deep-report.js` (`buildWealthStorage` and nearby storage helpers)
- Test: `tests/deep-report-wealth.test.js`

**Interfaces:**
- Consumes: `bazi`, `core.yongJi`, `calculator.WU_XING`, `calculator.getShiShen`, `getHiddenStems()`.
- Produces: `wealth.storage.storages[]` with `{ zhi, pillar, fixedElement, storageRole, storageRoleKey, elementRole, activated, hiddenRoles[], wealthConnection, outcomeKey }`.

- [ ] **Step 1: Write failing tests for all five storage classes**

```js
test('every storage is classified by fixed element and keeps every hidden Ten-God role', () => {
  const facts = DeepReport.buildWealthFacts(chartWithFourStorages, core, calculator);
  assert.deepEqual(
    facts.storage.storages.map(row => row.storageRoleKey).sort(),
    ['officer', 'output', 'resource', 'wealth'].sort()
  );
  assert.ok(facts.storage.storages.every(row => row.hiddenRoles.length > 0));
});

test('same-element storage is classified as peer storage for a matching day master', () => {
  const facts = DeepReport.buildWealthFacts(peerStorageChart, peerCore, calculator);
  assert.ok(facts.storage.storages.some(row => row.storageRoleKey === 'peer'));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/deep-report-wealth.test.js`

Expected: FAIL because `storage.storages` and `storageRoleKey` do not exist.

- [ ] **Step 3: Implement fixed-storage and hidden-role facts**

```js
function storageRoleKey(dayElement, storedElement) {
  var relation = elementRelation(dayElement, storedElement);
  return ({ same: 'peer', generatedBy: 'resource', generates: 'output', controls: 'wealth', controlledBy: 'officer' })[relation] || 'neutral';
}

function storageRoleLabel(key) {
  return ({ peer: '比劫库', resource: '印库', output: '食伤库', wealth: '财库', officer: '官杀库' })[key] || '十神库';
}
```

For every `辰戌丑未` present in the chart, retain fixed storage element, role label, hidden stems with exact Ten-God names, Yong/Xi/Ji role, and activation evidence. Preserve the legacy `candidates`, `present`, and `activated` fields during migration.

- [ ] **Step 4: Add adjudication tests for useful/adverse and connected/disconnected storage**

```js
test('useful resource output and officer storage do not claim income without a wealth connection', () => {
  for (const key of ['resource', 'output', 'officer']) {
    const row = storageFixture(key, { elementRole: '用神', wealthConnection: false });
    assert.doesNotMatch(DeepReport.__test.storageOutcome(row), /收入增加|直接赚钱|发财/);
  }
});

test('useful peer storage requires a peer-output-wealth path before claiming team-amplified income', () => {
  assert.match(DeepReport.__test.storageOutcome(storageFixture('peer', { elementRole: '喜神', wealthConnection: true })), /团队|伙伴|圈层/);
  assert.doesNotMatch(DeepReport.__test.storageOutcome(storageFixture('peer', { elementRole: '喜神', wealthConnection: false })), /带来收入/);
});
```

- [ ] **Step 5: Implement `storageOutcome()` and verify GREEN**

Return concrete outcomes for peer, resource, output, wealth, and officer storage. Distinguish useful, adverse, activated, inactive, and actual connection to a wealth pathway.

Run: `node --test tests/deep-report-wealth.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add js/deep-report.js tests/deep-report-wealth.test.js
git commit -m "feat: classify every ten-god storage in paid wealth facts"
```

### Task 2: Build one coherent wealth conclusion and favorable direction

**Files:**
- Modify: `js/deep-report.js` (`buildWealthNarrative` and new direction helpers)
- Modify: `js/result.js` (wealth renderer only if the stable four-part structure needs explicit titles)
- Test: `tests/deep-report-wealth.test.js`
- Test: `tests/deep-report-narrative.test.js`
- Test: `tests/deep-report-render.test.js`

**Interfaces:**
- Consumes: Task 1 `wealth.storage.storages`, `wealth.capacity`, `wealth.resource`, `wealth.pathways`, `wealth.retention`, and `core.yongJi` exposed through wealth facts.
- Produces: `wealth.direction` and exactly four narrative verdicts: `财富量级与总判断`, `钱主要从哪里来`, `钱能不能留下`, `哪里更容易打开财路`.

- [ ] **Step 1: Write failing narrative-structure tests**

```js
test('wealth report produces four coherent customer conclusions instead of five fragmented cards', () => {
  const narrative = DeepReport.buildNarratives(fixtureFacts()).wealth;
  assert.deepEqual(narrative.verdicts.map(row => row.title), [
    '财富量级与总判断', '钱主要从哪里来', '钱能不能留下', '哪里更容易打开财路'
  ]);
});
```

- [ ] **Step 2: Write failing direction tests**

```js
test('wealth direction prefers a useful element that participates in the actual wealth path', () => {
  const direction = DeepReport.__test.deriveWealthDirection({
    yongJi: { yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] },
    pathElements: ['木', '火'],
  });
  assert.deepEqual(direction, { element: '木', directions: ['东方', '东南'], confidence: 'strong', conflict: false });
});

test('conflicting direction evidence does not force a single favorable direction', () => {
  assert.equal(DeepReport.__test.deriveWealthDirection(conflictingDirectionFacts).conflict, true);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js tests/deep-report-render.test.js`

Expected: FAIL on missing direction and old five-card titles.

- [ ] **Step 4: Implement direction selection and four-part narrative**

```js
var WEALTH_DIRECTIONS = {
  木: ['东方', '东南'], 火: ['南方'], 土: ['本地', '中央区域'], 金: ['西方', '西北'], 水: ['北方']
};

function deriveWealthDirection(input) {
  input = input || {};
  var yong = list(input.yongJi && input.yongJi.yongShen);
  var xi = list(input.yongJi && input.yongJi.xiShen);
  var ji = list(input.yongJi && input.yongJi.jiShen);
  var paths = list(input.pathElements);
  var ranked = ['木', '火', '土', '金', '水'].filter(function (element) {
    return ji.indexOf(element) < 0 && (yong.indexOf(element) >= 0 || xi.indexOf(element) >= 0);
  }).map(function (element) {
    return {
      element: element,
      score: (paths.indexOf(element) >= 0 ? 2 : 0) +
        (yong.indexOf(element) >= 0 ? 2 : 0) + (xi.indexOf(element) >= 0 ? 1 : 0),
    };
  }).sort(function (a, b) { return b.score - a.score; });
  if (!ranked.length) return { element: '', directions: [], confidence: 'limited', conflict: true };
  if (ranked[1] && ranked[1].score === ranked[0].score) {
    return { element: '', directions: [], confidence: 'limited', conflict: true };
  }
  return {
    element: ranked[0].element,
    directions: WEALTH_DIRECTIONS[ranked[0].element],
    confidence: paths.indexOf(ranked[0].element) >= 0 ? 'strong' : 'medium',
    conflict: false,
  };
}
```

Consolidate capacity, opportunity, paths, storage, and retention into four verdicts. The no-wealth-storage sentence may say stable accumulation only when strong indirect/partial wealth, CongCai, or annual activation evidence is absent.

- [ ] **Step 5: Verify renderer and escaping**

Run: `node --test tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js tests/deep-report-render.test.js`

Expected: PASS and all direction/copy strings remain HTML-escaped.

- [ ] **Step 6: Commit Task 2**

```bash
git add js/deep-report.js js/result.js tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js tests/deep-report-render.test.js
git commit -m "feat: deliver coherent wealth conclusions and directions"
```

### Task 3: Replace public study levels with three bands

**Files:**
- Modify: `js/deep-report.js` (`studyLevelText`, `deriveEducationBand`, `buildStudyNarrative`)
- Test: `tests/deep-report-study.test.js`
- Test: `tests/deep-report-narrative.test.js`

**Interfaces:**
- Consumes: existing internal rank 1–10, study profile, four dimensions, and limitations.
- Produces: `educationBand.publicKey` (`high|ordinary|low`), `educationBand.publicLabel` (`高学历|普通学历|低学历`), and specific plain outcome text.

- [ ] **Step 1: Write failing three-band tests**

```js
test('study ranks expose only high ordinary or low public bands', () => {
  assert.equal(DeepReport.__test.publicStudyBand(9).label, '高学历');
  assert.equal(DeepReport.__test.publicStudyBand(6).label, '普通学历');
  assert.equal(DeepReport.__test.publicStudyBand(2).label, '低学历');
});

test('customer study copy never says junior college or cannot enter college', () => {
  const text = customerStudyText(lowStudyFacts);
  assert.doesNotMatch(text, /大专|考不上|只能|无缘本科/);
  assert.match(text, /达到本科需要.*更多/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/deep-report-study.test.js tests/deep-report-narrative.test.js`

Expected: FAIL because public three-band fields do not exist and old labels contain “大专”.

- [ ] **Step 3: Implement stable three-band mapping**

```js
function publicStudyBand(rank) {
  if (rank >= 8) return { key: 'high', label: '高学历' };
  if (rank >= 4) return { key: 'ordinary', label: '普通学历' };
  return { key: 'low', label: '低学历' };
}
```

Keep the internal rank and evidence unchanged. Use rank-specific outcome sentences within the ordinary band so rank 4 and rank 7 remain meaningfully different.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/deep-report-study.test.js tests/deep-report-narrative.test.js`

Expected: PASS.

```bash
git add js/deep-report.js tests/deep-report-study.test.js tests/deep-report-narrative.test.js
git commit -m "feat: present study outcomes in three public bands"
```

### Task 4: Distinguish unknown birth, pre-start, and active DaYun

**Files:**
- Modify: `js/deep-report.js` (`buildUndatedFiveYearFacts`, `buildFiveYearFacts`, five-year narrative row labels)
- Modify: `js/result.js` (`buildResultData` matched-birth object)
- Test: `tests/deep-report-timing.test.js`
- Test: `tests/deep-report-narrative.test.js`
- Test: `tests/paipan-direct-mode-contract.test.js`
- Local-only update: `qa-deep-report-preview.html`

**Interfaces:**
- Consumes: `bazi.birthDate`, reverse-lookup URL fields, and `calculateDaYun().list`.
- Produces: `fiveYear.timingStatus` and year-level `daYunStatus` with `unknown_birth|before_start|active`.

- [ ] **Step 1: Write failing timing-state tests**

```js
test('matched direct pillars carry birth data into an active DaYun report', () => {
  const bazi = calculator.buildFromPillars(pillars, 'male', { year: 1990, month: 7, day: 12, hour: 9, clock: 18 });
  const facts = DeepReport.buildFiveYearFacts(bazi, core, calculator, chain, 2026, 'male');
  assert.equal(facts.years[0].daYunStatus, 'active');
  assert.equal(facts.years[0].daYun.gan + facts.years[0].daYun.zhi, '丙戌');
});

test('dated child chart before first DaYun says pre-start instead of unknown', () => {
  const facts = DeepReport.buildFiveYearFacts(childChart, core, calculator, chain, 2026, 'male');
  assert.equal(facts.years[0].daYunStatus, 'before_start');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/deep-report-timing.test.js tests/deep-report-narrative.test.js tests/paipan-direct-mode-contract.test.js`

Expected: FAIL because all null DaYun values share one undifferentiated label.

- [ ] **Step 3: Implement timing statuses and clock propagation**

Include `clock: params.clock` when `js/result.js` constructs the matched direct-pillar `birthDate`. Pass `bazi.birthDate.clock` to `calculateDaYun` when present. Mark undated charts `unknown_birth`; dated years before the first DaYun `before_start`; matched years `active`. Render “出生时间未定位”, “起运前”, or the actual DaYun pillar respectively.

- [ ] **Step 4: Update local preview with the real matched date**

Use `{ year: 1990, month: 7, day: 12, hour: 9, clock: 18 }` when building `庚午 癸未 戊寅 辛酉`; keep the preview file untracked.

- [ ] **Step 5: Verify GREEN and commit tracked files only**

Run: `node --test tests/deep-report-timing.test.js tests/deep-report-narrative.test.js tests/paipan-direct-mode-contract.test.js`

Expected: PASS.

```bash
git add js/deep-report.js js/result.js tests/deep-report-timing.test.js tests/deep-report-narrative.test.js tests/paipan-direct-mode-contract.test.js
git commit -m "fix: preserve direct-pillar birth timing in paid reports"
```

### Task 5: Enforce plain Chinese across paid sections

**Files:**
- Modify: `js/deep-report.js` (customer narrative strings only)
- Test: `tests/deep-report-narrative.test.js`
- Test: `tests/deep-report-render.test.js`

**Interfaces:**
- Consumes: all five paid narratives.
- Produces: concrete customer outcomes free of prohibited abstract terminology while retaining source evidence.

- [ ] **Step 1: Write the failing language-contract test**

```js
test('all customer-visible paid outcomes use concrete plain Chinese', () => {
  const text = collectCustomerOutcomes(DeepReport.buildNarratives(fullFixture));
  assert.doesNotMatch(text, /消耗|纠缠|失衡|结构张力|资源分流|承载不足|关系波动/);
  assert.match(text, /反复怀疑|钱进来以后|真正留下|客户|项目|本科/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/deep-report-narrative.test.js tests/deep-report-render.test.js`

Expected: FAIL on remaining abstract customer strings.

- [ ] **Step 3: Replace only customer outcomes with concrete manifestations**

Keep `sourceText` professional and short. Rewrite `outcomeText`, `headline`, and `painPoint` so each names what the user would actually experience in money, work, study, or relationships.

- [ ] **Step 4: Verify GREEN, bump cache key, and commit**

Run: `node --check js/deep-report.js && node --check js/result.js && node --test tests/deep-report-narrative.test.js tests/deep-report-render.test.js`

Expected: PASS.

```bash
git add js/deep-report.js result.html tests/deep-report-narrative.test.js tests/deep-report-render.test.js
git commit -m "feat: make paid report outcomes immediately understandable"
```

### Task 6: Full regression and real-browser acceptance

**Files:**
- Create: `docs/verification/2026-08-16-paid-report-wealth-study-timing.md`
- Do not track: `.data-store.json`, `qa-deep-report-preview.html`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: test totals, known-baseline comparison, desktop/mobile screenshots, and a local preview URL.

- [ ] **Step 1: Run focused suites**

Run:

```powershell
node --check js/deep-report.js
node --check js/result.js
node --test tests/deep-report-study.test.js tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js tests/deep-report-timing.test.js tests/deep-report-relationship.test.js tests/deep-report-render.test.js tests/paipan-direct-mode-contract.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the complete baseline**

```powershell
$files = Get-ChildItem -LiteralPath tests -Recurse -Filter *.test.js | ForEach-Object { $_.FullName }
node --test @files
```

Expected: no new failures compared with the recorded 12 known baseline failures.

- [ ] **Step 3: Verify the real matched chart in the browser**

Open the safe static preview server, not `npm run dev`. Verify `庚午 癸未 戊寅 辛酉`, male, `1990-07-12 18:00`, anchor 2026:

- actual DaYun is present rather than “未定”; 
- four wealth conclusions are coherent;
- every storage found is classified and explained;
- wealth direction includes reason;
- study shows exactly one of high/ordinary/low;
- desktop and 390×844 mobile have no console error or horizontal overflow.

- [ ] **Step 4: Write verification record and commit**

```bash
git add docs/verification/2026-08-16-paid-report-wealth-study-timing.md
git commit -m "docs: verify paid wealth study and timing upgrade"
```

- [ ] **Step 5: Stop before integration**

Report the branch, commits, test totals, preview URL, and remaining known failures. Do not merge, push, or deploy.
