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

function pillars(text) {
  const records = text.split(' ').map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('癸水酉月唯一印根被卯冲且财旺时，从中和修正为偏弱', () => {
  const calculator = loadCalculator();
  const chart = pillars('丙戌 丁酉 癸卯 丁巳');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const yongJi = calculator.getYongJi(calculator.buildFromPillars(chart, 'male'));
  const interaction = strength.audit.stages.find(stage => stage.id === 'branch-interactions');

  assert.equal(strength.score, 37);
  assert.equal(strength.level, '偏弱');
  assert.equal(interaction.meta.monthDaySupportClash, true);
  assert.equal(interaction.meta.monthSupportCredit, 20);
  assert.equal(interaction.meta.independentSupports, 0);
  assert.equal(interaction.meta.monthSupportClashPenalty, 8);
  assert.deepEqual(Array.from(yongJi.yongShen), ['水']);
  assert.deepEqual(Array.from(yongJi.xiShen), ['水', '金']);
  assert.deepEqual(Array.from(yongJi.jiShen), ['木', '火', '土']);
});

test('月令受冲但另有透干和地支印比时，只折损两成月令信用', () => {
  const calculator = loadCalculator();
  const chart = pillars('丙午 辛酉 癸卯 壬子');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const interaction = strength.audit.stages.find(stage => stage.id === 'branch-interactions');

  assert.equal(strength.score, 65);
  assert.equal(strength.level, '偏强');
  assert.ok(interaction.meta.independentSupports >= 2);
  assert.equal(interaction.meta.monthSupportClashPenalty, 4);
});

test('不是月日六冲时不回收月令生扶信用', () => {
  const calculator = loadCalculator();
  const chart = pillars('甲申 甲戌 辛未 壬辰');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const interaction = strength.audit.stages.find(stage => stage.id === 'branch-interactions');

  assert.equal(strength.score, 60);
  assert.equal(strength.level, '偏强');
  assert.equal(interaction.meta.monthDaySupportClash, false);
  assert.equal(interaction.meta.monthSupportClashPenalty, 0);
});
