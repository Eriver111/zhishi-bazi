const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const DeepReport = require('../js/deep-report.js');

function loadRealCalculator() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
  return context.window.BaZiCalculator;
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
};
const calculator = {
  WU_XING,
  getCangGan: (zhi) => CANG_GAN[zhi] || [],
  getShiShen: (dayGan, gan) => ROLE[dayGan + gan] || '十神未定',
  calculateShenSha: (bazi) => bazi.shenSha || [],
};

function chart(overrides = {}) {
  return {
    year: { gan: '甲', zhi: '子' },
    month: { gan: '壬', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' },
    hour: { gan: '辛', zhi: '午' },
    ...overrides,
  };
}

function buildStudyFixture({ strength = '中和', sealRole = '用神', sealCount = 1, wenChang = false, chain, patternStatus = '成格', noStudySignals = false, noOfficers = false } = {}) {
  const seals = Array.from({ length: sealCount }, (_, index) => ({ gan: index % 2 ? '壬' : '癸', zhi: '子' }));
  const bazi = chart({
    year: seals[0] || { gan: '甲', zhi: wenChang ? '巳' : '子' },
    month: seals[1] || { gan: '乙', zhi: '卯' },
    shenSha: wenChang ? [{ name: '文昌贵人', positions: ['year'] }] : [],
  });
  if (noStudySignals) {
    bazi.year = { gan: '甲', zhi: '子' };
    bazi.month = { gan: '甲', zhi: '卯' };
    bazi.hour = { gan: '甲', zhi: '午' };
  }
  if (chain === '伤官配印' && !noStudySignals) bazi.hour = { gan: '丁', zhi: '午' };
  if (noOfficers && !noStudySignals) bazi.hour = { gan: '甲', zhi: '午' };
  const core = {
    strength: { level: strength },
    pattern: { name: chain || '普通格', status: patternStatus, congGe: false },
    congGe: false,
    yongJi: { yongShen: sealRole === '用神' ? ['水'] : [], xiShen: [], jiShen: sealRole === '忌神' ? ['水'] : [] },
    actionChains: chain ? [{ title: chain, detail: chain }] : [],
    relationEvents: [],
    structuralRisks: [],
  };
  return DeepReport.buildStudyFacts(bazi, core, calculator);
}

test('strong Ji seals do not automatically produce excellent study claims', () => {
  const result = buildStudyFixture({ strength: '偏强', sealRole: '忌神', sealCount: 4 });
  assert.notEqual(result.absorption.state, '天然优秀');
  assert.match(result.absorption.conclusion, /思虑|行动|转化|需要输出/);
});

test('WenChang alone cannot decide study level', () => {
  const without = buildStudyFixture({ wenChang: false });
  const withOnly = buildStudyFixture({ wenChang: true });
  assert.equal(withOnly.path.type, without.path.type);
  assert.equal(withOnly.auxiliary.length, 1);
});

test('GuanYin and ShangGuanPeiYin map to different paths', () => {
  assert.equal(buildStudyFixture({ chain: '官印相生' }).path.type, '考试型');
  assert.equal(buildStudyFixture({ chain: '伤官配印' }).path.type, '研究创作型');
});

test('broken or unsupported pattern labels cannot create a strong study path', () => {
  const result = buildStudyFixture({ chain: '官印相生', patternStatus: '破格', noStudySignals: true });
  assert.notEqual(result.path.type, '考试型');
  assert.notEqual(result.path.confidence, 'strong');
  assert.match(result.path.conclusion, /条件|证据|路径/);
});

test('study path evidence names occurrences and their frozen yongJi roles', () => {
  const result = buildStudyFixture({ chain: '官印相生', sealRole: '用神', sealCount: 2 });
  assert.ok(result.path.evidence.some((item) => /月柱|时柱|正官|偏印|正印/.test(item)));
  assert.ok(result.path.evidence.some((item) => /用神|喜神|成格/.test(item)));
});

test('ShangGuanPeiYin with Ji seal is conditional rather than unconditionally strong', () => {
  const result = buildStudyFixture({ chain: '伤官配印', sealRole: '忌神', sealCount: 2 });
  assert.equal(result.path.type, '研究创作型');
  assert.notEqual(result.path.confidence, 'strong');
  assert.match(result.path.conclusion + result.path.conditions.join(' '), /忌神|条件|转化/);
});

test('GuanYin or ShaYin cannot be strong discipline evidence without officers', () => {
  const result = buildStudyFixture({ chain: '官印相生', sealCount: 2, noOfficers: true });
  assert.notEqual(result.discipline.confidence, 'strong');
  assert.match(result.discipline.conclusion, /官杀|纪律|外部/);
});

test('study facts expose four dimensions and avoid deterministic education claims', () => {
  const result = buildStudyFixture({ sealRole: '用神', sealCount: 2 });
  assert.deepEqual(Object.keys(result).sort(), ['absorption', 'application', 'auxiliary', 'chains', 'discipline', 'expression', 'obstacles', 'path', 'timing'].sort());
  assert.match(JSON.stringify(result), /学习|表达|纪律|实践/);
  assert.doesNotMatch(JSON.stringify(result), /必上岸|必然取得学历|大学层次/);
});

function findStudyChain(result, id) {
  return result.chains.find((chain) => chain.id === id);
}

test('effective sha-yin evidence requires actual officer and seal and keeps the claim conditional', () => {
  const result = buildStudyFixture({ chain: '杀印相生', sealRole: '用神', sealCount: 2 });
  const chain = findStudyChain(result, 'sha_yin');
  assert.equal(chain.present, true);
  assert.equal(chain.confidence, 'strong');
  assert.ok(chain.evidence.some((item) => /正官|七杀/.test(item)));
  assert.ok(chain.evidence.some((item) => /正印|偏印/.test(item)));
  assert.doesNotMatch(JSON.stringify(chain), /高学历|必上岸|录取|名校|一定聪明/);
});

test('broken or officer-less sha-yin never becomes strong', () => {
  const broken = buildStudyFixture({ chain: '杀印相生', sealRole: '用神', sealCount: 2, patternStatus: '破格' });
  const noOfficer = buildStudyFixture({ chain: '杀印相生', sealRole: '用神', sealCount: 2, noOfficers: true });
  assert.notEqual(findStudyChain(broken, 'sha_yin').confidence, 'strong');
  assert.notEqual(findStudyChain(noOfficer, 'sha_yin').confidence, 'strong');
  assert.ok(findStudyChain(broken, 'sha_yin').blockers.length > 0);
  assert.ok(findStudyChain(noOfficer, 'sha_yin').blockers.length > 0);
});

test('wealth regulating an excess seal is distinct from the structural wealth-breaks-seal risk', () => {
  const bazi = chart({
    year: { gan: '戊', zhi: '子' },
    month: { gan: '癸', zhi: '卯' },
    hour: { gan: '辛', zhi: '午' },
  });
  const core = {
    strength: { level: '偏强' },
    pattern: { name: '印绶格', status: '成格' },
    yongJi: { yongShen: ['土'], xiShen: [], jiShen: [] },
    actionChains: [{ title: '印成势→财制印', detail: '印成势→财制印，财为用神。' }],
    structuralRisks: [],
    relationEvents: [],
  };
  const safe = findStudyChain(DeepReport.buildStudyFacts(bazi, core, calculator), 'wealth_regulates_seal');
  assert.equal(safe.present, true);
  assert.equal(safe.confidence, 'medium');
  assert.ok(safe.elementRoles.wealth === '用神');
  assert.equal(safe.blockers.some((item) => /财破印|财坏印/.test(item)), false);

  const risky = findStudyChain(DeepReport.buildStudyFacts(bazi, {
    ...core,
    structuralRisks: [{ type: '财破印', why: '财印透干相克' }],
  }, calculator), 'wealth_regulates_seal');
  assert.ok(risky.blockers.some((item) => /财破印/.test(item)));
  assert.equal(risky.confidence, 'limited');
});

test('wealth regulation ignores non-production candidate pseudo-fields', () => {
  const bazi = chart({ year: { gan: '戊', zhi: '巳' }, month: { gan: '癸', zhi: '卯' } });
  const result = DeepReport.buildStudyFacts(bazi, {
    strength: { level: '偏强' },
    pattern: { name: '印绶格', status: '成格' },
    yongJi: { yongShen: ['土'], xiShen: [], jiShen: [] },
    actionChains: [],
    actionCandidates: [{ title: '印成势→财制印', detail: '伪候选字段，不属于生产 core' }],
    candidateEvidence: ['印成势→财制印'],
    structuralRisks: [], relationEvents: [],
  }, calculator);
  const chain = findStudyChain(result, 'wealth_regulates_seal');
  assert.equal(chain.present, false);
  assert.equal(chain.unsupported, true);
  assert.equal(chain.confidence, 'limited');
});

test('real core study facts report wealth regulation as unsupported when no production evidence is exposed', () => {
  const realCalculator = loadRealCalculator();
  const bazi = realCalculator.buildFromPillars({
    year: { gan: '戊', zhi: '午' }, month: { gan: '癸', zhi: '卯' },
    day: { gan: '甲', zhi: '寅' }, hour: { gan: '辛', zhi: '酉' },
  }, 'male');
  const facts = DeepReport.buildFacts(bazi, 'male', {
    anchorYear: 2026,
    deps: { calculator: realCalculator },
  });
  const chain = findStudyChain(facts.study, 'wealth_regulates_seal');
  assert.ok(chain);
  if (!chain.present) {
    assert.equal(chain.unsupported, true);
    assert.equal(chain.confidence, 'limited');
  } else {
    assert.ok(chain.evidence.some((item) => /印成势|财制印|财星制印/.test(item)));
  }
});

test('food-controls-sha distinguishes food god plus seven-kill from proper officer and hurting-officer conflicts', () => {
  const positive = chart({
    year: { gan: '丙', zhi: '子' },
    month: { gan: '庚', zhi: '申' },
    hour: { gan: '癸', zhi: '午' },
  });
  const positiveCore = {
    strength: { level: '中和' },
    pattern: { name: '食神制杀格', status: '成格' },
    yongJi: { yongShen: ['火'], xiShen: [], jiShen: [] },
    actionChains: [{ title: '食神制杀', detail: '食神制杀，七杀有制。' }],
    structuralRisks: [], relationEvents: [],
  };
  const foodSha = findStudyChain(DeepReport.buildStudyFacts(positive, positiveCore, calculator), 'food_controls_sha');
  assert.equal(foodSha.present, true);
  assert.equal(foodSha.confidence, 'strong');
  assert.ok(foodSha.elementRoles.outputKind === '食神');
  assert.ok(foodSha.elementRoles.officerKind === '七杀');

  const properOfficer = chart({
    year: { gan: '丙', zhi: '子' },
    month: { gan: '辛', zhi: '酉' },
    hour: { gan: '癸', zhi: '午' },
  });
  const properCore = { ...positiveCore, pattern: { name: '正官格', status: '成格' }, actionChains: [{ title: '食神克正官', detail: '食神克正官。' }] };
  const proper = findStudyChain(DeepReport.buildStudyFacts(properOfficer, properCore, calculator), 'food_controls_sha');
  assert.notEqual(proper.confidence, 'strong');
  assert.notEqual(proper.present, true);

  const hurtingOfficer = chart({
    year: { gan: '丁', zhi: '子' },
    month: { gan: '辛', zhi: '酉' },
    hour: { gan: '癸', zhi: '午' },
  });
  const hurtingCore = { ...properCore, actionChains: [{ title: '伤官见官', detail: '伤官见官。' }] };
  const hurting = findStudyChain(DeepReport.buildStudyFacts(hurtingOfficer, hurtingCore, calculator), 'food_controls_sha');
  assert.notEqual(hurting.confidence, 'strong');
  assert.ok(hurting.blockers.some((item) => /伤官见官/.test(item)));
});

test('effective food-controls-sha is limited when real risks or a Ji output block conversion', () => {
  const positive = chart({
    year: { gan: '丙', zhi: '子' }, month: { gan: '庚', zhi: '申' }, hour: { gan: '癸', zhi: '午' },
  });
  const core = {
    strength: { level: '中和' }, pattern: { name: '食神制杀格', status: '成格' },
    yongJi: { yongShen: [], xiShen: [], jiShen: ['火'] },
    actionChains: [{ title: '食神制杀', detail: '食神制杀，七杀有制。' }],
    structuralRisks: [{ type: '枭神夺食' }, { type: '财党杀' }, { type: '承载不足' }], relationEvents: [],
  };
  const chain = findStudyChain(DeepReport.buildStudyFacts(positive, core, calculator), 'food_controls_sha');
  assert.equal(chain.present, true);
  assert.equal(chain.confidence, 'limited');
  assert.ok(chain.blockers.some((item) => /枭神夺食/.test(item)));
  assert.ok(chain.blockers.some((item) => /财党杀/.test(item)));
  assert.ok(chain.blockers.some((item) => /承载不足/.test(item)));
  assert.ok(chain.blockers.some((item) => /忌神|忌/.test(item)));
});

test('yangren output is always marked for manual review', () => {
  const result = buildStudyFixture({ chain: '羊刃', sealCount: 1 });
  const chain = findStudyChain(result, 'yangren_output');
  assert.equal(chain.manualReviewRequired, true);
  assert.equal(chain.confidence, 'limited');
});

test('weak body with officers and no seals produces conditional learning pressure only', () => {
  const result = DeepReport.buildStudyFacts(chart({
    year: { gan: '丙', zhi: '巳' },
    month: { gan: '乙', zhi: '卯' },
    hour: { gan: '辛', zhi: '酉' },
  }), {
    strength: { level: '极弱' }, pattern: { name: '普通格', status: '成格' },
    yongJi: { yongShen: [], xiShen: [], jiShen: [] }, actionChains: [], structuralRisks: [], relationEvents: [],
  }, calculator);
  const pressure = findStudyChain(result, 'learning_pressure');
  assert.equal(pressure.present, true);
  assert.notEqual(pressure.confidence, 'strong');
  assert.match(pressure.conclusion, /压力|承载|条件/);
  assert.notEqual(findStudyChain(result, 'sha_yin').confidence, 'strong');
});
