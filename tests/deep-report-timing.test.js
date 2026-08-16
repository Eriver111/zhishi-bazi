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

test('undated four pillars still use authoritative original-chart annual relations', () => {
  const undated = { ...chart };
  delete undated.birthDate;
  let pillarCalls = 0;
  let branchCalls = 0;
  const calculator = {
    ...makeCalculator(),
    getPillarRelations(proxy) {
      pillarCalls += 1;
      return [{ from: '年柱', to: '月柱', gan: '克', zhi: '—', details: [`年柱天干${proxy.year.gan}克月柱天干${proxy.month.gan}`] }];
    },
    getBranchRelations(proxy) {
      branchCalls += 1;
      return proxy.year.zhi === '子' && proxy.month.zhi === '午'
        ? [{ from: '年柱', to: '月柱', branch1: '子', branch2: '午', relations: [{ type: '六冲', detail: '年柱地支子冲月柱地支午' }] }]
        : [];
    },
  };
  const chain = { analyzeLiuNian() { throw new Error('must not pass a null DaYun into the DaYun analyzer'); } };

  const result = DeepReport.buildFiveYearFacts(undated, core, calculator, chain, 2026, 'female');
  const first = result.years[0];
  assert.ok(pillarCalls > 0);
  assert.ok(branchCalls > 0);
  assert.ok(first.dynamic.triggers.some(row => row.type === '六冲' && row.sourcePillar === 'year'));
  assert.equal(first.dynamic.mode, 'original-chart');
});

test('structured annual triggers stay in their own report domains', () => {
  const chain = {
    analyzeLiuNian() {
      return {
        triggers: [
          { type: '财星激活', domain: 'wealth', detail: '财星资源议题' },
          { type: '夫妻宫激活', domains: ['relationship'], detail: '夫妻宫关系议题' },
          { type: '学习节奏', category: 'study', detail: '学习安排议题' },
          { type: '年度节点', detail: '通用结构变化' },
        ],
        reliefs: [],
      };
    },
  };
  const annual = DeepReport.buildAnnualFacts(
    chart, core, makeCalculator(), chain, 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );

  assert.match(annual.wealth.evidence.join('|'), /财星资源议题/);
  assert.doesNotMatch(annual.wealth.evidence.join('|'), /夫妻宫|学习安排|通用结构/);
  assert.match(annual.relationship.evidence.join('|'), /夫妻宫关系议题/);
  assert.doesNotMatch(annual.relationship.evidence.join('|'), /财星资源|学习安排|通用结构/);
  assert.match(annual.study.evidence.join('|'), /学习安排议题/);
  assert.doesNotMatch(annual.study.evidence.join('|'), /财星资源|夫妻宫|通用结构/);
  assert.deepEqual(annual.overallTriggers.map(row => row.detail), ['通用结构变化']);
});

test('conservative annual text fallback separates wealth and relationship triggers', () => {
  const chain = {
    analyzeLiuNian() {
      return {
        triggers: [
          { type: '触发', detail: '财星资源被引动' },
          { type: '触发', detail: '日支夫妻宫被引动' },
        ],
        reliefs: [],
      };
    },
  };
  const annual = DeepReport.buildAnnualFacts(
    chart, core, makeCalculator(), chain, 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  assert.deepEqual(annual.wealth.evidence, ['财星资源被引动']);
  assert.deepEqual(annual.relationship.evidence, ['日支夫妻宫被引动']);
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

test('an unverifiable strengthening hint does not activate from one matching token', () => {
  const risk = {
    type: '枭夺食',
    severity: '潜在',
    parties: '时柱甲（枭）克年柱戊（食）',
    why: '偏印元素克食神元素',
    mitigations: '无',
    triggerHint: '若偏印甲进一步增强，枭夺食可能显化。',
    evidence: '原局偏印与食神相克',
    partyEvidence: '时柱hour甲枭；年柱year戊食',
  };
  const annual = DeepReport.buildAnnualFacts(
    chart, { ...core, structuralRisks: [risk] }, makeCalculator(), makeChain(false), 2024,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  assert.equal(annual.triggeredRisks.length, 0);
});

test('active risk preserves the real structural evidence fields', () => {
  const risk = {
    type: '关键用神/格局节点受冲',
    severity: '潜在',
    parties: '年柱子 ↔ 时柱午',
    why: '六冲子午命中',
    mitigations: '保留调整空间',
    triggerHint: '若流年午冲年柱子，相关节点可能受扰。',
    evidence: '原局年柱子与时柱午形成六冲',
    partyEvidence: '年柱year（癸水·偏财）；时柱hour（丁火·偏印）',
  };
  const annual = DeepReport.buildAnnualFacts(
    chart, { ...core, structuralRisks: [risk] }, makeCalculator(), makeChain(false), 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  assert.equal(annual.triggeredRisks.length, 1);
  const active = annual.triggeredRisks[0];
  assert.equal(active.why, risk.why);
  assert.equal(active.triggerHint, risk.triggerHint);
  assert.equal(active.partyEvidence, risk.partyEvidence);
  assert.match(JSON.stringify(active.evidence), /原局年柱子/);
});

test('placeholder mitigations do not become relief conclusions', () => {
  const risk = {
    type: '关键用神/格局节点受冲',
    parties: '年柱子 ↔ 时柱午',
    why: '六冲子午命中',
    mitigations: ['无', '暂无', '无救应', '  ', '保留边界与调整空间'],
    triggerHint: '若流年午冲年柱子，相关节点可能受扰。',
    evidence: '原局年柱子与时柱午形成六冲',
    partyEvidence: '年柱year子；时柱hour午',
  };
  const annual = DeepReport.buildAnnualFacts(
    chart, { ...core, structuralRisks: [risk] }, makeCalculator(), makeChain(false), 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 }
  );
  const conclusions = annual.reliefs.map((row) => row.conclusion).join('|');
  assert.match(conclusions, /保留边界与调整空间/);
  assert.doesNotMatch(conclusions, /^(无|暂无|无救应)$/m);
});
