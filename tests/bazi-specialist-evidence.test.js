'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Mechanism/transport fixtures, not independently adjudicated accuracy labels.
// Load pure source only; never require API/store or read production configuration.
const root = path.join(__dirname, '..');
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/bazi.js'), 'utf8'), scope);
const E = scope.window.BaZiCalculator;
const plain = value => JSON.parse(JSON.stringify(value));
function chart(text) {
  const p = text.split(' ').map(value => ({gan:value[0], zhi:value[1]}));
  return E.buildFromPillars({year:p[0], month:p[1], day:p[2], hour:p[3]}, 'male');
}
function context(data) {
  const api = fs.readFileSync(path.join(root, 'api/ai-chat.js'), 'utf8');
  const start = api.indexOf('function buildSingleChart(data)');
  const end = api.indexOf('function buildLiurenContext(', start);
  assert.ok(start >= 0 && end > start);
  const box = {};
  vm.runInNewContext(api.slice(start,end), box);
  return box.buildSingleChart(data);
}
function removal(text) {
  const bazi = chart(text), yj = E.getYongJi(bazi);
  const related = yj.resolvedPattern.relatedPatterns.find(p => p.name === '去官留杀格');
  assert.ok(related);
  return {bazi, yj, related};
}

for (const [text, name, xi, ji] of [
  ['癸亥 壬戌 丁丑 辛亥', '从杀格', '水金', '木火'],
  ['戊戌 己未 甲戌 戊辰', '从财格', '土火金', '水木'],
  ['丙午 丙午 甲午 戊辰', '从儿格', '火土', '水'],
  ['丙午 戊戌 癸卯 甲寅', '假从势格', '土火木', '金水']
]) test(name + '的提前返回保留残余生扶，未定承载不抹根也不擅改喜忌', () => {
  const bazi = chart(text), c = E.getCongGe(bazi), j = E.getYongJi(bazi);
  assert.equal(c.name, name);
  assert.equal(c.isCong, true);
  assert.equal(c.followingReview.outcome, 'following');
  assert.equal(c.followingReview.reviewRequired, true);
  assert.ok(c.followingReview.supportRoots.length > 0);
  assert.ok(c.followingReview.gates.every(g => g.passed));
  assert.equal(j.xiShen.join(''), xi);
  assert.equal(j.jiShen.join(''), ji);
  assert.match(c.source, /残余印比承载待复核/);
  assert.match(c.followingReview.summary, /不等于绝无根气或已证实真从/);
  assert.deepEqual(plain(j.congGe.followingReview), plain(c.followingReview));
  assert.deepEqual(plain(j.resolvedPattern.followingReview), plain(c.followingReview));
  assert.ok(j.evidence.some(e => e.category === '从格生扶证据' && e.detail === c.followingReview.summary));
  assert.match(context({yongJi:j}), /从弱生扶专项证据：残余生扶/);
  assert.match(context({pattern:j.resolvedPattern}), /从弱生扶专项证据：残余生扶/);
  assert.doesNotMatch(c.desc, /富压一方|杀旺为贵/);
});

test('同字异位分开记录，受扰中气不冒充余气，也不消失', () => {
  const r = E.getCongGe(chart('癸亥 壬戌 丁丑 辛亥')).followingReview;
  const wood = r.supportRoots.filter(x => x.gan === '甲');
  assert.equal(wood.length, 2);
  assert.deepEqual(plain(wood.map(x => x.position)), ['year','hour']);
  assert.notEqual(wood[0].id, wood[1].id);
  const fire = r.supportRoots.find(x => x.gan === '丁');
  assert.equal(fire.effectivePower, 0.35);
  assert.equal(fire.depth, '余气');
  assert.ok(fire.adjustments.length > 0);
  const metal = E.getCongGe(chart('丙午 戊戌 癸卯 甲寅')).followingReview.supportRoots.find(x => x.gan === '辛');
  assert.equal(metal.depth, '中气');
  assert.equal(metal.effectivePower, 0.5);
});

test('无残余生扶与浮透候选有不同证据状态，专旺不套从弱复核', () => {
  const clean = E.getCongGe(chart('戊午 己未 癸未 甲寅'));
  assert.equal(clean.isCong, true);
  assert.equal(clean.followingReview.supportRoots.length, 0);
  assert.equal(clean.followingReview.reviewRequired, false);
  assert.match(clean.followingReview.summary, /未见印比藏干/);
  const c = E.getCongGe(chart('乙酉 己卯 己亥 乙亥'));
  assert.equal(c.isCong, false);
  assert.equal(c.isCandidate, true);
  assert.equal(c.followingReview.outcome, 'candidate');
  assert.equal(c.followingReview.reviewRequired, true);
  assert.equal(c.followingReview.visibleSupport.length, 1);
  assert.equal(c.followingReview.visibleSupport[0].rootPower, 0);
  assert.equal(c.followingReview.gates.find(g => g.id === 'no-visible-support').passed, false);
  assert.match(context({yongJi:E.getYongJi(chart('乙酉 己卯 己亥 乙亥'))}), /仅为候选，仍按普通取用/);
  const strong = E.getCongGe(chart('甲寅 乙卯 甲寅 癸亥'));
  assert.equal(strong.zhuanWang, true);
  assert.equal(strong.followingReview, undefined);
});

test('调换日支位置仍按既有门槛，排除原因可以追溯到日支藏干', () => {
  const a = E.getCongGe(chart('戊戌 己丑 丙子 己丑'));
  const b = E.getCongGe(chart('戊子 己丑 丙戌 己丑'));
  assert.equal(a.isCong, true);
  assert.equal(b.isCong, false);
  assert.equal(b.followingReview.outcome, 'ordinary');
  assert.equal(b.followingReview.gates.find(g => g.id === 'no-day-support').passed, false);
  assert.ok(b.followingReview.supportRoots.some(r => r.position === 'day' && r.gan === '丁'));
});

test('去官留杀识别兼任透干、共享根和藏印线索，未完成裁决不算已制化', () => {
  const {bazi, yj, related} = removal('丁亥 壬午 庚戌 丙申');
  const proof = related.controlEvidence;
  assert.equal(related.status, '条件待定');
  assert.equal(proof.verified, false);
  assert.equal(proof.sharedVisible.length, 1);
  assert.equal(proof.sharedVisible[0].position, 'month');
  assert.equal(proof.sharedVisible[0].gan, '壬');
  const water = proof.hiddenCandidates.filter(r => r.element === '水');
  assert.deepEqual(plain(water.map(r => r.position)), ['year','hour']);
  assert.ok(water.every(r => r.supportsBindingParticipant));
  const earth = proof.hiddenCandidates.filter(r => r.element === '土');
  assert.ok(earth.length > 0);
  assert.ok(earth.every(r => !r.supportsBindingParticipant));
  assert.ok(proof.hiddenCandidates.every(r => !r.controlVerified));
  assert.ok(yj.evidence.some(e => e.category === '制化复核' && e.detail === proof.summary));
  assert.match(context({pattern:yj.resolvedPattern}), /藏干存在不等于制化已完成/);
  assert.equal(yj.resolvedPattern.name, E.getPattern(bazi).name);
});

test('根受扰折损只读统一结果，不因参与两项任务重复扣减或加分', () => {
  const {bazi, related} = removal('丁亥 壬子 庚辰 丙申');
  const roots = E.buildEvidenceSettlement(bazi).roots;
  assert.ok(related.pendingReasons.some(s => /所留七杀缺少有效根气/.test(s)));
  for (const r of related.controlEvidence.hiddenCandidates) {
    const original = roots.find(x => x.id === r.id);
    assert.equal(r.effectivePower, original.effectivePower);
    assert.deepEqual(plain(r.adjustments), plain(original.adjustments));
  }
  assert.equal(related.controlEvidence.verified, false);
});

test('遥合和争合未通过时，不能借藏干制化证据绕过合绊前提', () => {
  for (const text of ['丙申 壬子 庚辰 丁亥','乙卯 庚申 乙巳 辛酉']) {
    const {related} = removal(text);
    assert.equal(related.status, '条件待定');
    assert.equal(related.controlEvidence, undefined);
  }
});

test('外部修改专项证据不能污染缓存根气或下一次判读', () => {
  const bazi = chart('癸亥 壬戌 丁丑 辛亥');
  const original = plain(E.buildEvidenceSettlement(bazi).roots);
  const review = E.getCongGe(bazi).followingReview;
  for (const r of review.supportRoots) {
    r.effectivePower = 999;
    r.relationSettlementIds.push('fake');
    if (r.adjustments[0]) r.adjustments[0].coefficient = 999;
  }
  assert.deepEqual(plain(E.buildEvidenceSettlement(bazi).roots), original);
  assert.ok(E.getCongGe(bazi).followingReview.supportRoots.every(r => r.effectivePower < 999));
  const fixture = removal('丁亥 壬午 庚戌 丙申');
  const before = plain(E.buildEvidenceSettlement(fixture.bazi));
  fixture.related.controlEvidence.sharedVisible[0].rootIds.push('fake');
  fixture.related.controlEvidence.hiddenCandidates[0].adjustments.push({coefficient:999});
  assert.deepEqual(plain(E.buildEvidenceSettlement(fixture.bazi)), before);
});
