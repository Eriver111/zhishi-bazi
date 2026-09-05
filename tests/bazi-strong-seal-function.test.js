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

function resultOf(calculator, values) {
  return calculator.getYongJi(calculator.buildFromPillars(pillars(values), 'male'));
}

test('身强印星化杀成格时，区分原局有功与继续增印', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['戊辰', '丙辰', '庚子', '戊寅']);

  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.patternStatus.name, '印星化杀格');
  assert.equal(result.patternStatus.status, '成格');
  assert.ok(result.jiShen.includes('土'), '身强扶抑层仍应慎增印星');
  assert.deepEqual(Array.from(result.functionalTaskElements), ['土']);
  assert.deepEqual(Array.from(result.functionalDualRoleElements), ['土']);
  assert.equal(result.functionalTasks[0].type, '印星化杀通关');
  assert.match(result.functionalTasks[0].conclusion, /原局有功|原局承担/);
  assert.match(result.functionalTasks[0].condition, /不宜继续增印/);
  assert.equal(result.elementReasons['土'].role, '忌神');
  assert.equal(result.elementReasons['土'].functionalRole, '功能用神');
  assert.equal(result.elementReasons['土'].functionalDualRole, true);
  assert.ok(result.evidence.some(row => row.category === '功能任务' && /化杀通关/.test(row.title)));
});

test('身强伤官配印成格时，印只承担制伤护格任务', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['辛丑', '辛卯', '壬申', '庚子']);

  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.patternStatus.name, '伤官配印格');
  assert.equal(result.patternStatus.status, '成格');
  assert.ok(result.jiShen.includes('金'));
  assert.equal(result.functionalTasks.length, 1);
  assert.equal(result.functionalTasks[0].element, '金');
  assert.equal(result.functionalTasks[0].type, '印星制伤护格');
  assert.match(result.functionalTasks[0].condition, /伤官压力仍重.*印有根且不过量/);
  assert.match(result.functionalTasks[0].conclusion, /任务完成后.*身强不宜再生/);
});

test('强土丑月保留火印调候，但不让火抢核心用神', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['甲子', '丁丑', '戊辰', '己未']);

  assert.equal(result.dayMasterLevel, '偏强');
  assert.deepEqual(Array.from(result.yongShen), ['木']);
  assert.ok(result.jiShen.includes('火'));
  assert.deepEqual(Array.from(result.tiaoHouYongShen), ['火']);
  assert.deepEqual(Array.from(result.dualRoleElements), ['火']);
  assert.match(result.tiaoHouReason, /火印承担暖局调候.*不宜增多/);
  assert.equal(result.functionalTasks.length, 0);
});

test('普通印比身强盘不因“身强不忌印”被泛化成功能用神', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['丁巳', '丙戌', '己亥', '己巳']);

  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.strongCause.type, '印比并旺');
  assert.deepEqual(Array.from(result.functionalTasks), []);
  assert.deepEqual(Array.from(result.functionalTaskElements), []);
  assert.ok(result.jiShen.includes('火'));
});

test('AI 上下文明确传递功能用神的任务、边界和非无条件增量语义', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars(['戊辰', '丙辰', '庚子', '戊寅']), 'male');
  const yongJi = calculator.getYongJi(chart);
  const context = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern,
    yongJi,
  });

  assert.match(context, /功能用神：印星承担化杀通关任务（土）/);
  assert.match(context, /原局有功|原局承担/);
  assert.match(context, /官杀转轻或印已过旺后，不宜继续增印/);
});
