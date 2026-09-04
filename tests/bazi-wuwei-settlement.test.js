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

function chart(calculator, values) {
  const pillars = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return calculator.buildFromPillars({ year:pillars[0], month:pillars[1], day:pillars[2], hour:pillars[3] }, 'male');
}

function interactionOf(calculator, bazi) {
  return calculator.calcDayMasterStrength(bazi, { audit:true }).audit.stages.find(stage => stage.id === 'branch-interactions');
}

test('未月午未只按趋土轻度结算，不再与半会火相互抵消', () => {
  const calculator = loadCalculator();
  const bazi = chart(calculator, ['甲申', '辛未', '丙辰', '甲午']);
  const strength = calculator.calcDayMasterStrength(bazi, { audit:true });
  const interaction = interactionOf(calculator, bazi);
  const audit = calculator.auditDayMasterStrength(bazi);

  assert.equal(strength.score, 35);
  assert.equal(strength.level, '偏弱');
  assert.equal(interaction.delta, -1);
  assert.equal(interaction.meta.wuWeiResolution.mode, 'earth-tendency');
  assert.equal(audit.eventLedger.events.some(event => event.type === 'branch-group' && event.data.relation === '半会' && event.data.resultElement === '火'), false);
  assert.equal(audit.eventLedger.evidenceSettlement.groupSettlements.filter(row => row.relation === '午未趋土' && row.state === 'active').length, 1);
  assert.equal(audit.eventLedger.audit.scoreClosureMatches, true);
  assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0);
});

test('午火得令时午未取火势，禁止再按合土计分', () => {
  const calculator = loadCalculator();
  const bazi = chart(calculator, ['甲寅', '丙午', '丙辰', '丁未']);
  const interaction = interactionOf(calculator, bazi);
  const ledger = calculator.auditDayMasterStrength(bazi).eventLedger;

  assert.equal(interaction.meta.wuWeiResolution.mode, 'fire-tendency');
  // 该阶段只保留半会火原有的一笔 +3，不再另叠“午未趋火”加分。
  assert.equal(interaction.delta, 3);
  assert.ok(ledger.events.some(event => event.type === 'branch-group' && event.data.relation === '半会' && event.data.resultElement === '火'));
  const wuWeiEvent = ledger.events.find(event => event.type === 'branch-relation' && event.data.relation === '六合' && event.data.branches.includes('午') && event.data.branches.includes('未'));
  assert.equal(wuWeiEvent.data.resolution.mode, 'fire-tendency');
});

test('火土条件均不足时午未只合绊，巳午未齐全时改由完整三会统一结算', () => {
  const calculator = loadCalculator();
  const binding = chart(calculator, ['庚午', '乙酉', '丁未', '壬辰']);
  const fullFire = chart(calculator, ['甲午', '丁巳', '丁未', '乙卯']);

  assert.equal(interactionOf(calculator, binding).meta.wuWeiResolution.mode, 'binding');
  assert.equal(interactionOf(calculator, fullFire).meta.wuWeiResolution.mode, 'full-fire');
  const fullLedger = calculator.auditDayMasterStrength(fullFire).eventLedger;
  assert.ok(fullLedger.events.some(event => event.type === 'branch-group' && event.data.relation === '三会' && event.data.resultElement === '火'));
});
