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

function pillars(text) {
  const records = text.split(' ').map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

function entryOf(result, element) {
  return result.elementRoleLedger.entries.find(item => item.element === element);
}

test('用神已有本气根但未透时，优先透干显用而非继续笼统补根', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丙戌 癸巳 辛酉 甲午'), 'male');
  const result = calculator.getYongJi(chart);
  const earth = entryOf(result, '土');
  const carrier = earth.carrierGuidance;

  assert.equal(result.yongShen.join('、'), '土');
  assert.equal(earth.currentState, '藏支有根');
  assert.equal(carrier.rootAlreadyEstablished, true);
  assert.equal(carrier.stemPriority, true);
  assert.equal(carrier.priorityCarrier, '天干透出');
  assert.equal(carrier.additionalBranchRole, '条件辅助');
  assert.equal(carrier.branchAutoFavorable, false);
  assert.equal(carrier.requiresRoot, false);
  assert.match(carrier.summary, /已有年柱戌本气根，优先戊、己透干显用/);
  assert.match(carrier.branchCondition, /不按“补根”自动论吉/);
  assert.equal(earth.branchPreference, '优先戊、己透干显用');
  assert.match(earth.fortuneDirection, /以戊、己透干显用为先/);
  assert.match(earth.fortuneReason, /根气已经到位/);
  assert.match(earth.conditions.join('；'), /新增同类地支只作条件辅助/);
});

test('缺少本气根时仍优先落实地支根，不误改成透干优先', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 癸丑 乙丑 癸未'), 'female');
  const result = calculator.getYongJi(chart);
  const wood = entryOf(result, '木');

  assert.equal(wood.carrierGuidance.rootAlreadyEstablished, false);
  assert.equal(wood.carrierGuidance.stemPriority, false);
  assert.equal(wood.carrierGuidance.priorityCarrier, '地支本气根');
  assert.equal(wood.branchPreference, '首喜寅卯');
  assert.match(wood.carrierGuidance.summary, /首喜寅、卯本气根/);
});

test('已有透干的喜神不触发待透规则', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丙戌 癸巳 辛酉 甲午'), 'male');
  const result = calculator.getYongJi(chart);
  const metal = entryOf(result, '金');

  assert.ok(metal.visible.length > 0);
  assert.equal(metal.carrierGuidance.stemPriority, false);
  assert.notEqual(metal.carrierGuidance.priorityCarrier, '天干透出');
});

test('AI 上下文同步传递透干优先和地支条件辅助，避免模型再说四库都可直接补', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丙戌 癸巳 辛酉 甲午'), 'male');
  const yongJi = calculator.getYongJi(chart);
  const context = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern,
    yongJi,
  });

  assert.match(context, /土（优先戊、己透干显用）/);
  assert.match(context, /原局已有年柱戌本气根，优先戊、己透干显用/);
  assert.match(context, /不按“补根”自动论吉/);
});
