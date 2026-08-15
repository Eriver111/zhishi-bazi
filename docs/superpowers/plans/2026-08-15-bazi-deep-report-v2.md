# 八字深度报告 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用冻结命局事实重建八字结果页五个付费栏目，使财运、姻缘、学业和岁运各自按专业领域规则生成稳定、可追溯且不过度确定的报告。

**Architecture:** 新增独立 UMD 模块 `js/deep-report.js`，只读消费 `BaZiCalculator`、`StructuralAnalysis` 和 `BaZiChain` 的权威输出，统一生成 `deepReportFacts`；`js/result.js` 只负责把事实渲染到现有五个 section。报告年份由独立 `js/deep-report-anchor.js` 固定，不进入订单哈希；旧分析函数保留但不再驱动付费栏目。

**Tech Stack:** 浏览器原生 JavaScript、Node.js `node:test`、VM 沙箱测试、现有 HTML/CSS、Supabase 报告库只读接口

**Spec:** `docs/superpowers/specs/2026-08-15-bazi-deep-report-v2-design.md`

## Global Constraints

- 不修改冻结的旺衰、格局、从格、喜用忌、合化和结构风险判定。
- 不修改支付金额、二维码、支付回调、订单轮询、积分、会员或已购权限判定。
- 不新增深度报告 AI 请求。
- 保留 `thisYearSection`、`marriageSection`、`wealthSection`、`studySection`、`fortuneSection` 的 ID 与解锁框架。
- 页面和 PDF 必须读取同一份已渲染报告。
- 不输出具体财富金额、必然婚期/离婚、确定学历、疾病诊断或灾祸硬断。
- `.data-store.json` 是运行数据，任何提交都不得包含它。

---

## File Structure

- Create: `js/deep-report.js` — 纯事实构建器、领域判定器和确定性模板数据，不操作 DOM。
- Create: `js/deep-report-anchor.js` — 购买年份解析与游客本地快照，独立于支付身份。
- Modify: `js/result.js` — 单次构建 `deepReportFacts`，渲染五个现有栏目并安全转义。
- Modify: `result.html` — 在 `result.js` 前加载两个新模块并 bump 静态版本。
- Modify: `profile.html` — 从 `paid_at` 向报告链接附带只读 `report_year`。
- Modify: `api/reports/access.js` — 只读返回命中报告的 `paid_at`；不改变权限结果。
- Modify: `lib/supabase.js` — 新增只读报告访问记录查询，保留现有布尔接口兼容。
- Create: `tests/deep-report-core.test.js` — 统一事实契约、冻结核心、稳定性。
- Create: `tests/deep-report-wealth.test.js` — 财星质量、承载、路径、财库和禁语。
- Create: `tests/deep-report-timing.test.js` — 大运逐年匹配、结构触发、健康边界。
- Create: `tests/deep-report-relationship.test.js` — 男女配偶星、夫妻宫互动、位置与外在气质。
- Create: `tests/deep-report-study.test.js` — 印食伤官杀、格局路径、神煞降级。
- Create: `tests/deep-report-anchor.test.js` — 登录/游客/历史报告年份快照。
- Create: `tests/deep-report-render.test.js` — 五栏目 DOM、转义、失败状态与 PDF 同源。
- Modify: `tests/profile-report-library.test.js` — 报告链接携带购买年份。
- Modify: `tests/report-api.test.js` — access 接口兼容 `paid_at`。
- Modify: `tests/payment-ui-contract.test.js` — 证明订单参数与支付身份不含 `report_year`。

---

### Task 1: 建立统一事实模块与冻结边界

**Files:**
- Create: `tests/deep-report-core.test.js`
- Create: `js/deep-report.js`
- Modify: `result.html:2661-2663,2815`

**Interfaces:**
- Consumes: `BaZiCalculator.getProfessionalReportFacts(bazi, gender)`、`StructuralAnalysis.evaluate(bazi, calculator)`、`BaZiChain.analyze(bazi)`。
- Produces: `window.DeepReport.buildFacts(bazi, gender, options)`、`window.DeepReport.SCHEMA_VERSION`。

- [ ] **Step 1: 写统一契约的失败测试**

```js
test('buildFacts consumes each authoritative source once and is deterministic', () => {
  const calls = { professional:0, structural:0, chain:0 };
  const deps = fakeDependencies(calls);
  const first = DeepReport.buildFacts(sampleChart(), 'male', { anchorYear:2026, deps });
  const second = DeepReport.buildFacts(sampleChart(), 'male', { anchorYear:2026, deps:fakeDependencies() });
  assert.equal(calls.professional, 1);
  assert.equal(calls.structural, 1);
  assert.equal(calls.chain, 1);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(Object.keys(first), [
    'schemaVersion','anchorYear','chartIdentity','core',
    'wealth','relationship','study','currentYear','fiveYear'
  ]);
});

test('deep report source does not contain independent strength or pattern scoring', () => {
  const source = fs.readFileSync(path.join(root, 'js/deep-report.js'), 'utf8');
  assert.doesNotMatch(source, /score\s*[+\-]=|function\s+calcDayMasterStrength|function\s+getPattern/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/deep-report-core.test.js`  
Expected: FAIL，原因是 `js/deep-report.js` 或 `DeepReport.buildFacts` 尚不存在。

- [ ] **Step 3: 实现最小 UMD 模块与核心快照**

```js
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeepReport = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  var SCHEMA_VERSION = '2.0.0';

  function buildFacts(bazi, gender, options) {
    options = options || {};
    var deps = options.deps || {
      calculator: window.BaZiCalculator,
      structural: window.StructuralAnalysis,
      chain: window.BaZiChain
    };
    if (!bazi || !deps.calculator) throw new Error('深度报告缺少有效命盘或计算器');
    var professional = deps.calculator.getProfessionalReportFacts(bazi, gender);
    var structural = deps.structural ? deps.structural.evaluate(bazi, deps.calculator) : { relationEvents:[], structuralRisks:[] };
    var chain = deps.chain ? deps.chain.analyze(bazi) : { adjustments:[], hints:[], ganChain:[], zhiChain:[] };
    var core = Object.freeze({
      strength: professional.strength,
      pattern: professional.pattern,
      yongJi: professional.yongJi,
      congGe: !!(professional.pattern && professional.pattern.congGe),
      actionChains: professional.actionChains || [],
      relationEvents: structural.relationEvents || [],
      structuralRisks: structural.structuralRisks || [],
      chain: chain
    });
    return {
      schemaVersion:SCHEMA_VERSION,
      anchorYear:Number(options.anchorYear),
      chartIdentity:[bazi.year,bazi.month,bazi.day,bazi.hour].map(function(p){ return p.gan+p.zhi; }).join(' '),
      core:core,
      wealth:null, relationship:null, study:null, currentYear:null, fiveYear:null
    };
  }

  return { SCHEMA_VERSION:SCHEMA_VERSION, buildFacts:buildFacts };
});
```

- [ ] **Step 4: 在 `result.html` 中按依赖顺序加载模块**

```html
<script src="js/bazi.js?v=20260813d"></script>
<script src="js/structural.js?v=1"></script>
<script src="js/bazi-chain.js?v=2"></script>
<script src="js/deep-report.js?v=1"></script>
<!-- 现有 mo-xing-he、图表和交互脚本保持原有顺序 -->
<script src="js/result.js?v=8"></script>
```

- [ ] **Step 5: 运行核心和现有冻结测试**

Run: `node --test tests/deep-report-core.test.js tests/bazi-yongji-report.test.js tests/p3-a-structural.test.js tests/bazi-chain-professional.test.js`  
Expected: 新测试 PASS；现有冻结测试无新增失败。

- [ ] **Step 6: 提交核心骨架**

```bash
git add js/deep-report.js result.html tests/deep-report-core.test.js
git commit -m "feat: add deep report fact contract"
```

---

### Task 2: 实现财富事实模型

**Files:**
- Modify: `js/deep-report.js`
- Create: `tests/deep-report-wealth.test.js`

**Interfaces:**
- Consumes: `core.strength`、`core.yongJi`、`core.pattern`、`core.actionChains`、`core.relationEvents`、`core.structuralRisks`、计算器十神/藏干/五行表。
- Produces: `DeepReport.buildWealthFacts(bazi, core, calculator)`，返回 `summaryLevel/resource/capacity/pathways/retention/storage/timing/evidence`。

- [ ] **Step 1: 写财运多维事实的失败测试**

```js
test('weak chart with strong Ji wealth reports pressure instead of prosperity', () => {
  const facts = buildWealthFixture({ strength:'偏弱', wealthRole:'忌神', visibleWealth:2 });
  assert.equal(facts.capacity.state, '承压');
  assert.match(facts.capacity.conclusion, /机会.*压力|承载/);
  assert.doesNotMatch(JSON.stringify(facts), /百万|千万|必发财/);
});

test('CongCai follows frozen CongGe instead of ordinary weak-chart rules', () => {
  const facts = buildWealthFixture({ strength:'极弱', congGe:true, patternName:'从财格', wealthRole:'用神' });
  assert.equal(facts.capacity.method, '从格顺势');
  assert.doesNotMatch(facts.capacity.conclusion, /身弱不担财/);
});

test('storage activation is conditional and names the hidden wealth evidence', () => {
  const facts = DeepReport.buildWealthFacts(storageChart, storageCore, calculator);
  assert.equal(facts.storage.present, true);
  assert.match(facts.storage.conclusion, /藏干.*引动|库气.*引动/);
  assert.doesNotMatch(facts.storage.conclusion, /冲开.*发财|必发/);
});
```

- [ ] **Step 2: 运行财运测试并确认失败**

Run: `node --test tests/deep-report-wealth.test.js`  
Expected: FAIL，原因是 `buildWealthFacts` 尚不存在。

- [ ] **Step 3: 实现财星枚举和承载规则**

```js
function buildWealthFacts(bazi, core, calculator) {
  var dayWx = calculator.WU_XING[bazi.day.gan];
  var cycle = ['木','火','土','金','水'];
  var wealthWx = cycle[(cycle.indexOf(dayWx) + 2) % 5];
  var occurrences = collectTenGodOccurrences(bazi, calculator, function(role) {
    return role === '正财' || role === '偏财';
  });
  var elementRole = classifyElementRole(wealthWx, core.yongJi);
  var isCongCai = !!(core.congGe && core.pattern && /从财/.test(core.pattern.name || ''));
  var weak = /弱/.test(core.strength.level || core.strength.label || '');
  var capacity = isCongCai
    ? evidence('顺势', '从财格成立，财星按从格顺势解释。', 'strong', ['从财格'], elementRole)
    : weak && elementRole === '忌神'
      ? evidence('承压', '财星力量明显，但日主承载条件有限，机会与资源压力可能同时增加。', 'strong', ['身弱','财为忌'], elementRole)
      : evidence(elementRole === '用神' || elementRole === '喜神' ? '可承接' : '平衡观察',
          '财星作用需结合日主承载、格局路径和结构风险判断。', 'medium', [], elementRole);
  return {
    wealthElement:wealthWx,
    occurrences:occurrences,
    resource:buildResourceQuality(occurrences, bazi, core, calculator),
    capacity:capacity,
    pathways:buildWealthPathways(core),
    retention:buildWealthRetention(core, wealthWx),
    storage:buildWealthStorage(bazi, core, wealthWx, calculator),
    timing:null,
    summaryLevel:deriveWealthSummaryLevel(capacity, occurrences, core),
    evidence:flattenEvidence([capacity])
  };
}
```

`collectTenGodOccurrences` 必须为天干、本气、中气、余气分别记录 `pillar/layer/gan/role/element`；`buildWealthPathways` 只接受实际 `actionChains` 和风险证据；`buildWealthStorage` 只有在库支真实藏财且存在相关引动时才提高可信度。

- [ ] **Step 4: 接入 `buildFacts` 并导出测试接口**

```js
facts.wealth = buildWealthFacts(bazi, core, deps.calculator);
```

模块导出：

```js
var dynamic = chain && activeDaYun
  ? chain.analyzeLiuNian(bazi, activeDaYun, yearPillar, core.yongJi)
  : null;
return {
  SCHEMA_VERSION:SCHEMA_VERSION,
  buildFacts:buildFacts,
  buildWealthFacts:buildWealthFacts
};
```

- [ ] **Step 5: 运行财运、链路和核心回归**

Run: `node --test tests/deep-report-core.test.js tests/deep-report-wealth.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js`  
Expected: PASS，无财富金额与“冲库必发”措辞。

- [ ] **Step 6: 提交财富事实模型**

```bash
git add js/deep-report.js tests/deep-report-wealth.test.js
git commit -m "feat: add evidence based wealth report facts"
```

---

### Task 3: 实现今年与五年岁运事实

**Files:**
- Modify: `js/deep-report.js`
- Create: `tests/deep-report-timing.test.js`

**Interfaces:**
- Consumes: `anchorYear`、`BaZiCalculator.calculateDaYun()`、`calculateLiuNian()`、`BaZiChain.analyzeLiuNian()`、核心事实与领域模型。
- Produces: `DeepReport.buildAnnualFacts()`、`DeepReport.buildFiveYearFacts()`。

- [ ] **Step 1: 写逐年大运与风险触发失败测试**

```js
test('each of five years resolves its own DaYun across a boundary', () => {
  const result = DeepReport.buildFiveYearFacts(chart, core, calculator, chain, 2026, 'male');
  assert.deepEqual(result.years.map(row => row.year), [2026,2027,2028,2029,2030]);
  assert.notEqual(result.years[1].daYun.gan + result.years[1].daYun.zhi,
                  result.years[2].daYun.gan + result.years[2].daYun.zhi);
  assert.equal(result.transitions[0].year, 2028);
});

test('a structural risk is emphasized only when the annual nodes trigger it', () => {
  const dormant = buildAnnualRiskFixture({ strengthensRisk:false });
  const active = buildAnnualRiskFixture({ strengthensRisk:true });
  assert.equal(dormant.triggeredRisks.length, 0);
  assert.equal(active.triggeredRisks.length, 1);
  assert.match(active.triggeredRisks[0].conclusion, /可能|需|条件/);
});

test('wellbeing copy contains no diagnosis or deterministic organ claim', () => {
  const text = JSON.stringify(buildAnnualRiskFixture({ strengthensRisk:true }).wellbeing);
  assert.doesNotMatch(text, /患病|疾病|心脏病|肾病|必然|大凶|死亡/);
});
```

- [ ] **Step 2: 运行岁运测试并确认失败**

Run: `node --test tests/deep-report-timing.test.js`  
Expected: FAIL，原因是岁运事实函数尚不存在。

- [ ] **Step 3: 实现逐年所属大运解析**

```js
function findDaYunForYear(list, year) {
  for (var i = 0; i < list.length; i++) {
    if (year >= Number(list[i].startYear) && year <= Number(list[i].endYear)) return list[i];
  }
  return null;
}

function buildFiveYearFacts(bazi, core, calculator, chain, anchorYear, gender) {
  if (!bazi.birthDate || !bazi.birthDate.year) {
    return buildUndatedFiveYearFacts(bazi, core, calculator, chain, anchorYear);
  }
  var daYun = calculator.calculateDaYun(
    bazi.month, bazi.year, gender,
    bazi.birthDate.year, bazi.birthDate.month, bazi.birthDate.day, bazi.birthDate.hour
  );
  var years = [];
  for (var year = anchorYear; year < anchorYear + 5; year++) {
    var activeDaYun = findDaYunForYear(daYun.list || [], year);
    years.push(buildAnnualFacts(bazi, core, calculator, chain, year, activeDaYun));
  }
  return { anchorYear:anchorYear, hasDaYun:true, years:years, transitions:findDaYunTransitions(years), trend:compareAnnualFacts(years) };
}
```

- [ ] **Step 4: 实现年度干支、领域触发与健康边界**

`buildAnnualFacts` 必须分别记录流年干、流年支、大运干支、喜用忌角色、十神、动态关系、实际触发风险和救应；事业/财运/感情/学业使用各自领域事实，不用一个十神故事覆盖全部。

```js
return {
  year:year,
  pillar:yearPillar,
  daYun:activeDaYun,
  stemRole:classifyElementRole(calculator.WU_XING[yearPillar.gan], core.yongJi),
  branchRole:classifyElementRole(calculator.DI_ZHI_WU_XING[yearPillar.zhi], core.yongJi),
  dynamic:dynamic,
  triggeredRisks:matchTriggeredRisks(core.structuralRisks, yearPillar, activeDaYun, core),
  reliefs:matchReliefs(core.structuralRisks, yearPillar, activeDaYun, core),
  career:buildAnnualCareerFacts(bazi, core, yearPillar, activeDaYun, dynamic, calculator),
  wealth:buildAnnualWealthFacts(bazi, core, yearPillar, activeDaYun, dynamic, calculator),
  relationship:buildAnnualRelationshipFacts(bazi, core, yearPillar, activeDaYun, dynamic, calculator),
  study:buildAnnualStudyFacts(bazi, core, yearPillar, activeDaYun, dynamic, calculator),
  wellbeing:buildWellbeingGuidance(core, yearPillar, activeDaYun)
};
```

- [ ] **Step 5: 实现四柱无出生时间的安全降级**

```js
function buildUndatedFiveYearFacts(bazi, core, calculator, chain, anchorYear) {
  var years = [];
  for (var year = anchorYear; year < anchorYear + 5; year++) {
    years.push(buildAnnualFacts(bazi, core, calculator, chain, year, null));
  }
  return {
    anchorYear:anchorYear,
    hasDaYun:false,
    limitation:'未确认出生时间，当前大运与起运年龄未纳入。',
    years:years,
    transitions:[],
    trend:compareAnnualFacts(years)
  };
}
```

- [ ] **Step 6: 接入 `buildFacts` 并运行回归**

Run: `node --test tests/deep-report-core.test.js tests/deep-report-wealth.test.js tests/deep-report-timing.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js`  
Expected: PASS；五年边界逐年切运；无健康硬断。

- [ ] **Step 7: 提交岁运事实模型**

```bash
git add js/deep-report.js tests/deep-report-timing.test.js
git commit -m "feat: add anchored annual report facts"
```

---

### Task 4: 实现婚姻与配偶事实模型

**Files:**
- Modify: `js/deep-report.js`
- Create: `tests/deep-report-relationship.test.js`

**Interfaces:**
- Consumes: 性别、日干日支全部藏干、喜用忌、关系事件、结构风险和岁运事实。
- Produces: `DeepReport.buildRelationshipFacts(bazi, gender, core, calculator)`。

- [ ] **Step 1: 写男女配偶星与夫妻宫互动失败测试**

```js
test('male uses wealth stars and female uses officer stars', () => {
  assert.deepEqual(buildRelationship(maleChart, 'male').spouseStar.roles, ['正财','偏财']);
  assert.deepEqual(buildRelationship(femaleChart, 'female').spouseStar.roles, ['正官','七杀']);
});

test('day branch generating day stem describes partner-side support without claiming love', () => {
  const result = buildRelationship(branchGeneratesStemChart, 'female');
  assert.equal(result.interaction.direction, '夫妻宫生身');
  assert.match(result.interaction.conclusion, /支持|照顾|资源/);
  assert.doesNotMatch(result.interaction.conclusion, /更爱|一定对你好/);
});

test('appearance confidence falls when spouse star and palace signals conflict', () => {
  const result = buildRelationship(conflictingAppearanceChart, 'male');
  assert.equal(result.appearance.confidence, 'limited');
  assert.match(result.appearance.conclusion, /特征不集中|复合倾向/);
  assert.doesNotMatch(JSON.stringify(result.appearance), /厘米|瓜子脸|皮肤一定/);
});
```

- [ ] **Step 2: 运行婚姻测试并确认失败**

Run: `node --test tests/deep-report-relationship.test.js`  
Expected: FAIL，原因是婚姻事实函数尚不存在。

- [ ] **Step 3: 实现夫妻宫和干支互动**

```js
function deriveDayPillarInteraction(dayGanWx, dayZhiWx) {
  if (generates(dayZhiWx, dayGanWx)) return { direction:'夫妻宫生身', actor:'partner', effect:'support' };
  if (generates(dayGanWx, dayZhiWx)) return { direction:'命主生夫妻宫', actor:'self', effect:'invest' };
  if (controls(dayGanWx, dayZhiWx)) return { direction:'命主克夫妻宫', actor:'self', effect:'lead' };
  if (controls(dayZhiWx, dayGanWx)) return { direction:'夫妻宫克身', actor:'partner', effect:'pressure' };
  return { direction:'干支同类', actor:'both', effect:'peer' };
}
```

夫妻宫事实必须包含 `zhi/element/hiddenStems/hiddenTenGods/elementRole/dayInvolvingEvents/risks`，并将喜忌加入解释，禁止由生克单点决定好坏。

- [ ] **Step 4: 实现配偶星质量、位置、年龄和远近倾向**

```js
var spouseRoles = gender === 'male' ? ['正财','偏财'] : ['正官','七杀'];
var spouseOccurrences = collectTenGodOccurrences(bazi, calculator, function(role) {
  return spouseRoles.indexOf(role) >= 0;
});
```

位置只贡献弱证据：年柱 `outside_or_early`、月柱 `work_or_local`、日柱 `close_circle`、时柱 `later_or_distant`。年龄只输出 `older_tendency/similar_tendency/younger_tendency/unclear`；若证据不足或冲突，必须返回 `unclear`。

- [ ] **Step 5: 实现外在气质的多证据可信度**

```js
function buildAppearanceFacts(palace, spouseStar, core) {
  var signals = collectAppearanceSignals(palace, spouseStar, core);
  var agreement = countDominantAgreement(signals);
  return {
    confidence:agreement >= 3 ? 'strong' : agreement === 2 ? 'medium' : 'limited',
    conclusion:agreement >= 2 ? describeDominantStyle(signals) : '夫妻宫与配偶星呈现复合信号，外在气质特征不集中。',
    evidence:signals
  };
}
```

- [ ] **Step 6: 接入 `buildFacts` 并运行测试**

Run: `node --test tests/deep-report-core.test.js tests/deep-report-relationship.test.js tests/p3-a-structural.test.js`  
Expected: PASS；男女性别口径、互动方向和可信度正确。

- [ ] **Step 7: 提交婚姻事实模型**

```bash
git add js/deep-report.js tests/deep-report-relationship.test.js
git commit -m "feat: add evidence based relationship report facts"
```

---

### Task 5: 实现学业与发展路径事实模型

**Files:**
- Modify: `js/deep-report.js`
- Create: `tests/deep-report-study.test.js`

**Interfaces:**
- Consumes: 印、食伤、官杀的透藏与喜忌，格局成破，关系事件、结构风险，文昌/学堂辅助信息。
- Produces: `DeepReport.buildStudyFacts(bazi, core, calculator)`。

- [ ] **Step 1: 写学习四维和神煞降级失败测试**

```js
test('strong Ji seals do not automatically produce excellent study claims', () => {
  const result = buildStudyFixture({ strength:'偏强', sealRole:'忌神', sealCount:4 });
  assert.notEqual(result.absorption.state, '天然优秀');
  assert.match(result.absorption.conclusion, /思虑|行动|转化|需要输出/);
});

test('WenChang alone cannot decide study level', () => {
  const without = buildStudyFixture({ wenChang:false });
  const withOnly = buildStudyFixture({ wenChang:true });
  assert.equal(withOnly.path.type, without.path.type);
  assert.equal(withOnly.auxiliary.length, 1);
});

test('GuanYin and ShangGuanPeiYin map to different paths', () => {
  assert.equal(buildStudyFixture({ chain:'官印相生' }).path.type, '考试型');
  assert.equal(buildStudyFixture({ chain:'伤官配印' }).path.type, '研究创作型');
});
```

- [ ] **Step 2: 运行学业测试并确认失败**

Run: `node --test tests/deep-report-study.test.js`  
Expected: FAIL，原因是 `buildStudyFacts` 尚不存在。

- [ ] **Step 3: 实现输入、输出、纪律、实践四维事实**

```js
function buildStudyFacts(bazi, core, calculator) {
  var tenGods = collectTenGodOccurrences(bazi, calculator, function(){ return true; });
  var seals = selectRoles(tenGods, ['正印','偏印']);
  var outputs = selectRoles(tenGods, ['食神','伤官']);
  var officers = selectRoles(tenGods, ['正官','七杀']);
  return {
    absorption:buildAbsorptionFacts(seals, core),
    expression:buildExpressionFacts(outputs, core),
    discipline:buildDisciplineFacts(officers, core),
    application:buildApplicationFacts(tenGods, core),
    path:deriveStudyPath(core, seals, outputs, officers),
    obstacles:selectStudyRisks(core.structuralRisks),
    auxiliary:buildStudyAuxiliary(bazi, calculator),
    timing:null
  };
}
```

`deriveStudyPath` 的优先证据顺序为：有效格局/生克链→喜用忌与承载→十神透藏→神煞辅助。输出类型限制为 `研究型/考试型/技术型/创作型/实践型/复合型`，不输出学校层次和录取保证。

- [ ] **Step 4: 接入 `buildFacts` 并运行测试**

Run: `node --test tests/deep-report-core.test.js tests/deep-report-study.test.js tests/bazi-yongji-report.test.js tests/p3-a-structural.test.js`  
Expected: PASS；文昌学堂不主判，喜忌与格局路径生效。

- [ ] **Step 5: 提交学业事实模型**

```bash
git add js/deep-report.js tests/deep-report-study.test.js
git commit -m "feat: add structured study report facts"
```

---

### Task 6: 固定购买年份且不污染支付身份

**Files:**
- Create: `js/deep-report-anchor.js`
- Create: `tests/deep-report-anchor.test.js`
- Modify: `profile.html:350-485`
- Modify: `lib/supabase.js:419-460`
- Modify: `api/reports/access.js`
- Modify: `tests/profile-report-library.test.js`
- Modify: `tests/report-api.test.js`
- Modify: `tests/payment-ui-contract.test.js`
- Modify: `result.html`

**Interfaces:**
- Consumes: URL `report_year`、报告 `paid_at`、游客本地快照、当前中国时区年份。
- Produces: `DeepReportAnchor.resolve(options)`、access 响应可选 `paid_at`。

- [ ] **Step 1: 写年份优先级和支付隔离失败测试**

```js
test('explicit paid report year wins and remains stable', () => {
  assert.equal(Anchor.resolve({ reportYear:2026, localYear:2027, now:new Date('2030-01-01T00:00:00+08:00') }), 2026);
});

test('new guest stores the first China year and reuses it', () => {
  const storage = memoryStorage();
  assert.equal(Anchor.resolve({ chartKey:'甲子乙丑丙寅丁卯', storage, now:new Date('2026-12-31T20:00:00+08:00') }), 2026);
  assert.equal(Anchor.resolve({ chartKey:'甲子乙丑丙寅丁卯', storage, now:new Date('2028-01-01T00:00:00+08:00') }), 2026);
});

test('report_year is excluded from payment report params and local report identity', () => {
  const source = fs.readFileSync(path.join(root, 'js/paywall.js'), 'utf8');
  assert.doesNotMatch(source, /report_year/);
  assert.match(resultSource, /delete\s+_params\.reportYear|reportYear.*DeepReportAnchor/);
});
```

- [ ] **Step 2: 运行年份与支付契约测试并确认失败**

Run: `node --test tests/deep-report-anchor.test.js tests/profile-report-library.test.js tests/report-api.test.js tests/payment-ui-contract.test.js`  
Expected: 新测试 FAIL；现有支付测试保持基准状态。

- [ ] **Step 3: 实现独立年份解析器**

```js
function chinaYear(now) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Shanghai', year:'numeric' }).format(now || new Date()));
}

function resolve(options) {
  options = options || {};
  var explicit = Number(options.reportYear);
  if (explicit >= 1900 && explicit <= 2200) return explicit;
  var key = options.chartKey ? 'deep_report_anchor_v1:' + options.chartKey : '';
  var stored = key && options.storage ? Number(options.storage.getItem(key)) : 0;
  if (stored >= 1900 && stored <= 2200) return stored;
  var year = chinaYear(options.now);
  if (key && options.storage) options.storage.setItem(key, String(year));
  return year;
}
```

- [ ] **Step 4: 从报告库 `paid_at` 构造只读年份参数**

```js
function paidReportHref(report) {
  var params = new URLSearchParams(report.report_params || {});
  var paidYear = Number(String(report.paid_at || '').slice(0, 4));
  if (paidYear) params.set('report_year', String(paidYear));
  return 'result.html?' + params.toString();
}
```

在 `result.js` 中先提取 `report_year` 为独立变量，再从传给 `initPaywall()` 的 `_params` 中删除；不得修改 `js/paywall.js` 的身份算法。

- [ ] **Step 5: 让 access 接口只读返回命中订单时间**

新增 `getPaidReportAccess(userId, reportType, reportKey)` 返回 `{ unlocked, paid_at }`，保留 `hasPaidReport()` 布尔包装供其他调用。`api/reports/access.js` 响应为 `{ unlocked, report_key, paid_at }`；未命中时 `paid_at:null`。

- [ ] **Step 6: 加载 anchor 模块并运行完整相关测试**

Run: `node --test tests/deep-report-anchor.test.js tests/profile-report-library.test.js tests/report-api.test.js tests/payment-ui-contract.test.js tests/payment-flow.test.js tests/report-order-store.test.js`  
Expected: PASS；订单请求、报告键和支付恢复行为不变。

- [ ] **Step 7: 提交年份快照**

```bash
git add js/deep-report-anchor.js result.html profile.html lib/supabase.js api/reports/access.js tests/deep-report-anchor.test.js tests/profile-report-library.test.js tests/report-api.test.js tests/payment-ui-contract.test.js
git commit -m "feat: freeze paid report anchor year"
```

---

### Task 7: 用统一事实渲染五个付费栏目

**Files:**
- Modify: `js/result.js:228-245,900-1260`
- Create: `tests/deep-report-render.test.js`

**Interfaces:**
- Consumes: `DeepReport.buildFacts()` 的完整输出。
- Produces: `renderPaidContent()` 只执行一次事实构建并填充五个现有内容容器。

- [ ] **Step 1: 写 DOM 同源与文案边界失败测试**

```js
test('five paid sections render from one deep report fact object', () => {
  const rendered = renderPaidFixture();
  assert.equal(rendered.buildFactsCalls, 1);
  ['thisYearContent','marriageContent','wealthContent','studyContent','fortuneContent']
    .forEach(id => assert.notEqual(rendered.nodes[id].innerHTML, ''));
});

test('paid report escapes all fact text before HTML insertion', () => {
  const rendered = renderPaidFixture({ injected:'<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(rendered.html, /<img/);
  assert.match(rendered.html, /&lt;img/);
});

test('rendered copy contains no prohibited deterministic claims', () => {
  assert.doesNotMatch(renderPaidFixture().html, /千万|百万级|必发财|必结婚|必离婚|克夫|克妻|患病|大凶|死亡/);
});
```

- [ ] **Step 2: 运行渲染测试并确认失败**

Run: `node --test tests/deep-report-render.test.js`  
Expected: FAIL，因为 `renderPaidContent` 仍调用五个旧分析函数。

- [ ] **Step 3: 添加统一安全渲染辅助函数**

```js
function reportEsc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderEvidenceRows(rows) {
  return (rows || []).map(function(row) {
    return '<li><strong>' + reportEsc(row.label || '依据') + '</strong>' + reportEsc(row.text || row.conclusion || '') + '</li>';
  }).join('');
}
```

- [ ] **Step 4: 单次构建事实并替换五个旧 renderer 的数据源**

```js
function renderPaidContent() {
  if (!_bazi || !window.DeepReport) return renderDeepReportError('专业报告暂时无法生成，请稍后重试。');
  try {
    var anchorYear = resolveDeepReportAnchor(_bazi, _params);
    var facts = window.DeepReport.buildFacts(_bazi, _params.gender, { anchorYear:anchorYear });
    renderDeepCurrentYear(facts.currentYear);
    renderDeepRelationship(facts.relationship);
    renderDeepWealth(facts.wealth);
    renderDeepStudy(facts.study);
    renderDeepFiveYear(facts.fiveYear);
  } catch (error) {
    console.error('[deep-report]', error);
    renderDeepReportError('专业报告暂时无法生成，请稍后重试。');
  }
}
```

栏目内部顺序统一为“概览→核心维度→证据→条件与限制→建议”。不显示旧“未来财富量级”、确定配偶外貌、学业等级或器官疾病文本。

- [ ] **Step 5: 禁止失败时回退旧结论**

失败时五个栏目显示明确错误卡片并保留重试入口；不得调用旧 `analyzeWealth/analyzePei/analyzeStudy/analyzeThisYear/analyzeFortune` 作为静默兜底。

- [ ] **Step 6: 运行渲染、页面和移动端测试**

Run: `node --test tests/deep-report-render.test.js tests/bazi-professional-report-render.test.js tests/mobile-report-pdf.test.js tests/report-pdf.test.js tests/homepage-visual-contract.test.js`  
Expected: 新渲染测试 PASS；现有页面/PDF测试无新增失败。

- [ ] **Step 7: 提交五栏目接入**

```bash
git add js/result.js tests/deep-report-render.test.js
git commit -m "feat: render paid sections from unified facts"
```

---

### Task 8: 完整回归、真实样本与支付隔离验收

**Files:**
- Modify: `docs/superpowers/specs/2026-08-15-bazi-deep-report-v2-design.md`（只记录经验证的实现偏差或最终状态）
- Create: `docs/verification/2026-08-15-bazi-deep-report-v2.md`

**Interfaces:**
- Consumes: Tasks 1–7 的完整实现。
- Produces: 可复查的测试报告、真实命盘差异表和提交边界证明。

- [ ] **Step 1: 建立真实样本矩阵**

至少覆盖：身强财喜、身弱财忌、从财格、财破印、财党杀、库支无财、库藏财被引动；男财星远近、女官杀远近、夫妻宫生身/被克/同类、配偶星缺失；官印相生、伤官配印、印多为忌、文昌单信号；五年跨大运和四柱无出生时间。

每盘对账字段：`strength/pattern/yongJi/relationEvents/structuralRisks` 与五个领域事实，不以模板文字相似度代替事实一致性。

- [ ] **Step 2: 运行全部新增专项测试**

Run: `node --test tests/deep-report-*.test.js`  
Expected: 全部 PASS。

- [ ] **Step 3: 运行核心与专业回归**

Run: `node --test tests/bazi-yongji-report.test.js tests/bazi-professional-report-render.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js tests/bazi-*.test.js`  
Expected: 与实施前基准相比无新增失败；冻结结论零漂移。

- [ ] **Step 4: 运行支付、报告库和 PDF 隔离回归**

Run: `node --test tests/payment-flow.test.js tests/payment-ui-contract.test.js tests/payment-security.test.js tests/report-api.test.js tests/report-order-store.test.js tests/profile-report-library.test.js tests/report-pdf.test.js tests/mobile-report-pdf.test.js`  
Expected: 与实施前基准相比无新增失败；支付创建、二维码、回调、积分和解锁行为不变。

- [ ] **Step 5: 证明支付关键文件未被修改**

Run: `git diff <implementation-base> -- api/create-order.js api/check-order.js api/callback.js js/paywall.js js/hepan-paywall.js`  
Expected: 空输出。`api/reports/access.js` 只允许出现只读 `paid_at` 扩展。

- [ ] **Step 6: 启动本地网站进行桌面和手机验收**

Run: `npm run dev`  
Expected: 结果页五个付费栏目在解锁后正常显示；桌面和手机无横向溢出；PDF内容与页面一致；重复刷新年份和结论保持一致。

- [ ] **Step 7: 扫描禁止性措辞和运行数据**

Run: `rg -n "千万|百万级|必发财|必结婚|必离婚|克夫|克妻|患病|大凶|死亡" js/deep-report.js js/result.js`  
Expected: 深度报告新增路径无命中，或仅命中测试用禁词断言。

Run: `git status --short`  
Expected: `.data-store.json` 仍为未跟踪且未暂存；仅有本计划范围文件。

- [ ] **Step 8: 写验证报告并提交整体收口**

验证报告必须记录测试命令、通过/既有失败数量、真实样本差异、四柱降级、年份快照、支付隔离和未解决限制。

```bash
git add docs/verification/2026-08-15-bazi-deep-report-v2.md docs/superpowers/specs/2026-08-15-bazi-deep-report-v2-design.md
git commit -m "test: verify bazi deep report v2"
```

完成后先向用户提供本地验收入口和变更摘要；未经用户明确要求，不推送远程仓库。
