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

test('事件账本统一结算证据，且不产生额外评分副作用', () => {
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

  assert.equal(audit.eventLedger.mode, 'settled');
  assert.equal(audit.eventLedger.internalOnly, true);
  assert.deepEqual(after.strength, before.strength);
  assert.equal(after.pattern.name, before.pattern.name);
  assert.equal(after.pattern.status, before.pattern.status);
  assert.deepEqual(after.yongJi.yongShen, before.yongJi.yongShen);
  assert.deepEqual(after.yongJi.xiShen, before.yongJi.xiShen);
  assert.deepEqual(after.yongJi.jiShen, before.yongJi.jiShen);
  assert.equal(audit.eventLedger.audit.scoreClosureMatches, true);
  assert.equal(audit.eventLedger.audit.consumerDeltaTotal, audit.result.rawScore);
  assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0);
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

test('日支与同一支同时构成刑害时只结算一次受扰状态', () => {
  const E = loadCalculator();
  const chart = chartOf(E, ['辛亥', '庚寅', '己巳', '庚午']);
  const audit = E.auditDayMasterStrength(chart);
  const stage = Array.from(audit.scoreTrace).find(item => item.id === 'branch-interactions');
  const settlement = Array.from(stage.meta.settlements).find(item =>
    item.source === 'month' && item.target === 'day'
  );

  assert.equal(audit.result.score, 25);
  assert.deepEqual({ hai:settlement.raw.harm, xing:settlement.raw.punishment }, { hai:2, xing:2 });
  assert.equal(settlement.applied.soft, 2);
  assert.equal(settlement.primarySoftRelation, '相刑');
  assert.deepEqual(Array.from(settlement.suppressedSoftRelations), ['六害']);

  const relationEvents = Array.from(audit.eventLedger.events).filter(event =>
    event.type === 'branch-relation' && event.source === 'month' && event.target === 'day'
  );
  const punishment = relationEvents.find(event => event.data.relation === '相刑');
  const harm = relationEvents.find(event => event.data.relation === '六害');
  assert.equal(punishment.finalValue, -2);
  assert.equal(harm.finalValue, 0);
  assert.equal(harm.state, 'merged');
  assert.equal(harm.adjustments[0].type, 'duplicate-merge');
  assert.ok(Array.from(audit.eventLedger.audit.resolvedDuplicateSettlements).some(item => item.eventId === harm.id));
});

test('非日支刑害击中实际日主根时也只结算一次', () => {
  const E = loadCalculator();
  const audit = E.auditDayMasterStrength(chartOf(E, ['庚寅', '辛巳', '乙亥', '己卯']));
  assert.equal(audit.result.score, 40);
  assert.equal(audit.result.level, '中和');
  const stage = Array.from(audit.scoreTrace).find(item => item.id === 'branch-interactions');
  const settlement = Array.from(stage.meta.settlements).find(item =>
    item.source === 'year' && item.target === 'month'
  );
  assert.equal(settlement.raw.harm + settlement.raw.punishment, 2);
  assert.equal(settlement.applied.soft, 1);
  assert.deepEqual(Array.from(settlement.suppressedSoftRelations), ['六害']);
  const evidence = Array.from(audit.eventLedger.evidenceSettlement.relationSettlements)
    .find(item => item.id === 'branch-disturbance:year-month');
  assert.ok(evidence.affectedDayRootIds.length > 0);
  assert.deepEqual(Array.from(evidence.mergedRelations), ['六害']);
});

test('非日支刑害未击中日主根时不机械合并', () => {
  const E = loadCalculator();
  const audit = E.auditDayMasterStrength(chartOf(E, ['庚寅', '辛巳', '壬子', '辛酉']));
  const evidence = Array.from(audit.eventLedger.evidenceSettlement.relationSettlements)
    .find(item => item.id === 'branch-disturbance:year-month');
  assert.deepEqual(Array.from(evidence.affectedDayRootIds), []);
  assert.deepEqual(Array.from(evidence.mergedRelations), []);
});

test('重叠合会只有一个主结算组，同一根的折损不连乘', () => {
  const E = loadCalculator();
  const ledger = E.auditDayMasterStrength(chartOf(E, ['甲寅', '庚午', '丙戌', '癸亥'])).eventLedger;
  const groups = Array.from(ledger.evidenceSettlement.groupSettlements);
  const fullMeeting = groups.find(group => group.relation === '三合' && group.formedElement === '火');
  const combine = groups.find(group => group.relation === '六合' && group.positions.includes('year'));
  assert.equal(fullMeeting.state, 'active');
  assert.ok(fullMeeting.activePositions.includes('year'));
  assert.ok(combine.referencePositions.includes('year'));
  const yearRoots = Array.from(ledger.evidenceSettlement.roots).filter(root => root.position === 'year');
  yearRoots.forEach(root => {
    assert.equal(root.effectivePower, Number((root.basePower * root.effectiveCoefficient).toFixed(3)));
    assert.ok(root.effectiveCoefficient >= 0.5, '合会折损不得连乘');
  });
});

test('透干有根度只汇总统一根事件的结算后力量', () => {
  const E = loadCalculator();
  const settlement = E.buildEvidenceSettlement(chartOf(E, ['庚寅', '辛巳', '乙亥', '己卯']));
  Array.from(settlement.visibleStems).forEach(stem => {
    assert.equal(new Set(Array.from(stem.rootIds)).size, stem.rootIds.length);
    const rootPower = Array.from(settlement.roots)
      .filter(root => stem.rootIds.includes(root.id))
      .reduce((sum, root) => sum + root.effectivePower, 0);
    assert.equal(stem.effectivePower, Number((stem.basePower + rootPower).toFixed(3)));
  });
});
