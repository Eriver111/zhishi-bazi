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

const chart = {
  year: { gan: '甲', zhi: '子' },
  month: { gan: '乙', zhi: '丑' },
  day: { gan: '丙', zhi: '午' },
  hour: { gan: '丁', zhi: '未' },
  birthDate: { year: 1990, month: 1, day: 1, hour: 1 },
};

const core = {
  strength: { level: '中和' },
  pattern: { name: '普通格' },
  yongJi: { yongShen: ['木'], xiShen: ['火'], jiShen: ['金'] },
  actionChains: [],
  relationEvents: [],
  structuralRisks: [{ type: '年度节点风险', triggerElements: ['金'] }],
  wealth: { summaryLevel: '稳健', resource: { state: '显现' } },
};

function makeCalculator() {
  const years = {
    2026: { gan: '丙', zhi: '午' }, 2027: { gan: '丁', zhi: '未' },
    2028: { gan: '戊', zhi: '申' }, 2029: { gan: '己', zhi: '酉' },
    2030: { gan: '庚', zhi: '戌' },
  };
  return {
    WU_XING,
    DI_ZHI_WU_XING,
    getShiShen: () => '正财',
    calculateDaYun: () => ({ list: [
      { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 },
      { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 },
    ] }),
    calculateLiuNian: (daYun) => Array.from({ length: 10 }, (_, index) => {
      const year = Number(daYun.startYear) + index;
      const pillar = years[year] || { gan: '甲', zhi: '子' };
      return { year, ...pillar };
    }),
  };
}

function makeChain(strengthensRisk) {
  return {
    analyzeLiuNian: (_bazi, _daYun, liuNian) => ({
      triggers: strengthensRisk && liuNian.gan === '庚'
        ? [{ type: '年度节点风险', detail: '流年金加强年度节点风险', isGood: false }]
        : [],
      reliefs: [],
      summary: '按条件观察',
    }),
  };
}

test('each of five years resolves its own DaYun across a boundary', () => {
  const result = DeepReport.buildFiveYearFacts(
    chart, core, makeCalculator(), makeChain(false), 2026, 'male'
  );
  assert.deepEqual(result.years.map((row) => row.year), [2026, 2027, 2028, 2029, 2030]);
  assert.notEqual(result.years[1].daYun.gan + result.years[1].daYun.zhi,
    result.years[2].daYun.gan + result.years[2].daYun.zhi);
  assert.equal(result.transitions[0].year, 2028);
});

test('a structural risk is emphasized only when the annual nodes trigger it', () => {
  const dormant = DeepReport.buildAnnualFacts(
    chart, core, makeCalculator(), makeChain(false), 2030,
    { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 }
  );
  const active = DeepReport.buildAnnualFacts(
    chart, core, makeCalculator(), makeChain(true), 2030,
    { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 }
  );
  assert.equal(dormant.triggeredRisks.length, 0);
  assert.equal(active.triggeredRisks.length, 1);
  assert.match(active.triggeredRisks[0].conclusion, /可能|需|条件/);
});

test('wellbeing copy contains no diagnosis or deterministic organ claim', () => {
  const annual = DeepReport.buildAnnualFacts(
    chart, core, makeCalculator(), makeChain(true), 2030,
    { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 }
  );
  const text = JSON.stringify(annual.wellbeing);
  assert.doesNotMatch(text, /患病|疾病|心脏病|肾病|必然|大凶|死亡/);
});

test('undated four pillars do not fabricate a DaYun', () => {
  const undated = { ...chart };
  delete undated.birthDate;
  const result = DeepReport.buildFiveYearFacts(
    undated, core, makeCalculator(), makeChain(false), 2026, 'female'
  );
  assert.equal(result.hasDaYun, false);
  assert.match(result.limitation, /未确认出生时间/);
  assert.ok(result.years.every((row) => row.daYun === null));
});

test('annual wealth only adds timing activation and reuses frozen wealth facts', () => {
  const wealth = { summaryLevel: '承压', resource: { state: '潜藏' }, capacity: { state: '承压' } };
  const annual = DeepReport.buildAnnualFacts(
    chart, { ...core, wealth }, makeCalculator(), makeChain(false), 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  assert.equal(annual.wealth.base, wealth);
  assert.equal(annual.wealth.base.capacity.state, '承压');
  assert.ok(annual.wealth.timing);
  assert.equal(Object.prototype.hasOwnProperty.call(annual.wealth, 'occurrences'), false);
});

test('real StructuralRisks contract activates from annual branch relation and preserves mitigation', () => {
  const realRisk = {
    type: '关键用神/格局节点受冲',
    severity: '潜在',
    parties: '年柱子 ↔ 时柱午（印星之根）',
    why: '六冲子午命中；时柱午（印星之根）',
    mitigations: '加强印星支持并保留调整空间',
    triggerHint: '若年柱子（癸水·偏财）得运助增，对时柱午（印星之根）的冲击可能加重。',
    evidence: '年柱子与时柱午形成六冲',
    partyEvidence: '年柱year（癸水·偏财）；时柱hour（丁火·偏印）',
  };
  const realCore = { ...core, structuralRisks: [realRisk] };
  const active = DeepReport.buildAnnualFacts(
    chart, realCore, makeCalculator(), makeChain(false), 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  const dormant = DeepReport.buildAnnualFacts(
    chart, realCore, makeCalculator(), makeChain(false), 2027,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  assert.equal(active.triggeredRisks.length, 1);
  assert.equal(dormant.triggeredRisks.length, 0);
  assert.ok(active.reliefs.some((row) => row.conclusion.includes('加强印星支持')));
});

test('incomplete birthDate safely skips DaYun calculation', () => {
  let called = false;
  const calculator = makeCalculator();
  const original = calculator.calculateDaYun;
  calculator.calculateDaYun = (...args) => { called = true; return original(...args); };
  const incomplete = { ...chart, birthDate: { year: 1990, month: 1, day: 1 } };
  const result = DeepReport.buildFiveYearFacts(incomplete, core, calculator, makeChain(false), 2026, 'male');
  assert.equal(called, false);
  assert.equal(result.hasDaYun, false);
  assert.match(result.limitation, /未确认出生时间/);
});
