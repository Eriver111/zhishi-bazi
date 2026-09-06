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

test('乙木旺水无本气根：印星信用统一回收，判水多木漂而非印旺身强', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬子 癸亥 乙亥 壬子'), 'male');
  const state = calculator.getWaterloggedWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const stage = strength.audit.stages.filter(item => item.id === 'waterlogged-wood');
  const yongJi = calculator.getYongJi(chart);
  const ledger = Object.fromEntries(yongJi.elementRoleLedger.entries.map(item => [item.element, item]));

  assert.equal(state.applies, true);
  assert.equal(state.severity, '重');
  assert.equal(state.intactWoodMainRoots.length, 0);
  assert.equal(strength.level, '偏弱');
  assert.equal(strength.score, 35);
  assert.equal(stage.length, 1, '水多木漂必须作为一个合并结构事件只结算一次');
  assert.equal(stage[0].delta, state.adjustment);
  assert.equal(strength.audit.sumMatches, true);
  assert.equal(yongJi.weaknessCause.type, '水多木漂');
  assert.deepEqual(Array.from(yongJi.yongShen), ['土']);
  assert.equal(yongJi.yongShenSource.primaryType, '病药用神');
  assert.equal(yongJi.tiaoHouYongShen.includes('火'), true);
  assert.equal(yongJi.elementClassification.水, '忌神');
  assert.equal(yongJi.elementClassification.木, '条件喜神');
  assert.match(ledger.水.risks.join('；'), /水多木漂/);
  assert.match(ledger.土.functions.join('；'), /筑堤制水/);
});

test('亥子丑会水且木根更虚：允许落入极弱，避免偏弱和极弱边界漂移', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬申 癸亥 乙丑 壬子'), 'male');
  const state = calculator.getWaterloggedWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart);
  const yongJi = calculator.getYongJi(chart);

  assert.equal(state.applies, true);
  assert.equal(state.waterGroup, '亥子丑三会水');
  assert.equal(strength.level, '极弱');
  assert.equal(strength.score, 24);
  assert.deepEqual(Array.from(yongJi.yongShen), ['土']);
  assert.equal(yongJi.elementClassification.水, '忌神');
});

test('护栏：甲木有完整寅根且火有根时，旺水仍按滋木，不触发水多木漂', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬子 癸亥 甲寅 丙寅'), 'male');
  const state = calculator.getWaterloggedWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const stage = strength.audit.stages.find(item => item.id === 'waterlogged-wood');

  assert.equal(state.applies, false);
  assert.deepEqual(Array.from(state.intactWoodMainRoots), ['day寅', 'hour寅']);
  assert.equal(stage.delta, 0);
  assert.equal(strength.level, '极强');
});

test('护栏：无寅卯根但火土均已形成有效制化时，不以水多木漂重复扣分', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬子 癸亥 乙未 丙戌'), 'male');
  const state = calculator.getWaterloggedWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });

  assert.equal(state.applies, false);
  assert.equal(state.effectiveFire, true);
  assert.equal(state.effectiveDryEarth, true);
  assert.equal(strength.audit.stages.find(item => item.id === 'waterlogged-wood').delta, 0);
});

test('内部审计：水多木漂结构结算后旺衰、喜用和事件账本仍然闭合', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬子 癸亥 乙亥 壬子'), 'male');
  const audit = calculator.auditDayMasterStrength(chart);

  assert.equal(audit.result.score, audit.yongJi.score);
  assert.equal(audit.result.level, audit.yongJi.level);
  assert.equal(audit.eventLedger.audit.scoreClosureMatches, true);
  assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0);
  assert.equal(audit.warnings.some(item => item.severity === 'error'), false);
});

test('有弱火种时优先用火暖局，并明确标注兼调候而不是机械扶身', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬辰 癸亥 甲午 壬子'), 'male');
  const state = calculator.getWaterloggedWoodState(chart);
  const yongJi = calculator.getYongJi(chart);

  assert.equal(state.applies, true);
  assert.equal(state.primaryRemedy, '火');
  assert.deepEqual(Array.from(yongJi.yongShen), ['火']);
  assert.equal(yongJi.yongShenSource.primaryType, '病药用神');
  assert.equal(yongJi.yongShenSource.secondaryTypes.includes('兼调候'), true);
  assert.equal(yongJi.elementClassification.水, '忌神');
  assert.equal(yongJi.elementClassification.木, '条件喜神');
});
