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

function chartOf(calculator, values) {
  const p = values.map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return calculator.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}

test('普通旺衰输出不泄露内部审计，审计 API 单独返回真实分差', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['丙戌','丙申','己卯','庚午']);
  const normal = E.calcDayMasterStrength(chart);
  assert.equal(normal.audit, undefined);

  const audit = E.auditDayMasterStrength(chart);
  assert.equal(audit.internalOnly, true);
  assert.equal(audit.result.score, 54);
  assert.equal(audit.result.level, '中和');
  assert.equal(audit.status, 'ok');
  assert.deepEqual(Array.from(audit.warnings), []);
  assert.equal(50 + audit.scoreTrace.reduce((sum, stage) => sum + stage.delta, 0), audit.result.rawScore);
});

test('审计层能指出己土午禄和伤官配印的真实承载分', () => {
  const E = loadCalculator();
  const audit = E.auditDayMasterStrength(chartOf(E, ['丙戌','丙申','己卯','庚午']));
  const lu = audit.roots.find(root => root.branch === '午' && root.hiddenStem === '己');
  assert.ok(lu);
  assert.equal(lu.rootType, '禄根');
  assert.equal(lu.exactDayStem, true);
  assert.equal(lu.status, '完整根');
  const hiddenLu = audit.scoreTrace.find(stage => stage.id === 'hidden-earth-lu');
  assert.equal(hiddenLu.delta, 1);
  const mediation = audit.scoreTrace.find(stage => stage.id === 'injury-seal-load');
  assert.equal(mediation.delta, 20);
  assert.equal(audit.pattern.name, '伤官配印格');
  assert.equal(audit.pattern.status, '成格');
});

test('严格门槛不成立时，审计层明确显示承载修正为零', () => {
  const E = loadCalculator();
  const audit = E.auditDayMasterStrength(chartOf(E, ['丙戌','丙申','己卯','庚子']));
  const mediation = audit.scoreTrace.find(stage => stage.id === 'injury-seal-load');
  assert.equal(mediation.delta, 0);
  assert.ok(audit.result.score < 40);
});

test('戊巳己午外柱完整禄根在普通格局中也统一计入得地', () => {
  const E = loadCalculator();
  const audit = E.auditDayMasterStrength(chartOf(E, ['乙巳','壬辰','己亥','戊午']));
  const hiddenLu = audit.scoreTrace.find(stage => stage.id === 'hidden-earth-lu');
  assert.equal(hiddenLu.delta, 1);
  assert.equal(audit.warnings.some(item => item.code === 'HIDDEN_EARTH_LU_WITHOUT_SUPPORT'), false);
});

test('三会牵走的根不再被旧审计层误报为完整强根', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['辛亥','癸丑','己亥','丙子']);
  const strength = E.calcDayMasterStrength(chart);
  const pattern = E.getPattern(chart);
  const audit = E.auditDayMasterStrength(chart);

  assert.equal(strength.score, 29);
  assert.equal(strength.level, '极弱');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.includes('日主极弱，难以承载格局用神'));
  assert.equal(audit.status, 'ok');
  assert.equal(audit.warnings.some(item => item.code === 'EXTREME_WEAK_BOUNDARY_SUPPORT'), false);
  const root = audit.roots.find(item => item.branch === '丑' && item.hiddenStem === '己');
  assert.equal(root.effectiveCoefficient, 0.5);
  assert.equal(root.status, '受损根');
});

test('28到29分的极弱盘确有完整强根与生扶时仍进入临界复核', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['庚辰','乙卯','戊寅','己丑']);
  const audit = E.auditDayMasterStrength(chart);

  assert.equal(audit.result.score, 28);
  assert.equal(audit.result.level, '极弱');
  assert.equal(audit.status, 'review');
  assert.ok(audit.warnings.some(item => item.code === 'EXTREME_WEAK_BOUNDARY_SUPPORT'));
});

test('低分无强根的真极弱盘不触发临界误报，仍严格判为不能承载', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['庚辰','乙卯','壬寅','癸丑']);
  const strength = E.calcDayMasterStrength(chart);
  const pattern = E.getPattern(chart);
  const audit = E.auditDayMasterStrength(chart);

  assert.equal(strength.score, 25);
  assert.equal(strength.level, '极弱');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.includes('日主极弱，难以承载格局用神'));
  assert.equal(audit.warnings.some(item => item.code === 'EXTREME_WEAK_BOUNDARY_SUPPORT'), false);
});

test('得令双根透印盘不因浮财与寅巳刑害重复扣分误判中和', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['癸未','壬戌','戊寅','丁巳']);
  const strength = E.calcDayMasterStrength(chart, { audit:true });

  assert.equal(strength.score, 60);
  assert.equal(strength.level, '偏强');
  assert.equal(strength.audit.stages.find(stage => stage.id === 'day-seat-hidden-support').delta, 5);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'visible-stem-rooting').delta, 4);
  // 未戌刑 -1；寅巳同时见刑、害，但同一对只取最重 -2，不再累计为 -4。
  assert.equal(strength.audit.stages.find(stage => stage.id === 'branch-interactions').delta, -3);
});

test('没有透印有根承载时，不启用浮透折减与日支印杀通关补偿', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['癸未','壬戌','戊寅','甲子']);
  const strength = E.calcDayMasterStrength(chart, { audit:true });

  assert.equal(strength.audit.stages.find(stage => stage.id === 'day-seat-hidden-support').delta, 0);
  assert.equal(strength.audit.stages.find(stage => stage.id === 'visible-stem-rooting').delta, 0);
});
