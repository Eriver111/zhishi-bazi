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

const E = loadCalculator();
function build(text) {
  const p = text.split(' ').map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return E.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}

test('乙酉己卯己亥乙亥：单一无根比肩只进入假从财杀候选，不直接反转喜忌', () => {
  const chart = build('乙酉 己卯 己亥 乙亥');
  const strength = E.calcDayMasterStrength(chart);
  const cong = E.getCongGe(chart);
  const yongJi = E.getYongJi(chart);

  assert.equal(strength.score, 10);
  assert.equal(strength.level, '极弱');
  assert.equal(cong.isCong, false);
  assert.equal(cong.isCandidate, true);
  assert.equal(cong.name, '假从财杀候选');
  assert.equal(cong.trueFollowing, false);
  assert.equal(cong.floatingHelpingStems.length, 1);
  assert.equal(cong.floatingHelpingStems[0].gan, '己');
  assert.equal(cong.floatingHelpingStems[0].rootPower, 0);
  assert.match(cong.purityIssues.join('；'), /酉卯冲|卯酉冲/);

  assert.notEqual(yongJi.method, '从格顺势');
  assert.equal(yongJi.followingCandidate.name, '假从财杀候选');
  assert.deepEqual(Array.from(yongJi.yongShen), ['火']);
  assert.ok(yongJi.evidence.some(row => row.category === '从格复核' && /尚未成立|未成立/.test(row.title)));
});

test('有日支根或多个无根印比时不得进入假从候选', () => {
  const rooted = E.getCongGe(build('乙酉 己卯 己未 乙亥'));
  const manyFloating = E.getCongGe(build('己酉 己卯 己亥 乙亥'));

  assert.equal(rooted.isCong, false);
  assert.notEqual(rooted.isCandidate, true);
  assert.equal(manyFloating.isCong, false);
  assert.notEqual(manyFloating.isCandidate, true);
});

test('既有真从样本仍按从格顺势，不被候选层降级', () => {
  const chart = build('壬子 癸亥 戊子 癸卯');
  const cong = E.getCongGe(chart);
  const yongJi = E.getYongJi(chart);

  assert.equal(cong.isCong, true);
  assert.notEqual(cong.isCandidate, true);
  assert.equal(yongJi.method, '从格顺势');
});

test('AI 上下文锁定假从候选尚未成立且不得擅自反转喜忌', () => {
  const chart = build('乙酉 己卯 己亥 乙亥');
  const context = require('../api/ai-chat.js')._test.buildChartContext({
    dayMasterStrength:E.calcDayMasterStrength(chart),
    congGe:E.getCongGe(chart),
    yongJi:E.getYongJi(chart),
    pattern:E.getYongJi(chart).resolvedPattern,
  });

  assert.match(context, /假从财杀候选/);
  assert.match(context, /当前未成立|不得按从格反转本站喜用忌/);
});
