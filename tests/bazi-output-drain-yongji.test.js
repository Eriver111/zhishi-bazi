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

test('财多或官杀导致的身弱不误判为食伤泄身', () => {
  const calculator = loadCalculator();
  const cases = [
    ['己酉', '辛未', '癸巳', '丁巳'],
    ['庚申', '己丑', '癸卯', '丁巳'],
  ];

  for (const gz of cases) {
    const chart = calculator.buildFromPillars(pillars(gz), 'male');
    const result = calculator.getYongJi(chart);

    assert.equal(result.weaknessCause, undefined, gz.join(' '));
    assert.ok(result.xiShen.includes('金'), gz.join(' '));
    assert.ok(result.xiShen.includes('水'), gz.join(' '));
    assert.ok(!result.evidence.some(row => row.category === '取用病因'), gz.join(' '));
  }
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
