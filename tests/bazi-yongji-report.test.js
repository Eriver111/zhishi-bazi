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

test('所有八字入口加载同一版核心取用脚本', () => {
  for (const page of ['paipan.html', 'result.html', 'hepan-result.html', 'ziwei.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /js\/bazi\.js\?v=20260817n/, `${page} must load the hidden-seal-evidence-consistent core bundle`);
  }
});

test('只保留一个核心用神，且用神属于喜神、忌神不与喜用重叠', () => {
  const calculator = loadCalculator();
  const charts = [
    calculator.buildFromPillars(pillars(['丙辰', '辛酉', '甲寅', '戊辰']), 'male'),
    calculator.buildFromPillars(pillars(['丙戌', '甲午', '丁巳', '庚午']), 'male'),
    calculator.buildFromPillars(pillars(['甲子', '己丑', '戊寅', '甲子']), 'female'),
  ];

  charts.forEach(chart => {
    const result = calculator.getYongJi(chart);
    assert.equal(result.yongShen.length, 1);
    result.yongShen.forEach(wx => assert.ok(result.xiShen.includes(wx)));
    assert.equal(result.jiShen.filter(wx => result.xiShen.includes(wx)).length, 0);
    assert.equal(new Set(result.xiShen).size, result.xiShen.length);
    assert.equal(new Set(result.yongShen).size, result.yongShen.length);
    assert.equal(new Set(result.jiShen).size, result.jiShen.length);
  });
});

test('喜用忌说明判定方法、格局状态和每个五行的理由', () => {
  const calculator = loadCalculator();
  const charts = [
    calculator.buildFromPillars(pillars(['丙戌', '甲午', '丁巳', '庚午']), 'male'),
    calculator.buildFromPillars(pillars(['壬子', '癸丑', '己酉', '丙寅']), 'female'),
    calculator.buildFromPillars(pillars(['辛亥', '丙寅', '甲子', '癸亥']), 'male'),
  ];

  charts.forEach(chart => {
    const result = calculator.getYongJi(chart);
    assert.ok(['从格顺势', '扶抑为主·调候辅助', '扶抑为主', '格局救应', '格局条件待定'].includes(result.method));
    assert.ok(result.primaryReason.length >= 8);
    assert.ok(result.evidence.some(row => row.category === '旺衰'));
    assert.ok(result.evidence.some(row => row.category === '格局'));
    assert.ok(result.evidence.some(row => row.category === '根气/透干'));
    assert.ok(['成格', '破格', '条件待定'].includes(result.patternStatus.status));

    [...new Set([...result.xiShen, ...result.jiShen])].forEach(wx => {
      assert.ok(result.elementReasons[wx]);
      assert.ok(['用神', '喜神', '忌神'].includes(result.elementReasons[wx].role));
      assert.ok(result.elementReasons[wx].reasons.length > 0);
    });
  });

  const winterEarth = calculator.getYongJi(charts[1]);
  assert.equal(winterEarth.method, '扶抑为主·调候辅助');
  assert.ok(winterEarth.evidence.some(row => row.category === '调候'));
});

test('调候辅助不能覆盖最终核心用神的首要理由', () => {
  const calculator = loadCalculator();
  const cases = [
    ['木', ['己酉', '丁丑', '乙未', '庚辰']],
    ['木', ['庚戌', '癸未', '丙申', '甲午']],
    ['土', ['壬子', '癸丑', '辛亥', '甲午']],
  ];

  for (const [expectedYong, gz] of cases) {
    const result = calculator.getYongJi(calculator.buildFromPillars(pillars(gz), 'male'));
    assert.deepEqual(Array.from(result.yongShen), [expectedYong]);
    assert.match(result.primaryReason, new RegExp(`^核心用神为${expectedYong}`));
    assert.match(result.primaryReason, /调候辅助：/);
    const coreReason = `核心用神按结构评分取${expectedYong}`;
    assert.match(result.reasoning, new RegExp(coreReason));
    assert.ok(result.reasoning.indexOf(coreReason) < result.reasoning.indexOf('调候辅助：'));
  }
});

test('候选对比先展示核心结构分并把调候分明确标为参考', () => {
  const calculator = loadCalculator();
  const cases = [
    ['土', ['癸亥', '乙丑', '戊辰', '壬子']],
    ['金', ['庚午', '癸未', '戊寅', '辛酉']],
  ];

  for (const [expectedYong, gz] of cases) {
    const result = calculator.getYongJi(calculator.buildFromPillars(pillars(gz), 'male'));
    const comparison = result.evidence.find(row => row.category === '候选对比');

    assert.deepEqual(Array.from(result.yongShen), [expectedYong]);
    assert.match(result.reasoning, new RegExp(`核心用神按结构评分取${expectedYong}`));
    assert.doesNotMatch(result.reasoning, /候选五行评分后取/);
    assert.ok(comparison);
    assert.match(comparison.detail, /核心结构分/);
    assert.match(comparison.detail, /调候参考/);
    assert.doesNotMatch(comparison.detail, /综合分/);
  }
});

test('戊土丑月调候说明不误写成己土', () => {
  const calculator = loadCalculator();
  const result = calculator.getYongJi(calculator.buildFromPillars(
    pillars(['癸亥', '乙丑', '戊辰', '壬子']),
    'male'
  ));

  assert.match(result.primaryReason, /冬土生于丑月/);
  assert.doesNotMatch(result.primaryReason, /己土冬生/);
});

test('深度报告事实对同一命盘生成稳定的专业证据链', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙卯', '辛酉', '甲寅', '戊辰']),
    'male'
  );
  const first = calculator.getProfessionalReportFacts(chart);
  const second = calculator.getProfessionalReportFacts(chart);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.pattern.status, '破格');
  assert.ok(first.summary.length >= 20);
  assert.ok(first.strength.evidence.length > 0);
  assert.ok(first.actionChains.length >= 2 && first.actionChains.length <= 4);
  assert.equal(first.yongJi.jiShen.filter(wx => first.yongJi.xiShen.includes(wx)).length, 0);
});

test('流年明确说明触发的是用神、喜神还是忌神', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙卯', '辛酉', '甲寅', '戊辰']),
    'male'
  );
  const thisYear = calculator.analyzeThisYear(chart, 'male', {
    dayMasterLevel: '偏弱',
    yongShen: ['火'],
    xiShen: ['火', '木'],
    jiShen: ['水'],
    elementReasons: {
      火: { role: '用神', reasons: ['测试用神依据'] },
      木: { role: '喜神', reasons: ['测试喜神依据'] },
      水: { role: '忌神', reasons: ['测试忌神依据'] },
    },
  });

  assert.equal(thisYear.triggeredElement, '火');
  assert.equal(thisYear.triggeredRole, '用神');
  assert.match(thisYear.triggeredReason, /流年天干丙火/);
  assert.match(thisYear.triggeredReason, /用神/);
});

test('专业报告包含岁运与喜用忌的联动结论', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙卯', '辛酉', '甲寅', '戊辰']),
    'female'
  );
  const facts = calculator.getProfessionalReportFacts(chart, 'female');

  assert.ok(facts.fortuneInteraction);
  assert.match(facts.fortuneInteraction.yearPillar, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
  assert.ok(['用神', '喜神', '忌神', '中性'].includes(facts.fortuneInteraction.triggeredRole));
  assert.ok(facts.fortuneInteraction.triggeredReason.length >= 8);
});
