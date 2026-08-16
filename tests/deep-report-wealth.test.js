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

function storageCore(yongJi = { yongShen: [], xiShen: [], jiShen: [] }) {
  return {
    strength: { level: '中和' },
    pattern: { name: '普通格', congGe: false },
    congGe: false,
    yongJi,
    actionChains: [],
    relationEvents: [],
    structuralRisks: [],
  };
}

function storageFixture(storageRoleKey, overrides = {}) {
  return {
    storageRoleKey,
    elementRole: '平神',
    activated: true,
    wealthConnection: false,
    ...overrides,
  };
}

test('every storage is classified by fixed element and keeps every hidden Ten-God role', () => {
  const chartWithFourStorages = chart({
    year: { gan: '戊', zhi: '辰' },
    month: { gan: '辛', zhi: '戌' },
    day: { gan: '甲', zhi: '未' },
    hour: { gan: '己', zhi: '丑' },
  });
  const facts = DeepReport.buildWealthFacts(chartWithFourStorages, storageCore(), calculator);
  assert.deepEqual(
    facts.storage.storages.map(row => row.storageRoleKey).sort(),
    ['officer', 'output', 'resource', 'peer'].sort()
  );
  assert.ok(facts.storage.storages.every(row => row.hiddenRoles.length > 0));
  assert.deepEqual(
    facts.storage.storages.map(row => row.fixedElement).sort(),
    ['金', '木', '水', '火'].sort()
  );
  assert.ok(facts.storage.storages.every(row => row.hiddenRoles.every(hidden => hidden.role !== '十神未定')));
});

test('same-element storage is classified as peer storage for a matching day master', () => {
  const peerStorageChart = chart({
    year: { gan: '戊', zhi: '戌' },
    month: { gan: '乙', zhi: '卯' },
    day: { gan: '丙', zhi: '午' },
    hour: { gan: '甲', zhi: '子' },
  });
  const facts = DeepReport.buildWealthFacts(peerStorageChart, storageCore(), calculator);
  assert.ok(facts.storage.storages.some(row => row.storageRoleKey === 'peer'));
});

test('useful resource output and officer storage do not claim income without a wealth connection', () => {
  for (const key of ['resource', 'output', 'officer']) {
    const row = storageFixture(key, { elementRole: '用神', wealthConnection: false });
    assert.doesNotMatch(DeepReport.__test.storageOutcome(row), /收入增加|直接赚钱|发财/);
  }
});

test('useful peer storage requires a peer-output-wealth path before claiming team-amplified income', () => {
  assert.match(DeepReport.__test.storageOutcome(storageFixture('peer', { elementRole: '喜神', wealthConnection: true })), /团队|伙伴|圈层/);
  assert.doesNotMatch(DeepReport.__test.storageOutcome(storageFixture('peer', { elementRole: '喜神', wealthConnection: false })), /带来收入/);
});

test('wealth occurrences distinguish exposed and hidden stem layers', () => {
  const facts = buildWealthFixture();
  assert.ok(facts.occurrences.some((item) => item.layer === '天干' && item.pillar === 'year'));
  assert.ok(facts.occurrences.some((item) => item.layer === '本气' || item.layer === '中气' || item.layer === '余气'));
  assert.ok(facts.occurrences.every((item) => item.element === '土'));
});

test('伤官见官 alone is not a 食伤生财 pathway', () => {
  const facts = DeepReport.buildWealthFacts(chart(), {
    strength: { level: '中和' },
    pattern: { name: '普通格' },
    yongJi: { yongShen: [], xiShen: [], jiShen: [] },
    actionChains: ['伤官见官'],
    relationEvents: [],
    structuralRisks: [],
  }, calculator);
  assert.equal(facts.pathways.some((path) => path.type === '食伤生财'), false);
});

test('财破印 or 财坏印 never emits the positive 财配印 pathway', () => {
  for (const riskType of ['财破印', '财坏印']) {
    const facts = DeepReport.buildWealthFacts(chart(), {
      strength: { level: '中和' },
      pattern: { name: '普通格' },
      yongJi: { yongShen: [], xiShen: [], jiShen: [] },
      actionChains: [],
      relationEvents: [],
      structuralRisks: [{ type: riskType, why: `${riskType}结构成立` }],
    }, calculator);
    assert.equal(facts.pathways.some(path => path.type === '财配印'), false, riskType);
    assert.equal(facts.pathways.some(path => path.type === '财破印'), true, riskType);
  }
});

test('财党杀 never emits the positive 财生官 pathway', () => {
  const facts = DeepReport.buildWealthFacts(chart(), {
    strength: { level: '中和' },
    pattern: { name: '普通格' },
    yongJi: { yongShen: [], xiShen: [], jiShen: [] },
    actionChains: [],
    relationEvents: [],
    structuralRisks: [{ type: '财党杀', why: '财星加强七杀压力' }],
  }, calculator);
  assert.equal(facts.pathways.some(path => path.type === '财生官'), false);
  assert.equal(facts.pathways.some(path => path.type === '财党杀'), true);
});

test('wealth quality exposes evidence-backed season root source and relation fields without a score', () => {
  const facts = buildWealthFixture({ strength: '中和', wealthRole: '用神', visibleWealth: 2 });
  assert.ok(facts.resource.quality);
  assert.ok(facts.resource.quality.season);
  assert.ok(facts.resource.quality.roots.length > 0);
  assert.ok(facts.resource.quality.sources.length > 0);
  assert.ok(Array.isArray(facts.resource.quality.restraints));
  assert.ok(Array.isArray(facts.resource.quality.relationships));
  assert.equal(Object.prototype.hasOwnProperty.call(facts.resource.quality, 'score'), false);
});

test('weak body with effective seal or peer support reports mitigation before pure pressure', () => {
  const facts = DeepReport.buildWealthFacts(chart(), {
    strength: { level: '偏弱' },
    pattern: { name: '普通格', congGe: false },
    congGe: false,
    yongJi: { yongShen: ['水'], xiShen: ['木'], jiShen: ['土'] },
    actionChains: [],
    relationEvents: [],
    structuralRisks: [],
  }, calculator);
  assert.equal(facts.capacity.state, '有缓解');
  assert.equal(facts.capacity.support.effective, true);
  assert.match(facts.capacity.conclusion, /印|比|支持|缓解/);
  assert.doesNotMatch(facts.capacity.conclusion, /纯粹|完全无法承载/);
});

function supportFacts(bazi, { yongShen = ['水', '木'], actionChains = [], relationEvents = [] } = {}) {
  return DeepReport.buildWealthFacts(bazi, {
    strength: { level: '偏弱' },
    pattern: { name: '普通格', congGe: false },
    congGe: false,
    yongJi: { yongShen, xiShen: [], jiShen: ['土'] },
    actionChains,
    relationEvents,
    structuralRisks: [],
  }, calculator);
}

test('one middle or remaining hidden seal or peer is limited support only', () => {
  const facts = supportFacts(chart({
    year: { gan: '戊', zhi: '丑' },
    month: { gan: '己', zhi: '午' },
    day: { gan: '甲', zhi: '巳' },
    hour: { gan: '庚', zhi: '酉' },
  }), { yongShen: ['水'] });
  assert.equal(facts.capacity.support.effective, false);
  assert.equal(facts.capacity.support.limited, true);
  assert.equal(facts.capacity.state, '承压');
  assert.match(facts.capacity.conclusion, /仅部分缓解承载压力/);
});

test('exposed, main-qi, two-distinct-hidden, and authoritative-chain support each qualify', async (t) => {
  const base = {
    year: { gan: '戊', zhi: '午' },
    month: { gan: '己', zhi: '午' },
    day: { gan: '甲', zhi: '巳' },
    hour: { gan: '庚', zhi: '酉' },
  };
  const cases = [
    ['exposed', chart({ ...base, hour: { gan: '壬', zhi: '酉' } }), {}],
    ['main-qi', chart({ ...base, year: { gan: '戊', zhi: '子' } }), {}],
    ['two-distinct-hidden', chart({ ...base, year: { gan: '戊', zhi: '丑' }, month: { gan: '己', zhi: '辰' } }), {}],
    ['authoritative-chain', chart(base), { actionChains: [{ type: '印星生身', detail: '印星明确生身并提供承载支持' }] }],
  ];
  for (const [name, bazi, options] of cases) {
    await t.test(name, () => {
      const facts = supportFacts(bazi, options);
      assert.equal(facts.capacity.support.effective, true);
      assert.equal(facts.capacity.state, '有缓解');
    });
  }
});
