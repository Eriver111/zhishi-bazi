const test = require('node:test');
const assert = require('node:assert/strict');

const DeepReport = require('../js/deep-report.js');

const WU_XING = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土',
  庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const DI_ZHI_WU_XING = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const CANG_GAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const ROLE = {
  甲甲: '比肩', 甲乙: '劫财', 甲丙: '食神', 甲丁: '伤官', 甲戊: '偏财', 甲己: '正财',
  甲庚: '七杀', 甲辛: '正官', 甲壬: '偏印', 甲癸: '正印',
  丙甲: '偏印', 丙乙: '正印', 丙丙: '比肩', 丙丁: '劫财', 丙戊: '食神', 丙己: '伤官',
  丙庚: '偏财', 丙辛: '正财', 丙壬: '七杀', 丙癸: '正官',
  戊甲: '七杀', 戊乙: '正官', 戊丙: '偏印', 戊丁: '正印', 戊戊: '比肩', 戊己: '劫财',
  戊庚: '食神', 戊辛: '伤官', 戊壬: '偏财', 戊癸: '正财',
};

const calculator = {
  WU_XING,
  DI_ZHI_WU_XING,
  getCangGan: (zhi) => CANG_GAN[zhi] || [],
  getShiShen: (dayGan, gan) => ROLE[dayGan + gan] || '十神未定',
};

function chart(overrides = {}) {
  return {
    year: { gan: '戊', zhi: '子' },
    month: { gan: '己', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '乙', zhi: '午' },
    ...overrides,
  };
}

function core(overrides = {}) {
  return {
    strength: { level: '中和' },
    pattern: { name: '普通格', congGe: false },
    congGe: false,
    yongJi: { yongShen: ['水'], xiShen: [], jiShen: ['金'] },
    relationEvents: [],
    structuralRisks: [],
    ...overrides,
  };
}

test('male uses wealth stars and female uses officer stars', () => {
  const male = DeepReport.buildRelationshipFacts(chart(), 'male', core(), calculator);
  const female = DeepReport.buildRelationshipFacts(chart(), 'female', core(), calculator);

  assert.deepEqual(male.spouseStar.roles, ['正财', '偏财']);
  assert.deepEqual(female.spouseStar.roles, ['正官', '七杀']);
  assert.ok(male.spouseStar.occurrences.some((item) => item.role === '偏财'));
  assert.ok(female.spouseStar.occurrences.every((item) => ['正官', '七杀'].includes(item.role)));
});

test('day branch generating day stem describes partner-side support without claiming love', () => {
  const result = DeepReport.buildRelationshipFacts(chart({ day: { gan: '甲', zhi: '亥' } }), 'female', core(), calculator);

  assert.equal(result.interaction.direction, '夫妻宫生身');
  assert.match(result.interaction.conclusion, /支持|照顾|资源/);
  assert.doesNotMatch(result.interaction.conclusion, /更爱|一定对你好/);
  assert.equal(result.palace.zhi, '亥');
  assert.deepEqual(result.palace.hiddenStems, ['壬', '甲']);
});

test('day stem generating day branch describes the self investment direction', () => {
  const result = DeepReport.buildRelationshipFacts(chart({ day: { gan: '甲', zhi: '午' } }), 'male', core(), calculator);
  assert.equal(result.interaction.direction, '命主生夫妻宫');
  assert.equal(result.interaction.actor, 'self');
});

test('appearance confidence falls when spouse star and palace signals conflict', () => {
  const conflicting = chart({
    year: { gan: '戊', zhi: '子' },
    month: { gan: '己', zhi: '卯' },
    day: { gan: '甲', zhi: '申' },
    hour: { gan: '乙', zhi: '午' },
  });
  const result = DeepReport.buildRelationshipFacts(conflicting, 'male', core(), calculator);

  assert.equal(result.appearance.confidence, 'limited');
  assert.match(result.appearance.conclusion, /特征不集中|复合倾向/);
  assert.doesNotMatch(JSON.stringify(result.appearance), /厘米|瓜子脸|皮肤一定/);
});

test('day palace reuses real structural risk evidence when risk parties mention the day pillar', () => {
  const risk = {
    type: '财印冲',
    parties: '年柱亥（壬水）↔日柱巳（丙火）',
    why: '冲对主气一财一印，涉日支',
    partyEvidence: '年柱亥（壬水·正财）:hiddenMainRoot；日柱巳（丙火·正印）:hiddenMainRoot',
    evidence: 'v2：主气口径不变；补 partyEvidence',
    triggerHint: '若财方进一步增强，财印相冲可能加重。',
  };
  const result = DeepReport.buildRelationshipFacts(chart(), 'male', core({ structuralRisks: [risk] }), calculator);

  assert.deepEqual(result.palace.risks, [risk]);
  assert.match(result.palace.risks[0].parties, /日柱/);
  assert.match(result.palace.risks[0].why, /日支/);
  assert.match(result.palace.risks[0].partyEvidence, /日柱/);
  assert.match(result.palace.risks[0].evidence, /partyEvidence/);
  assert.match(result.palace.risks[0].triggerHint, /可能/);
});

test('conflicting palace and spouse styles stay limited even when their yongJi roles match', () => {
  const result = DeepReport.buildRelationshipFacts(
    chart(),
    'male',
    core({ yongJi: { yongShen: ['木', '土'], xiShen: [], jiShen: [] } }),
    calculator,
  );

  assert.equal(result.appearance.confidence, 'limited');
  assert.equal(result.appearance.evidence.filter((signal) => signal.source === '喜忌同向').length, 0);
});

test('missing spouse star keeps appearance as a low-confidence palace archetype', () => {
  const result = DeepReport.buildRelationshipFacts(chart(), 'female', core(), calculator);
  assert.equal(result.spouseStar.occurrences.length, 0);
  assert.equal(result.appearance.confidence, 'limited');
  assert.match(result.appearance.conclusion, /特征不集中|倾向参考/);
});

test('position and age are evidence-weighted tendencies rather than fixed claims', () => {
  const result = DeepReport.buildRelationshipFacts(chart(), 'male', core(), calculator);

  assert.ok(result.spouseStar.occurrences.every((item) => item.positionTendency));
  assert.ok(['older_tendency', 'similar_tendency', 'younger_tendency', 'unclear'].includes(result.age.tendency));
  assert.ok(['outside_or_early', 'work_or_local', 'close_circle', 'later_or_distant', 'unclear'].includes(result.distance.tendency));
  assert.strictEqual(result.age, result.ageTendency);
  assert.doesNotMatch(JSON.stringify(result), /必婚|必离|相差\d+岁|克夫|克妻/);
});
