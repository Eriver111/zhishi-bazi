# 八字喜用忌与深度报告专业化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全站喜用忌收敛为用神、喜神、忌神三类，并让 JS 深度报告输出可追溯的旺衰、格局、取用、原局与岁运证据链。

**Architecture:** `js/bazi.js` 继续是唯一专业事实源，在兼容现有 `getYongJi()` 返回字段的同时增加结构化证据和报告事实汇总。`js/pro-analysis.js`、`js/result.js` 和 `api/ai-chat.js` 只消费该结果，不再自行分类或重算。PDF 仍复用页面已渲染的报告 DOM。

**Tech Stack:** Browser JavaScript, Node.js CommonJS API routes, Node built-in test runner, DOM string rendering.

## Global Constraints

- 用户可见层只显示“用神、喜神、忌神”。
- 用神是喜神的核心，允许在用神和喜神中重复。
- 忌神必须与喜神、用神互斥。
- 用神通常 1 个，最多 2 个。
- 不增加闲神、仇神等新分类。
- 不改写现有财富金额文案和健康确定性文案。
- 不改变页面主框架、支付、报告库、PDF 和海报交互。
- 本轮只作本地提交，不推送、不部署。

---

### Task 1: 收敛喜用忌的输出不变式

**Files:**
- Create: `tests/bazi-yongji-report.test.js`
- Modify: `js/bazi.js:3891-4095`

**Interfaces:**
- Consumes: `calcDayMasterStrength(bazi)`, `getCongGe(bazi)`, `getPattern(bazi)`.
- Produces: `getYongJi(bazi)`，保留 `xiShen/yongShen/jiShen/reasoning/dayMasterLevel/dayMasterScore/congGe`，并保证用神属于喜神、忌神不重叠。

- [ ] **Step 1: 编写失败测试，固定三类不变式**

```js
function pillars(values) {
  const [year, month, day, hour] = values.map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return { year, month, day, hour };
}

test('yongji keeps yong inside xi while ji stays mutually exclusive', () => {
  const { calculator } = loadCalculator();
  const charts = [
    calculator.buildFromPillars(pillars(['丙辰','辛酉','甲寅','戊辰']), 'male'),
    calculator.buildFromPillars(pillars(['丙戌','甲午','丁巳','庚午']), 'male'),
    calculator.buildFromPillars(pillars(['甲子','己丑','戊寅','甲子']), 'female')
  ];
  charts.forEach(chart => {
    const result = calculator.getYongJi(chart);
    assert.ok(result.yongShen.length >= 1 && result.yongShen.length <= 2);
    result.yongShen.forEach(wx => assert.ok(result.xiShen.includes(wx)));
    assert.deepEqual(result.jiShen.filter(wx => result.xiShen.includes(wx)), []);
    assert.equal(new Set(result.xiShen).size, result.xiShen.length);
    assert.equal(new Set(result.yongShen).size, result.yongShen.length);
    assert.equal(new Set(result.jiShen).size, result.jiShen.length);
  });
});
```

- [ ] **Step 2: 运行测试并确认因当前调候修正可造成列表不一致而失败**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: FAIL，失败点为用神未纳入喜神、忌神重叠、重复元素或用神超过 2 个之一。

- [ ] **Step 3: 增加统一的结果归一化**

```js
function normalizeYongJiLists(xiShen, yongShen, jiShen) {
  var valid = ['木','火','土','金','水'];
  var unique = function(list) {
    return Array.from(new Set((list || []).filter(function(wx) { return valid.indexOf(wx) >= 0; })));
  };
  var yong = unique(yongShen).slice(0, 2);
  var xi = unique(yong.concat(xiShen));
  var ji = unique(jiShen).filter(function(wx) { return xi.indexOf(wx) < 0; });
  return { xiShen: xi, yongShen: yong, jiShen: ji };
}
```

在从格早返回和普通返回前均调用该函数，不在渲染层修补数据。

- [ ] **Step 4: 运行目标测试**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: PASS.

- [ ] **Step 5: 提交三类不变式**

```powershell
git add js/bazi.js tests/bazi-yongji-report.test.js
git commit -m "fix: normalize bazi yongji categories"
```

### Task 2: 建立可追溯的取用依据

**Files:**
- Modify: `tests/bazi-yongji-report.test.js`
- Modify: `js/bazi.js:3891-4095`

**Interfaces:**
- Consumes: Task 1 的稳定三类列表，以及 `calcDayMasterStrength/getCongGe/getPattern/getCangGan/getGanHe/getBranchRelations`.
- Produces: `getYongJi(bazi)` 新字段 `method: string`, `primaryReason: string`, `evidence: Array<{category:string,title:string,detail:string}>`, `elementReasons: Record<string,{role:string,reasons:string[]}>`, `patternStatus: {name:string,status:string,breakReasons:string[]}`.

- [ ] **Step 1: 编写失败测试，验证证据结构与三种主判方法**

```js
test('yongji explains method, primary reason, pattern and every visible element', () => {
  const { calculator } = loadCalculator();
  const fixtures = [
    { pillars:pillars(['丙戌','甲午','丁巳','庚午']), method:/从格|扶抑/ },
    { pillars:pillars(['壬子','癸丑','己酉','丙寅']), method:/调候/ },
    { pillars:pillars(['辛亥','丙寅','甲子','癸亥']), method:/扶抑|格局/ }
  ];
  fixtures.forEach(item => {
    const result = calculator.getYongJi(calculator.buildFromPillars(item.pillars, 'male'));
    assert.match(result.method, item.method);
    assert.ok(result.primaryReason.length >= 8);
    assert.ok(result.evidence.some(row => row.category === '旺衰'));
    assert.equal(typeof result.patternStatus.status, 'string');
    [...result.xiShen, ...result.jiShen].forEach(wx => {
      assert.ok(result.elementReasons[wx]);
      assert.ok(result.elementReasons[wx].reasons.length > 0);
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认因证据字段尚未存在而失败**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: FAIL with `method`/`evidence`/`elementReasons` missing.

- [ ] **Step 3: 实现专业证据构建器**

```js
function buildYongJiEvidence(bazi, context) {
  var evidence = [{
    category: '旺衰',
    title: '日主' + context.dmLevel,
    detail: context.dmDetail
  }];
  if (context.tiaoHouNote) evidence.push({ category:'调候', title:'寒暖燥湿', detail:context.tiaoHouNote });
  evidence.push({
    category: '格局',
    title: context.pattern.name + '·' + context.pattern.status,
    detail: context.pattern.status === '破格'
      ? context.pattern.breakReasons.join('；')
      : context.pattern.source
  });
  return evidence;
}
```

用一个内部 `finalizeYongJiResult()` 同时负责 Task 1 归一化和证据组装。`method` 仅允许“从格顺势”“调候优先”“扶抑为主”“格局救应”四种稳定值；它是方法说明，不是新神类。

- [ ] **Step 4: 运行目标测试与现有专业核心测试**

Run: `node --test tests/bazi-yongji-report.test.js tests/bazi-professional-core.test.js`

Expected: PASS.

- [ ] **Step 5: 提交证据结构**

```powershell
git add js/bazi.js tests/bazi-yongji-report.test.js
git commit -m "feat: explain bazi yongji evidence"
```

### Task 3: 生成深度报告专业事实

**Files:**
- Modify: `tests/bazi-yongji-report.test.js`
- Modify: `js/bazi.js:4090-4435`

**Interfaces:**
- Consumes: Task 2 的 `getYongJi(bazi)`，以及 `getPattern/getPillarRelations/getBranchRelations/getGanHe/getSanHui`.
- Produces: `getProfessionalReportFacts(bazi)` 返回 `{summary,strength,yongJi,pattern,actionChains}`，并由 `window.BaZiCalculator.getProfessionalReportFacts` 导出。

- [ ] **Step 1: 编写失败测试，限制报告事实结构和作用链数量**

```js
test('professional report facts expose one deterministic evidence chain', () => {
  const { calculator } = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙卯','辛酉','甲寅','戊辰']), 'male'
  );
  const first = calculator.getProfessionalReportFacts(chart);
  const second = calculator.getProfessionalReportFacts(chart);
  assert.deepEqual(first, second);
  assert.equal(first.pattern.status, '破格');
  assert.ok(first.summary.length >= 20);
  assert.ok(first.strength.evidence.length > 0);
  assert.ok(first.actionChains.length >= 2 && first.actionChains.length <= 4);
  assert.deepEqual(first.yongJi.jiShen.filter(wx => first.yongJi.xiShen.includes(wx)), []);
});
```

- [ ] **Step 2: 运行测试并确认因报告事实 API 尚未存在而失败**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: FAIL with `getProfessionalReportFacts is not a function`.

- [ ] **Step 3: 实现报告事实汇总与作用链排序**

```js
function getProfessionalReportFacts(bazi) {
  var strength = calcDayMasterStrength(bazi);
  var pattern = getPattern(bazi);
  var yongJi = getYongJi(bazi);
  var chains = [];
  getGanHe(bazi).forEach(function(item) { chains.push({priority:3,title:item.status,detail:item.desc}); });
  getBranchRelations(bazi).forEach(function(item) { chains.push({priority:2,title:item.type,detail:item.desc}); });
  getPillarRelations(bazi).forEach(function(item) {
    (item.details || []).forEach(function(detail) { chains.push({priority:1,title:item.from + '→' + item.to,detail:detail}); });
  });
  chains.sort(function(a,b) { return b.priority - a.priority || a.title.localeCompare(b.title, 'zh-CN'); });
  return {
    summary: bazi.day.gan + '日主·' + strength.level + '·' + pattern.name + '·' + pattern.status,
    strength: { level:strength.level, score:strength.score, detail:strength.detail, evidence:yongJi.evidence },
    yongJi: yongJi,
    pattern: pattern,
    actionChains: chains.slice(0, 4)
  };
}
```

去重键使用 `title + '|' + detail`，若关系少于 2 条，用格局来源和取用核心依据补足，不生成随机文案。

- [ ] **Step 4: 运行目标测试**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: PASS.

- [ ] **Step 5: 提交报告事实 API**

```powershell
git add js/bazi.js tests/bazi-yongji-report.test.js
git commit -m "feat: build deterministic bazi report facts"
```

### Task 4: 将专业证据渲染到网页与 PDF

**Files:**
- Create: `tests/bazi-professional-report-render.test.js`
- Modify: `js/pro-analysis.js:20-42,144-224`
- Modify: `js/result.js:2059-2061`
- Verify only: `js/result.js:1402-1625`

**Interfaces:**
- Consumes: `BaZiCalculator.getProfessionalReportFacts(bazi)`.
- Produces: `proSection` 内的命局总纲、旺衰依据、喜用忌、格局成败、原局作用链；`buildReportHTML()` 仍按现有方式复制该 DOM。

- [ ] **Step 1: 编写失败的渲染契约测试**

```js
test('professional report renders five core evidence sections and only three yongji labels', () => {
  const pro = fs.readFileSync(path.join(ROOT, 'js/pro-analysis.js'), 'utf8');
  assert.match(pro, /命局总纲/);
  assert.match(pro, /旺衰依据/);
  assert.match(pro, /格局成败/);
  assert.match(pro, /原局作用链/);
  assert.match(pro, /用神/);
  assert.match(pro, /喜神/);
  assert.match(pro, /忌神/);
  assert.doesNotMatch(pro, /闲神|仇神/);
  assert.match(pro, /getProfessionalReportFacts/);
});
```

- [ ] **Step 2: 运行测试并确认因新区块与新 API 消费尚不存在而失败**

Run: `node --test tests/bazi-professional-report-render.test.js`

Expected: FAIL on missing section labels or `getProfessionalReportFacts`.

- [ ] **Step 3: 用一个报告事实对象渲染专业分析**

```js
var facts = BaZiCalculator.getProfessionalReportFacts(bazi);
renderSummary(facts.summary);
renderStrengthEvidence(facts.strength);
renderPatternFacts(facts.pattern);
renderYongJiFacts(facts.yongJi);
renderActionChains(facts.actionChains);
renderFortuneLink(facts.yongJi);
```

每个辅助渲染函数只读取参数，不调用另一套旺衰或喜用忌判定。用神、喜神、忌神保留现有标签视觉；证据用次级文字和短段落展示，不改页面宽度与抽屉结构。

- [ ] **Step 4: 验证 PDF 仍复制 `proSection` 且不存在独立重算**

Run: `node --test tests/bazi-professional-report-render.test.js tests/mobile-report-pdf.test.js tests/report-pdf.test.js`

Expected: PASS.

- [ ] **Step 5: 提交报告渲染**

```powershell
git add js/pro-analysis.js js/result.js tests/bazi-professional-report-render.test.js
git commit -m "feat: enrich deterministic bazi report"
```

### Task 5: 同步 AI 上下文与岁运联动说明

**Files:**
- Modify: `tests/bazi-yongji-report.test.js`
- Modify: `js/ai-chat-integration.js:520-660`
- Modify: `api/ai-chat.js:640-690`
- Modify: `js/bazi.js` 中 `analyzeFortune()` / `analyzeThisYear()` 的结构化描述组装点

**Interfaces:**
- Consumes: `getYongJi()` 的三类和证据字段，以及已有 `currentDaYun/currentLiuNian`.
- Produces: AI `chartData.yongJi` 的完整结构，以及岁运中 `triggeredRole` 和 `triggeredReason` 的确定性说明。

- [ ] **Step 1: 编写失败测试，要求 AI 可见成破与取用依据**

```js
test('AI context serializes yongji evidence without creating extra god categories', () => {
  const api = fs.readFileSync(path.join(ROOT, 'api/ai-chat.js'), 'utf8');
  assert.match(api, /yj\.method/);
  assert.match(api, /yj\.primaryReason/);
  assert.match(api, /yj\.elementReasons/);
  assert.doesNotMatch(api, /闲神|仇神/);
});

test('professional report adds the fortune interaction section', () => {
  const pro = fs.readFileSync(path.join(ROOT, 'js/pro-analysis.js'), 'utf8');
  assert.match(pro, /岁运联动/);
});

test('fortune output explains whether an element triggers yong, xi or ji', () => {
  const result = calculator.analyzeThisYear(chart, 'male', yongJi);
  assert.match(result.triggeredRole, /用神|喜神|忌神|中性/);
  assert.ok(result.triggeredReason.length >= 6);
});
```

- [ ] **Step 2: 运行测试并确认因新证据与岁运触发字段尚未消费而失败**

Run: `node --test tests/bazi-yongji-report.test.js`

Expected: FAIL on missing `yj.method` serialization or missing `triggeredRole`.

- [ ] **Step 3: 将结构化证据传入 AI 上下文**

```js
ctx += `  判定方法：${yj.method || '—'}\n`;
ctx += `  核心理由：${yj.primaryReason || yj.reasoning || '—'}\n`;
Object.keys(yj.elementReasons || {}).forEach(wx => {
  ctx += `  ${wx}：${yj.elementReasons[wx].role}，${yj.elementReasons[wx].reasons.join('；')}\n`;
});
```

提示词明确“用神可包含在喜神内，忌神不与两者重叠”，且不允许 AI 新增第四类。

- [ ] **Step 4: 为岁运结果增加触发角色和原因**

```js
function classifyFortuneElement(wx, yongJi) {
  if ((yongJi.yongShen || []).indexOf(wx) >= 0) return '用神';
  if ((yongJi.xiShen || []).indexOf(wx) >= 0) return '喜神';
  if ((yongJi.jiShen || []).indexOf(wx) >= 0) return '忌神';
  return '中性';
}
```

`analyzeFortune()` 和 `analyzeThisYear()` 使用该函数生成 `triggeredRole` 和 `triggeredReason`，不更改现有财富金额或健康文案。

- [ ] **Step 5: 运行 AI、岁运与专业核心测试**

Run: `node --test tests/bazi-yongji-report.test.js tests/bazi-professional-core.test.js tests/ai-flow-contract.test.js`

Expected: PASS.

- [ ] **Step 6: 提交 AI 与岁运联动**

```powershell
git add js/bazi.js js/ai-chat-integration.js api/ai-chat.js tests/bazi-yongji-report.test.js
git commit -m "feat: connect yongji evidence to fortune and AI"
```

### Task 6: 保护指定文案并执行全站验收

**Files:**
- Modify: `tests/bazi-yongji-report.test.js`
- Verify: all changed production files

**Interfaces:**
- Consumes: Tasks 1–5 的最终行为。
- Produces: 可回归的文案保护与全站验证证据。

- [ ] **Step 1: 为财富金额和健康确定性文案增加基线哈希保护**

```js
test('protected wealth and health copy remains byte-identical to the approved baseline', () => {
  const source = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8');
  const wealth = extractFunction(source, 'analyzeWealth');
  const health = chineseStringLiterals(source).filter(text =>
    /(健康|疾病|患病|五脏|六腑|肝胆|心血|脾胃|伤病|手术)/.test(text)
  ).join('\n');
  assert.equal(sha256(chineseStringLiterals(wealth).join('\n')), '8c4ee2553f663995c710294ca3261da26caab11a86ba93083c5fff82e6ec7f02');
  assert.equal(sha256(health), '2dd6a8d4f1a2adbb5a7a48f4e7d68d7a460f4e1f8c1bc3fe63256ac3b02e40b6');
});
```

`chineseStringLiterals()` 使用字符串字面量正则提取含中文的单引号、双引号和模板字符串；`extractFunction()` 按花括号深度提取完整函数。两个 SHA-256 值已由本轮受保护基线提交 `2ffbc49` 计算；测试只哈希用户可见字符串，不锁死函数中的数据读取代码。

- [ ] **Step 2: 运行新增专业测试**

Run: `node --test tests/bazi-yongji-report.test.js tests/bazi-professional-report-render.test.js`

Expected: PASS.

- [ ] **Step 3: 运行语法检查**

Run: `node --check js/bazi.js; node --check js/pro-analysis.js; node --check js/result.js; node --check js/ai-chat-integration.js; node --check api/ai-chat.js`

Expected: exit 0 for every file.

- [ ] **Step 4: 运行全站测试**

Run: `node --test tests/*.test.js`

Expected: 0 failures.

- [ ] **Step 5: 检查改动边界与空白错误**

Run: `git diff --check; git status --short; git diff --stat`

Expected: 无空白错误；只有计划内文件和早已存在的未跟踪 `.data-store.json` / `.superpowers/brainstorm/`。

- [ ] **Step 6: 提交验收保护**

```powershell
git add tests/bazi-yongji-report.test.js tests/bazi-professional-report-render.test.js
git commit -m "test: protect professional bazi report behavior"
```

- [ ] **Step 7: 停止在本地并汇报结果**

不执行 `git push`、不调用部署命令；汇报本地提交、测试数量、保留文案校验结果与尚存的专业简化边界。
