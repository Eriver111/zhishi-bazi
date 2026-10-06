const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Pure source evaluation; no server, credentials or production API loading.
const runtime = {window:{}};
for (const file of ['bazi.js', 'bazi-chain.js', 'structural.js', 'deep-report.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), runtime);
}
const calc = runtime.window.BaZiCalculator;
const plain = value => JSON.parse(JSON.stringify(value));
const describe = (relation, level, cong = null) => runtime.describeElementBenefit('水', '火', relation, {dmStr:{level}, cong});

test('generic officer help respects settled weak, neutral, strong and missing strength', () => {
  for (const level of ['极弱', '偏弱', '中和', '']) {
    const help = describe('官杀', level);
    assert.match(help, /克身压力/);
    assert.doesNotMatch(help, /可制衡.*日主/);
  }
  assert.match(describe('官杀', '偏强'), /可制衡较强日主/);
  assert.match(describe('官杀', '极强'), /可制衡较强日主/);
  assert.doesNotMatch(describe('官杀', '极弱', {isCong:false, isCandidate:true, name:'从杀候选'}), /按从杀候选顺势/);
});

test('following help describes the settled route for all five relationships without ordinary strength remedies', () => {
  for (const [relation, level, name, action] of [
    ['官杀', '极弱', '从杀格', '官杀参与'],
    ['财星', '极弱', '从财格', '财星参与'],
    ['食伤', '极弱', '从儿格', '承接并疏导'],
    ['比劫', '极强', '曲直格', '维持同类'],
    ['印星', '极强', '润下格', '生助所从'],
  ]) {
    const context = {dmStr:{level}, cong:{isCong:true, name}};
    const before = structuredClone(context);
    const help = runtime.describeElementBenefit('水', '火', relation, context);
    assert.match(help, new RegExp(name + '顺势取用'));
    assert.match(help, new RegExp(action));
    assert.doesNotMatch(help, /可制衡.*日主|日主承载足够|补充承载/);
    assert.deepEqual(context, before, 'explanation must not mutate settled facts');
  }
});

test('seal, peer and output fallbacks do not infer ordinary weakness or strength from their labels', () => {
  assert.match(describe('印星', '偏弱'), /提供生扶/);
  assert.match(describe('印星', '中和'), /制伤、化杀或格局任务/);
  assert.doesNotMatch(describe('印星', '偏强'), /能为日主提供生扶/);
  assert.match(describe('比劫', '偏弱'), /补充承载/);
  assert.doesNotMatch(describe('比劫', '中和'), /能补充承载/);
  assert.match(describe('食伤', '偏弱'), /继续消耗日主.*承载与实际通路/);
  assert.match(describe('食伤', '偏强'), /疏导日主/);
});

function facts(pillars) {
  const input = Object.fromEntries(pillars.split(' ').map((value, i) => [
    ['year','month','day','hour'][i], {gan:value[0], zhi:value[1]}
  ]));
  const chart = calc.buildFromPillars(input, 'female');
  const yongJi = calc.getYongJi(chart);
  const report = runtime.window.DeepReport.buildFacts(chart, 'female', {
    anchorYear:2023,
    deps:{calculator:calc, chain:runtime.window.BaZiChain, structural:runtime.window.StructuralAnalysis},
  });
  return {yongJi, report};
}

test('source-chart replay and constructed following charts keep grades, strength and useful elements while sharing corrected help', () => {
  for (const fixture of [
    {pillars:'戊辰 壬戌 丁酉 庚戌', level:'极弱', grade:'A10', yong:['水'], xi:['水','金','土'], ji:['木','火'], following:true},
    {pillars:'辛亥 癸巳 己酉 乙亥', level:'偏弱', grade:'A8', yong:['火'], following:false},
    {pillars:'辛酉 辛酉 乙酉 辛巳', level:'极弱', grade:'A6', yong:['金'], xi:['金','土'], ji:['水','木'], following:true},
    {pillars:'戊戌 己未 甲戌 戊辰', level:'极弱', grade:'A10', yong:['土'], following:true},
    {pillars:'甲寅 乙卯 甲寅 癸亥', level:'极强', grade:'A6', yong:['水'], following:true},
  ]) {
    const {yongJi, report} = facts(fixture.pillars);
    assert.equal(report.core.strength.level, fixture.level);
    assert.equal(report.wealth.narrative.grade, fixture.grade);
    assert.deepEqual(plain(yongJi.yongShen), fixture.yong);
    if (fixture.xi) assert.deepEqual(plain(yongJi.xiShen), fixture.xi);
    if (fixture.ji) assert.deepEqual(plain(yongJi.jiShen), fixture.ji);
    assert.equal(report.storyline.mechanismAccount.help, yongJi.mechanismSummary.help);
    assert.equal(yongJi.mechanismSummary.help, yongJi.elementRoleLedger.entries.find(e=>e.element===fixture.yong[0]).tradeoff.benefit);
    if (fixture.following) assert.match(yongJi.mechanismSummary.help, /顺势取用/);
    else assert.match(yongJi.mechanismSummary.help, /提供生扶/);
    assert.doesNotMatch(yongJi.mechanismSummary.help, /制衡过强日主/);
  }
});
