const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

function loadBrowserRuntime(runtimeConsole = console) {
  const context = { console: runtimeConsole, Date, Math, setTimeout, clearTimeout };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bazi.js'), 'utf8'), context, { filename: 'bazi.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bazi-chain.js'), 'utf8'), context, { filename: 'bazi-chain.js' });
  return context;
}

function chart(yg, yz, mg, mz, dg, dz, hg, hz) {
  return {
    year: { gan: yg, zhi: yz }, month: { gan: mg, zhi: mz },
    day: { gan: dg, zhi: dz }, hour: { gan: hg, zhi: hz },
  };
}

test('browser-loaded chain uses the public BaZiCalculator API and returns evidence', () => {
  const context = loadBrowserRuntime();
  const bazi = context.BaZiCalculator.calculate(1990, 5, 15, 5, 'male', 10);

  const result = context.BaZiChain.analyze(bazi);

  assert.ok(Array.isArray(result.hints));
  assert.ok(result.hints.length > 0);
  assert.ok(Array.isArray(result.ganChain));
  assert.ok(Array.isArray(result.zhiChain));
});

test('chain rejects an incomplete four-pillar chart with a clear error', () => {
  const context = loadBrowserRuntime();

  assert.throws(
    () => context.BaZiChain.analyze({ day: { gan: '甲', zhi: '子' } }),
    /complete year, month, day, and hour pillars/,
  );
});

test('DiTianSui rules use 寅卯辰 as spring months', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('庚', '子', '壬', '寅', '甲', '辰', '戊', '子'));
  const classic = result.hints.find(item => item.category === '滴天髓');

  assert.match(classic.text, /春不容金/);
  assert.doesNotMatch(classic.text, /冬月木寒凝/);
});

test('Sha-Yin evidence names the actual month branch and hidden seal stem', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('己', '辰', '戊', '酉', '乙', '子', '丙', '寅'));
  const evidence = result.hints.find(item => item.category === '杀印相生');

  assert.match(evidence.text, /月令酉/);
  assert.match(evidence.text, /日支子中藏癸水偏印/);
  assert.doesNotMatch(evidence.text, /申金|日支申/);
});

test('wealth-to-officer-to-seal chain names the actual stems, elements, and Ten Gods', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('庚', '申', '壬', '子', '丁', '卯', '己', '酉'));
  const evidence = result.hints.find(item => item.category === '财生杀印截');

  assert.ok(evidence);
  assert.match(evidence.text, /年干庚（金，正财）/);
  assert.match(evidence.text, /月干壬（水，正官）/);
  assert.match(evidence.text, /日支卯中藏乙木偏印/);
  assert.doesNotMatch(evidence.text, /日支藏壬水|庚土财/);
});

test('root evidence recognizes secondary hidden stems and uses the real day element', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('甲', '未', '戊', '辰', '丙', '子', '辛', '丑'));
  const rootEvidence = result.hints.find(item => item.category === '日主根气');

  assert.ok(rootEvidence);
  assert.match(rootEvidence.text, /年柱地支未藏丁火/);
  assert.equal(result.hints.some(item => item.category === '日主无根'), false);
  assert.doesNotMatch(result.hints.map(item => item.text).join('\n'), /日主丙木/);
});

test('chain evidence does not expose an unconsumed structural score', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('己', '辰', '戊', '酉', '乙', '子', '丙', '寅'));

  assert.equal(Object.hasOwn(result, 'bonuses'), false);
});

test('storage interaction derives Ten-God roles from the current day stem and uses cautious wording', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('乙', '丑', '己', '未', '甲', '子', '庚', '午'));
  const officerPath = result.hints.find(item => item.category === '官/杀印通关');
  const storage = result.hints.find(item => item.category === '库冲开库');

  assert.match(officerPath.text, /辛（金，正官）/);
  assert.doesNotMatch(officerPath.text, /辛（金，正财）/);
  assert.match(storage.text, /藏干受到引动/);
  assert.doesNotMatch(storage.text, /藏干被释放/);
});

test('an unrelated annual branch is not credited with completing an existing three-punishment set', () => {
  const context = loadBrowserRuntime();
  const base = chart('己', '丑', '乙', '未', '庚', '申', '丙', '子');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '戊', zhi: '戌' },
    { gan: '丁', zhi: '亥' },
    { xiShen: ['木'], yongShen: ['木'], jiShen: ['火', '土'] },
  );

  assert.equal(result.triggers.some(item => item.type === '三刑俱全'), false);
});

test('same annual branch alone is branch repetition rather than full-pillar FuYin', () => {
  const context = loadBrowserRuntime();
  const base = chart('甲', '子', '丙', '寅', '庚', '申', '戊', '辰');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '乙', zhi: '卯' },
    { gan: '壬', zhi: '申' },
    { xiShen: ['土'], yongShen: ['土'], jiShen: ['木', '火'] },
  );

  assert.equal(result.triggers.some(item => item.type === '伏吟'), false);
  assert.equal(result.triggers.some(item => item.type === '地支重复'), true);
});

test('a DaYun trine completed into a Ji element does not improve the verdict', () => {
  const context = loadBrowserRuntime();
  const base = chart('甲', '寅', '丙', '午', '庚', '子', '戊', '辰');
  const result = context.BaZiChain.analyzeFortune(
    base,
    [{ gan: '丙', zhi: '戌', displayAge: '21岁', startYear: 2020, endYear: 2029 }],
    { xiShen: ['金'], yongShen: ['水'], jiShen: ['火', '土'] },
  );

  assert.equal(result.periods[0].verdict, '忌运');
  const trine = result.periods[0].interactions.find(item => item.type === 'structure');
  assert.equal(trine.isGood, false);
  assert.match(trine.text, /三合火局.*忌神/);
});

test('annual stem and branch combinations are neutral triggers without transformation evidence', () => {
  const context = loadBrowserRuntime();
  const base = chart('甲', '子', '丙', '寅', '甲', '午', '戊', '辰');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '丙', zhi: '辰' },
    { gan: '己', zhi: '未' },
    { xiShen: ['水'], yongShen: ['木'], jiShen: ['土', '火'] },
  );

  const stemCombine = result.triggers.find(item => item.type === '流年合日主');
  const branchCombine = result.triggers.find(item => item.type === '流年合日支');
  assert.equal(stemCombine.isGood, null);
  assert.equal(branchCombine.isGood, null);
  assert.match(stemCombine.detail, /不直接定吉凶/);
  assert.match(branchCombine.detail, /不直接定吉凶/);
  assert.notEqual(result.verdict, 'opportunity');
});

test('storage evidence describes activation as conditional rather than guaranteed release', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('乙', '丑', '己', '未', '丁', '子', '庚', '午'));
  const narrative = result.hints.map(item => item.text).concat(
    result.adjustments.map(item => item.reason),
  ).join('\n');

  assert.doesNotMatch(narrative, /释放|冲旺|质变|忌中转用|贵气有代价|贵气有成本/);
  assert.match(narrative, /受到引动|可能|需看|候选证据/);
});

test('adverse annual interactions avoid deterministic disaster claims', () => {
  const context = loadBrowserRuntime();
  const base = chart('壬', '申', '丙', '寅', '甲', '子', '戊', '辰');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '乙', zhi: '丑' },
    { gan: '庚', zhi: '午' },
    { xiShen: ['水'], yongShen: ['木'], jiShen: ['金', '土'] },
  );
  const narrative = result.triggers.map(item => item.detail).concat(result.summary).join('\n');

  assert.doesNotMatch(narrative, /必有|必定|凶事加倍|大凶|凶兆|吉星高照/);
  assert.match(narrative, /可能|容易|需|宜/);
});

test('core analysis degrades safely but reports chain failures for diagnosis', () => {
  const warnings = [];
  const runtimeConsole = { ...console, warn: (...args) => warnings.push(args) };
  const context = loadBrowserRuntime(runtimeConsole);
  const base = context.BaZiCalculator.calculate(1990, 5, 15, 5, 'male', 10);
  context.BaZiChain = { analyze() { throw new Error('chain probe'); } };

  const result = context.BaZiCalculator.getYongJi(base);

  assert.ok(result && Array.isArray(result.yongShen));
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /BaZiChain/);
  assert.match(String(warnings[0][1]), /chain probe/);
});

test('all chain entry pages request the repaired script version', () => {
  for (const page of ['paipan.html', 'result.html', 'hepan-result.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /js\/bazi-chain\.js\?v=3/, page);
  }
});

test('a ZhengGuan month command is never mislabeled as QiSha or ShiShen-ZhiSha', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('丙', '子', '癸', '酉', '甲', '辰', '戊', '午'));
  const narrative = result.hints.map(item => `${item.category}|${item.text}`).join('\n');

  assert.match(narrative, /官印相生/);
  assert.match(narrative, /食伤制官/);
  assert.doesNotMatch(narrative, /月令七杀|食神制杀/);
});

test('the fact graph covers all pillar pairs, hidden stems, self-punishment, and six-break evidence', () => {
  const context = loadBrowserRuntime();
  const selfPunish = context.BaZiChain.analyze(chart('丙', '辰', '乙', '卯', '甲', '辰', '戊', '午'));
  const sixBreak = context.BaZiChain.analyze(chart('甲', '子', '丙', '寅', '戊', '酉', '庚', '辰'));

  assert.ok(selfPunish.factGraph.nodes.some(node => node.visibility === 'hidden'));
  assert.ok(selfPunish.factGraph.edges.some(edge => edge.type === '自刑'));
  assert.ok(sixBreak.factGraph.edges.some(edge => edge.type === '六破'));
  assert.ok(selfPunish.factGraph.edges.some(edge => edge.from === 'year.gan' && edge.to === 'hour.gan'));
});

test('chain mechanisms preserve multiple effects for one element instead of first-write-wins loss', () => {
  const context = loadBrowserRuntime();
  const result = context.BaZiChain.analyze(chart('庚', '申', '壬', '子', '丁', '卯', '甲', '午'));

  assert.ok(Array.isArray(result.mechanisms));
  assert.ok(result.adjustments.every(item => Array.isArray(item.reasons) && item.reasons.length >= 1));
});

test('annual TianKeDiChong recognizes either stem-control direction', () => {
  const context = loadBrowserRuntime();
  const base = chart('丙', '寅', '乙', '卯', '甲', '子', '戊', '辰');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '庚', zhi: '申' },
    { gan: '戊', zhi: '午' },
    { xiShen: ['木'], yongShen: ['水'], jiShen: ['金'] },
  );

  assert.equal(result.triggers.some(item => item.type === '天克地冲'), true);
});

test('annual verdict evaluates both stem and branch roles', () => {
  const context = loadBrowserRuntime();
  const base = chart('丙', '丑', '乙', '辰', '甲', '丑', '辛', '辰');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '己', zhi: '未' },
    { gan: '戊', zhi: '亥' },
    { xiShen: ['木'], yongShen: ['水'], jiShen: ['金'] },
  );

  assert.equal(result.branchRole, '用神');
  assert.equal(result.verdict, '偏吉');
});

test('DaYun stem combinations are recorded without crashing the full interaction pass', () => {
  const context = loadBrowserRuntime();
  const base = chart('己', '丑', '乙', '卯', '甲', '辰', '丙', '午');
  const result = context.BaZiChain.analyzeFortune(
    base,
    [{ gan: '己', zhi: '未', displayAge: '31岁', startYear: 2030, endYear: 2039 }],
    { xiShen: ['火'], yongShen: ['木'], jiShen: ['土'] },
  );

  const combine = result.periods[0].interactions.find(item => item.type === '天干五合');
  assert.ok(combine);
  assert.match(combine.text, /己合.*甲.*候选化土/);
});

test('a favorable annual branch clashing a Ji target can be judged as change-before-improvement', () => {
  const context = loadBrowserRuntime();
  const base = chart('庚', '辰', '丙', '寅', '甲', '午', '丁', '卯');
  const result = context.BaZiChain.analyzeLiuNian(
    base,
    { gan: '乙', zhi: '卯' },
    { gan: '壬', zhi: '子' },
    { xiShen: ['水'], yongShen: ['水'], jiShen: ['火'] },
  );

  const dayClash = result.triggers.find(item => item.type === '六冲' && item.target === 'day');
  assert.ok(dayClash);
  assert.equal(dayClash.isGood, true);
  assert.match(dayClash.detail, /先变后改善/);
});

test('XiangFa output is derived from mechanism evidence and yongji instead of free calculation', () => {
  const context = loadBrowserRuntime();
  const base = chart('庚', '申', '壬', '子', '丁', '卯', '甲', '午');
  const result = context.BaZiChain.interpret(base, {
    yongShen: ['木'], xiShen: ['木', '火'], jiShen: ['金', '水'],
  });

  assert.ok(result.imagery.length > 0);
  assert.ok(result.imagery.every(item => item.basis && item.conclusion && item.direction));
  assert.ok(result.imagery.some(item => /年柱|月柱|日柱|时柱/.test(item.basis)));
});
