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

test('食伤旺导致身弱时取印制食伤生身，不再机械补比劫', () => {
  const calculator = loadCalculator();
  const cases = [
    { gz: ['壬子', '丙午', '甲午', '丁巳'], seal: '水', peer: '木' },
    { gz: ['辛丑', '乙未', '丙寅', '戊戌'], seal: '木', peer: '火' },
    { gz: ['戊午', '癸亥', '辛卯', '甲午'], seal: '土', peer: '金' },
  ];

  for (const item of cases) {
    const chart = calculator.buildFromPillars(pillars(item.gz), 'male');
    const result = calculator.getYongJi(chart);

    assert.ok(['偏弱', '极弱'].includes(result.dayMasterLevel), item.gz.join(' '));
    assert.deepEqual(Array.from(result.yongShen), [item.seal], item.gz.join(' '));
    assert.ok(result.xiShen.includes(item.seal), item.gz.join(' '));
    assert.ok(!result.xiShen.includes(item.peer), item.gz.join(' '));
    assert.ok(result.jiShen.includes(item.peer), item.gz.join(' '));
    assert.deepEqual(Array.from(result.conditionalAuxiliaryElements), [item.peer], item.gz.join(' '));
    assert.match(result.conditionalAuxiliaryReason, /并非纯忌.*印星.*少量配合/, item.gz.join(' '));
    assert.equal(result.elementReasons[item.peer].conditionalRole, '条件辅助', item.gz.join(' '));
    assert.equal(result.weaknessCause.type, '食伤泄身', item.gz.join(' '));
    assert.ok(result.evidence.some(row => row.category === '取用病因'), item.gz.join(' '));
    assert.match(result.primaryReason, /印星制食伤并生身/, item.gz.join(' '));
    assert.match(result.primaryReason, /比劫并非纯忌.*印星制泄后少量搭配/, item.gz.join(' '));
  }
});

test('财官并重与官杀主导的身弱分别按病因取用', () => {
  const calculator = loadCalculator();
  const cases = [
    { gz: ['己酉', '辛未', '癸巳', '丁巳'], cause: '财官压身', primary: '水', remedy: '金', supporting: '金' },
    { gz: ['庚申', '己丑', '癸卯', '丁巳'], cause: '官杀克身', primary: '金', supporting: '水' },
  ];

  for (const item of cases) {
    const chart = calculator.buildFromPillars(pillars(item.gz), 'male');
    const result = calculator.getYongJi(chart);

    assert.ok(['偏弱', '极弱'].includes(result.dayMasterLevel), item.gz.join(' '));
    assert.equal(result.weaknessCause.type, item.cause, item.gz.join(' '));
    assert.equal(result.weaknessCause.primaryElement, item.primary, item.gz.join(' '));
    if (item.remedy) {
      assert.equal(result.weaknessCause.diseaseRemedyElement, item.remedy, item.gz.join(' '));
      assert.equal(result.weaknessCause.selectedElement, item.primary, item.gz.join(' '));
      assert.match(result.weaknessCause.selectionOverride, /综合结算后.*最终以.*为核心用神/, item.gz.join(' '));
    }
    if (item.conditional) {
      assert.ok(result.conditionalAuxiliaryElements.includes(item.conditional), item.gz.join(' '));
      assert.match(result.conditionalAuxiliaryReason, /不可单独用比劫/, item.gz.join(' '));
    }
    if (item.supporting) {
      assert.ok(result.weaknessSupportingElements.includes(item.supporting), item.gz.join(' '));
      assert.equal(result.elementReasons[item.supporting].supportingRole, '辅助喜神', item.gz.join(' '));
    }
    assert.ok(result.evidence.some(row => row.category === '取用病因'), item.gz.join(' '));
  }
});

test('财多耗身优先比劫分财，印星只作有条件辅助', () => {
  const calculator = loadCalculator();
  const gz = ['甲子', '甲子', '己亥', '丙戌'];
  const result = calculator.getYongJi(calculator.buildFromPillars(pillars(gz), 'male'));

  assert.equal(result.dayMasterLevel, '极弱');
  assert.equal(result.weaknessCause.type, '财多耗身');
  assert.equal(result.weaknessCause.primaryElement, '土');
  assert.deepEqual(Array.from(result.yongShen), ['土']);
  assert.deepEqual(Array.from(result.conditionalAuxiliaryElements), ['火']);
  assert.match(result.conditionalAuxiliaryReason, /印星可辅助生身.*不被旺财.*破坏/);
});

test('没有单一主导压力时区分失令少根与复合耗泄克', () => {
  const calculator = loadCalculator();
  const cases = [
    { gz: ['甲子', '庚午', '甲子', '己未'], cause: '根气不足' },
    { gz: ['甲子', '戊辰', '戊寅', '戊申'], cause: '复合耗泄克' },
  ];

  for (const item of cases) {
    const result = calculator.getYongJi(calculator.buildFromPillars(pillars(item.gz), 'male'));
    assert.equal(result.dayMasterLevel, '偏弱', item.gz.join(' '));
    assert.equal(result.weaknessCause.type, item.cause, item.gz.join(' '));
    assert.equal(result.weaknessCause.primaryElement, null, item.gz.join(' '));
    assert.ok(result.weaknessSupportingElements.length >= 1, item.gz.join(' '));
    assert.ok(!result.weaknessSupportingElements.includes(result.yongShen[0]), item.gz.join(' '));
  }
});

test('AI 上下文逐字传递各自的条件辅助理由，不再套食伤模板', () => {
  const calculator = loadCalculator();
  const gz = ['甲子', '甲子', '己亥', '丙戌'];
  const chart = calculator.buildFromPillars(pillars(gz), 'male');
  const yongJi = calculator.getYongJi(chart);
  const api = require('../api/ai-chat.js')._test;
  const context = api.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern || calculator.getPattern(chart),
    yongJi,
  });

  assert.match(context, /身弱病因：财多耗身型身弱/);
  assert.match(context, /火印星可辅助生身.*不被旺财直接破坏/);
  assert.doesNotMatch(context, /须先以印星制住食伤/);
});

test('中和盘即使内部差值略偏负，也不贴身弱病因标签', () => {
  const calculator = loadCalculator();
  const gz = ['甲子', '甲子', '丙午', '甲子'];
  const result = calculator.getYongJi(calculator.buildFromPillars(pillars(gz), 'male'));

  assert.equal(result.dayMasterLevel, '中和');
  assert.equal(result.weaknessCause, undefined);
  assert.ok(!result.evidence.some(row => row.category === '取用病因'));
});

test('真从格仍优先按从格顺势，不进入普通身弱扶抑规则', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['壬子', '癸亥', '戊子', '癸卯']),
    'male'
  );
  const result = calculator.getYongJi(chart);

  assert.equal(calculator.getCongGe(chart).isCong, true);
  assert.equal(result.method, '从格顺势');
  assert.equal(result.weaknessCause, undefined);
});
