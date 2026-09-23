'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Mechanism fixtures only; load the pure calculator, never API or storage modules.
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
const E = context.window.BaZiCalculator;

function build(text) {
  const records = text.split(' ').map(value => ({ gan:value[0], zhi:value[1] }));
  return E.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((position, index) => [position, records[index]])), 'male');
}

function entry(result, element) {
  return result.elementRoleLedger.entries.find(item => item.element === element);
}

function assertTaskAgreement(result) {
  for (const task of result.functionalTasks) {
    const ledger = entry(result, task.element);
    assert.ok(ledger.functions.includes(task.conclusion), task.type + ' conclusion is retained');
    assert.ok(ledger.conditions.includes(task.condition), task.type + ' boundary is retained');
    assert.ok(result.elementReasons[task.element].functionalTasks.some(item => item.type === task.type));
  }
}

function inspectScores(text) {
  const chart = build(text);
  const pattern = E.getPattern(chart);
  const strength = E.calcDayMasterStrength(chart);
  const scores = context.calcCandidateScores(chart, strength, pattern);
  return { chart, pattern, strength, scores, result:E.getYongJi(chart) };
}

test('无根印的通路被最终裁决撤销后，角色账本不能恢复其原局功效', () => {
  const result = E.getYongJi(build('丁巳 甲子 丁巳 丁巳'));
  assert.equal(result.dayMasterLevel, '偏强');
  assert.equal(result.resolvedPattern.formationStatus, '不成立');
  assert.ok(result.resolvedPattern.structureBreakReasons.includes('印星结算后无有效根气'));
  assert.equal(entry(result, '木').rootPower, 0);
  assert.equal(result.functionalTasks.length, 0);
  assert.equal(result.functionalTaskElements.length, 0);
  assert.equal(result.elementReasons['木'].functionalTasks, undefined);
  assert.ok(!result.evidence.some(item => item.category === '功能任务'));
  assert.doesNotMatch(entry(result, '木').functions.join('；'), /承担化杀通关任务|原局有功/);
  assert.doesNotMatch(entry(result, '木').conditions.join('；'), /官杀压力与通关链仍然存在/);
  assert.notEqual(entry(result, '木').natalRole, '原局有功');
  assert.notEqual(entry(result, '木').natalRole, '功过并见');
});

test('已成立通关和伤官配印任务在所有出口保留同一功效与增量边界', () => {
  for (const [text, type, element] of [
    ['戊辰 丙辰 庚子 戊寅', '印星化杀通关', '土'],
    ['辛丑 辛卯 壬申 庚子', '印星制伤护格', '金']
  ]) {
    const result = E.getYongJi(build(text));
    assert.equal(result.functionalTasks.length, 1);
    assert.equal(result.functionalTasks[0].type, type);
    assert.equal(result.functionalTasks[0].element, element);
    assert.ok(result.jiShen.includes(element), 'a natal task does not reverse the increment direction');
    assert.equal(entry(result, element).natalRole, '功过并见', 'confirmed natal function cannot be labelled pure disease');
    assert.equal(entry(result, element).fortuneRole, '忌神', 'natal function does not grant favorable future increments');
    assertTaskAgreement(result);
  }
});

test('财官印都有根但通路待定时，不凭根气给账本添加已完成功能', () => {
  const result = E.getYongJi(build('庚辰 乙酉 丁亥 壬寅'));
  const related = result.resolvedPattern.relatedPatterns.find(item => item.name === '财官印相生格');
  assert.equal(related.status, '条件待定');
  assert.ok(related.establishConditions.some(item => item.condition === '财官印全部透干有根' && item.met));
  assert.ok(related.pendingReasons.some(reason => /节点受合牵制/.test(reason)));
  assert.equal(result.functionalTasks.length, 0);
  assert.doesNotMatch(entry(result, '木').functions.join('；'), /承担化杀通关任务/);
});

test('有效任务和被拒任务交替计算不串盘，返回对象修改不会污染后续结果', () => {
  const acceptedChart = build('辛丑 辛卯 壬申 庚子');
  const rejectedChart = build('丁巳 甲子 丁巳 丁巳');
  const accepted = E.getYongJi(acceptedChart);
  const rejected = E.getYongJi(rejectedChart);
  const acceptedSnapshot = JSON.stringify(accepted);
  const rejectedSnapshot = JSON.stringify(rejected);
  accepted.functionalTasks[0].conclusion = 'mutated caller value';
  entry(accepted, '金').functions.push('caller-only entry');
  entry(rejected, '木').conditions.push('caller-only condition');
  assert.equal(JSON.stringify(E.getYongJi(acceptedChart)), acceptedSnapshot);
  assert.equal(JSON.stringify(E.getYongJi(rejectedChart)), rejectedSnapshot);
});

test('无根官杀印通路不能取得成格加分，但独立扶抑需求继续存在', () => {
  const { pattern, strength, scores, result } = inspectScores('壬子 甲子 丁巳 丁酉');
  assert.equal(pattern.status, '成格', 'base pattern status alone cannot establish the route');
  assert.equal(pattern.formationStatus, '不成立');
  assert.equal(strength.score, 48);
  assert.equal(scores.L1['木'], 2);
  assert.equal(scores.L2['木'], 0.96);
  assert.equal(scores.L3['木'], 0);
  assert.ok(scores.l3Details.some(item => item.val === 0 && /通路未成立/.test(item.note)));
  // Before this gate: wood L3=10, SBase=12.96 and winner=wood.
  // After: SBase=2.96; the independently supported winner remains wood.
  assert.ok(Math.abs(scores.SBase['木'] - 2.96) < 1e-9);
  assert.equal(scores.yongWx, '木');
  assert.equal(result.yongShenSource.primaryType, '扶抑用神');
  assert.doesNotMatch(result.reasoning, /杀\/官印相生，印星化杀生身/);
});

test('有根且方向门控通过时保留成格加分，不等印被选成用神后才加分', () => {
  const { pattern, scores, result } = inspectScores('壬子 甲子 丁卯 丁酉');
  assert.equal(pattern.formationStatus, '成立');
  assert.equal(pattern.structureStatus, '待喜用裁决');
  assert.equal(scores.L3['木'], 10);
  assert.equal(scores.yongWx, '木');
  assert.equal(result.yongShenSource.primaryType, '格局用神');
});

test('破格通路不获成格分，独立月令受冲救应仍可作为取用依据', () => {
  const { pattern, strength, scores, result } = inspectScores('癸亥 甲子 丙午 丁酉');
  assert.equal(pattern.status, '破格');
  assert.equal(pattern.formationStatus, '不成立');
  assert.equal(strength.score, 43);
  const rescue = scores.l3Details.find(item => /月令受冲，木通关泄化/.test(item.note));
  assert.ok(rescue && rescue.val > 0, 'the independent rescue path still awards its existing score');
  assert.ok(Math.abs(rescue.val - 4.2) < 1e-9);
  assert.ok(Math.abs(scores.L3['木'] - rescue.val) < 1e-9);
  // Before: L3=8.2, SBase=18.56, winner=wood. After: 4.2 / 14.56 / wood.
  assert.ok(Math.abs(scores.SBase['木'] - 14.56) < 1e-9);
  assert.equal(scores.yongWx, '木');
  assert.equal(result.yongShenSource.primaryType, '格局救应用神');
});
