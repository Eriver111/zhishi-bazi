const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DeepReport = require('../js/deep-report.js');

function loadRealWealthDeps() {
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ['bazi.js', 'structural.js', 'bazi-chain.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
  }
  return {
    calculator: context.window.BaZiCalculator,
    structural: context.window.StructuralAnalysis,
    chain: context.window.BaZiChain,
  };
}

function buildRealWealthFacts(pillars) {
  const deps = loadRealWealthDeps();
  const chars = [...pillars.replace(/\s+/g, '')];
  const bazi = deps.calculator.buildFromPillars({
    year: { gan: chars[0], zhi: chars[1] },
    month: { gan: chars[2], zhi: chars[3] },
    day: { gan: chars[4], zhi: chars[5] },
    hour: { gan: chars[6], zhi: chars[7] },
  }, 'male', null);
  return DeepReport.buildFacts(bazi, 'male', { anchorYear: 2026, deps });
}

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

test('a wealth storage needs a recognized wealth pathway before it is connected', () => {
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '己', zhi: '丑' },
    month: { gan: '甲', zhi: '卯' },
    day: { gan: '丙', zhi: '午' },
    hour: { gan: '乙', zhi: '巳' },
  }), storageCore({ yongShen: ['金'], xiShen: [], jiShen: [] }), calculator);
  const wealthStorage = facts.storage.storages.find(row => row.storageRoleKey === 'wealth');
  assert.equal(wealthStorage.wealthConnection, false);
  assert.match(wealthStorage.outcomeKey, /disconnected$/);
});

test('a recognized food-harms-wealth path connects a useful output storage', () => {
  const core = storageCore({ yongShen: ['火'], xiShen: [], jiShen: [] });
  core.actionChains = ['食伤生财'];
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '戊', zhi: '戌' },
    month: { gan: '乙', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '丙', zhi: '午' },
  }), core, calculator);
  assert.ok(facts.pathways.some(path => path.type === '食伤生财'));
  assert.equal(facts.storage.storages.find(row => row.storageRoleKey === 'output').wealthConnection, true);
});

test('an explicit peer-to-output-to-wealth path is retained and connects a useful peer storage', () => {
  const core = storageCore({ yongShen: ['木'], xiShen: [], jiShen: [] });
  core.actionChains = ['比劫生食伤生财'];
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '己', zhi: '未' },
    month: { gan: '乙', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '丙', zhi: '午' },
  }), core, calculator);
  assert.ok(facts.pathways.some(path => path.type === '比劫生食伤生财'));
  assert.equal(facts.storage.storages.find(row => row.storageRoleKey === 'peer').wealthConnection, true);
});

test('wealth storage outcomes distinguish connected and disconnected wealth paths', () => {
  const disconnected = DeepReport.__test.storageOutcome(storageFixture('wealth', { elementRole: '用神', wealthConnection: false }));
  const connected = DeepReport.__test.storageOutcome(storageFixture('wealth', { elementRole: '用神', wealthConnection: true }));
  assert.match(disconnected, /尚未见.*财富路径/);
  assert.match(connected, /已接入.*财富路径/);
  assert.notEqual(connected, disconnected);
});

test('inactive and adverse storage outcomes remain specific to each Ten-God role', () => {
  const roleTerms = {
    peer: /协作|伙伴/,
    resource: /学习|资质/,
    output: /技能|表达/,
    wealth: /资金|资产/,
    officer: /责任|规则/,
  };
  for (const [key, term] of Object.entries(roleTerms)) {
    assert.match(DeepReport.__test.storageOutcome(storageFixture(key, { elementRole: '用神', activated: false })), term, key + ' inactive');
    assert.match(DeepReport.__test.storageOutcome(storageFixture(key, { elementRole: '忌神', activated: true })), term, key + ' adverse');
  }
});

test('storage activation retains the exact relation or action-chain evidence that matched', () => {
  const relation = { type: '丑未冲', pillars: ['year', 'month'] };
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '己', zhi: '丑' },
    month: { gan: '乙', zhi: '未' },
    day: { gan: '丙', zhi: '午' },
    hour: { gan: '甲', zhi: '子' },
  }), { ...storageCore(), relationEvents: [relation] }, calculator);
  assert.deepEqual(facts.storage.storages.find(row => row.zhi === '丑').activationEvidence, [relation]);
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

test('wealth direction lists Yong first and Xi second without requiring a wealth path', () => {
  const direction = DeepReport.__test.deriveWealthDirection({
    yongJi: { yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] },
    pathElements: ['木', '火'],
  });
  assert.deepEqual(direction, {
    element: '木', elements: ['木', '水'], primary: ['木'], secondary: ['水'],
    directions: ['东方', '东南', '北方'], confidence: 'strong', conflict: false,
  });
});

test('strong exposed output feeding rooted wealth and an activated wealth storage can reach A10', () => {
  const deps = loadRealWealthDeps();
  const bazi = deps.calculator.buildFromPillars({
    year: { gan: '辛', zhi: '丑' },
    month: { gan: '乙', zhi: '未' },
    day: { gan: '丙', zhi: '寅' },
    hour: { gan: '戊', zhi: '戌' },
  }, 'male', null);
  const facts = DeepReport.buildFacts(bazi, 'male', { anchorYear: 2026, deps });
  const wealthStorage = facts.wealth.storage.storages.find((row) => row.storageRoleKey === 'wealth');

  assert.ok(facts.wealth.pathways.some((row) => row.type === '食伤生财' && row.scalePotential === true));
  assert.ok(facts.wealth.pathways.some((row) => row.type === '食伤生财' && row.effect === 'adverse'));
  assert.equal(wealthStorage.zhi, '丑');
  assert.equal(wealthStorage.activated, true);
  assert.equal(wealthStorage.wealthConnection, true);
  assert.equal(facts.wealth.narrative.grade, 'A10');
  assert.match(facts.wealth.narrative.headline + facts.wealth.narrative.painPoint, /挣钱|财富|漏财|投资/);
});

test('month-command output feeding deeply rooted hidden wealth through a wealth combine can reach A10', () => {
  const facts = buildRealWealthFacts('丙寅 己亥 庚申 庚辰');
  const pathway = facts.wealth.pathways.find((row) => row.type === '食伤生财');

  assert.ok(pathway);
  assert.equal(pathway.positive, true);
  assert.equal(pathway.confidence, 'strong');
  assert.match(pathway.evidence.join(' '), /亥|食神|财星.*根|寅亥|合.*木/);
  assert.equal(facts.wealth.narrative.grade, 'A10');
});

test('a large adverse wealth field is graded for scale but remains below A10 when the weak chart only has relief', () => {
  const facts = buildRealWealthFacts('戊寅 甲子 辛卯 辛卯');
  const pathway = facts.wealth.pathways.find((row) => row.type === '食伤生财');

  assert.ok(pathway);
  assert.equal(pathway.positive, false);
  assert.equal(pathway.effect, 'adverse');
  assert.ok(facts.wealth.pathways.some((row) => row.type === '合会引财'));
  assert.equal(facts.wealth.narrative.grade, 'A9');
  assert.match(facts.wealth.narrative.verdicts[1].outcomeText, /技能|产品|项目|内容|客户/);
  assert.match(facts.wealth.narrative.verdicts[2].outcomeText, /财来财去|不容易.*留|压力/);
});

test('extremely weak charts do not gain wealth rank from adverse wealth-to-officer flow', () => {
  const facts = buildRealWealthFacts('甲戌 乙亥 戊申 壬子');
  const pathway = facts.wealth.pathways.find((row) => row.type === '财生官');

  assert.ok(pathway);
  assert.equal(pathway.positive, false);
  assert.equal(pathway.effect, 'adverse');
  assert.equal(facts.wealth.narrative.grade, 'A5');
  assert.match(facts.wealth.narrative.verdicts[0].outcomeText, /压力|负担|难.*留下|事情.*多/);
  assert.doesNotMatch(facts.wealth.narrative.verdicts[1].outcomeText, /放大财富|职位.*收入.*放大/);
});

test('wealth-breaks-seal copy does not invent partnership loss or failed investment', () => {
  const facts = buildRealWealthFacts('戊辰 癸亥 乙未 戊寅');
  const retention = facts.wealth.narrative.verdicts.find((row) => row.title === '钱能不能留下').outcomeText;

  assert.match(retention, /学习|资格|稳定支持|原有保障/);
  assert.doesNotMatch(retention, /合作分走|合伙|投资失败|判断失误/);
});

test('peer competition names shared profit while adverse wealth-to-officer flow names responsibility instead', () => {
  const peerFacts = buildRealWealthFacts('庚申 甲申 庚辰 庚辰');
  const officerFacts = buildRealWealthFacts('甲戌 乙亥 戊申 壬子');
  const peerRetention = peerFacts.wealth.narrative.verdicts.find((row) => row.title === '钱能不能留下').outcomeText;
  const officerRetention = officerFacts.wealth.narrative.verdicts.find((row) => row.title === '钱能不能留下').outcomeText;

  assert.match(peerRetention, /合作|团队|同行|分利|分钱/);
  assert.match(officerRetention, /责任|成本|压力/);
  assert.doesNotMatch(officerRetention, /合作分走|合伙分钱/);
});

test('wealth hidden inside a non-wealth storage is not described as a wealth storage', () => {
  const facts = buildRealWealthFacts('丙寅 己亥 庚申 庚辰');
  const retention = facts.wealth.narrative.verdicts.find((row) => row.title === '钱能不能留下').outcomeText;

  assert.ok(facts.wealth.storage.storages.some((row) => row.storageRoleKey === 'output'));
  assert.ok(!facts.wealth.storage.storages.some((row) => row.storageRoleKey === 'wealth'));
  assert.match(retention, /没有形成财库/);
  assert.doesNotMatch(retention, /虽然能看到财星或财库/);
});

test('calibrated wealth examples keep their accepted public A bands', () => {
  const cases = [
    ['辛丑 乙未 丙寅 戊戌', 'A10'],
    ['丙寅 己亥 庚申 庚辰', 'A10'],
    ['戊寅 甲子 辛卯 辛卯', 'A9'],
    ['戊辰 乙丑 己巳 己巳', 'A8'],
    ['庚申 甲申 庚辰 庚辰', 'A9'],
    ['戊辰 癸亥 乙未 戊寅', 'A8'],
    ['己酉 辛未 癸巳 丁巳', 'A5'],
    ['甲戌 乙亥 戊申 壬子', 'A5'],
  ];

  for (const [pillars, expected] of cases) {
    assert.equal(buildRealWealthFacts(pillars).wealth.narrative.grade, expected, pillars);
  }
});

test('hidden wealth without a source chain or connected storage stays in a poor public band', () => {
  const facts = buildRealWealthFacts('甲子 戊辰 己丑 戊辰');
  const level = Number(facts.wealth.narrative.grade.slice(1));

  assert.equal(facts.wealth.resource.visibleCount, 0);
  assert.equal(facts.wealth.pathways.filter((row) => row && row.scalePotential !== false).length, 0);
  assert.ok(facts.wealth.storage.storages.filter((row) => row.storageRoleKey === 'wealth').every((row) => row.wealthConnection === false));
  assert.ok(level <= 4, facts.wealth.narrative.grade);
  assert.match(facts.wealth.narrative.verdicts[0].outcomeText, /藏在地支|没有接成|不等于/);
});

test('an extremely weak body cannot become rich from adverse wealth scale alone', () => {
  const facts = buildRealWealthFacts('戊午 癸亥 辛卯 甲午');
  const level = Number(facts.wealth.narrative.grade.slice(1));

  assert.equal(facts.core.strength.score, 21);
  assert.equal(facts.wealth.resource.elementRole, '忌神');
  assert.ok(facts.wealth.pathways.some((row) => row.scalePotential === true && row.effect === 'adverse'));
  assert.ok(level <= 5, facts.wealth.narrative.grade);
});

test('multiple Yong elements retain all matching directions instead of returning no answer', () => {
  const direction = DeepReport.__test.deriveWealthDirection({
    yongJi: { yongShen: ['木', '水'], xiShen: [], jiShen: ['火'] },
    pathElements: ['木', '水'],
  });
  assert.equal(direction.conflict, false);
  assert.deepEqual(direction.primary, ['木', '水']);
  assert.deepEqual(direction.directions, ['东方', '东南', '北方']);
});

test('wealth facts preserve Yong-based direction independently of validated wealth pathways', () => {
  const core = storageCore({ yongShen: ['火'], xiShen: [], jiShen: ['土'] });
  core.actionChains = ['食伤生财'];
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '戊', zhi: '子' },
    month: { gan: '己', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '丙', zhi: '午' },
  }), core, calculator);
  assert.ok(facts.pathways.some(path => path.type === '食伤生财'));
  assert.deepEqual(facts.direction, {
    element: '火', elements: ['火'], primary: ['火'], secondary: [],
    directions: ['南方'], confidence: 'strong', conflict: false,
  });
});

test('two exposed partial-wealth stems create a traceable strong-partial-wealth fact without a storage', () => {
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '戊', zhi: '子' },
    month: { gan: '戊', zhi: '卯' },
    day: { gan: '甲', zhi: '卯' },
    hour: { gan: '乙', zhi: '午' },
  }), storageCore({ yongShen: ['火'], xiShen: [], jiShen: ['土'] }), calculator);
  assert.deepEqual(facts.partialWealth, {
    strong: true,
    exposedCount: 2,
    hiddenCount: 0,
    evidence: ['年柱天干戊偏财', '月柱天干戊偏财'],
  });
  assert.equal(facts.storage.candidates.length, 0);
});

test('every hidden stem keeps its own frozen Yong-Xi-Ji role', () => {
  const facts = DeepReport.buildWealthFacts(chart({
    year: { gan: '戊', zhi: '辰' },
    month: { gan: '辛', zhi: '戌' },
    day: { gan: '甲', zhi: '未' },
    hour: { gan: '己', zhi: '丑' },
  }), storageCore({ yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] }), calculator);

  const hidden = facts.storage.storages.flatMap(row => row.hiddenRoles);
  assert.ok(hidden.length > 0);
  assert.ok(hidden.every(row => ['用神', '喜神', '忌神', '中性'].includes(row.elementRole)));
  assert.ok(hidden.some(row => row.element === '木' && row.elementRole === '用神'));
  assert.ok(hidden.some(row => row.element === '水' && row.elementRole === '喜神'));
  assert.ok(hidden.some(row => row.element === '火' && row.elementRole === '忌神'));
});

test('all five storage categories distinguish useful adverse and neutral verdicts', async (t) => {
  const roles = {
    peer: /团队|伙伴|圈层/,
    resource: /学习|资质|支持/,
    output: /技能|表达|交付/,
    wealth: /资金|资产/,
    officer: /责任|规则|组织/,
  };
  const adverseTerms = /压力|竞争|牵制|垫资|债务|争客户|分钱|收款.*不多/;
  for (const [key, roleTerm] of Object.entries(roles)) {
    await t.test(key, () => {
      const useful = DeepReport.__test.storageOutcome(storageFixture(key, {
        elementRole: '用神', hiddenRoles: [{ elementRole: '喜神' }], wealthConnection: true,
      }));
      const adverse = DeepReport.__test.storageOutcome(storageFixture(key, {
        elementRole: '忌神', hiddenRoles: [{ elementRole: '忌神' }], wealthConnection: true,
      }));
      const neutral = DeepReport.__test.storageOutcome(storageFixture(key, {
        elementRole: '中性', hiddenRoles: [{ elementRole: '中性' }], wealthConnection: true,
      }));

      assert.match(useful, roleTerm);
      assert.match(adverse, roleTerm);
      assert.match(adverse, adverseTerms);
      assert.match(neutral, roleTerm);
      assert.doesNotMatch(neutral, adverseTerms);
      assert.match(neutral, /中性|只说明|不能直接/);
    });
  }
});

test('negative wealth chains enter retention risk but cannot raise the A-level', () => {
  const bazi = chart({
    year: { gan: '庚', zhi: '子' },
    month: { gan: '甲', zhi: '卯' },
    day: { gan: '丙', zhi: '午' },
    hour: { gan: '乙', zhi: '亥' },
  });
  const plainCore = storageCore();
  const base = DeepReport.buildWealthFacts(bazi, plainCore, calculator);
  const negative = DeepReport.buildWealthFacts(bazi, {
    ...plainCore,
    actionChains: ['财党杀', '财破印'],
  }, calculator);
  const baseGrade = DeepReport.buildNarratives({ wealth: base }).wealth.grade;
  const negativeGrade = DeepReport.buildNarratives({ wealth: negative }).wealth.grade;

  assert.deepEqual(negative.pathways.map(row => [row.type, row.positive]), [
    ['财党杀', false], ['财破印', false],
  ]);
  assert.deepEqual(negative.retention.risks.map(row => row.type).sort(), ['财党杀', '财破印']);
  assert.ok(Number(negativeGrade.slice(1)) <= Number(baseGrade.slice(1)));
});

test('fixed and hidden storage roles are adjudicated together when they conflict', () => {
  const usefulFixedAdverseHidden = DeepReport.__test.storageOutcome(storageFixture('wealth', {
    elementRole: '用神', hiddenRoles: [{ elementRole: '忌神' }], wealthConnection: true,
  }));
  const adverseFixedUsefulHidden = DeepReport.__test.storageOutcome(storageFixture('wealth', {
    elementRole: '忌神', hiddenRoles: [{ elementRole: '喜神' }], wealthConnection: true,
  }));
  assert.match(usefulFixedAdverseHidden, /同时|混合|不能直接/);
  assert.doesNotMatch(usefulFixedAdverseHidden, /可观察收入转化与留存/);
  assert.match(adverseFixedUsefulHidden, /同时|混合|不能直接/);
  assert.doesNotMatch(adverseFixedUsefulHidden, /可能伴随压力/);
});

test('mixed storage copy names the fixed role and the opposing hidden role precisely', async (t) => {
  const cases = [
    ['fixed useful hidden adverse', '用神', ['忌神'], /固定库性为用神，但藏干含忌神/],
    ['fixed adverse hidden useful', '忌神', ['喜神'], /固定库性为忌神，但藏干含喜神/],
    ['neutral fixed mixed hidden', '中性', ['用神', '忌神'], /固定库性为中性，藏干同时含喜用与忌神/],
  ];
  for (const [name, elementRole, hiddenRoles, expected] of cases) {
    await t.test(name, () => {
      const outcome = DeepReport.__test.storageOutcome(storageFixture('wealth', {
        elementRole,
        hiddenRoles: hiddenRoles.map(role => ({ elementRole: role })),
        wealthConnection: true,
      }));
      assert.match(outcome, expected);
      assert.doesNotMatch(outcome, /^库中喜用与忌神同时存在/);
    });
  }
});
