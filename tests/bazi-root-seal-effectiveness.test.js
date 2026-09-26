const test = require('node:test');
const assert = require('node:assert/strict');
const { calculator: E } = require('../api/_bazi-runtime');
const positions = ['year', 'month', 'day', 'hour'];

// Four-pillar mechanism controls, not independently verified biographies or
// authoritative strength labels. Calendar-valid sampling is covered separately.
function chart(text, gender = 'female') {
  return E.buildFromPillars(Object.fromEntries(text.split(' ').map((p, i) =>
    [positions[i], { gan: p[0], zhi: p[1] }])), gender);
}
function inspect(text, gender) {
  const bazi = chart(text, gender);
  const strength = E.calcDayMasterStrength(bazi, { audit: true });
  const stage = id => strength.audit.stages.find(s => s.id === id);
  return { bazi, strength, stage, seal: stage('sha-seal-mediation').meta,
    settlement: E.buildEvidenceSettlement(bazi) };
}

test('酉月甲木：保留双寅根与子印，藏印不领取透印最高档，也不被双根补偿补回', () => {
  const r = inspect('庚寅 乙酉 甲子 丙寅');
  assert.equal(r.strength.score, 46);
  assert.equal(r.strength.level, '中和');
  assert.match(r.strength.detail, /克泄耗略占上风/);
  assert.doesNotMatch(r.strength.detail, /五行相对均衡|不偏不倚/);
  assert.equal(r.seal.adjustment, 6);
  assert.equal(r.seal.selectedPath.type, 'day-hidden');
  const roots = r.settlement.roots.filter(x => x.gan === '甲');
  assert.equal(roots.length, 2);
  assert.ok(roots.every(x => x.effectivePower === x.basePower), '不能把克泄直接变成拔根或重复扣根分');
  const gate = r.stage('root-cluster-gate');
  assert.deepEqual(Array.from(gate.meta.constrainedRoots, x => x.pos), ['year']);
  assert.equal(r.stage('root-cluster-final').delta, 0);
  assert.equal(r.stage('visible-stems').delta, -1, '原有庚克、乙帮、丙泄只结算一次');
  assert.equal(r.stage('branch-main-qi').delta, 6, '基本通根和藏印信用仍保留');
  const yongJi = E.getYongJi(r.bazi);
  assert.equal(yongJi.dayMasterScore, 46);
  assert.equal(yongJi.dayMasterLevel, r.strength.level);
  assert.equal(E.getProfessionalReportFacts(r.bazi, 'female').strength.detail, r.strength.detail);
});

for (const text of [
  '甲寅 乙酉 甲子 丙寅',
  '丁巳 庚子 丙寅 戊午',
  '戊辰 甲寅 戊午 庚申',
  '庚申 丙午 庚辰 壬申',
  '壬子 己未 壬申 甲寅',
]) {
  test(`${text}：五行轮转下，本气藏印都不能等同透印`, () => {
    const r = inspect(text);
    assert.ok(r.seal.eligible);
    assert.ok(r.seal.paths.length > 0);
    assert.ok(r.seal.paths.every(x => x.type === 'day-hidden'));
    assert.ok(r.seal.adjustment > 0 && r.seal.adjustment <= 6);
    assert.equal(r.strength.audit.sumMatches, true);
  });
}

test('同一日坐印从未透到贴身透出，通关信用增加且不重复叠加两条路径', () => {
  const hidden = inspect('庚寅 乙酉 甲子 丙寅');
  const exposed = inspect('庚寅 癸酉 甲子 丙寅');
  assert.equal(hidden.seal.adjustment, 6);
  assert.equal(exposed.seal.adjustment, 13);
  assert.equal(exposed.seal.paths.length, 2);
  assert.equal(exposed.seal.selectedPath.type, 'adjacent-visible');
  assert.ok(exposed.strength.score > hidden.strength.score);
});

test('杂藏印低于完整本气印；原局无印时没有凭空通关', () => {
  const residual = inspect('庚寅 乙酉 甲辰 丙寅');
  assert.equal(residual.seal.adjustment, 3);
  assert.equal(residual.seal.selectedPath.depth, '余气');
  assert.equal(inspect('庚寅 乙酉 甲午 丙寅').seal.adjustment, 0);
});

test('子印受午冲降为有限承接，透印只有同一受损根时不恢复最高档', () => {
  const hidden = inspect('庚午 乙酉 甲子 丙寅');
  assert.equal(hidden.seal.adjustment, 3);
  const visible = inspect('庚午 癸酉 甲子 丙寅');
  assert.equal(visible.seal.adjustment, 3);
  assert.equal(visible.seal.paths.find(x => x.type === 'day-hidden').adjustment, 3);
  assert.equal(visible.seal.paths.find(x => x.type === 'adjacent-visible').adjustment, 3);
  const independent = inspect('庚午 癸酉 甲子 乙亥');
  assert.equal(independent.seal.adjustment, 13, '亥水另有未受冲印根，不因子冲把所有印路径打包扣减');
});

test('印干受相邻五合限制，独立日支印保留；不会把合绊说成合化消失', () => {
  const r = inspect('戊寅 癸酉 甲子 丙寅');
  const exposed = r.seal.paths.find(x => x.type === 'adjacent-visible');
  assert.equal(exposed.bound, true);
  assert.equal(exposed.transformedAway, false);
  assert.equal(exposed.adjustment, 3);
  assert.equal(r.seal.adjustment, 6);
  assert.equal(r.seal.selectedPath.type, 'day-hidden');
});

for (const [text, element] of [
  ['庚寅 辛酉 甲子 丙寅', '木'],
  ['壬午 壬子 丙寅 甲午', '火'],
  ['甲辰 乙卯 戊申 丙辰', '土'],
  ['丙申 丁巳 庚子 壬申', '金'],
  ['戊子 己未 壬申 庚子', '水'],
]) {
  test(`${element}根被同柱得令有根官杀所克：记录限制，保留根气基线`, () => {
    const r = inspect(text);
    const root = r.settlement.rootAt('year').find(x => x.element === element && x.depth === '本气');
    assert.ok(root);
    const constraint = root.supportConstraints.find(x => x.kind === 'control');
    assert.ok(constraint && constraint.limitsClusterBonus);
    assert.equal(constraint.adjustment, 0);
    assert.equal(root.effectivePower, Number((root.basePower * root.effectiveCoefficient).toFixed(3)));
    assert.ok(root.effectivePower > 0);
  });
}

test('丙寅泄根被记录但失令火不取消寅根补偿资格，得令泄干才限制额外补偿', () => {
  const autumn = inspect('庚寅 乙酉 甲子 丙寅');
  const summer = inspect('甲寅 丙午 甲子 丙寅');
  const first = autumn.settlement.rootAt('hour', '甲')[0].supportConstraints[0];
  const second = summer.settlement.rootAt('hour', '甲')[0].supportConstraints[0];
  assert.equal(first.kind, 'drain');
  assert.equal(first.rooted, true);
  assert.equal(first.limitsClusterBonus, false);
  assert.equal(second.limitsClusterBonus, true);
  assert.equal(first.adjustment, 0);
  assert.equal(second.adjustment, 0);
});

test('审计、事件账本和男女输入共用同一套根气限制与旺衰结果', () => {
  const text = '庚寅 乙酉 甲子 丙寅';
  const female = inspect(text, 'female'), male = inspect(text, 'male');
  assert.equal(female.strength.score, male.strength.score);
  assert.deepEqual(E.calcDayMasterStrength(female.bazi, { audit: true }), female.strength);
  const audit = E.auditDayMasterStrength(female.bazi);
  assert.equal(audit.eventLedger.audit.scoreClosureMatches, true);
  assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0);
  assert.equal(audit.warnings.filter(x => x.severity === 'error').length, 0);
  for (const root of audit.roots) {
    assert.deepEqual(root.supportConstraints, female.settlement.rootAt(root.position, root.hiddenStem)[0].supportConstraints);
  }
});
