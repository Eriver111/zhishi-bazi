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
  birthDate: { year: 1990, month: 1, day: 1, hour: 1, clock: 2 },
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
  assert.equal(result.timingStatus, 'unknown_birth');
  assert.match(result.limitation, /未确认出生时间/);
  assert.ok(result.years.every((row) => row.daYun === null && row.daYunStatus === 'unknown_birth'));
});

test('findDaYunForYear accepts only a primitive finite integer target year', () => {
  const rows = [{ gan: '丙', zhi: '寅', startYear: 1995, endYear: 2004 }];
  assert.equal(DeepReport.findDaYunForYear(rows, 1995), rows[0]);
  for (const year of ['1995', '   ', true, [1995], { value: 1995 }, null, 1995.5, NaN, Infinity]) {
    assert.equal(DeepReport.findDaYunForYear(rows, year), null, String(year));
  }
});

test('matched direct-pillar birth passes its precise clock into an active DaYun report', () => {
  const matched = {
    ...chart,
    birthDate: { year: 1990, month: 7, day: 12, hour: 9, clock: 18 },
  };
  let receivedArgs = null;
  const calculator = {
    ...makeCalculator(),
    calculateDaYun(...args) {
      receivedArgs = args;
      return { list: [{ gan: '丙', zhi: '戌', startYear: 1995, endYear: 2034 }] };
    },
  };

  const result = DeepReport.buildFiveYearFacts(
    matched, core, calculator, makeChain(false), 2026, 'male'
  );

  assert.equal(receivedArgs[7], 18);
  assert.equal(result.timingStatus, 'active');
  assert.equal(result.years[0].daYunStatus, 'active');
  assert.equal(result.years[0].daYun.gan + result.years[0].daYun.zhi, '丙戌');
});

test('dated chart before the first DaYun says pre-start rather than unknown birth', () => {
  const child = {
    ...chart,
    birthDate: { year: 2025, month: 1, day: 1, hour: 1, clock: 2 },
  };
  const calculator = {
    ...makeCalculator(),
    calculateDaYun: () => ({ list: [{ gan: '丙', zhi: '寅', startYear: 2031, endYear: 2040 }] }),
  };

  const result = DeepReport.buildFiveYearFacts(
    child, core, calculator, makeChain(false), 2026, 'male'
  );

  assert.equal(result.timingStatus, 'before_start');
  assert.ok(result.years.every((row) => row.daYun === null && row.daYunStatus === 'before_start'));
});

test('birth time without a precise clock stays unknown and never calls DaYun', () => {
  let called = false;
  const calculator = {
    ...makeCalculator(),
    calculateDaYun() { called = true; return { list: [] }; },
  };
  const missingClock = {
    ...chart,
    birthDate: { year: 1990, month: 7, day: 12, hour: 9 },
  };

  const result = DeepReport.buildFiveYearFacts(
    missingClock, core, calculator, makeChain(false), 2026, 'male'
  );

  assert.equal(called, false);
  assert.equal(result.timingStatus, 'unknown_birth');
});

test('known birth with empty or failed DaYun calculation has its own unavailable state', async (t) => {
  const knownBirth = {
    ...chart,
    birthDate: { year: 1990, month: 7, day: 12, hour: 9, clock: 18 },
  };
  const cases = [
    ['empty', () => ({ list: [] })],
    ['thrown', () => { throw new Error('calculator unavailable'); }],
    ['malformed nonempty list', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: 'soon', endYear: null }] })],
    ['unknown stem', () => ({ list: [{ gan: '?', zhi: '戌', startYear: 1995, endYear: 2004 }] })],
    ['unknown branch', () => ({ list: [{ gan: '丙', zhi: '?', startYear: 1995, endYear: 2004 }] })],
    ['decimal year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: 1995.5, endYear: 2004 }] })],
    ['NaN year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: NaN, endYear: 2004 }] })],
    ['reversed range', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: 2005, endYear: 2004 }] })],
    ['blank string year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: '   ', endYear: 2004 }] })],
    ['boolean year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: true, endYear: 2004 }] })],
    ['array year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: [1995], endYear: 2004 }] })],
    ['numeric string year', () => ({ list: [{ gan: '丙', zhi: '戌', startYear: '1995', endYear: 2004 }] })],
  ];
  for (const [name, calculateDaYun] of cases) {
    await t.test(name, () => {
      const result = DeepReport.buildFiveYearFacts(
        knownBirth, core, { ...makeCalculator(), calculateDaYun }, makeChain(false), 2026, 'male'
      );
      assert.equal(result.timingStatus, 'calculation_unavailable');
      assert.match(result.limitation, /大运计算暂不可用/);
      assert.ok(result.years.every(row => row.daYun === null && row.daYunStatus === 'calculation_unavailable'));
    });
  }
});

test('known birth with a missing DaYun calculator is unavailable rather than unknown', () => {
  const knownBirth = { ...chart, birthDate: { year: 1990, month: 7, day: 12, hour: 9, clock: 18 } };
  const calculator = makeCalculator();
  delete calculator.calculateDaYun;
  const result = DeepReport.buildFiveYearFacts(knownBirth, core, calculator, makeChain(false), 2026, 'male');
  assert.equal(result.timingStatus, 'calculation_unavailable');
  assert.match(result.limitation, /大运计算暂不可用/);
});

test('null empty and partial clock values never become midnight in report facts', async (t) => {
  for (const clock of [null, undefined, '', '18abc', '1.5']) {
    await t.test(String(clock), () => {
      let called = false;
      const bazi = { ...chart, birthDate: { year: 1990, month: 7, day: 12, hour: 9, clock } };
      const calculator = { ...makeCalculator(), calculateDaYun() { called = true; return { list: [] }; } };
      const result = DeepReport.buildFiveYearFacts(bazi, core, calculator, makeChain(false), 2026, 'male');
      assert.equal(called, false);
      assert.equal(result.timingStatus, 'unknown_birth');
    });
  }
});

test('known birth after the available DaYun list stays out of range rather than becoming unknown birth', () => {
  const knownBirth = {
    ...chart,
    birthDate: { year: 1990, month: 1, day: 1, hour: 1, clock: 2 },
  };
  const calculator = {
    ...makeCalculator(),
    calculateDaYun: () => ({ list: [{ gan: '丙', zhi: '寅', startYear: 1995, endYear: 2004 }] }),
  };

  const result = DeepReport.buildFiveYearFacts(
    knownBirth, core, calculator, makeChain(false), 2026, 'male'
  );

  assert.equal(result.timingStatus, 'out_of_range');
  assert.equal(result.hasDaYun, false);
  assert.ok(result.years.every((row) => row.daYun === null && row.daYunStatus === 'out_of_range'));
  assert.ok(result.years.every((row) => row.daYunStemRole === '未纳入' && row.daYunBranchRole === '未纳入'));
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

test('annual facts explicitly evaluate both LiuNian and DaYun relations to the spouse palace', () => {
  const annual = DeepReport.buildAnnualFacts(
    chart,
    { ...core, yongJi: { yongShen: ['火'], xiShen: ['木'], jiShen: ['水'] } },
    makeCalculator(),
    makeChain(false),
    2026,
    { gan: '丙', zhi: '子', startYear: 2020, endYear: 2027 },
  );

  assert.deepEqual(
    annual.relationship.activations.map(row => [row.source, row.type, row.movingBranch, row.palaceBranch]),
    [['流年', '伏吟', '午', '午'], ['大运', '六冲', '子', '午']],
  );
  assert.equal(annual.relationship.activations[0].palaceRole, '用神');
  assert.equal(annual.relationship.activations[1].movingRole, '忌神');
  assert.equal(annual.relationship.activations[1].direction, 'adverse');
});

test('favorable annual branch clashing an adverse spouse palace is marked as conditional improvement', () => {
  const annual = DeepReport.buildAnnualFacts(
    chart,
    { ...core, yongJi: { yongShen: ['水'], xiShen: [], jiShen: ['火'] } },
    makeCalculator(),
    makeChain(false),
    2032,
    { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 },
  );

  const clash = annual.relationship.activations.find(row => row.source === '流年' && row.type === '六冲');
  assert.ok(clash);
  assert.equal(clash.movingBranch, '子');
  assert.equal(clash.palaceBranch, '午');
  assert.equal(clash.palaceRole, '忌神');
  assert.equal(clash.movingRole, '用神');
  assert.equal(clash.direction, 'favorable');
});

test('neutral annual branch clashing a favorable spouse palace is still adverse to palace stability', () => {
  const annual = DeepReport.buildAnnualFacts(
    chart,
    { ...core, yongJi: { yongShen: ['火'], xiShen: [], jiShen: ['金'] } },
    makeCalculator(),
    makeChain(false),
    2032,
    { gan: '丁', zhi: '卯', startYear: 2028, endYear: 2037 },
  );

  const clash = annual.relationship.activations.find(row => row.source === '流年' && row.type === '六冲');
  assert.equal(clash.palaceRole, '用神');
  assert.equal(clash.movingRole, '中性');
  assert.equal(clash.direction, 'adverse');
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
  assert.equal(result.timingStatus, 'unknown_birth');
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

test('annual interactions evaluate LiuNian and DaYun against every original pillar', () => {
  const allTargetsChart = {
    year: { gan: '甲', zhi: '子' },
    month: { gan: '乙', zhi: '子' },
    day: { gan: '丙', zhi: '子' },
    hour: { gan: '丁', zhi: '子' },
    birthDate: { year: 1990, month: 1, day: 1, hour: 1 },
  };
  const annual = DeepReport.buildAnnualFacts(
    allTargetsChart, core, makeCalculator(), makeChain(false), 2026,
    { gan: '丙', zhi: '寅', startYear: 2020, endYear: 2027 },
  );
  assert.ok(Array.isArray(annual.interactions));
  for (const targetPillar of ['year', 'month', 'day', 'hour']) {
    assert.ok(annual.interactions.some(row => row.source === '流年' && row.targetPillar === targetPillar));
  }
  assert.ok(annual.interactions.some(row => row.source === '大运'));
  assert.ok(annual.interactions.some(row => row.source === '岁运' && row.targetPillar === 'dayun'));
});

test('timing collectors preserve stem control and every branch relation family', () => {
  assert.ok(DeepReport.__test, 'CommonJS test hooks must exist');
  const hooks = DeepReport.__test;
  const calculator = makeCalculator();
  const roleCore = { yongJi: { yongShen: ['木'], xiShen: ['水'], jiShen: ['金'] } };
  const pairRows = [
    ...hooks.collectStemTimingRelation('流年', '庚', '甲', 'day', roleCore, calculator),
    ...hooks.collectStemTimingRelation('流年', '甲', '己', 'month', roleCore, calculator),
    ...hooks.collectBranchTimingRelations('流年', '申', '寅', 'day', roleCore, calculator),
    ...hooks.collectBranchTimingRelations('流年', '亥', '寅', 'day', roleCore, calculator),
    ...hooks.collectBranchTimingRelations('流年', '巳', '寅', 'day', roleCore, calculator),
    ...hooks.collectBranchTimingRelations('流年', '子', '卯', 'day', roleCore, calculator),
    ...hooks.collectBranchTimingRelations('流年', '寅', '寅', 'day', roleCore, calculator),
  ];
  for (const type of ['天干相克', '天干五合', '六冲', '六合', '六害', '刑', '伏吟']) {
    assert.ok(pairRows.some(row => row.type === type), type);
  }
  const control = pairRows.find(row => row.type === '天干相克');
  assert.ok(control.controller && control.controlled);

  const groupRows = []
    .concat(hooks.collectGroupTimingRelations('流年', '戌', {
      year: { zhi: '寅' }, month: { zhi: '午' }, day: { zhi: '子' }, hour: { zhi: '丑' },
    }, roleCore, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '午', {
      year: { zhi: '寅' }, month: { zhi: '子' }, day: { zhi: '丑' }, hour: { zhi: '亥' },
    }, roleCore, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '辰', {
      year: { zhi: '寅' }, month: { zhi: '卯' }, day: { zhi: '午' }, hour: { zhi: '未' },
    }, roleCore, calculator))
    .concat(hooks.collectGroupTimingRelations('流年', '卯', {
      year: { zhi: '寅' }, month: { zhi: '子' }, day: { zhi: '午' }, hour: { zhi: '未' },
    }, roleCore, calculator));
  for (const type of ['三合', '半合', '三会', '半会']) {
    assert.ok(groupRows.some(row => row.type === type), type);
  }
});

test('half combinations and unqualified combinations never claim transformation', () => {
  assert.ok(DeepReport.__test, 'CommonJS test hooks must exist');
  const hooks = DeepReport.__test;
  const calculator = makeCalculator();
  const roleCore = { yongJi: { yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] } };
  const rows = hooks.collectGroupTimingRelations('流年', '午', {
    year: { zhi: '寅' }, month: { zhi: '子' }, day: { zhi: '卯' }, hour: { zhi: '酉' },
  }, roleCore, calculator).concat(
    hooks.collectStemTimingRelation('流年', '甲', '己', 'month', roleCore, calculator),
  );
  assert.ok(rows.some(row => row.type === '半合' && row.formationStatus === 'tendency'));
  assert.equal(rows.some(row => /半合|半会/.test(row.type) && row.transformed === true), false);
  assert.equal(rows.some(row => row.type === '天干五合' && row.transformed === true), false);
});

test('group interaction source names the moving branch once and labels the original branches', () => {
  const hooks = DeepReport.__test;
  const calculator = makeCalculator();
  const roleCore = { yongJi: { yongShen: ['木'], xiShen: ['水'], jiShen: ['火'] } };
  const row = hooks.collectGroupTimingRelations('流年', '午', {
    year: { zhi: '午' }, month: { zhi: '未' }, day: { zhi: '寅' }, hour: { zhi: '酉' },
  }, roleCore, calculator).find(item => item.type === '半合' && item.formedElement === '火');
  const sourceText = hooks.timingSourceText(row);
  assert.match(sourceText, /流年午引动原局年柱午、日柱寅，午寅半合/);
  assert.doesNotMatch(sourceText, /流年午午寅/);
});

test('undated direct pillars collect annual-original relations without fabricating DaYun relations', () => {
  const undated = {
    year: { gan: '甲', zhi: '子' }, month: { gan: '乙', zhi: '丑' },
    day: { gan: '丙', zhi: '午' }, hour: { gan: '丁', zhi: '未' },
  };
  const facts = DeepReport.buildFiveYearFacts(undated, core, makeCalculator(), makeChain(false), 2026, 'male');
  assert.ok(facts.years[0].interactions.some(row => row.source === '流年'));
  assert.equal(facts.years.some(year => year.interactions.some(row => row.source === '大运' || row.source === '岁运')), false);
});

test('clashing a favorable target is adverse while clashing a Ji target can improve through change', () => {
  assert.ok(DeepReport.__test && DeepReport.__test.adjudicateTimingInteraction);
  const adjudicate = DeepReport.__test.adjudicateTimingInteraction;
  const favorableTarget = adjudicate({ type: '六冲', targetRole: '用神', actorRole: '忌神' });
  const adverseTarget = adjudicate({ type: '六冲', targetRole: '忌神', actorRole: '喜神' });
  assert.equal(favorableTarget.direction, 'adverse');
  assert.equal(adverseTarget.direction, 'favorable');
  assert.equal(adverseTarget.changeCost, true);
});

test('combination direction follows the formed element instead of treating every combination as good', () => {
  const adjudicate = DeepReport.__test.adjudicateTimingInteraction;
  assert.equal(adjudicate({ type: '六合', formedRole: '忌神', formationStatus: 'potential' }).direction, 'adverse');
  assert.equal(adjudicate({ type: '六合', formedRole: '喜神', formationStatus: 'potential' }).direction, 'favorable');
});

test('punishment and harm retain friction even when they touch a Ji target', () => {
  const adjudicate = DeepReport.__test.adjudicateTimingInteraction;
  for (const type of ['刑', '六害']) {
    const result = adjudicate({ type, targetRole: '忌神', actorRole: '喜神' });
    assert.notEqual(result.direction, 'favorable');
    assert.equal(result.frictionPersists, true);
  }
});

test('stem control follows the roles of the actual controller and controlled stem', () => {
  const adjudicate = DeepReport.__test.adjudicateTimingInteraction;
  assert.equal(adjudicate({ type: '天干相克', controllerRole: '喜神', controlledRole: '忌神' }).direction, 'favorable');
  assert.equal(adjudicate({ type: '天干相克', controllerRole: '忌神', controlledRole: '用神' }).direction, 'adverse');
});

test('timing source text names the exact relation and domains require real matching evidence', () => {
  const hooks = DeepReport.__test;
  const row = {
    source: '流年', type: '六冲', layer: '地支', actor: '申', target: '寅',
    targetPillar: 'day', targetLabel: '日支', targetElement: '木', targetRole: '用神',
  };
  assert.equal(hooks.timingSourceText(row), '流年申冲日支寅，寅木为本命用神。');
  assert.deepEqual(hooks.timingDomains(row, {}), ['relationship']);
  assert.equal(hooks.timingDomains({ ...row, targetPillar: 'month', targetLabel: '月支' }, {}).includes('wealth'), false);
  assert.equal(hooks.timingDomains({ ...row, targetPillar: 'month', targetLabel: '月干', actorTenGod: '正财' }, {}).includes('wealth'), true);
});
