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

test('用神属于喜神且忌神不与喜用重叠', () => {
  const calculator = loadCalculator();
  const charts = [
    calculator.buildFromPillars(pillars(['丙辰', '辛酉', '甲寅', '戊辰']), 'male'),
    calculator.buildFromPillars(pillars(['丙戌', '甲午', '丁巳', '庚午']), 'male'),
    calculator.buildFromPillars(pillars(['甲子', '己丑', '戊寅', '甲子']), 'female'),
  ];

  charts.forEach(chart => {
    const result = calculator.getYongJi(chart);
    assert.ok(result.yongShen.length >= 1 && result.yongShen.length <= 2);
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
    assert.ok(['从格顺势', '调候优先', '扶抑为主', '格局救应'].includes(result.method));
    assert.ok(result.primaryReason.length >= 8);
    assert.ok(result.evidence.some(row => row.category === '旺衰'));
    assert.ok(result.evidence.some(row => row.category === '格局'));
    assert.ok(result.evidence.some(row => row.category === '根气/透干'));
    assert.ok(['成格', '破格'].includes(result.patternStatus.status));

    [...new Set([...result.xiShen, ...result.jiShen])].forEach(wx => {
      assert.ok(result.elementReasons[wx]);
      assert.ok(['用神', '喜神', '忌神'].includes(result.elementReasons[wx].role));
      assert.ok(result.elementReasons[wx].reasons.length > 0);
    });
  });

  const winterEarth = calculator.getYongJi(charts[1]);
  assert.equal(winterEarth.method, '调候优先');
  assert.ok(winterEarth.evidence.some(row => row.category === '调候'));
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
