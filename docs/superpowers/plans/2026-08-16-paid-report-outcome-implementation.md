# Paid Report Outcome Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the four remaining paid-report sections to evidence-led, plain-Chinese outcome inference, with complete report-layer LiuNian/DaYun activation analysis and no advice-style copy.

**Architecture:** Keep the frozen BaZi core untouched. Extend `js/deep-report.js` with a report-only timing relation collector, a role-aware direction adjudicator, stricter study-profile facts, and domain narratives. Extend `js/result.js` only for the new source/outcome presentation contract; page and PDF continue to share rendered DOM.

**Tech Stack:** Browser JavaScript, CommonJS-compatible UMD module, Node built-in test runner, VM render tests, static HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-08-16-paid-report-outcome-design.md`

## Global Constraints

- Do not modify frozen strength, pattern, Yong/Xi/Ji, or calendar algorithms in `js/bazi.js`.
- Do not modify payment, orders, membership, credits, AI endpoints, or PDF generation logic.
- Do not stage or commit `.data-store.json` or `qa-deep-report-preview.html`.
- Do not fabricate DaYun for undated direct-pillar charts.
- All new production behavior must be preceded by a failing test.
- User-visible paid narratives must not contain internal English fields, raw evidence arrays, scores for relationship/current-year/five-year, or advice verbs.
- A combination is not a transformation unless authoritative facts explicitly confirm transformation; half-combinations and half-meetings remain tendencies.
- Relation names never directly determine favorable/adverse direction; adjudicate through the frozen Yong/Xi/Ji role and real action direction.
- Do not push or deploy without a later explicit user request.

---

### Task 1: Add the professional-source plus plain-outcome narrative contract

**Files:**
- Modify: `js/result.js:308-333`
- Modify: `tests/deep-report-render.test.js`

**Interfaces:**
- Consumes: existing narrative verdicts `{ title, text, basis }`.
- Produces: backward-compatible verdicts `{ title, sourceText, outcomeText, text, basis }` rendered as source first and outcome second.

- [ ] **Step 1: Write the failing render tests**

Add a fixture verdict and assertions:

```js
test('paid verdict renders professional source before the plain outcome and escapes both', () => {
  const facts = fixtureFacts();
  facts.currentYear.narrative = {
    hideScore: true,
    headline: '本年结论',
    painPoint: '',
    verdicts: [{
      title: '感情稳定基础被打乱',
      sourceText: '流年申冲日支寅，寅木为本命用神。',
      outcomeText: '两个人更容易争吵、分开住，或者重新考虑关系。<img src=x>',
      basis: ['TIMING:LIUNIAN:CLASH:DAY'],
    }],
    note: '传统命理推演参考。',
  };
  const rendered = renderFixture({ facts });
  const page = rendered.nodes.thisYearContent.innerHTML;
  assert.ok(page.indexOf('流年申冲日支寅') < page.indexOf('两个人更容易争吵'));
  assert.match(page, /deep-report-verdict-source/);
  assert.match(page, /deep-report-verdict-outcome/);
  assert.doesNotMatch(page, /<img/);
  assert.match(rendered.pdfHtml, /流年申冲日支寅/);
});

test('legacy text-only verdicts remain visible during migration', () => {
  const facts = fixtureFacts();
  facts.study.narrative = {
    grade: 'L6', level: '本科较顺', difficulty: '', headline: '学业结论', painPoint: '',
    verdicts: [{ title: '学习方式', text: '理解和表达能够连接起来。', basis: ['LEGACY'] }], note: '',
  };
  const rendered = renderFixture({ facts });
  assert.match(rendered.nodes.studyContent.innerHTML, /理解和表达能够连接起来/);
});
```

- [ ] **Step 2: Run the render tests and verify RED**

Run:

```powershell
node --test tests/deep-report-render.test.js
```

Expected: the source/outcome class assertions fail because `reportNarrative` only renders `verdict.text`.

- [ ] **Step 3: Implement the backward-compatible renderer**

Update the verdict mapping in `reportNarrative`:

```js
var sourceText = reportText(verdict.sourceText);
var outcomeText = reportText(verdict.outcomeText || verdict.text);
var body = '';
if (sourceText) body += '<p class="deep-report-verdict-source">命理依据：' + reportEsc(sourceText) + '</p>';
if (outcomeText) body += '<p class="deep-report-verdict-outcome">' + reportEsc(outcomeText) + '</p>';
return '<section class="deep-report-verdict-item"><h4>'
  + reportEsc(reportText(verdict.title)) + '</h4>' + body + '</section>';
```

Do not render `basis`.

- [ ] **Step 4: Run the render tests and verify GREEN**

Run the same command. Expected: all render tests pass.

- [ ] **Step 5: Commit the narrative contract**

```powershell
git add js/result.js tests/deep-report-render.test.js
git commit -m "feat: render evidence-led paid report verdicts"
```

---

### Task 2: Build complete report-layer LiuNian and DaYun relation facts

**Files:**
- Modify: `js/deep-report.js:1100-1580`
- Modify: `tests/deep-report-timing.test.js`

**Interfaces:**
- Consumes: `bazi`, frozen `core.yongJi`, annual pillar, active DaYun, and calculator element/relationship APIs.
- Produces: `annual.interactions[]` records with stable fields:
- Produces for Node tests only: `DeepReport.__test.collectStemTimingRelation`, `collectBranchTimingRelations`, `collectGroupTimingRelations`, `collectAnnualInteractions`, and `adjudicateTimingInteraction`. Do not attach `__test` in the browser build.

```js
{
  id: 'liunian:branch:clash:day:申:寅',
  source: '流年',
  sourcePillar: { gan: '丙', zhi: '申' },
  targetPillar: 'day',
  targetLabel: '日支',
  layer: '地支',
  type: '六冲',
  actor: '申',
  target: '寅',
  actorElement: '金',
  targetElement: '木',
  actorRole: '喜神',
  targetRole: '忌神',
  formedElement: '',
  formedRole: '中性',
  formationStatus: 'none',
  direction: 'favorable',
  domains: ['relationship'],
}
```

- [ ] **Step 1: Write failing tests for full relation coverage**

Reuse the existing `chart`, `core`, `makeCalculator`, and `makeChain` fixtures in `tests/deep-report-timing.test.js`. Add focused tests with controlled pillars and assert:

```js
test('annual interactions cover LiuNian and DaYun against all four original pillars', () => {
  const allTargetsChart = {
    year:{gan:'甲',zhi:'子'}, month:{gan:'乙',zhi:'子'},
    day:{gan:'丙',zhi:'子'}, hour:{gan:'丁',zhi:'子'},
    birthDate:{year:1990,month:1,day:1,hour:1},
  };
  const facts = DeepReport.buildAnnualFacts(
    allTargetsChart, core, makeCalculator(), makeChain(false), 2026,
    { gan:'丙', zhi:'寅', startYear:2020, endYear:2027 }
  );
  const rows = facts.interactions;
  assert.ok(rows.some(row => row.source === '流年' && row.targetPillar === 'year'));
  assert.ok(rows.some(row => row.source === '流年' && row.targetPillar === 'month'));
  assert.ok(rows.some(row => row.source === '流年' && row.targetPillar === 'day'));
  assert.ok(rows.some(row => row.source === '流年' && row.targetPillar === 'hour'));
  assert.ok(rows.some(row => row.source === '大运'));
  assert.ok(rows.some(row => row.source === '岁运' && row.targetPillar === 'dayun'));
});

test('timing interactions retain stem control direction and every branch relation family', () => {
  const hooks = DeepReport.__test;
  const calculator = makeCalculator();
  const core = { yongJi: { yongShen:['木'], xiShen:['水'], jiShen:['金'] } };
  const pairRows = [
    ...hooks.collectStemTimingRelation('流年', '庚', '甲', 'day', core, calculator),
    ...hooks.collectStemTimingRelation('流年', '甲', '己', 'month', core, calculator),
    ...hooks.collectBranchTimingRelations('流年', '申', '寅', 'day', core, calculator),
    ...hooks.collectBranchTimingRelations('流年', '亥', '寅', 'day', core, calculator),
    ...hooks.collectBranchTimingRelations('流年', '巳', '寅', 'day', core, calculator),
    ...hooks.collectBranchTimingRelations('流年', '子', '卯', 'day', core, calculator),
    ...hooks.collectBranchTimingRelations('流年', '寅', '寅', 'day', core, calculator),
  ];
  for (const type of ['天干相克', '天干五合', '六冲', '六合', '六害', '刑', '伏吟']) {
    assert.ok(pairRows.some(row => row.type === type), type);
  }
  const groupRows = []
    .concat(hooks.collectGroupTimingRelations('流年', '戌', {
      year:{zhi:'寅'}, month:{zhi:'午'}, day:{zhi:'子'}, hour:{zhi:'丑'},
    }, core, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '午', {
      year:{zhi:'寅'}, month:{zhi:'子'}, day:{zhi:'丑'}, hour:{zhi:'亥'},
    }, core, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '辰', {
      year:{zhi:'寅'}, month:{zhi:'卯'}, day:{zhi:'午'}, hour:{zhi:'未'},
    }, core, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '卯', {
      year:{zhi:'寅'}, month:{zhi:'子'}, day:{zhi:'午'}, hour:{zhi:'未'},
    }, core, calculator));
  for (const type of ['三合', '半合', '三会', '半会']) assert.ok(groupRows.some(row => row.type === type), type);
  const control = pairRows.find(row => row.type === '天干相克');
  assert.ok(control.controller && control.controlled);
});

test('half combinations and unqualified combinations never claim transformation', () => {
  const calculator = makeCalculator();
  const core = { yongJi: { yongShen:['木'], xiShen:['水'], jiShen:['火'] } };
  const rows = DeepReport.__test.collectGroupTimingRelations('流年', '午', {
    year:{zhi:'寅'}, month:{zhi:'子'}, day:{zhi:'卯'}, hour:{zhi:'酉'},
  }, core, calculator).concat(
    DeepReport.__test.collectStemTimingRelation('流年', '甲', '己', 'month', core, calculator)
  );
  assert.ok(rows.some(row => row.type === '半合' && row.formationStatus === 'tendency'));
  assert.equal(rows.some(row => /半合|半会/.test(row.type) && row.transformed === true), false);
  assert.equal(rows.some(row => row.type === '天干五合' && row.transformed === true), false);
});

test('undated direct pillars collect annual-original relations but never DaYun relations', () => {
  const undated = {
    year:{gan:'甲',zhi:'子'}, month:{gan:'乙',zhi:'丑'},
    day:{gan:'丙',zhi:'午'}, hour:{gan:'丁',zhi:'未'},
  };
  const facts = DeepReport.buildFiveYearFacts(undated, core, makeCalculator(), makeChain(false), 2026, 'male');
  assert.ok(facts.years[0].interactions.some(row => row.source === '流年'));
  assert.equal(facts.years.some(year => year.interactions.some(row => row.source === '大运' || row.source === '岁运')), false);
});
```

- [ ] **Step 2: Run timing tests and verify RED**

```powershell
node --test tests/deep-report-timing.test.js
```

Expected: `interactions` is missing or only spouse-palace activations exist.

- [ ] **Step 3: Add deterministic relation tables and collectors inside `deep-report.js`**

Add one canonical set of constants; remove duplicate report-local declarations:

```js
var STEM_COMBINE = { 甲:'己', 己:'甲', 乙:'庚', 庚:'乙', 丙:'辛', 辛:'丙', 丁:'壬', 壬:'丁', 戊:'癸', 癸:'戊' };
var STEM_COMBINE_ELEMENT = { 甲己:'土', 己甲:'土', 乙庚:'金', 庚乙:'金', 丙辛:'水', 辛丙:'水', 丁壬:'木', 壬丁:'木', 戊癸:'火', 癸戊:'火' };
var BRANCH_COMBINE_ELEMENT = { 子丑:'土', 丑子:'土', 寅亥:'木', 亥寅:'木', 卯戌:'火', 戌卯:'火', 辰酉:'金', 酉辰:'金', 巳申:'水', 申巳:'水', 午未:'土', 未午:'土' };
var THREE_COMBINE = [
  { branches:['寅','午','戌'], element:'火' }, { branches:['亥','卯','未'], element:'木' },
  { branches:['申','子','辰'], element:'水' }, { branches:['巳','酉','丑'], element:'金' },
];
var THREE_MEET = [
  { branches:['寅','卯','辰'], element:'木' }, { branches:['巳','午','未'], element:'火' },
  { branches:['申','酉','戌'], element:'金' }, { branches:['亥','子','丑'], element:'水' },
];
```

Implement `collectStemTimingRelation(source, movingGan, targetGan, targetPillar, core, calculator)`, `collectBranchTimingRelations(source, movingZhi, targetZhi, targetPillar, core, calculator)`, `collectGroupTimingRelations(source, movingZhi, bazi, core, calculator)`, `collectAnnualInteractions(bazi, core, pillar, daYun, dynamic, calculator)`, and `dedupeTimingInteractions(rows)`.

`collectStemTimingRelation` first compares elements for same/generate/control direction, then adds five-combine when `STEM_COMBINE[movingGan] === targetGan`. `collectBranchTimingRelations` checks repetition, clash, harm, punishment, and six-combine tables independently so no relation is lost. `collectGroupTimingRelations` loops `THREE_COMBINE` and `THREE_MEET`, counts original members before adding the moving branch, emits three-member rows only when the moving branch completes a previously incomplete group, and emits half rows when exactly two distinct members exist. `collectAnnualInteractions` calls all three collectors for LiuNian and DaYun against every `PILLARS` entry, adds LiuNian-versus-DaYun pair relations, merges authoritative formation evidence from `dynamic.triggers`, and finally calls `dedupeTimingInteractions`.

Rules:

- The collector records all relations before adjudication.
- Pair and group formations store their formed element and frozen role.
- Half-combine/half-meet always use `formationStatus:'tendency'`.
- Three-combine/three-meet use `formationStatus:'qualified'` only when an authoritative dynamic row explicitly identifies completion and a formed element; otherwise use `potential`.
- Stem five-combine uses `potential` unless an authoritative row explicitly confirms transformation.
- `source:'岁运'` is reserved for LiuNian versus DaYun.
- Deduplication key is `source|layer|type|targetPillar|actor|target|formedElement`.
- At the module return site, attach the collector and adjudicator functions under `api.__test` only when `typeof module !== 'undefined' && module.exports`; browser `window.DeepReport` does not expose them.

- [ ] **Step 4: Attach interactions to every annual fact**

In `buildAnnualFacts`, call the collector once and return:

```js
var interactions = collectAnnualInteractions(bazi, core, pillar, activeDaYun, dynamic, calculator);
return {
  // existing fields
  interactions: interactions,
  // domain facts receive filtered references, not independent recalculation
};
```

Retain legacy `dynamic.triggers` only as authoritative support and backward compatibility.

- [ ] **Step 5: Run timing tests and verify GREEN**

Run `node --test tests/deep-report-timing.test.js`. Expected: all timing tests pass.

- [ ] **Step 6: Commit the timing facts**

```powershell
git add js/deep-report.js tests/deep-report-timing.test.js
git commit -m "feat: add complete paid report timing facts"
```

---

### Task 3: Adjudicate relation direction through frozen Yong/Xi/Ji

**Files:**
- Modify: `js/deep-report.js`
- Modify: `tests/deep-report-timing.test.js`
- Modify: `tests/deep-report-narrative.test.js`

**Interfaces:**
- Consumes: Task 2 timing records.
- Produces: `direction`, `sourceText`, `outcomeKey`, and domain routing without changing the frozen core.

- [ ] **Step 1: Write failing direction tests**

```js
test('clashing a favorable target is adverse while clashing a Ji target can be favorable with change cost', () => {
  const favorable = DeepReport.__test.adjudicateTimingInteraction({ type:'六冲', targetRole:'用神', actorRole:'忌神' });
  const adverse = DeepReport.__test.adjudicateTimingInteraction({ type:'六冲', targetRole:'忌神', actorRole:'喜神' });
  assert.equal(favorable.direction, 'adverse');
  assert.equal(adverse.direction, 'favorable');
  assert.equal(adverse.changeCost, true);
});

test('combining into a Ji element is adverse and combining into a favorable element is favorable', () => {
  assert.equal(DeepReport.__test.adjudicateTimingInteraction({ type:'六合', formedRole:'忌神', formationStatus:'potential' }).direction, 'adverse');
  assert.equal(DeepReport.__test.adjudicateTimingInteraction({ type:'六合', formedRole:'喜神', formationStatus:'potential' }).direction, 'favorable');
});

test('punishment and harm never become automatically favorable merely because the target is Ji', () => {
  for (const type of ['刑', '六害']) {
    const result = DeepReport.__test.adjudicateTimingInteraction({ type, targetRole:'忌神', actorRole:'喜神' });
    assert.notEqual(result.direction, 'favorable');
    assert.equal(result.frictionPersists, true);
  }
});

test('stem control follows controller and controlled roles', () => {
  assert.equal(DeepReport.__test.adjudicateTimingInteraction({ type:'天干相克', controllerRole:'喜神', controlledRole:'忌神' }).direction, 'favorable');
  assert.equal(DeepReport.__test.adjudicateTimingInteraction({ type:'天干相克', controllerRole:'忌神', controlledRole:'用神' }).direction, 'adverse');
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/deep-report-timing.test.js tests/deep-report-narrative.test.js
```

Expected: no generic role-aware adjudicator exists.

- [ ] **Step 3: Implement one direction adjudicator**

Add and use exactly one function:

```js
function adjudicateTimingInteraction(row) {
  var result = { direction:'mixed', changeCost:false, frictionPersists:false, reasonKey:'insufficient' };
  if (row.type === '六冲') {
    result.changeCost = true;
    if (favorableRole(row.targetRole)) Object.assign(result, { direction:'adverse', reasonKey:'clash_favorable_target' });
    else if (row.targetRole === '忌神' && favorableRole(row.actorRole)) Object.assign(result, { direction:'favorable', reasonKey:'clash_ji_target' });
  } else if (/六合|三合|半合|三会|半会|天干五合/.test(row.type)) {
    if (favorableRole(row.formedRole)) Object.assign(result, { direction:'favorable', reasonKey:'combine_favorable_formation' });
    else if (row.formedRole === '忌神') Object.assign(result, { direction:'adverse', reasonKey:'combine_ji_formation' });
    else if (favorableRole(row.targetRole) && row.actorRole === '忌神') Object.assign(result, { direction:'adverse', reasonKey:'bind_favorable_target' });
    else if (row.targetRole === '忌神') Object.assign(result, { direction:'mixed', reasonKey:'bind_ji_target' });
  } else if (row.type === '刑' || row.type === '六害') {
    result.frictionPersists = true;
    result.direction = favorableRole(row.targetRole) || row.actorRole === '忌神' ? 'adverse' : 'mixed';
    result.reasonKey = row.type === '刑' ? 'repeated_friction' : 'hidden_distrust';
  } else if (row.type === '伏吟') {
    result.direction = favorableRole(row.targetRole) ? 'favorable' : row.targetRole === '忌神' ? 'adverse' : 'mixed';
    result.reasonKey = 'repeat_target_role';
  } else if (row.type === '天干相克') {
    if (favorableRole(row.controllerRole) && row.controlledRole === '忌神') result.direction = 'favorable';
    else if (row.controllerRole === '忌神' && favorableRole(row.controlledRole)) result.direction = 'adverse';
    result.reasonKey = 'stem_control_direction';
  }
  return Object.assign({}, row, result);
}
```

Do not let `dynamic.verdict`, `dangerScore`, or a legacy `isGood:false` override this result without Yong/Xi/Ji evidence.

- [ ] **Step 4: Add source text and domain routing**

Implement `timingSourceText(row)` as a deterministic formatter. It must name the moving layer, exact stems/branches, relation, affected pillar, and the resolved role, for example `流年申冲日支寅，寅木为本命用神。`; for a formation it must append `合向火，火为本命忌神` only when `formedElement` exists, and must say `形成趋势` rather than `化成` unless `formationStatus === 'qualified'`.

Implement `timingDomains(row, facts)` as a deduplicated array builder with these exact gates:

- day-branch targets add `relationship`;
- month-pillar targets add `career`;
- `wealth` is added only when the moving/target Ten-God is 正财/偏财, the row touches a recorded wealth storage branch, or a frozen wealth pathway/risk is activated;
- `study` is added only when the moving/target Ten-God is 印/官杀/食伤 or the row activates a recorded study profile/limitation;
- do not route a row to wealth or study from pillar position alone;
- an otherwise unrouted row remains in the annual overall section, so evidence is not discarded.

- [ ] **Step 5: Run direction tests and verify GREEN**

Run the Task 3 test command. Expected: all pass.

- [ ] **Step 6: Commit direction adjudication**

```powershell
git add js/deep-report.js tests/deep-report-timing.test.js tests/deep-report-narrative.test.js
git commit -m "feat: adjudicate paid report timing by yongji"
```

---

### Task 4: Replace study advice with ranked, evidence-gated study outcomes

**Files:**
- Modify: `js/deep-report.js:117-540, 1744-1843`
- Modify: `tests/deep-report-study.test.js`
- Modify: `tests/deep-report-narrative.test.js`

**Interfaces:**
- Consumes: existing Ten-God occurrences, frozen pattern status, strength, Yong/Xi/Ji, authoritative action chains, relation events, and structural risks.
- Produces: `study.profile`, `study.educationBand`, `study.fieldTendencies`, `study.limitations`, and a no-advice narrative.

- [ ] **Step 1: Write failing tests for the confirmed positive hierarchy**

Add real fact tests for:

```js
test('effective Sha-Yin with useful seal outranks Guan-Yin and yields the persistent-study profile', () => {
  const shaYin = buildStudyFixture({ chain:'杀印相生', patternStatus:'成格', sealRole:'用神', sealCount:2 });
  const guanYin = buildStudyFixture({ chain:'官印相生', patternStatus:'成格', sealRole:'用神', sealCount:2 });
  assert.equal(shaYin.profile.key, 'persistent_sha_yin');
  assert.ok(shaYin.educationBand.rank > guanYin.educationBand.rank);
  assert.match(shaYin.profile.outcome, /不怕重复|肯下功夫|长期投入/);
});

test('useful wealth regulating an excessive Ji seal is positive unless wealth breaks the seal', () => {
  const regulated = buildStudyFixture({ sealRole:'忌神', sealCount:4, wealthRole:'用神', authoritative:'印成势，财星制印' });
  assert.equal(regulated.profile.key, 'smart_action_regulation');
  const broken = buildStudyFixture({ sealRole:'忌神', sealCount:4, wealthRole:'用神', authoritative:'财坏印' });
  assert.notEqual(broken.profile.key, 'smart_action_regulation');
});

test('YangRen inspiration requires strong body, strong seal evidence and effective output', () => {
  const complete = buildStudyFixture({ chain:'羊刃', strength:'极强', sealCount:3, sealStrong:true, outputEffective:true });
  assert.equal(complete.profile.key, 'inspired_breakthrough');
  assert.notEqual(buildStudyFixture({ chain:'羊刃', strength:'中和', sealCount:3, sealStrong:true, outputEffective:true }).profile.key, 'inspired_breakthrough');
  assert.notEqual(buildStudyFixture({ chain:'羊刃', strength:'极强', sealCount:1, sealStrong:false, outputEffective:true }).profile.key, 'inspired_breakthrough');
  assert.notEqual(buildStudyFixture({ chain:'羊刃', strength:'极强', sealCount:3, sealStrong:true, outputEffective:false }).profile.key, 'inspired_breakthrough');
});

test('officer-control profiles follow the confirmed hierarchy and exclude hurting-officer-sees-officer', () => {
  const foodSha = buildStudyFixture({ authoritative:'食神制杀' });
  const woundCombinesSha = buildStudyFixture({ authoritative:'伤官合杀' });
  const foodControlsOfficer = buildStudyFixture({ authoritative:'食神克官' });
  assert.ok(foodSha.profile.rank > woundCombinesSha.profile.rank);
  assert.ok(woundCombinesSha.profile.rank > foodControlsOfficer.profile.rank);
  assert.notEqual(buildStudyFixture({ authoritative:'伤官见官' }).profile.key, 'smart_and_hardworking');
});
```

- [ ] **Step 2: Write failing pairing and negative-condition tests**

Extend `buildStudyFixture` with `pairing`, `season`, `balancingElementPresent`, `authoritative`, `wealthRole`, `sealStrong`, and `outputEffective`, then add these executable tests:

```js
test('metal-water clarity requires an actual chain and no cold or dry blocker', () => {
  assert.equal(buildStudyFixture({ pairing:'金水相涵', season:'秋', authoritative:'金生水，清而不寒' }).profile.key, 'metal_water_clarity');
  assert.notEqual(buildStudyFixture({ pairing:'金水相涵', season:'冬', balancingElementPresent:false, authoritative:'金寒水冷' }).profile.key, 'metal_water_clarity');
});

test('wood-fire clarity requires an actual chain and no dry, blazing or burned-wood blocker', () => {
  assert.equal(buildStudyFixture({ pairing:'木火通明', season:'春', authoritative:'木生火，清而不烈' }).profile.key, 'wood_fire_clarity');
  assert.notEqual(buildStudyFixture({ pairing:'木火通明', season:'夏', balancingElementPresent:false, authoritative:'火炎木焚' }).profile.key, 'wood_fire_clarity');
});

test('Ji seal is only called excessive when authoritative facts say seal is strong or formed', () => {
  const countOnly = buildStudyFixture({ sealRole:'忌神', sealCount:4, sealStrong:false, authoritative:'' });
  const confirmed = buildStudyFixture({ sealRole:'忌神', sealCount:4, sealStrong:true, authoritative:'印星成势' });
  assert.equal(countOnly.limitations.some(row => row.key === 'excessive_ji_seal'), false);
  assert.equal(confirmed.limitations.some(row => row.key === 'excessive_ji_seal'), true);
});

test('uncontrolled excessive output lowers education outcome', () => {
  const clean = buildStudyFixture({ outputEffective:true, authoritative:'食伤有制' });
  const uncontrolled = buildStudyFixture({ outputExcess:true, outputEffective:false, authoritative:'食伤过旺无制' });
  assert.ok(uncontrolled.educationBand.rank < clean.educationBand.rank);
});

test('confirmed severe study blockers reduce two education bands', () => {
  const base = buildStudyFixture({ chain:'官印相生', sealRole:'用神', sealCount:2 });
  for (const authoritative of ['财坏印', '身弱杀旺无印', '用神无力且空亡']) {
    const blocked = buildStudyFixture({ chain:'官印相生', sealRole:'用神', sealCount:2, authoritative });
    assert.ok(blocked.educationBand.rank <= base.educationBand.rank - 2);
  }
});
```

Exact pairing gates:

- Both elements must have at least one exposed or main-Qi occurrence.
- The generating element and generated element must not both be Ji.
- Metal-water rejects authoritative text matching `寒|冻|金寒水冷|水多金沉|湿重|燥土埋金`.
- Wood-fire rejects authoritative text matching `燥|烈|火炎|木焚|木火偏枯|炎上太过`.
- Winter metal-water additionally requires an actual fire occurrence; summer wood-fire additionally requires an actual water occurrence.
- Any frozen structural risk directly breaking the chain downgrades it to a limitation instead of a strong profile.

- [ ] **Step 3: Run study tests and verify RED**

```powershell
node --test tests/deep-report-study.test.js tests/deep-report-narrative.test.js
```

Expected: the current study chain still blocks Ji-seal regulation, keeps YangRen manual-only, and emits advice language.

- [ ] **Step 4: Implement study profile facts**

Add four deterministic functions, with no AI inference:

- `buildStudyProfile(bazi, tenGods, chains, core, calculator)` evaluates only authoritative pattern/action-chain facts, in descending `STUDY_PROFILE_RANK`, and returns the first fully qualified profile plus all matched evidence IDs. It must distinguish `财星制印` from `财坏印` before considering `smart_action_regulation`.
- `buildStudyPairingProfile(bazi, tenGods, core, calculator)` first proves exposed/main-Qi occurrences and the actual generating chain, then applies the seasonal/blocker gates below; an unproven poetic label never creates a profile.
- `buildStudyLimitations(bazi, tenGods, core, calculator)` emits stable `{ key, severity, sourceText, outcomeText, basis }` rows only from authoritative strength/pattern/action/risk facts.
- `deriveEducationBand(profile, dimensions, limitations)` starts from the existing dimension-derived plain band, caps upward movement to one band from profile evidence, applies severe blockers as `-2` and medium blockers as `-1`, clamps within existing band bounds, and returns `{ key, label, rank, basis }`. It does not promise admission or a named school.

Use stable ranks:

```js
var STUDY_PROFILE_RANK = {
  persistent_sha_yin: 100,
  disciplined_guan_yin: 90,
  inspired_breakthrough: 88,
  smart_and_hardworking_food_sha: 84,
  smart_and_hardworking_wound_sha: 80,
  smart_and_hardworking_food_officer: 76,
  smart_action_regulation: 74,
  metal_water_clarity: 70,
  wood_fire_clarity: 70,
  composite: 50,
};
```

Limitations reduce the education-band rank but never mutate frozen core facts. Severe blockers (`财破印/财坏印`, `身弱杀旺无印`, effective chain broken) reduce two bands; medium blockers (`印为忌且旺`, `食伤过旺无制`) reduce one band.

Education bands remain the existing plain levels from basic difficulty through graduate-study potential. The narrative may show the plain band but must not claim admission, a named university, or a guaranteed credential.

- [ ] **Step 5: Rewrite the study narrative without advice**

First extend the existing helper without breaking legacy callers:

```js
function narrativeVerdict(title, text, basis, details) {
  details = details || {};
  var outcomeText = details.outcomeText || text || '';
  return {
    title: title || '',
    sourceText: details.sourceText || '',
    outcomeText: outcomeText,
    text: outcomeText,
    basis: list(basis).filter(Boolean),
  };
}
```

Every verdict then receives source/outcome fields. Example:

```js
narrativeVerdict('学习属于长期用功型', '', ['STUDY_PROFILE:persistent_sha_yin'], {
  sourceText: '杀印相生成格，印星为本命用神。',
  outcomeText: '你不是只靠临场聪明，而是能把压力变成反复钻研；越是需要长期积累的考试，优势越容易显出来。',
});
```

Remove advice verbs from absorption, expression, discipline, application, profile, limitation, headline, pain point, and note strings used by narrative.

- [ ] **Step 6: Run study and narrative tests and verify GREEN**

Run the Task 4 test command. Expected: all pass.

- [ ] **Step 7: Commit study outcomes**

```powershell
git add js/deep-report.js tests/deep-report-study.test.js tests/deep-report-narrative.test.js
git commit -m "feat: derive evidence-gated study outcomes"
```

---

### Task 5: Remove advice from wealth and attach concrete timing outcomes

**Files:**
- Modify: `js/deep-report.js:549-805, 1658-1742`
- Modify: `tests/deep-report-wealth.test.js`
- Modify: `tests/deep-report-narrative.test.js`

**Interfaces:**
- Consumes: frozen wealth facts plus Task 2/3 interactions.
- Produces: A1—A10 magnitude plus source/outcome verdicts and year-specific wealth activations.

- [ ] **Step 1: Write failing no-advice and timing tests**

```js
test('wealth narrative states magnitude, source, capacity, retention and storage without advice verbs', () => {
  const narrative = DeepReport.buildNarratives(favorableFacts()).wealth;
  const copy = JSON.stringify(narrative);
  assert.match(copy, /A(?:10|[1-9])/);
  for (const title of ['财富显现方式', '财富承载能力', '主要赚钱路径', '财富留存状态', '资产沉淀能力']) {
    assert.match(copy, new RegExp(title));
  }
  assert.doesNotMatch(copy, /建议|应该|应当|优先|最好|宜|需注意|控制投入|建立|选择/);
});

test('wealth timing names the exact year relation and the concrete money outcome', () => {
  const facts = favorableFacts();
  facts.currentYear.interactions = [{
    source:'流年', type:'六冲', targetPillar:'month', targetLabel:'月支',
    actor:'戌', target:'辰', actorRole:'喜神', targetRole:'忌神',
    direction:'favorable', domains:['wealth'],
    sourceText:'流年戌冲原局财库辰，辰土为本命忌神。',
  }];
  const current = DeepReport.buildNarratives(facts).currentYear;
  const copy = JSON.stringify(current);
  assert.match(copy, /财星|财库|食伤生财|财富/);
  assert.match(copy, /收入|进账|支出|资金|资产/);
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js
```

Expected: current source/retention strings contain advice and annual wealth copy is generic.

- [ ] **Step 3: Rewrite wealth narrative as facts**

Convert advice such as:

```text
先守住现金流和合同边界
主动做储蓄、配置和风险隔离
更适合从稳定主业起步
```

to outcomes such as:

```text
收入扩大时更容易同时出现合作分配、长期投入或责任支出，账面流水增长不等于净资产同步增长。
阶段性进账有机会沉淀为长期资产，但资金在沉淀前通常会经历明显流动。
财富更常从稳定职位和长期积累开始显现，突然获得高额横财的证据不强。
```

Keep A1—A10 unchanged.

- [ ] **Step 4: Route timing interactions to wealth outcomes**

Add wealth verdicts only when interactions touch a wealth occurrence, a wealth pathway, a storage branch, or a frozen wealth structural risk. Do not infer wealth from every favorable year.

- [ ] **Step 5: Run tests and verify GREEN**

Run the Task 5 command. Expected: all pass.

- [ ] **Step 6: Commit wealth outcomes**

```powershell
git add js/deep-report.js tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js
git commit -m "feat: make paid wealth report outcome-led"
```

---

### Task 6: Remove current-year and five-year scores and generate concrete yearly outcomes

**Files:**
- Modify: `js/deep-report.js:2010-2135`
- Modify: `js/result.js`
- Modify: `result.html`
- Modify: `tests/deep-report-narrative.test.js`
- Modify: `tests/deep-report-render.test.js`
- Modify: `tests/deep-report-timing.test.js`

**Interfaces:**
- Consumes: adjudicated annual interactions and domain facts.
- Produces: scoreless current-year/five-year narratives and per-year entries `{ year, pillar, daYunLabel, directionLabel, sourceText, summary }`.

- [ ] **Step 1: Write failing score-removal tests**

```js
test('current-year and five-year narratives expose no scores or score-derived labels', () => {
  const narratives = DeepReport.buildNarratives(favorableFacts());
  for (const section of [narratives.currentYear, narratives.fiveYear]) {
    assert.equal(section.hideScore, true);
    assert.equal(Object.prototype.hasOwnProperty.call(section, 'grade'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(section, 'difficulty'), false);
    assert.doesNotMatch(JSON.stringify(section), /\/10|最高分|最低分|高分年份|低分年份|ANNUAL_SCORE|FIVE_YEAR_AVERAGE/);
  }
});

test('each five-year row includes DaYun, professional source and a plain outcome without a score', () => {
  const facts = favorableFacts();
  facts.fiveYear.years.forEach((year, index) => {
    year.daYun = { gan:index < 2 ? '甲' : '乙', zhi:index < 2 ? '辰' : '巳' };
    year.interactions = index === 2 ? [{
      source:'流年', type:'六冲', targetPillar:'day', targetLabel:'日支',
      actor:'申', target:'寅', actorRole:'忌神', targetRole:'用神',
      direction:'adverse', domains:['relationship'],
      sourceText:'流年申冲日支寅，寅木为本命用神。',
    }] : [];
  });
  const years = DeepReport.buildNarratives(facts).fiveYear.years;
  assert.equal(years.length, 5);
  for (const year of years) {
    assert.ok(year.pillar);
    assert.ok(Object.prototype.hasOwnProperty.call(year, 'daYunLabel'));
    assert.ok(year.directionLabel);
    assert.ok(year.sourceText || /延续/.test(year.summary));
    assert.doesNotMatch(JSON.stringify(year), /\/10/);
  }
});
```

- [ ] **Step 2: Write failing concrete-outcome tests**

Cover at least:

- flow-year clash against favorable spouse palace;
- favorable flow-year clash against Ji spouse palace;
- combine toward a favorable element;
- combine toward a Ji element;
- punishment and harm;
- stem control in both directions;
- DaYun boundary transition;
- year without a supported trigger.

Each test asserts both the short professional source and a concrete result word such as `争吵/分开住/收入/支出/岗位/考试/项目`.

- [ ] **Step 3: Run narrative/timing/render tests and verify RED**

```powershell
node --test tests/deep-report-narrative.test.js tests/deep-report-timing.test.js tests/deep-report-render.test.js
```

Expected: score fields and score-derived sorting remain.

- [ ] **Step 4: Replace score-derived current-year narrative**

Remove `annualNarrativeScore` from customer-facing selection. Build the overall headline from adjudicated interaction counts and priority:

1. qualified/potential formation involving Yong/Xi/Ji;
2. day/month pillar clash, punishment, harm or stem control;
3. triggered structural risk;
4. wealth/study domain activation;
5. no supported trigger → explicit continuation statement.

Return `hideScore:true` and no `grade`, `level`, or `difficulty`.

- [ ] **Step 5: Replace five-year score sorting**

Delete numeric best/worst/average logic from `buildFiveYearNarrative`. Rank only internally by evidence priority and direction counts to select wording; never expose the rank. Produce:

```js
{
  hideScore: true,
  headline: '2028年变化最明显，2030年更容易把已有成果兑现。',
  painPoint: '2027年的旧问题最容易重新出现。',
  verdicts: [],
  years: [{
    year: 2028,
    pillar: '戊申',
    daYunLabel: '甲辰大运',
    directionLabel: '偏不利',
    sourceText: '流年申冲日支寅，寅木为本命用神。',
    summary: '感情稳定基础容易被打乱，两个人更容易争吵或聚少离多。',
  }],
}
```

- [ ] **Step 6: Update five-year row rendering and static cache version**

Render year, pillar, DaYun label, direction, source and summary; remove grade concatenation. Increment the `deep-report.js` query version in `result.html` after all behavior is stable.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run the Task 6 command. Expected: all pass.

- [ ] **Step 8: Commit scoreless timing narratives**

```powershell
git add js/deep-report.js js/result.js result.html tests/deep-report-narrative.test.js tests/deep-report-timing.test.js tests/deep-report-render.test.js
git commit -m "feat: deliver scoreless annual outcome reports"
```

---

### Task 7: Enforce plain-language and no-advice rules across all paid narratives

**Files:**
- Modify: `tests/deep-report-narrative.test.js`
- Modify: `tests/deep-report-render.test.js`
- Modify: `js/deep-report.js`

**Interfaces:**
- Consumes: all five narrative objects.
- Produces: a customer-visible copy contract that rejects internal/abstract/advice language.

- [ ] **Step 1: Write the failing copy-contract test**

```js
test('customer-visible paid narratives contain outcomes rather than advice or internal abstractions', () => {
  const narratives = DeepReport.buildNarratives(favorableFacts());
  for (const section of Object.values(narratives)) {
    const copy = customerVisibleCopy(section);
    assert.doesNotMatch(copy, /建议|应该|应当|优先|最好|宜|需注意|需要做到/);
    assert.doesNotMatch(copy, /relationEvents|structuralRisks|elementRole|confidence|evidence|sourcePillar|targetPillar/);
    assert.doesNotMatch(copy, /消耗结构|关系结构|议题增强|暗耗|失衡模式/);
  }
});
```

The helper must inspect only displayed fields (`headline`, `painPoint`, verdict title/source/outcome/text, year labels/source/summary, note), not hidden `basis`.

Add this exact test helper beside `favorableFacts`:

```js
function customerVisibleCopy(section) {
  var visible = [section.headline, section.painPoint, section.note];
  for (const verdict of section.verdicts || []) {
    visible.push(verdict.title, verdict.sourceText, verdict.outcomeText || verdict.text);
  }
  for (const year of section.years || []) {
    visible.push(year.year, year.pillar, year.daYunLabel, year.directionLabel, year.sourceText, year.summary);
  }
  return visible.filter(Boolean).join('\n');
}
```

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/deep-report-narrative.test.js tests/deep-report-render.test.js
```

Expected: current advice and abstract phrases are reported.

- [ ] **Step 3: Rewrite every failing displayed phrase**

Use concrete manifestations:

- `关系结构受损` → `两个人更容易争吵、疏远或重新考虑关系`.
- `资金消耗增加` → `进账以后更容易被支出、合作分配或长期投入带走`.
- `学习承接不足` → `听懂以后不容易稳定写出来，考试成绩容易忽高忽低`.
- `事业议题增强` → `岗位、职责、上级关系或项目节奏会出现明显变化`.

- [ ] **Step 4: Run and verify GREEN**

Run the Task 7 command. Expected: all pass.

- [ ] **Step 5: Commit the copy contract**

```powershell
git add js/deep-report.js tests/deep-report-narrative.test.js tests/deep-report-render.test.js
git commit -m "test: enforce plain paid report conclusions"
```

---

### Task 8: Regression, real example, mobile layout, and handoff

**Files:**
- Modify only if verification exposes an in-scope defect.
- Local-only: `qa-deep-report-preview.html` remains untracked.
- Create: `docs/verification/2026-08-16-paid-report-outcome-verification.md`

**Interfaces:**
- Consumes: completed implementation.
- Produces: reproducible verification evidence and an open local example for user review.

- [ ] **Step 1: Run syntax and focused suites**

```powershell
node --check js/deep-report.js
node --check js/result.js
node --test tests/deep-report-study.test.js tests/deep-report-wealth.test.js tests/deep-report-narrative.test.js tests/deep-report-timing.test.js tests/deep-report-relationship.test.js tests/deep-report-render.test.js
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete maintained test suite**

```powershell
$files = Get-ChildItem tests -Filter *.test.js | ForEach-Object { $_.FullName }
node --test $files
```

Compare failures by exact name with the known 12-test baseline. Any new failure blocks completion.

- [ ] **Step 3: Update and reload the local QA preview**

Use the real chart `庚午 癸未 戊寅 辛酉`, male, anchor year 2026. The preview must demonstrate:

- wealth A level with no advice;
- direct education level and learning type;
- no relationship/current/five-year score;
- original half-combine and spouse-star stem combine;
- one flow-year clash against spouse palace;
- five yearly rows with LiuNian, DaYun, source and plain outcome.

- [ ] **Step 4: Inspect desktop and mobile widths in the in-app browser**

Verify no horizontal overflow and source/outcome hierarchy remains legible at approximately 390 px and desktop width. Check that no internal English or score remains in the three scoreless sections.

- [ ] **Step 5: Write the verification report**

Record:

- focused and full-suite counts;
- exact known baseline failures;
- chart input and displayed outcome excerpts;
- files changed;
- confirmation that frozen core/payment/AI/PDF engine were not changed;
- remaining interpretive limitations.

- [ ] **Step 6: Commit verification evidence only**

```powershell
git add docs/verification/2026-08-16-paid-report-outcome-verification.md
git commit -m "docs: verify paid report outcome inference"
```

- [ ] **Step 7: Stop for user review**

Leave the local preview open. Do not push or deploy. Report what changed and ask the user to review the visible content.
