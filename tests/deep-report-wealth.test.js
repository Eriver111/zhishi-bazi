const test = require('node:test');
const assert = require('node:assert/strict');

const DeepReport = require('../js/deep-report.js');

const WU_XING = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土',
  庚: '金', 辛: '金', 壬: '水', 癸: '水',
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

function buildWealthFixture({ strength = '偏弱', wealthRole = '忌神', visibleWealth = 2, congGe = false, patternName = '普通格' } = {}) {
  const bazi = chart({
    year: { gan: visibleWealth > 0 ? '戊' : '甲', zhi: '子' },
    month: { gan: visibleWealth > 1 ? '己' : '乙', zhi: '卯' },
  });
  const core = {
    strength: { level: strength },
    pattern: { name: patternName, congGe },
    congGe,
    yongJi: { yongShen: wealthRole === '用神' ? ['土'] : [], xiShen: [], jiShen: wealthRole === '忌神' ? ['土'] : [] },
    actionChains: [],
    relationEvents: [],
    structuralRisks: [],
  };
  return DeepReport.buildWealthFacts(bazi, core, calculator);
}

test('weak chart with strong Ji wealth reports pressure instead of prosperity', () => {
  const facts = buildWealthFixture({ strength: '偏弱', wealthRole: '忌神', visibleWealth: 2 });
  assert.equal(facts.capacity.state, '承压');
  assert.match(facts.capacity.conclusion, /机会.*压力|承载/);
  assert.doesNotMatch(JSON.stringify(facts), /百万|千万|必发财/);
});

test('CongCai follows frozen CongGe instead of ordinary weak-chart rules', () => {
  const facts = buildWealthFixture({ strength: '极弱', congGe: true, patternName: '从财格', wealthRole: '用神' });
  assert.equal(facts.capacity.method, '从格顺势');
  assert.doesNotMatch(facts.capacity.conclusion, /身弱不担财/);
});

test('storage activation is conditional and names the hidden wealth evidence', () => {
  const storageChart = chart({
    year: { gan: '丙', zhi: '丑' },
    month: { gan: '乙', zhi: '未' },
    day: { gan: '丙', zhi: '午' },
    hour: { gan: '甲', zhi: '子' },
  });
  const storageCore = {
    strength: { level: '中和' },
    pattern: { name: '财格', congGe: false },
    congGe: false,
    yongJi: { yongShen: ['金'], xiShen: [], jiShen: [] },
    actionChains: [],
    relationEvents: [{ type: '丑未冲', pillars: ['year', 'month'] }],
    structuralRisks: [],
  };
  const facts = DeepReport.buildWealthFacts(storageChart, storageCore, calculator);
  assert.equal(facts.storage.present, true);
  assert.match(facts.storage.conclusion, /藏干.*引动|库气.*引动/);
  assert.doesNotMatch(facts.storage.conclusion, /冲开.*发财|必发/);
});

test('wealth occurrences distinguish exposed and hidden stem layers', () => {
  const facts = buildWealthFixture();
  assert.ok(facts.occurrences.some((item) => item.layer === '天干' && item.pillar === 'year'));
  assert.ok(facts.occurrences.some((item) => item.layer === '本气' || item.layer === '中气' || item.layer === '余气'));
  assert.ok(facts.occurrences.every((item) => item.element === '土'));
});
