const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/bazi.js'), 'utf8');
const box = {window:{}};
// Expose only the pure private scorer in this VM, without changing production exports.
assert.equal(source.split('window.BaZiCalculator = {').length, 2);
vm.runInNewContext(source.replace('window.BaZiCalculator = {', 'window.testSupportQuality = evaluateYongShenQuality;\nwindow.BaZiCalculator = {'), box);
const E = box.window.BaZiCalculator;
const wx = ['木','火','土','金','水'];
function chart(text) {
  return E.buildFromPillars(Object.fromEntries(text.split(' ').map((gz, i) => [
    ['year','month','day','hour'][i], {gan:gz[0],zhi:gz[1]}
  ])), 'male');
}
function quality(bazi) { return box.window.testSupportQuality(bazi, {yongShen:wx,xiShen:[]}); }

test('两处金透干没有藏干根：保留综合分2，但不能把浮透写成有根', () => {
  const bazi = E.calculate(1951, 12, 25, 11, 'male', 21 + 22 / 60);
  assert.equal(['year','month','day','hour'].map(p => bazi[p].gan+bazi[p].zhi).join(' '), '辛卯 庚子 己亥 乙亥');
  const q = quality(bazi).金;
  assert.equal(q.score, 2);
  assert.equal(q.rootPower, 0);
  assert.equal(q.rooted, false);
  assert.equal(q.rootState, '浮透无根');
  assert.equal(q.roots.length, 0);
  assert.equal(q.rootEvidence.length, 0);
  assert.equal(q.exposedPositions.length, 2);
  assert.match(q.quality, /浮透无根/);
  assert.doesNotMatch(q.quality, /偏真用神|有根但|中年|层次高/);
});

for (const [text, power, score, rootText] of [
  ['丙申 丁酉 甲寅 己巳', 0.5, -0.5, '年支申藏壬（中气）'],
  ['乙未 戊寅 辛酉 己亥', 1.5, -0.5, '时支亥藏壬（本气）']
]) {
  test(text + '：受克后综合分为负，不能抹掉仍存在的水根', () => {
    const q = quality(chart(text)).水;
    assert.equal(q.score, score);
    assert.equal(q.rootPower, power);
    assert.equal(q.rooted, true);
    assert.equal(q.supportLevel, '受限');
    assert.match(q.quality, /有根/);
    assert.doesNotMatch(q.quality, /虚浮无根|假用神/);
    assert.ok(q.roots.some(value => value.includes(rootText)));
    assert.ok(q.rootEvidence.some(value => value.effectiveCoefficient < 1));
    assert.equal(q.rootEvidence.reduce((sum, value) => sum + value.effectivePower, 0), power);
  });
}

test('有根透出和完全未现各自有事实来源，质量文案不承诺人生结果', () => {
  const result = quality(chart('甲寅 乙卯 甲寅 癸亥'));
  assert.equal(result.木.rooted, true);
  assert.ok(result.木.rootPower > 0);
  assert.equal(result.金.rooted, false);
  assert.equal(result.金.rootState, '原局未见根气');
  assert.equal(result.金.exposedPositions.length, 0);
  Object.values(result).forEach(q => {
    assert.doesNotMatch(q.quality, /一生|中年|人生层次|徒有其名/);
    assert.ok(q.roots.every(text => !/透干|受克/.test(text)), '根气列表只存藏干证据');
  });
});

test('三处火浮透也不能凭综合分3写成冬土暖局已有火根', () => {
  const result=E.getYongJi(chart('丙子 丁丑 戊申 丙子'));
  const fire=result.candidateScores.find(c=>c.wx==='火');
  assert.equal(fire.supportScore,3);
  assert.equal(fire.rootPower,0);
  assert.equal(fire.rooted,false);
  assert.equal(result.climateState.needsWarmth,true);
  assert.match(result.tiaoHouReason,/未见地支根气/);
  assert.doesNotMatch(result.tiaoHouReason,/火有根/);
  assert.equal(result.yongShen.join(''),'水');
});

test('512个日期：综合分保持旧公式，根气存在性只取统一藏干结算', () => {
  let seed = 0x9252026;
  const rand = max => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return Math.floor(seed/4294967296*max); };
  const controls = {木:'金',火:'水',土:'木',金:'火',水:'土'};
  for (let i=0;i<512;i++) {
    const year=1930+rand(100),month=1+rand(12),day=1+rand(28),hour=rand(24);
    const bazi=E.calculate(year,month,day,Math.floor((hour+1)%24/2),'male',hour);
    const settled=E.buildEvidenceSettlement(bazi), q=quality(bazi);
    for (const element of wx) {
      const expectedRoots=settled.roots.filter(r => r.element===element);
      const power=expectedRoots.reduce((sum,r)=>sum+r.effectivePower,0);
      const exposed=['year','month','hour'].filter(p=>E.WU_XING[bazi[p].gan]===element).length;
      const attacks=['year','month','hour'].filter(p=>E.WU_XING[bazi[p].gan]===controls[element]).length;
      assert.ok(Math.abs(q[element].rootPower-power)<1e-9);
      assert.ok(Math.abs(q[element].score-(power+exposed-attacks))<1e-9);
      assert.equal(q[element].rooted,power>0);
      assert.equal(q[element].rootEvidence.length,expectedRoots.length);
    }
    const yj=E.getYongJi(bazi);
    (yj.candidateScores||[]).forEach(c=>{
      assert.equal(c.rootScore,c.supportScore, '兼容字段数值保留');
      assert.equal(c.rootPower,q[c.wx].rootPower);
      assert.equal(c.rooted,q[c.wx].rooted);
    });
  }
});

test('AI上下文区分实际根气与综合分，旧质量标签不补造根气事实', () => {
  const api=fs.readFileSync(path.join(root,'api/ai-chat.js'),'utf8');
  const start=api.indexOf('function buildSingleChart(data)'),end=api.indexOf('function buildLiurenContext(',start);
  assert.ok(start>=0&&end>start);
  const scope={};vm.runInNewContext(api.slice(start,end),scope);
  const q=quality(chart('辛卯 庚子 己亥 乙亥'));
  const text=scope.buildSingleChart({yongJi:{yongShenQuality:{金:q.金}}});
  assert.match(text,/浮透无根/);
  assert.match(text,/有效根气0；综合承载参考分2/);
  assert.doesNotMatch(text,/根气得分2|偏真用神/);
  const old=scope.buildSingleChart({yongJi:{yongShenQuality:{金:{score:2,quality:'偏真用神——有根但不够深固',roots:['透干year/month']}}}});
  assert.match(old,/缺少独立根气字段/);
  assert.doesNotMatch(old,/有根但不够深固|根气得分/);
  assert.doesNotMatch(api,/真用神有力则一生层次高/);
});
