'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const c = { console, Date, Math }; c.window = c; vm.createContext(c);
for (const file of ['bazi.js', 'bazi-chain.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), c);
function chart(pillars = ['甲子', '丁丑', '癸丑', '己未']) {
  return c.BaZiCalculator.buildFromPillars(Object.fromEntries(['year', 'month', 'day', 'hour'].map((key, i) => [key, {gan:pillars[i][0], zhi:pillars[i][1]}])), 'male');
}
function adjudicate(b, gan, triggers, age = 29) {
  return c.BaZiChain.buildAnnualEventAdjudication(b, {gan:'庚',zhi:'辰'}, {year:2014,gan,zhi:'午'}, {stemRole:'忌神',triggers}, {age});
}
function row(result, domain) { return result.domainRecords.find(r => r.domain === domain); }

test('十个日干的伤官年只进入食伤主题，不因含官字重复算官杀', () => {
  for (const dayGan of '甲乙丙丁戊己庚辛壬癸') {
    const b = chart(); b.day.gan = dayGan;
    const annualGan = Array.from('甲乙丙丁戊己庚辛壬癸').find(g => c.BaZiCalculator.getShiShen(dayGan, g) === '伤官');
    const r = row(adjudicate(b, annualGan, []), 'career');
    assert.equal(r.annualActivationScore, 2, dayGan);
    assert.equal(r.hasIndependentAnnualTrigger, false);
    assert.doesNotMatch(r.evidence.join(''), /职位、规则与责任/);
  }
});

test('正官七杀主题保留，十八至二十三岁的规则压力采用学习场景', () => {
  const b = chart();
  for (const [gan, ss] of [['戊', '正官'], ['己', '七杀']]) {
    const adult = adjudicate(b, gan, []);
    assert.equal(adult.annualShiShen, ss);
    assert.equal(row(adult, 'career').annualActivationScore, 4);
    const student = adjudicate(b, gan, [{type:'伤官见官',isGood:false,detail:'规则冲突'}], 20);
    assert.equal(student.primaryEvent.domain, 'study');
    assert.equal(row(student, 'career').annualStructuralTriggerCount, 0);
  }
});

test('十个日干的劫财年不因财字重复叠加正偏财主题', () => {
  for (const dayGan of '甲乙丙丁戊己庚辛壬癸') {
    const b = chart(); b.day.gan = dayGan;
    const annualGan = Array.from('甲乙丙丁戊己庚辛壬癸').find(g => c.BaZiCalculator.getShiShen(dayGan, g) === '劫财');
    const r = row(adjudicate(b, annualGan, []), 'wealth');
    assert.equal(r.annualActivationScore, 2, dayGan);
    assert.doesNotMatch(r.evidence.join(''), /主要引动收入、资源与资金安排/);
  }
});

test('只有地支重复不能作为独立婚恋应期', () => {
  const r = adjudicate(chart(), '辛', [{type:'地支重复',target:'day',isGood:null,detail:'与日支重复'}]);
  const relationship = row(r, 'relationship');
  assert.equal(relationship.annualStructuralTriggerCount, 0);
  assert.equal(relationship.hasIndependentAnnualTrigger, false);
  assert.equal(c.BaZiChain.rankTimingCandidates([{eventAdjudication:r}], 'relationship').length, 0);
});

test('同一位置的六冲、天克地冲和重复说明只计一项独立证据', () => {
  const base = [{type:'六冲',target:'day',isGood:false,detail:'流年冲日支'}];
  const one = adjudicate(chart(), '辛', base);
  const many = adjudicate(chart(), '辛', [...base, ...base, {type:'天克地冲',target:'day',isGood:false,detail:'流年与日柱天克地冲'}]);
  for (const domain of ['relationship', 'change']) {
    assert.equal(row(many, domain).annualStructuralTriggerCount, 1);
    assert.equal(row(many, domain).activationScore, row(one, domain).activationScore);
  }
  assert.notEqual(row(many, 'relationship').confidence, '高');
});

test('日支合的专名和标准六合不重复增加婚恋权重', () => {
  const standard = row(adjudicate(chart(), '辛', [{type:'六合',target:'day',isGood:null,detail:'流年合日支'}]), 'relationship');
  const named = row(adjudicate(chart(), '辛', [{type:'流年合日支',isGood:null,detail:'流年合日支'}]), 'relationship');
  assert.equal(named.annualActivationScore, standard.annualActivationScore);
  assert.equal(named.annualStructuralTriggerCount, 1);
});

test('跨年候选排名不因同一关系的重复或复合说明加分', () => {
  const b = chart();
  const trigger = {type:'六冲',target:'day',isGood:false,detail:'流年冲日支'};
  const variations = [
    [trigger],
    [trigger, {...trigger}],
    [trigger, {type:'天克地冲',isGood:false,detail:'流年与日柱天克地冲'}],
    [trigger, {...trigger}, {type:'天克地冲',target:'day',isGood:false,detail:'流年与日柱天克地冲'}]
  ];
  const entries = variations.map((triggers, i) => ({eventAdjudication:
    c.BaZiChain.buildAnnualEventAdjudication(b, {gan:'庚',zhi:'辰'}, {year:2014 + i * 60,gan:'辛',zhi:'午'},
      {stemRole:'忌神',triggers,dangerScore:3,opportunityScore:2}, {age:29})
  }));
  for (const entry of entries) {
    assert.equal(entry.eventAdjudication.triggerStrength, 6, '保留上游综合分 3+2，只计一组触发');
    const ranked = c.BaZiChain.rankTimingCandidates([entry], 'relationship');
    assert.equal(ranked[0].score, 8.2);
  }
  const ranked = c.BaZiChain.rankTimingCandidates(entries, 'relationship');
  assert.deepEqual(Array.from(ranked, r => r.year), [2014,2074,2134], '同分保留既定年份顺序，不优先说明更多的年份');
});

test('跨年触发数量保留不同作用位置，同支重临不额外增加独立数量', () => {
  const b = chart();
  const day = {type:'六冲',target:'day',isGood:false,detail:'流年冲日支'};
  const one = adjudicate(b, '辛', [day]);
  const repeated = adjudicate(b, '辛', [day, {type:'地支重复',target:'month',isGood:null,detail:'流年与月支重复'}]);
  const separate = adjudicate(b, '辛', [day, {type:'六冲',target:'year',isGood:false,detail:'流年冲年柱'}]);
  assert.equal(one.triggerStrength, 1);
  assert.equal(repeated.triggerStrength, 1);
  assert.equal(separate.triggerStrength, 2);
});

test('不同柱受冲仍各自保留证据，泛化变动不合计吞并具体领域', () => {
  const one = adjudicate(chart(), '辛', [{type:'六冲',target:'year',isGood:false,detail:'流年冲年柱'}]);
  const many = adjudicate(chart(), '辛', ['year','month','day','hour'].map(target => ({type:'六冲',target,isGood:false,detail:'独立作用位置 '+target})));
  assert.equal(row(many, 'change').annualStructuralTriggerCount, 4);
  assert.equal(row(many, 'change').annualActivationScore, row(one, 'change').annualActivationScore);
  assert.equal(row(many, 'family').annualStructuralTriggerCount, 2);
  assert.ok(['career','relationship','family'].includes(many.primaryEvent.domain));
});

test('有当年触发的婚恋领域优先于高分但无触发的工作背景', () => {
  const r = adjudicate(chart(), '戊', [{type:'六害',target:'day',isGood:false,detail:'日支丑受害'}]);
  assert.equal(r.primaryEvent.domain, 'relationship');
  assert.equal(row(r, 'career').hasIndependentAnnualTrigger, false);
});

test('婚恋与比劫合作分开，不把合作年直接解释成婚年', () => {
  const romance = row(adjudicate(chart(), '甲', [{type:'六害',target:'day',isGood:false,detail:'日支受害'}]), 'relationship');
  assert.deepEqual(Array.from(romance.relationshipScopes), ['marriage']);
  assert.equal(romance.label, '感情婚恋');
  assert.doesNotMatch(romance.eventCandidate, /合作/);
  assert.equal(romance.concreteOutcomeEstablished, false);
  assert.doesNotMatch(romance.eventCandidate, /已.*离婚|一定.*分手/);
  const peers = row(adjudicate(chart(), '壬', [{type:'三合局',targetPositions:['year','month'],formedWx:'水',functionalFamily:'比劫',isGood:false,detail:'补成比劫三合'}]), 'relationship');
  assert.deepEqual(Array.from(peers.relationshipScopes), ['cooperation']);
  assert.equal(peers.label, '同辈合作');
  assert.doesNotMatch(peers.eventCandidate, /婚|恋|伴侣/);
  const ranked=c.BaZiChain.rankTimingCandidates([{eventAdjudication:adjudicate(chart(), '壬', [{type:'三合局',targetPositions:['year','month'],formedWx:'水',functionalFamily:'比劫',isGood:false,detail:'补成比劫三合'}],30)}],'relationship');
  assert.deepEqual(Array.from(ranked[0].relationshipScopes),['cooperation']);
  assert.equal(ranked[0].concreteOutcomeEstablished,false);
});

test('流年六合完整记录非日支位置及大运，不再混用双字与单字映射', () => {
  const b = chart(['庚午','甲申','丙戌','壬辰']);
  const result = c.BaZiChain.analyzeLiuNian(b, {gan:'乙',zhi:'申'}, {gan:'丁',zhi:'巳',year:2037}, c.BaZiCalculator.getYongJi(b), {age:30});
  assert.ok(result.triggers.some(t => t.type === '六合' && t.target === 'month'));
  assert.ok(result.triggers.some(t => t.type === '六合' && t.target === 'dayun'));
  assert.ok(!result.triggers.some(t => t.type === '六合' && t.target === 'year'));
});

test('未成年或未知年龄的日支触发不套用成人婚离场景', () => {
  for (const age of [null, 15, 17]) {
    const r = row(adjudicate(chart(), '甲', [{type:'六害',target:'day',isGood:false,detail:'日支受害'}], age), 'relationship');
    assert.deepEqual(Array.from(r.relationshipScopes), ['personal']);
    assert.doesNotMatch(r.eventCandidate, /伴侣|恋爱|婚姻/);
  }
});

test('十六盘、四流年分数有限，重点应期必须具有当年证据', () => {
  let checked = 0;
  for (const year of [1968,1987,2002,2010]) for (const month of [2,5,8,11]) {
    const b = c.BaZiCalculator.calculate(year, month, 15, 6, 'male', 12);
    const y = c.BaZiCalculator.getYongJi(b);
    for (const pair of ['庚子','甲辰','丙午','戊申']) {
      const result = c.BaZiChain.analyzeLiuNian(b, {gan:'壬',zhi:'子'}, {gan:pair[0],zhi:pair[1],year:2026}, y, {age:30});
      const a = result.eventAdjudication;
      assert.ok(a.domainRecords.every(r => Number.isFinite(r.activationScore)));
      if (a.domainRecords.some(r => r.hasIndependentAnnualTrigger)) assert.equal(a.primaryEvent.hasIndependentAnnualTrigger, true);
      for (const pick of c.BaZiChain.rankTimingCandidates([{eventAdjudication:a}])) assert.equal(pick.hasIndependentAnnualTrigger, true);
      checked++;
    }
  }
  assert.equal(checked, 64);
});
