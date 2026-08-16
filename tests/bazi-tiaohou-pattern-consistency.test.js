const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function pillars(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('丙火生未月时水作为调候喜神而不推翻木用神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['辛丑', '乙未', '丙寅', '戊戌']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const water = result.candidateScores.find(row => row.wx === '水');

  assert.equal(result.dayMasterScore, 38);
  assert.deepEqual(Array.from(result.yongShen), ['木']);
  assert.ok(result.xiShen.includes('水'), '未月丙火需要水润燥，水至少应列为调候喜神');
  assert.ok(!result.jiShen.includes('水'));
  assert.equal(result.elementClassification['水'], '喜神');
  assert.equal(water.role, '喜神');
});

test('偏强庚金生亥月时火接管核心调候用神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['丙寅', '己亥', '庚申', '庚辰']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const fire = result.candidateScores.find(row => row.wx === '火');

  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.dayMasterScore, 60);
  assert.deepEqual(Array.from(result.yongShen), ['火']);
  assert.ok(result.xiShen.includes('火'));
  assert.ok(!result.jiShen.includes('火'));
  assert.equal(result.elementClassification['火'], '用神');
  assert.equal(fire.role, '用神');
});

test('月令食神未透只降低层次而不自动判破格', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['丙寅', '己亥', '庚申', '庚辰']),
    'male'
  );
  const facts = calculator.getProfessionalReportFacts(chart, 'male');

  assert.equal(facts.pattern.name, '食神格');
  assert.equal(facts.pattern.status, '成格');
  assert.ok(!facts.pattern.breakReasons.includes('月令用神未透干'));
  assert.match(facts.pattern.desc, /月令食神当令但未透干/);
  assert.doesNotMatch(facts.pattern.desc, /月令透食/);
  assert.ok(facts.pattern.establishConditions.some(row =>
    row.condition === '月令格神透干' && row.met === false && row.category === 'QUALITY'
  ));
});

test('癸水未月既有极弱盘判断保持原判', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['己酉', '辛未', '癸巳', '丁巳']),
    'male'
  );
  const result = calculator.getYongJi(chart);
  const pattern = calculator.getPattern(chart);

  assert.equal(result.dayMasterLevel, '极弱');
  assert.equal(result.dayMasterScore, 14);
  assert.deepEqual(Array.from(result.yongShen), ['水']);
  assert.ok(result.xiShen.includes('金'));
  assert.ok(result.jiShen.includes('火'));
  assert.ok(result.jiShen.includes('土'));
  assert.equal(pattern.status, '破格');
});

test('同五行外透不能冒充月令格神本星透干', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['戊辰', '癸亥', '乙未', '戊寅']),
    'male'
  );
  const pattern = calculator.getPattern(chart);

  assert.equal(pattern.name, '正印格');
  assert.equal(pattern.matchMode, 'same-element');
  assert.match(pattern.desc, /月令印星当令但本星未透干/);
  assert.doesNotMatch(pattern.desc, /月令透印/);
  assert.ok(pattern.establishConditions.some(row =>
    row.condition === '月令格神透干' && row.met === false && row.category === 'QUALITY'
  ));
});

test('同五行月令不在临官帝旺位时不能冒充建禄格', () => {
  const calculator = loadCalculator();
  const charts = [
    ['戊辰', '乙丑', '己巳', '己巳'],
    ['甲子', '戊辰', '己丑', '戊辰'],
  ];

  charts.forEach(values => {
    const chart = calculator.buildFromPillars(pillars(values), 'male');
    const pattern = calculator.getPattern(chart);
    assert.equal(pattern.name, '杂格');
    assert.doesNotMatch(pattern.desc, /月令为日主禄位/);
    assert.match(pattern.desc, /月令比劫当权/);
    assert.match(pattern.desc, /不作建禄、羊刃论/);
  });
});
