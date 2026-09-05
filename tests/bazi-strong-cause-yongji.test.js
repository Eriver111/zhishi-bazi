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

test('身强按比劫、印星及印比并旺分别取用，不机械并列财官食伤', () => {
  const calculator = loadCalculator();
  const cases = [
    {
      gz: ['己亥', '丙子', '壬申', '甲辰'],
      type: '比劫成势', yong: '土', supporting: '木', conditional: '火',
    },
    {
      gz: ['癸未', '己卯', '丁亥', '丙寅'],
      type: '印旺生身', yong: '金', conditional: '土',
    },
    {
      gz: ['丁巳', '丙戌', '己亥', '己巳'],
      type: '印比并旺', yong: '水', conditional: '金',
    },
  ];

  for (const item of cases) {
    const chart = calculator.buildFromPillars(pillars(item.gz), 'male');
    const result = calculator.getYongJi(chart);

    assert.ok(['偏强', '极强'].includes(result.dayMasterLevel), item.gz.join(' '));
    assert.equal(result.strongCause.type, item.type, item.gz.join(' '));
    assert.equal(result.strongCause.primaryElement, item.yong, item.gz.join(' '));
    assert.deepEqual(Array.from(result.yongShen), [item.yong], item.gz.join(' '));
    if (item.supporting) assert.ok(result.strongSupportingElements.includes(item.supporting), item.gz.join(' '));
    if (item.conditional) assert.ok(result.conditionalAuxiliaryElements.includes(item.conditional), item.gz.join(' '));
    assert.ok(result.evidence.some(row => row.category === '取用病因'), item.gz.join(' '));
    assert.equal(result.weaknessCause, undefined, item.gz.join(' '));
  }
});

test('得令多根与复合生扶保留多候选，由综合评分决定核心用神', () => {
  const calculator = loadCalculator();
  const cases = [
    { gz: ['甲申', '戊午', '戊申', '戊子'], type: '得令多根', yong: '木' },
    { gz: ['乙丑', '甲申', '丙午', '戊辰'], type: '复合生扶', yong: '土' },
  ];

  for (const item of cases) {
    const result = calculator.getYongJi(calculator.buildFromPillars(pillars(item.gz), 'male'));
    assert.equal(result.dayMasterLevel, '偏强', item.gz.join(' '));
    assert.equal(result.strongCause.type, item.type, item.gz.join(' '));
    assert.equal(result.strongCause.primaryElement, null, item.gz.join(' '));
    assert.deepEqual(Array.from(result.yongShen), [item.yong], item.gz.join(' '));
    assert.equal(result.strongSupportingElements.length, 2, item.gz.join(' '));
    assert.ok(!result.strongSupportingElements.includes(item.yong), item.gz.join(' '));
  }
});

test('亥月强金的调候硬边界会同步改写身强成因主结论', () => {
  const calculator = loadCalculator();
  const gz = ['己巳', '辛亥', '辛未', '己酉'];
  const result = calculator.getYongJi(calculator.buildFromPillars(pillars(gz), 'male'));

  assert.equal(result.dayMasterLevel, '偏强');
  assert.deepEqual(Array.from(result.yongShen), ['火']);
  assert.equal(result.strongCause.type, '印旺生身');
  assert.equal(result.strongCause.primaryElement, '火');
  assert.equal(result.strongCause.diseaseRemedyElement, '木');
  assert.ok(result.strongSupportingElements.includes('木'));
  assert.match(result.strongCause.selectionOverride, /亥月强金.*调候硬边界.*最终以火为核心用神/);
  assert.match(result.primaryReason, /核心用神为火/);
});

test('AI 上下文传递身强来源和对应的条件辅助，不重新套模板', () => {
  const calculator = loadCalculator();
  const gz = ['丁巳', '丙戌', '己亥', '己巳'];
  const chart = calculator.buildFromPillars(pillars(gz), 'male');
  const yongJi = calculator.getYongJi(chart);
  const api = require('../api/ai-chat.js')._test;
  const context = api.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern || calculator.getPattern(chart),
    yongJi,
  });

  assert.match(context, /身强来源：印比并旺型身强/);
  assert.match(context, /金食伤虽能泄秀生财.*须先有水财星.*不可脱离财星单用/);
});

test('中和与真从格不进入普通身强分型', () => {
  const calculator = loadCalculator();
  const neutral = calculator.getYongJi(calculator.buildFromPillars(
    pillars(['甲子', '甲子', '丙午', '甲子']), 'male'
  ));
  const following = calculator.getYongJi(calculator.buildFromPillars(
    pillars(['壬子', '癸亥', '戊子', '癸卯']), 'male'
  ));

  assert.equal(neutral.dayMasterLevel, '中和');
  assert.equal(neutral.strongCause, undefined);
  assert.equal(following.method, '从格顺势');
  assert.equal(following.strongCause, undefined);
});
