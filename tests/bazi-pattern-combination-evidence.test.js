'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
const E = context.window.BaZiCalculator;

// Constructed mechanism fixtures, not independent natal-chart judgements.
function inspect(text) {
  const values = text.split(' ').map(value => ({ gan:value[0], zhi:value[1] }));
  const chart = E.buildFromPillars({ year:values[0], month:values[1], day:values[2], hour:values[3] }, 'male');
  const base = E.getPattern(chart);
  const resolved = E.getYongJi(chart).resolvedPattern;
  return { chart, base, resolved, combinations:E.getGanHe(chart) };
}

function pending(result, name, reason) {
  assert.equal(result.resolved.name, result.base.name, 'uncertain rescue cannot replace the base pattern');
  assert.equal(result.resolved.status, result.base.status);
  const relation = result.resolved.relatedPatterns.find(item => item.name === name);
  assert.ok(relation, name + ' remains visible as related evidence');
  assert.equal(relation.status, '条件待定');
  assert.match(relation.pendingReasons.join('；'), reason);
  assert.equal(relation.breakReasons.length, 0, 'pending is not a proven break');
  return relation;
}

test('rooted remote year-hour and month-hour combinations do not establish binding rescue', () => {
  const injury = inspect('戊辰 辛酉 丁未 癸亥');
  assert.ok(injury.combinations.some(item => item.from === '年柱' && item.to === '时柱' && !item.isAdjacent));
  const relation = pending(injury, '伤官合杀格', /隔柱遥合/);
  assert.ok(relation.establishConditions.some(item => item.condition === '伤官七杀双方有根' && item.met));
  assert.ok(relation.establishConditions.some(item => item.condition === '伤官与七杀有效合绊' && !item.met));
  const officer = inspect('丙申 壬子 庚辰 丁亥');
  assert.ok(officer.combinations.some(item => item.from === '月柱' && item.to === '时柱' && !item.isAdjacent));
  pending(officer, '去官留杀格', /隔柱遥合/);
});

test('adjacent untransformed uncontested combinations retain established rescue', () => {
  for (const [text, name] of [
    ['戊辰 癸亥 丁未 辛丑', '伤官合杀格'],
    ['癸亥 戊辰 丁未 辛丑', '伤官合杀格'],
    ['丁巳 壬申 丙午 癸酉', '去杀留官格']
  ]) {
    const result = inspect(text);
    assert.ok(result.combinations.some(item => item.isAdjacent && !item.isTransformed && !item.hasContention));
    assert.equal(result.resolved.name, name, text);
    assert.equal(result.resolved.status, '成格', text);
  }
});

test('third-stem contention blocks confirmed rescue even with an adjacent rooted pair', () => {
  for (const text of ['戊辰 癸亥 丁未 戊戌', '戊辰 癸亥 丁未 癸丑']) {
    const result = inspect(text);
    assert.ok(result.combinations.some(item => item.isAdjacent && item.hasContention));
    pending(result, '伤官合杀格', /第三干争合/);
  }
});

test('day-stem contention remains relevant although the day stem is not a removal actor', () => {
  const result = inspect('乙卯 庚申 乙巳 辛酉');
  assert.ok(result.combinations.some(item => item.from === '年柱' && item.to === '月柱' && item.hasContention));
  assert.ok(result.combinations.some(item => item.dayInvolved && item.hasContention));
  pending(result, '去官留杀格', /第三干争合/);
});

test('already transformed combinations cannot also be treated as original-star binding removal', () => {
  for (const [text, name] of [
    ['戊辰 癸巳 丁未 辛亥', '伤官合杀格'],
    ['丁卯 壬寅 丙子 癸酉', '去杀留官格']
  ]) {
    const result = inspect(text);
    assert.ok(result.combinations.some(item => item.isTransformed), text);
    pending(result, name, /已化.*不能沿用原星合绊去留/);
  }
});

test('removal requires effective roots for the binding pair and the retained star', () => {
  const weakBinding = inspect('丁卯 壬申 丙子 癸酉');
  const relation = pending(weakBinding, '去杀留官格', /合绊至少一方无有效根气/);
  assert.ok(relation.establishConditions.some(item => item.condition === '去杀合绊双方有根' && !item.met));
  assert.ok(relation.establishConditions.some(item => item.condition === '所留正官有根' && item.met));
  assert.doesNotMatch(relation.source, /被.*绊住|独留/);

  const unrootedKilling = inspect('丁亥 壬子 庚辰 丙申');
  const killingRelation = pending(unrootedKilling, '去官留杀格', /所留七杀缺少有效根气/);
  assert.ok(killingRelation.establishConditions.some(item => item.condition === '所留七杀有根' && !item.met));
});

test('a rooted food star used for officer binding is not reused as proven killing control', () => {
  for (const text of ['丁亥 壬午 庚戌 丙申', '丁亥 壬午 庚戌 丙午']) {
    const result = inspect(text);
    const relation = pending(result, '去官留杀格', /参与去官合绊者的兼任余力尚未裁决/);
    assert.ok(relation.establishConditions.some(item => item.condition === '正官有明确去处' && item.met));
    assert.ok(relation.establishConditions.some(item => item.condition === '去官合绊双方有根' && item.met));
    assert.ok(relation.establishConditions.some(item => item.condition === '所留七杀有根' && item.met));
    assert.ok(relation.establishConditions.some(item => item.condition === '所留七杀有独立制化' && !item.met));
    assert.doesNotMatch(relation.source, /被.*绊住|独留/);
  }
});
