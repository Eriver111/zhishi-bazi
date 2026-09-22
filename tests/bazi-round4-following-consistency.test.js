const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), box);
const E = box.window.BaZiCalculator;
function build(text) {
  const p = text.split(' ').map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return E.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}

// Distinct non-participating blockers cover the whole control cycle; none are
// a repeated combining stem, so a contention rule cannot hide a bad mapping.
for (const [text, hua, blocker] of [
  ['丁卯 壬寅 庚子 癸亥', '木', '庚'],
  ['戊子 癸巳 壬子 甲寅', '火', '壬'],
  ['甲子 己丑 乙卯 壬子', '土', '乙'],
  ['乙丑 庚申 丙子 壬子', '金', '丙'],
  ['丙子 辛亥 戊辰 壬子', '水', '戊'],
  ['丙子 辛亥 己巳 壬子', '水', '己'],
]) {
  test(`五合化${hua}：局外${blocker}为克制化神的证据`, () => {
    const item = E.getGanHe(build(text)).find(r => r.from === '年柱' && r.to === '月柱');
    assert.equal(item.huaWx, hua);
    assert.equal(item.hasContention, false);
    assert.equal(item.isTransformed, false);
    assert.match(item.desc, new RegExp(blocker + '克' + hua));
  });
}

test('丙辛化水不把生水的庚金错误列为克水阻化', () => {
  for (const text of ['丙子 辛亥 庚申 壬子', '庚申 丙子 辛亥 壬辰']) {
    const item = E.getGanHe(build(text)).find(r => r.huaWx === '水');
    assert.equal(item.hasContention, false);
    assert.equal(item.isTransformed, true);
    assert.doesNotMatch(item.desc, /庚克水/);
  }
});

test('从强兜底不能漏掉透出的财星并自动反转喜忌', () => {
  for (const text of ['乙卯 己卯 甲子 乙亥', '乙酉 辛酉 辛酉 辛酉']) {
    const bazi = build(text);
    assert.equal(E.calcDayMasterStrength(bazi).level, '极强');
    assert.equal(E.getCongGe(bazi).isCong, false);
    assert.notEqual(E.getPattern(bazi).congGe, true);
    assert.notEqual(E.getYongJi(bazi).method, '从格顺势');
  }
});

test('无根印星坐支生印时，不能被误写成坐克无承载的假从候选', () => {
  for (const text of ['甲子 癸酉 丁丑 戊申', '乙卯 甲申 己酉 丁卯', '甲寅 辛未 癸卯 甲寅']) {
    const cong = E.getCongGe(build(text));
    assert.equal(cong.isCong, false);
    assert.notEqual(cong.isCandidate, true, text);
  }
});

for (const [text, following, helping, subdued] of [
  ['丙戌 戊戌 乙酉 癸未', ['土','火','金'], ['水','木'], true],
  ['甲戌 癸酉 丁酉 己酉', ['水','金','土'], ['木','火'], false],
  ['乙酉 己卯 己亥 乙亥', ['木','水'], ['火','土'], true],
  ['癸卯 乙卯 辛卯 辛卯', ['木','水','火'], ['土','金'], false],
  ['乙卯 己卯 癸未 壬戌', ['土','火','木'], ['金','水'], true],
]) {
  test(`${text}：假从复核方向与当前日主及印比坐支一致`, () => {
    const bazi = build(text), cong = E.getCongGe(bazi), yong = E.getYongJi(bazi);
    assert.equal(cong.isCandidate, true);
    assert.equal(cong.isCong, false);
    assert.deepEqual(Array.from(cong.followingElements), following);
    assert.deepEqual(Array.from(cong.supportingElements), helping);
    assert.equal(cong.floatingHelpingStems[0].subduedBySeat, subdued);
    assert.ok(cong.desc.includes(following.join('、')));
    assert.ok(cong.desc.includes(helping.join('、')));
    assert.ok(cong.verification[0].includes(following.join('、')));
    assert.ok(cong.verification[1].includes(helping.join('、')));
    assert.notEqual(yong.method, '从格顺势', '候选不反转喜忌');
  });
}

test('五行专旺正例保留，成格依据与极强结果一致', () => {
  for (const text of ['甲子 乙卯 甲寅 乙卯','丙午 丁巳 丙午 丁巳','戊戌 己未 戊辰 己丑','庚申 辛酉 庚申 辛酉','壬子 癸亥 壬子 癸亥']) {
    const bazi = build(text), cong = E.getCongGe(bazi), pattern = E.getPattern(bazi), yong = E.getYongJi(bazi);
    assert.equal(cong.isCong, true);
    assert.equal(cong.zhuanWang, true);
    assert.equal(yong.method, '从格顺势');
    assert.doesNotMatch(pattern.establishConditions[0].detail, /日主弱极/);
    assert.match(pattern.establishConditions[0].detail, /日主强极/);
    assert.doesNotMatch(yong.reasoning, /木为食伤|此命已弃命从势/);
    assert.ok(yong.reasoning.includes(yong.xiShen.join('、')));
    assert.ok(yong.reasoning.includes(yong.jiShen.join('、')));
  }
});

test('配偶远近的日支驿马与统一神煞事实一致，不能见寅申巳亥就断驿马', () => {
  const map = {申:'寅',子:'寅',辰:'寅',寅:'申',午:'申',戌:'申',巳:'亥',酉:'亥',丑:'亥',亥:'巳',卯:'巳',未:'巳'};
  for (const yearZhi of '子丑寅卯辰巳午未申酉戌亥') {
    for (const dayZhi of ['寅','申','巳','亥']) {
      const pair = z => ('子寅辰午申戌'.includes(z) ? '甲' : '乙') + z;
      const bazi = build(`${pair(yearZhi)} 丙辰 ${pair(dayZhi)} 庚午`);
      const expected = map[yearZhi] === dayZhi;
      const facts = E.calculateShenSha(bazi).some(r => r.name === '驿马' && r.positions.includes('day'));
      assert.equal(facts, expected);
      assert.equal(E.calculateSpouseAge(bazi).distanceText.includes('日支带驿马星'), expected, `${yearZhi}年 ${dayZhi}日`);
    }
  }
});
