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
  const mediation = audit.scoreTrace.find(stage => stage.id === 'injury-seal-load');
  assert.equal(mediation.delta, 21);
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
