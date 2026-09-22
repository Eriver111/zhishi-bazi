const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { analyze, helpers } = require('../js/hepan-core.js');
const builder = require('../js/hepan-person.js');

const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const elements = [...'木火土金水'];
function person(name, pairs, options = {}) {
  const pillars = pairs.map(pair => ({ gan: pair[0], zhi: pair[1], cangGan: [] }));
  return { name, gender: options.gender || 'female', pillars, dayGan: pillars[2].gan,
    dayZhi: pillars[2].zhi, shenSha: [],
    wuxing: { 木: 2, 火: 2, 土: 2, 金: 2, 水: 2, ...options.wuxing },
    _professionalFacts: {
      strength: { level: options.level || '中和', score: options.score || 50 },
      yongJi: { xiShen: options.xi || ['木'], yongShen: options.yong || ['木'], jiShen: options.ji || ['金'] }
    } };
}
const aPillars = ['甲子', '丙寅', '戊辰', '庚午'];
const bPillars = ['己午', '辛酉', '癸亥', '乙卯'];
const canonical = item => [item.type, [item.pillar1, item.pillar2].sort().join('|')].join(':');

test('two branches never assert a complete three-branch formation', () => {
  const groups = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  for (const group of groups) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const expected = i === 1 || j === 1 ? '半合' : '拱合';
      assert.equal(helpers.zhiRelationType(group[i], group[j]), expected);
      const p1 = person('甲', ['甲子', '乙丑', '丙' + group[i], '丁卯']);
      const p2 = person('乙', ['戊辰', '己巳', '庚' + group[j], '辛未']);
      const relation = helpers.analyzeDailyRelation(p1, p2);
      assert.equal(relation.zhiRelation, expected);
      assert.match(relation.zhiDesc, /不能/);
      assert.doesNotMatch(relation.zhiDesc, /力量很强|日支三合是一种/);
    }
  }
});

test('all stem and branch pair relations preserve direction when exchanged', () => {
  const invert = { 生: '被生', 被生: '生', 克: '被克', 被克: '克' };
  for (const [values, fn] of [[stems, helpers.ganRelationType], [branches, helpers.zhiRelationType]]) {
    for (const a of values) for (const b of values) {
      const relation = fn(a, b);
      assert.equal(fn(b, a), invert[relation] || relation, a + '/' + b);
      assert.notEqual(relation, '三合');
    }
  }
});

test('stem union does not delete the branch clash of the same pillar pair', () => {
  const p1 = person('甲方', aPillars), p2 = person('乙方', bPillars);
  const result = helpers.analyzeCrossPillars(p1, p2);
  const pair = result.filter(item => item.pillar1 === '甲方的年柱(甲子)' && item.pillar2 === '乙方的年柱(己午)');
  assert.deepEqual(pair.map(item => item.type).sort(), ['冲', '合']);
  assert.ok(result.length > 8, 'full evidence must not be cut to the first eight favorable items');
  assert.deepEqual(result.map(canonical).sort(), helpers.analyzeCrossPillars(p2, p1).map(canonical).sort());
});

test('identical names do not merge different cross-person pillar pairs', () => {
  const both = ['甲子', '己丑', '丙寅', '辛卯'];
  const distinct = helpers.analyzeCrossPillars(person('甲', both), person('乙', both));
  const same = helpers.analyzeCrossPillars(person('同名', both), person('同名', both));
  assert.equal(same.length, distinct.length);
  assert.deepEqual(same.map(x => x.type).sort(), distinct.map(x => x.type).sort());
});

test('an absent unfavorable element does not earn complement credit', () => {
  for (const wx of elements) {
    const p1 = person('甲', aPillars, { wuxing: { [wx]: 0 }, xi: [wx], yong: [wx], ji: [wx] });
    const p2 = person('乙', bPillars);
    const excluded = helpers.analyzeWuxingComplement(p1, p2);
    assert.equal(excluded.complementPairs.length, 0, wx + ' must be excluded by frozen unfavorable facts');
    assert.doesNotMatch(excluded.detail, /刚好补上|天生的好搭档/);
    p1._professionalFacts.yongJi.jiShen = [];
    const favorable = helpers.analyzeWuxingComplement(p1, p2);
    assert.equal(favorable.complementPairs.length, 1);
    assert.ok(favorable.complementScore > excluded.complementScore);
  }
});

test('shared unfavorable elements never become supplementation advice', () => {
  for (const wx of elements) {
    const p1 = person('甲', aPillars, { xi: [], yong: [], ji: [wx], wuxing: { [wx]: 0 } });
    const p2 = person('乙', bPillars, { xi: [], yong: [], ji: [wx], wuxing: { [wx]: 0 } });
    const advice = helpers.generateDosAndDonts(p1, p2, '朋友');
    assert.doesNotMatch(advice.dos.join(' '), /共忌|不足，需有意识补充|需主动平衡/);
    assert.ok(advice.donts.some(text => text.includes(wx + '为共忌')));
  }
});

test('yearly evidence keeps a union on one side and a clash on the other', () => {
  const year = new Date().getFullYear();
  const yz = branches[(year - 4) % 12];
  const union = { 子:'丑', 丑:'子', 寅:'亥', 卯:'戌', 辰:'酉', 巳:'申', 午:'未', 未:'午', 申:'巳', 酉:'辰', 戌:'卯', 亥:'寅' };
  const clash = branches[(branches.indexOf(yz) + 6) % 12];
  const p1 = person('一方', ['甲子', '乙丑', '丙' + union[yz], '丁卯']);
  const p2 = person('另一方', ['戊辰', '己巳', '庚' + clash, '辛未']);
  const forward = helpers.generateYearlyAdvice(p1, p2, '夫妻')[0];
  const reverse = helpers.generateYearlyAdvice(p2, p1, '夫妻')[0];
  assert.deepEqual(forward.interactions.map(x => x.zhiRelation), ['六合', '六冲']);
  assert.match(forward.advice, /六合/);
  assert.match(forward.advice, /六冲/);
  assert.doesNotMatch(forward.advice, /适合订婚|感情运势上升/);
  const byName = record => record.interactions.map(({ personId, ...facts }) => facts).sort((a,b) => a.name.localeCompare(b.name));
  assert.deepEqual(byName(forward), byName(reverse));
});

test('horse-star advice consumes individual facts instead of any traveling branch', () => {
  const p1 = person('甲', ['甲寅', '甲寅', '甲寅', '甲寅'], { xi: [], yong: [], ji: [] });
  const p2 = person('乙', ['丙辰', '丙辰', '丙辰', '丙辰'], { xi: [], yong: [], ji: [] });
  assert.doesNotMatch(helpers.generateDosAndDonts(p1, p2, '朋友').dos.join(' '), /驿马/);
  p1.shenSha = ['驿马'];
  const advice = helpers.generateDosAndDonts(p1, p2, '朋友').dos.join(' ');
  assert.match(advice, /甲的个人排盘记录有驿马/);
  assert.doesNotMatch(advice, /乙的个人排盘记录有驿马/);
});

test('retained unions and clashes do not turn into guaranteed life outcomes', () => {
  for (const [a, b] of [['甲寅', '丙午'], ['甲子', '己午']]) {
    const p1 = person('甲', Array(4).fill(a), { xi: [], yong: [], ji: [] });
    const p2 = person('乙', Array(4).fill(b), { xi: [], yong: [], ji: [] });
    const advice = helpers.generateDosAndDonts(p1, p2, '朋友');
    assert.doesNotMatch(advice.dos.join(' ') + advice.donts.join(' '), /天生合得来|效果好，适合共同创业|化解冲的能量|距离远了容易生变/);
  }
});

test('synthetic chart exchanges preserve score, evidence and personal useful gods', () => {
  let seed = 20260922;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const fixture = name => {
    const pairs = Array.from({ length: 4 }, () => {
      const n = random(60); return stems[n % 10] + branches[n % 12];
    });
    const xi = elements[random(5)];
    return person(name, pairs, { xi: [xi], yong: [xi], ji: elements.filter(x => x !== xi), score: 1 + random(99) });
  };
  for (let i = 0; i < 240; i++) {
    const p1 = fixture('甲'), p2 = fixture('乙');
    const before = JSON.stringify([p1, p2]);
    for (const relation of ['夫妻', '情侣', '朋友']) {
      const ab = analyze(p1, p2, relation), ba = analyze(p2, p1, relation);
      assert.equal(ab.score.total, ba.score.total, 'exchange must not change score');
      assert.deepEqual(ab.xiyong.p1, ba.xiyong.p2);
      assert.deepEqual(ab.xiyong.p2, ba.xiyong.p1);
      assert.equal(ab.wuxingComplement.complementScore, ba.wuxingComplement.complementScore);
      assert.deepEqual(ab.crossPillars.map(canonical).sort(), ba.crossPillars.map(canonical).sort());
      assert.ok(Number.isFinite(ab.score.total) && ab.score.total >= 0 && ab.score.total <= 100);
    }
    assert.equal(JSON.stringify([p1, p2]), before, 'analysis must not overwrite personal frozen facts');
  }
});

test('eighty synthetic birth pairs preserve calculator facts across exchange', () => {
  const context = { window: {}, console, Date, Math };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/bazi.js'), 'utf8'), context);
  const calculator = context.window.BaZiCalculator;
  function fromBirth(index, name) {
    const clock = index % 24;
    return builder.buildPerson(name, { year: 1940 + index % 85, month: 1 + index % 12,
      day: 1 + (index * 11) % 28, clock, hour: Math.floor((clock + 1) % 24 / 2), minute: index % 60,
      gender: index % 2 ? 'male' : 'female', prov: '', city: '', dist: '',
      trueSolarTime: false, ziHourNextDay: index % 3 === 0 }, calculator);
  }
  for (let index = 0; index < 80; index++) {
    const p1 = fromBirth(index, '甲'), p2 = fromBirth(index + 139, '乙');
    const frozen = JSON.stringify([p1._professionalFacts, p2._professionalFacts, p1._daYunData, p2._daYunData]);
    const ab = analyze(p1, p2, '夫妻'), ba = analyze(p2, p1, '夫妻');
    assert.equal(ab.score.total, ba.score.total);
    assert.deepEqual(ab.xiyong.p1, ba.xiyong.p2);
    assert.deepEqual(ab.xiyong.p2, ba.xiyong.p1);
    assert.equal(ab.dayGanStrength.p1Strength.level, p1._professionalFacts.strength.level);
    assert.equal(ab.dayGanStrength.p2Strength.score, p2._professionalFacts.strength.score);
    assert.equal(JSON.stringify([p1._professionalFacts, p2._professionalFacts, p1._daYunData, p2._daYunData]), frozen);
  }
});
