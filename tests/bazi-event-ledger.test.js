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
  const pillars = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return calculator.buildFromPillars({
    year: pillars[0], month: pillars[1], day: pillars[2], hour: pillars[3]
  }, 'male');
}

test('事件账本只观察不改写旺衰、格局和喜用忌', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['癸未', '壬戌', '戊寅', '丁巳']);
  const before = {
    strength: E.calcDayMasterStrength(chart),
    pattern: E.getPattern(chart),
    yongJi: E.getYongJi(chart)
  };
  const audit = E.auditDayMasterStrength(chart);
  const after = {
    strength: E.calcDayMasterStrength(chart),
    pattern: E.getPattern(chart),
    yongJi: E.getYongJi(chart)
  };

  assert.equal(audit.eventLedger.mode, 'observe-only');
  assert.equal(audit.eventLedger.internalOnly, true);
  assert.deepEqual(after.strength, before.strength);
  assert.equal(after.pattern.name, before.pattern.name);
  assert.equal(after.pattern.status, before.pattern.status);
  assert.deepEqual(after.yongJi.yongShen, before.yongJi.yongShen);
  assert.deepEqual(after.yongJi.xiShen, before.yongJi.xiShen);
  assert.deepEqual(after.yongJi.jiShen, before.yongJi.jiShen);
});

test('事件编号稳定且同一原局事实只登记一次', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['甲申', '甲戌', '辛未', '壬辰']);
  const first = E.auditDayMasterStrength(chart).eventLedger;
  const second = E.auditDayMasterStrength(chart).eventLedger;
  const firstIds = Array.from(first.events, event => event.id);
  const secondIds = Array.from(second.events, event => event.id);

  assert.deepEqual(secondIds, firstIds);
  assert.equal(new Set(firstIds).size, firstIds.length);
  assert.ok(firstIds.every(id => id.includes('甲申-甲戌-辛未-壬辰')));
});

test('账本统一登记干支、藏干、根气、透干有根度与合冲刑害事件', () => {
  const E = loadCalculator();
  const ledger = E.auditDayMasterStrength(chartOf(E, ['癸未', '壬戌', '戊寅', '丁巳'])).eventLedger;
  const types = new Set(Array.from(ledger.events, event => event.type));
  const relations = Array.from(ledger.events)
    .filter(event => event.type === 'branch-relation')
    .map(event => event.data.relation);

  ['visible-stem', 'branch', 'hidden-stem', 'root', 'stem-root-link', 'branch-relation']
    .forEach(type => assert.ok(types.has(type), `缺少 ${type} 事件`));
  assert.ok(relations.includes('相刑'));
  assert.ok(relations.includes('六害'));
  assert.ok(ledger.consumers.some(consumer => consumer.stageId === 'branch-interactions'));
  assert.ok(Array.isArray(ledger.audit.duplicateScoreConsumers));
  assert.ok(Array.isArray(ledger.audit.unconsumedEventIds));
});

test('复合刑害保留为两条事实，但当前评分只绑定到同一结算阶段', () => {
  const E = loadCalculator();
  const ledger = E.auditDayMasterStrength(chartOf(E, ['癸未', '壬戌', '戊寅', '丁巳'])).eventLedger;
  const dayHour = Array.from(ledger.events).filter(event =>
    event.type === 'branch-relation' && event.source === 'day' && event.target === 'hour'
  );
  const relationNames = dayHour.map(event => event.data.relation).sort();
  const interaction = Array.from(ledger.consumers).find(consumer => consumer.stageId === 'branch-interactions');

  assert.deepEqual(relationNames, ['六害', '相刑']);
  dayHour.forEach(event => assert.ok(interaction.eventIds.includes(event.id)));
  assert.equal(Array.from(ledger.consumers).filter(consumer =>
    consumer.mode === 'score' && consumer.stageId === 'branch-interactions'
  ).length, 1);
});

test('半合、半会和自刑均进入事实层，未参与现行计分的自刑保持未消费', () => {
  const E = loadCalculator();
  const half = E.auditDayMasterStrength(chartOf(E, ['甲寅', '丙午', '戊子', '癸卯'])).eventLedger;
  assert.ok(Array.from(half.events).some(event =>
    event.type === 'branch-group' && event.data.relation === '半合' && event.data.resultElement === '火'
  ));
  assert.ok(Array.from(half.events).some(event =>
    event.type === 'branch-group' && event.data.relation === '半会' && event.data.resultElement === '木'
  ));

  const selfPunish = E.auditDayMasterStrength(chartOf(E, ['甲辰', '丙辰', '戊子', '癸卯'])).eventLedger;
  const event = Array.from(selfPunish.events).find(item =>
    item.type === 'branch-relation' && item.data.relation === '自刑'
  );
  assert.ok(event);
  assert.ok(Array.from(selfPunish.audit.unconsumedEventIds).includes(event.id));
});

test('月令先给分后受冲折损记录为同一信用的状态追回', () => {
  const E = loadCalculator();
  const ledger = E.auditDayMasterStrength(chartOf(E, ['丙戌', '丁酉', '癸卯', '丁巳'])).eventLedger;
  const month = Array.from(ledger.events).find(event => event.type === 'branch' && event.source === 'month');
  const recovery = month.adjustments.find(adjustment => adjustment.type === 'credit-recovery');

  assert.equal(month.baseValue, 20);
  assert.equal(month.finalValue, 12);
  assert.equal(month.effectiveCoefficient, 0.6);
  assert.equal(month.state, 'adjusted');
  assert.equal(recovery.delta, -8);
  assert.equal(recovery.sourceStage, 'branch-interactions');
});
