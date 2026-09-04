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

test('辛金戌月：壬水、辰湿土与完整申根共同恢复燥土印力', () => {
  const calculator = loadCalculator();
  const chart = pillars('甲申 甲戌 辛未 壬辰');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const yongJi = calculator.getYongJi(calculator.buildFromPillars(chart, 'male'));

  assert.equal(strength.score, 60);
  assert.equal(strength.level, '偏强');
  assert.equal(strength.audit.sumMatches, true);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'month-command').delta, 16);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'day-seat').delta, 6);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'dry-earth-buries-metal').delta, 0);
  assert.equal(yongJi.dayMasterLevel, '偏强');
  assert.deepEqual(Array.from(yongJi.yongShen), ['木']);
  assert.doesNotMatch(yongJi.reasoning, /燥土不生金|印星虚浮无效/);
});

test('护栏：只有完整申根、但原局无水和湿土，仍按未润燥土论弱', () => {
  const calculator = loadCalculator();
  const chart = pillars('甲申 甲戌 辛未 丙午');
  const strength = calculator.calcDayMasterStrength(chart);
  const yongJi = calculator.getYongJi(calculator.buildFromPillars(chart, 'male'));

  // 午未条件不足时只论合绊，不再把“合土生金”和“半会火克金”各算一遍。
  assert.equal(strength.score, 37);
  assert.equal(strength.level, '偏弱');
  assert.deepEqual(Array.from(yongJi.yongShen), ['水']);
  assert.match(yongJi.reasoning, /燥土不生金/);
});

test('护栏：只有壬水润燥、但申酉根缺失，不能凭印星反判身强', () => {
  const calculator = loadCalculator();
  const chart = pillars('甲寅 甲戌 辛未 壬午');
  const strength = calculator.calcDayMasterStrength(chart);

  assert.equal(strength.score, 29);
  assert.equal(strength.level, '极弱');
});

test('护栏：纯燥厚土无水无金根，保留土多金埋修正', () => {
  const calculator = loadCalculator();
  const chart = pillars('戊戌 己未 辛未 戊戌');
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });

  assert.equal(strength.score, 33);
  assert.equal(strength.level, '偏弱');
  assert.equal(strength.audit.stages.find(stage => stage.id === 'dry-earth-buries-metal').delta, -8);
});

test('辰湿土与完整申根也可润燥，但恢复幅度低于普通湿土月', () => {
  const calculator = loadCalculator();
  const strength = calculator.calcDayMasterStrength(pillars('甲申 甲戌 辛未 丙辰'));

  assert.equal(strength.score, 61);
  assert.equal(strength.level, '偏强');
});
