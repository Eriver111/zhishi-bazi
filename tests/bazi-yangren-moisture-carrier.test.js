const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/bazi.js'), 'utf8'), context);
const E = context.window.BaZiCalculator;
function chart(text) {
  return E.buildFromPillars(Object.fromEntries(text.split(' ').map((s, i) =>
    [['year', 'month', 'day', 'hour'][i], { gan: s[0], zhi: s[1] }])), 'female');
}
function water(yong) { return yong.elementRoleLedger.entries.find(x => x.element === '水'); }

test('五阴干帝旺不立羊刃格，也不生成制刃路线', () => {
  for (const [day, month] of [['乙酉','甲寅'],['丁酉','乙巳'],['己酉','乙巳'],['辛卯','戊申'],['癸巳','辛亥']]) {
    const b = chart(`壬午 ${month} ${day} 戊午`);
    assert.equal(E.getChangSheng(b.day.gan)[b.month.zhi].stage, '帝旺');
    for (const p of [E.getPattern(b), E.getYongJi(b).resolvedPattern]) {
      assert.notEqual(p.name, '羊刃格');
      assert.ok(!(p.establishConditions || []).some(x => x.condition === '官杀制刃'));
    }
  }
});

test('五阳干真刃位仍可立羊刃格，阴干临官仍可建禄', () => {
  for (const [day, month] of [['甲辰','丁卯'],['丙辰','丙午'],['戊辰','丙午'],['庚辰','辛酉'],['壬辰','壬子']]) {
    const b = chart(`辛丑 ${month} ${day} 庚申`);
    assert.equal(E.getPattern(b).name, '羊刃格', `${day}/${month}`);
  }
  const b = chart('辛丑 壬子 癸巳 戊午');
  assert.equal(E.getPattern(b).name, '建禄格');
});

test('申月双戌丙火可有润燥需求而无降温需求，藏壬不能直接算已润', () => {
  const b = chart('丙戌 丙申 丙申 戊戌'), cl = E.getClimateState(b), y = E.getYongJi(b);
  assert.equal(cl.needsCooling, false);
  assert.equal(cl.needsMoisture, true);
  assert.equal(cl.waterSeed, true);
  assert.equal(cl.moistureStatus, '有水但润局未足');
  assert.match(cl.moistureEvidence, /藏水/);
  assert.deepEqual(y.climateState, cl);
  assert.ok(y.tiaoHouYongShen.includes('水'));
  assert.ok(y.dualRoleElements.includes('水'));
  assert.equal(y.yongShen[0], '木', '登记调候任务不等于用水替换结构用神');
  assert.equal(water(y).fortuneLevel, '中性双向');
});

test('燥土识别有跨月正例与无火、单燥土、已有水支及湿土反例', () => {
  for (const text of ['丙戌 丁酉 丙午 戊戌', '丁未 戊申 丁酉 戊戌']) {
    const cl = E.getClimateState(chart(text));
    assert.equal(cl.drySoilUnrelieved, true, text);
    assert.equal(cl.needsMoisture, true);
  }
  for (const text of ['庚戌 戊申 庚申 戊戌', '丙戌 丙申 丙申 戊辰', '丙戌 丙申 丙子 戊戌', '丙戌 壬申 丙申 戊戌']) {
    assert.equal(E.getClimateState(chart(text)).drySoilUnrelieved, false, text);
  }
  assert.equal(E.getClimateState(chart('甲子 辛未 丙寅 甲子')).needsMoisture, false, '已有水势制衡不能机械续补');
});

test('弱财格不再同时判比劫夺财与承财已足，强比劫风险仍保留', () => {
  const b = chart('丙戌 丙申 丙申 戊戌'), p = E.getPattern(b);
  assert.equal(E.calcDayMasterStrength(b).level, '偏弱');
  assert.ok(!p.breakReasons.includes('比劫过重，财星受夺'));
  for (const name of ['日主有承载格局之力', '日主能担财']) {
    const c = p.establishConditions.find(x => x.condition === name);
    assert.equal(c.met, false);
    assert.equal(c.category, 'QUALITY');
  }
  const strong = chart('甲寅 己未 甲寅 甲子');
  const sp = E.getPattern(strong);
  assert.equal(sp.name, '正财格');
  assert.equal(E.calcDayMasterStrength(strong).level, '偏强');
  assert.ok(sp.breakReasons.includes('比劫过重，财星受夺'));
  for (const text of ['壬子 己巳 壬午 癸酉', '癸未 戊午 乙卯 丙戌']) {
    const b = chart(text), p = E.getPattern(b);
    assert.equal(E.calcDayMasterStrength(b).level, '偏弱');
    const bearing = p.establishConditions.find(c => /^日主能担财/.test(c.condition));
    assert.equal(bearing.met, false);
    assert.equal(bearing.category, 'QUALITY');
    assert.equal(p.status, text.startsWith('癸未') ? '条件待定' : '成格', '承载不足不硬破；戊癸合化另限制生财通路');
    assert.equal(p.breakReasons.length, 0);
  }
});

test('水干区分正官七杀与制合，水支有逐支风险而非预设支水为喜', () => {
  const y = E.getYongJi(chart('丙戌 丙申 丙申 戊戌')), w = water(y), g = w.carrierGuidance;
  assert.equal(g.branchAutoFavorable, false);
  assert.equal(g.stemPriority, false);
  assert.match(g.symbolReviews['壬'], /壬为七杀.*戊透出/);
  assert.match(g.symbolReviews['癸'], /癸为正官.*戊癸合/);
  assert.match(g.symbolReviews['子'], /申子半合/);
  assert.match(g.symbolReviews['亥'], /申亥害/);
  assert.match(g.symbolReviews['辰'], /辰戌冲/);
  assert.ok(w.conditions.some(s => /原局无木/.test(s)));
  const ding = water(E.getYongJi(chart('丁未 戊申 丁酉 戊戌'))).carrierGuidance;
  assert.match(ding.symbolReviews['壬'], /壬为正官/);
  assert.match(ding.symbolReviews['癸'], /癸为七杀/);
  const complete = water(E.getYongJi(chart('丙申 甲午 丙辰 戊戌'))).carrierGuidance;
  assert.match(complete.symbolReviews['子'], /申子辰三支齐备/);
  assert.doesNotMatch(complete.symbolReviews['子'], /申子半合/);
});

test('具体岁运载体不再因水透干或落支直接叠加吉凶分', () => {
  const y = E.getYongJi(chart('丙戌 丙申 丙申 戊戌'));
  for (const [type, symbol] of [['stem','壬'],['stem','癸'],['branch','子'],['branch','亥']]) {
    const r = E.classifyFortuneElement('水', y, '测试', { type, symbol });
    assert.equal(r.carrierAdjustment, 0);
    assert.equal(r.carrierStatus, '调候与克泄并审');
    assert.equal(r.score, r.baseScore);
    assert.match(r.carrierReason, new RegExp(symbol));
  }
});

test('AI上下文与报告事实保留独立润燥需求和水的载体条件', () => {
  const b = chart('丙戌 丙申 丙申 戊戌'), y = E.getYongJi(b);
  const facts = E.getProfessionalReportFacts(b, 'female');
  assert.equal(facts.yongJi.climateState.needsMoisture, true);
  const api = require('../api/ai-chat.js')._test;
  const text = api.buildChartContext({ dayMasterStrength: E.calcDayMasterStrength(b), pattern: y.resolvedPattern, yongJi: y });
  assert.match(text, /需暖=否，需润=是/);
  assert.match(text, /戊癸合/);
  assert.match(text, /申子半合/);
  assert.doesNotMatch(text, /水势=润局已到位/);
});
