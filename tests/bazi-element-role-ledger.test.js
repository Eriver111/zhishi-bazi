const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
  return context.window.BaZiCalculator;
}

function pillars(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

function resultOf(calculator, values) {
  return calculator.getYongJi(calculator.buildFromPillars(pillars(values), 'male'));
}

function entryOf(result, element) {
  return result.elementRoleLedger.entries.find(item => item.element === element);
}

test('原局角色账本为五行分别记录现状、功过与行运基础方向', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['丙戌', '丙申', '己卯', '庚午']);
  const ledger = result.elementRoleLedger;

  assert.equal(ledger.version, 'element-role-ledger-v2');
  assert.equal(ledger.entries.length, 5);
  assert.match(ledger.principle, /先由原局确定用神、喜神、忌神/);
  assert.match(ledger.principle, /十神名称不能直接代替吉凶裁决/);
  assert.deepEqual(Array.from(ledger.entries, item => item.element), ['木', '火', '土', '金', '水']);

  for (const item of ledger.entries) {
    assert.ok(item.relation, item.element + ' 缺少十神关系');
    assert.ok(item.currentState, item.element + ' 缺少原局状态');
    assert.ok(item.natalRole, item.element + ' 缺少原局功过');
    assert.ok(item.functions.length, item.element + ' 缺少原局作用');
    assert.ok(item.fortuneRole, item.element + ' 缺少行运喜忌角色');
    assert.ok(item.fortuneLevel, item.element + ' 缺少行运有利程度');
    assert.ok(item.fortuneDirection, item.element + ' 缺少行运方向');
    assert.ok(item.fortuneReason, item.element + ' 缺少行运依据');
  }
});

test('伤官配印盘以原局定行运方向，再为具体干支保留复核条件', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['丙戌', '丙申', '己卯', '庚午']);
  const fire = entryOf(result, '火');
  const earth = entryOf(result, '土');
  const metal = entryOf(result, '金');
  const water = entryOf(result, '水');

  assert.equal(result.dayMasterScore, 54);
  assert.equal(result.dayMasterLevel, '中和');
  assert.equal(result.patternStatus.name, '伤官配印格');
  assert.equal(result.patternStatus.status, '成格');
  assert.equal(result.yongShenSource.element, '火');
  assert.equal(result.yongShenSource.primaryType, '格局用神');
  assert.match(result.yongShenSource.label, /格局用神/);

  assert.equal(fire.natalRole, '原局有功');
  assert.equal(fire.fortuneRole, '用神');
  assert.equal(fire.useGodType, result.yongShenSource.label);
  assert.equal(fire.fortuneLevel, '核心有利');
  assert.equal(fire.fortuneDirection, '逢火运总体偏顺');
  assert.match(fire.fortuneReason, /不等于行运遇见它就转凶/);
  assert.match(fire.functions.join('；'), /制伤护身/);

  assert.equal(metal.currentState, '当令透出');
  assert.equal(metal.fortuneRole, '喜神');
  assert.equal(metal.fortuneLevel, '条件有利');
  assert.match(metal.fortuneDirection, /须印星承载/);

  assert.equal(water.fortuneRole, '喜神');
  assert.equal(water.fortuneLevel, '条件有利');
  assert.match(water.risks.join('；'), /财破印/);
  assert.match(water.fortuneReason, /没有形成财破印/);

  assert.equal(earth.natalRole, '功过并见');
  assert.equal(earth.fortuneRole, '忌神');
  assert.equal(earth.fortuneLevel, '总体不利');
});

test('新增角色账本不改写现有喜用忌兼容字段', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['丙戌', '丙申', '己卯', '庚午']);

  assert.equal(result.yongShen.join('、'), '火');
  assert.equal(result.xiShen.join('、'), '火、水、金、木');
  assert.equal(result.jiShen.join('、'), '土');
});

test('原局未出现的五行只记录为岁运候选，不伪装成既有作用', () => {
  const calculator = loadCalculator();
  const result = resultOf(calculator, ['甲子', '甲子', '癸卯', '甲子']);
  const fire = entryOf(result, '火');

  assert.equal(fire.present, false);
  assert.equal(fire.currentState, '原局未现');
  assert.equal(fire.natalRole, '原局未现');
  assert.deepEqual(Array.from(fire.functions), ['原局未见此五行，尚未形成直接作用']);
  assert.ok(fire.fortuneDirection, '仍须保留岁运进入后的方向判断');
});

test('AI 上下文明确先定行运方向再由具体干支复核', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars(['丙戌', '丙申', '己卯', '庚午']), 'male');
  const yongJi = calculator.getYongJi(chart);
  const context = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern,
    yongJi,
  });

  assert.match(context, /原局五行角色账本（先定行运方向，再由具体干支复核）/);
  assert.match(context, /用神来源：火·格局用神/);
  assert.match(context, /火·印星：用神（格局用神），核心有利，逢火运总体偏顺/);
  assert.match(context, /原局原局有力，原局有功/);
  assert.match(context, /水·财星：喜神，条件有利，逢水运有财机，但须防财破印/);
});
