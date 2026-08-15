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

function buildStudyFixture({ strength = '中和', sealRole = '用神', sealCount = 1, wenChang = false, chain } = {}) {
  const seals = Array.from({ length: sealCount }, (_, index) => ({ gan: index % 2 ? '壬' : '癸', zhi: '子' }));
  const bazi = chart({
    year: seals[0] || { gan: '甲', zhi: wenChang ? '巳' : '子' },
    month: seals[1] || { gan: '乙', zhi: '卯' },
    shenSha: wenChang ? [{ name: '文昌贵人', positions: ['year'] }] : [],
  });
  const core = {
    strength: { level: strength },
    pattern: { name: chain || '普通格', status: '成格', congGe: false },
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

test('study facts expose four dimensions and avoid deterministic education claims', () => {
  const result = buildStudyFixture({ sealRole: '用神', sealCount: 2 });
  assert.deepEqual(Object.keys(result).sort(), ['absorption', 'application', 'auxiliary', 'discipline', 'expression', 'obstacles', 'path', 'timing'].sort());
  assert.match(JSON.stringify(result), /学习|表达|纪律|实践/);
  assert.doesNotMatch(JSON.stringify(result), /必上岸|必然取得学历|大学层次/);
});
