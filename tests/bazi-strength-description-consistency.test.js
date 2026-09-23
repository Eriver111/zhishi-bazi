const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Standalone pure core VM only: no API, store, server or existing test imports.
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), box);
const E = box.window.BaZiCalculator;
const positions = ['year', 'month', 'day', 'hour'];
function chart(text) {
  return E.buildFromPillars(Object.fromEntries(text.split(' ').map((pillar, i) => [positions[i], {
    gan: pillar[0], zhi: pillar[1],
  }])), 'male');
}
function fromDate([year, month, day, hour, minute]) {
  return E.calculate(year, month, day, Math.floor((hour + 1) % 24 / 2), 'male', hour + minute / 60);
}
function factsOnly(detail) {
  assert.doesNotMatch(detail, /日主需印比扶助|需先疏土|需先暖局|取木须首重|火另承担/,
    '旺衰事实层不得先于格局与取用结论给出固定增补方向');
}

// Public Gregorian dates generate the fixtures. The assertions preserve the
// project's current classifications; they are not external expert verdicts.
for (const [name, date, score, yong, adverseSeal] of [
  ['从杀格', [1978, 7, 20, 4, 24], 1, '土', '金'],
  ['从财格', [1993, 9, 13, 16, 1], 1, '金', '木'],
  ['从儿格', [1949, 4, 17, 15, 18], 4, '土', '木'],
  ['假从势格', [1966, 10, 11, 4, 59], 1, '土', '金'],
]) {
  test(`${name}：旺衰说明不能推荐最终已列为忌的印星`, () => {
    const bazi = fromDate(date), strength = E.calcDayMasterStrength(bazi);
    const cong = E.getCongGe(bazi), yongJi = E.getYongJi(bazi);
    assert.equal(cong.isCong, true);
    assert.equal(cong.name, name);
    assert.equal(strength.score, score);
    assert.equal(strength.level, '极弱');
    assert.equal(yongJi.yongShen[0], yong);
    assert.ok(yongJi.jiShen.includes(adverseSeal));
    factsOnly(strength.detail);
    assert.match(strength.detail, /克泄耗力量偏重/);
    const report = E.getProfessionalReportFacts(bazi, 'male');
    assert.equal(report.strength.detail, strength.detail);
    assert.equal(yongJi.evidence.find(item => item.category === '旺衰').detail, strength.detail);
    report.strength.evidence.forEach(item => factsOnly(item.detail));
  });
}

test('专旺仍保留强弱事实，按既定顺势取用且不因说明改动反转', () => {
  const bazi = chart('甲寅 乙卯 甲寅 癸亥');
  const strength = E.calcDayMasterStrength(bazi), following = E.getCongGe(bazi), yongJi = E.getYongJi(bazi);
  assert.equal(strength.score, 100);
  assert.equal(strength.level, '极强');
  assert.equal(following.zhuanWang, true);
  assert.equal(following.name, '曲直仁寿格');
  assert.deepEqual(Array.from(yongJi.xiShen), ['水', '木']);
  assert.deepEqual(Array.from(yongJi.jiShen), ['金', '火', '土']);
  assert.match(strength.detail, /帮扶力量较强/);
  factsOnly(strength.detail);
});

for (const [text, score, level] of [
  ['戊子 己丑 丙戌 己丑', 1, '极弱'],
  ['甲子 戊午 庚辰 癸未', 35, '偏弱'],
  ['甲午 甲申 丙辰 甲午', 51, '中和'],
  ['甲寅 丙寅 甲辰 庚午', 76, '偏强'],
]) {
  test(`普通${level}：保持分数档位和取用读取，只收敛旺衰说明`, () => {
    const bazi = chart(text), strength = E.calcDayMasterStrength(bazi, { audit: true });
    assert.equal(E.getCongGe(bazi).isCong, false);
    assert.equal(strength.score, score);
    assert.equal(strength.level, level);
    assert.equal(strength.audit.sumMatches, true);
    assert.match(strength.detail, new RegExp(level + '（' + score + '分）'));
    factsOnly(strength.detail);
    const yongJi = E.getYongJi(bazi);
    assert.equal(yongJi.dayMasterScore, score);
    assert.equal(yongJi.dayMasterLevel, level);
  });
}

for (const [text, mechanism] of [
  ['戊辰 乙丑 辛巳 甲午', /湿库厚土成势.*金根承载受到厚土制约/],
  ['壬子 癸亥 乙亥 壬子', /木无完整寅卯本气根.*水多木漂/],
  ['丁丑 癸丑 乙丑 癸未', /双印透干并有根.*仍有生扶承载/],
]) {
  test(`${text}：特殊生扶受阻事实保留，具体调候取用留在取用层`, () => {
    const strength = E.calcDayMasterStrength(chart(text));
    assert.match(strength.detail, mechanism);
    factsOnly(strength.detail);
  });
}
