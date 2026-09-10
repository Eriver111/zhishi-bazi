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

test('丁丑癸丑乙丑癸未：寒湿厚土下双印保留承载，偏弱而非极弱', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 癸丑 乙丑 癸未'), 'female');
  const state = calculator.getColdWetEarthWoodState(chart);
  const waterlogged = calculator.getWaterloggedWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const stage = strength.audit.stages.filter(item => item.id === 'cold-wet-earth-wood-support');
  const yongJi = calculator.getYongJi(chart);
  const ledger = Object.fromEntries(yongJi.elementRoleLedger.entries.map(item => [item.element, item]));

  assert.equal(state.applies, true);
  assert.equal(state.rootedDoubleSeal, true);
  assert.equal(state.residualWoodRoot, true);
  assert.equal(waterlogged.applies, false, '三丑厚土不能误判成水多木漂');
  assert.equal(strength.score, 30);
  assert.equal(strength.level, '偏弱');
  assert.equal(stage.length, 1, '双印承载只能按一个合并事件结算一次');
  assert.equal(stage[0].delta, 12);
  assert.equal(strength.audit.sumMatches, true);

  assert.deepEqual(Array.from(yongJi.yongShen), ['木']);
  assert.equal(yongJi.yongShenSource.branchPreference, '首喜寅卯');
  assert.equal(yongJi.tiaoHouYongShen.includes('火'), true);
  assert.equal(yongJi.elementClassification.木, '用神');
  assert.equal(yongJi.elementClassification.火, '条件喜神');
  assert.equal(yongJi.elementClassification.水, '条件喜神');
  assert.equal(yongJi.elementClassification.土, '忌神');
  assert.equal(yongJi.elementClassification.金, '忌神');
  assert.equal(yongJi.jiShen.includes('火'), false);
  assert.equal(yongJi.jiShen.includes('水'), false);

  assert.equal(ledger.木.branchPreference, '首喜寅卯');
  assert.match(ledger.木.conditions.join('；'), /甲乙透干须同时得寅卯根/);
  assert.equal(ledger.火.tiaoHouRole, '调候用神');
  assert.match(ledger.火.conditions.join('；'), /适量使用/);
  assert.equal(ledger.水.fortuneLevel, '条件有利');
  assert.match(ledger.水.conditions.join('；'), /不宜.*单独再增水/);
});

test('护栏：没有残余木根时，不以双印承载规则抬出极弱档', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 癸丑 乙丑 癸丑'), 'female');
  const state = calculator.getColdWetEarthWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });

  assert.equal(state.applies, false);
  assert.equal(state.residualWoodRoot, false);
  assert.equal(strength.audit.stages.find(item => item.id === 'cold-wet-earth-wood-support').delta, 0);
  assert.equal(strength.level, '极弱');
});

test('护栏：只有一处印透时，不冒充双印承载结构', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 己丑 乙丑 癸未'), 'female');
  const state = calculator.getColdWetEarthWoodState(chart);

  assert.equal(state.applies, false);
  assert.equal(state.rootedDoubleSeal, false);
});

test('护栏：原分已经脱离极弱档时，双印结构不再重复抬分', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('壬申 丁丑 乙亥 壬辰'), 'female');
  const state = calculator.getColdWetEarthWoodState(chart);
  const strength = calculator.calcDayMasterStrength(chart, { audit: true });
  const yongJi = calculator.getYongJi(chart);

  assert.equal(state.applies, true, '结构事实可以存在，但不等于必然需要旺衰补偿');
  assert.equal(strength.score, 51);
  assert.equal(strength.level, '中和');
  assert.equal(strength.coldWetEarthWoodSupport.applied, false);
  assert.equal(strength.audit.stages.find(item => item.id === 'cold-wet-earth-wood-support').delta, 0);
  assert.notEqual(yongJi.elementClassification.水, '条件喜神', '专项喜用边界不能污染未使用补偿的盘');
});

test('AI 上下文同步首喜寅卯、调候火和水的增量边界', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 癸丑 乙丑 癸未'), 'female');
  const yongJi = calculator.getYongJi(chart);
  const context = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength: calculator.calcDayMasterStrength(chart),
    pattern: yongJi.resolvedPattern,
    yongJi,
  });

  assert.match(context, /木（首喜寅卯）·比劫：用神/);
  assert.match(context, /火（宜巳、午落根）·食伤：喜神（调候用神）/);
  assert.match(context, /水（宜亥、子落根）·印星：喜神，条件有利/);
  assert.match(context, /不宜脱离木根与火暖而单独再增水/);
});

test('内部审计：寒湿厚土规则结算后旺衰、喜用和事件账本闭合', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(pillars('丁丑 癸丑 乙丑 癸未'), 'female');
  const audit = calculator.auditDayMasterStrength(chart);

  assert.equal(audit.result.score, audit.yongJi.score);
  assert.equal(audit.result.level, audit.yongJi.level);
  assert.equal(audit.eventLedger.audit.scoreClosureMatches, true);
  assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0);
  assert.equal(audit.warnings.some(item => item.severity === 'error'), false);
});
