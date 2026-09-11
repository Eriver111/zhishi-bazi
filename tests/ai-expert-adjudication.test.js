const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../api/ai-chat.js')._test;

test('老师傅式裁决层按问题选择旺衰、格局、喜用和现实反馈任务', () => {
  const instruction = ai.buildExpertAdjudicationInstruction(
    '我觉得这个盘应该身强，为什么你说是正官格，而且喜用忌怎么排？',
    {
      dayMasterStrength: { level: '偏弱', score: 38 },
      pattern: { name: '正官格', status: '破格' },
      yongJi: { yongShen: ['水'], xiShen: ['木'], jiShen: ['土'] }
    },
    'pro'
  );
  assert.match(instruction, /旺衰与从格、格局成败、喜用忌与调候、质疑或现实反馈/);
  assert.match(instruction, /最强支持证据—最强反证—为何仍取主结论/);
  assert.match(instruction, /用户的命理意见只是待验证假设/);
  assert.match(instruction, /不得把“见某五行”直接等同“一定变顺”/);
});

test('裁决层在岁运字段不足时要求承认不能确认并提出区分问题', () => {
  const instruction = ai.buildExpertAdjudicationInstruction('我哪一步大运事业会变好？', {}, 'pro');
  assert.match(instruction, /当前缺少：对应岁运字段/);
  assert.match(instruction, /目前不能确认/);
  assert.match(instruction, /1至3个校对问题/);
});

test('直接问答限制篇幅，只有完整报告请求才允许分节展开', () => {
  const direct = ai.buildExpertAdjudicationInstruction('这个八字到底身强还是身弱？', {
    dayMasterStrength: { level: '偏弱', score: 38 }
  }, 'pro');
  assert.match(direct, /直接问答，不写成完整命理报告/);
  assert.match(direct, /350至900个汉字/);

  const report = ai.buildExpertAdjudicationInstruction('请给我一份完整详细报告', {}, 'pro');
  assert.match(report, /可以分节展开/);
  assert.doesNotMatch(report, /350至900个汉字/);
});

test('直接问旺衰却绕开冻结档位会触发必答锚点修正', () => {
  const chart = { type: 'bazi', dayMasterStrength: { level: '偏弱', score: 38 } };
  const missing = ai.runReplyValidation(chart, '这个命局需要结合整体情况综合考虑。', '到底身强还是身弱？');
  assert.ok(missing.some((item) => item.startsWith('E7-缺少旺衰锚点')));
  const answered = ai.runReplyValidation(chart, '本站冻结结论是偏弱，月令失势但仍有一处根气。', '到底身强还是身弱？');
  assert.equal(answered.some((item) => item.startsWith('E7-')), false);
});

test('直接问主格与喜用忌时不得漏答冻结结论', () => {
  const chart = {
    type: 'bazi',
    pattern: { name: '正官格', status: '破格' },
    yongJi: { yongShen: ['水'], xiShen: ['木'], jiShen: ['土'] }
  };
  const warnings = ai.runReplyValidation(chart, '这个盘结构比较复杂，需要谨慎。', '格局是什么，喜用忌怎么排列？');
  assert.ok(warnings.some((item) => item.includes('正官格')));
  assert.ok(warnings.some((item) => item.includes('用神「水」')));
  assert.ok(warnings.some((item) => item.includes('喜神「木」')));
  assert.ok(warnings.some((item) => item.includes('忌神「土」')));
  const answered = ai.runReplyValidation(chart, '主格为正官格；用神水，喜神木，忌神土。', '格局是什么，喜用忌怎么排列？');
  assert.equal(answered.some((item) => item.startsWith('E7-')), false);
});

test('师傅质量量表奖励具体盘面证据、反证与预测边界', () => {
  const chart = {
    type: 'bazi',
    fourPillars: {
      year: { gan: '丙', zhi: '戌' }, month: { gan: '丙', zhi: '申' },
      day: { gan: '己', zhi: '卯' }, hour: { gan: '庚', zhi: '午' }
    },
    dayMaster: { gan: '己' },
    dayMasterStrength: { level: '中和偏强', score: 57 }
  };
  const strong = ai.buildExpertReplyScorecard(
    '为什么判断为中和偏强，未来走火运一定好吗？',
    chart,
    '结论是中和偏强。己土日主生于申月，月令申金泄身；但原局丙戌、庚午并见，午火有根可生身。反证是申金当令且卯木克土，但这不足以推翻火土已有承载的结论。火只是原局基础方向，具体火运仍需结合干支冲合，因此不等于一定变顺。'
  );
  assert.equal(strong.grade, 'A');
  assert.equal(strong.hardWarningCount, 0);
  assert.ok(strong.evidenceHits.length >= 2);
  assert.equal(strong.verbosityRisk, false);
});

test('质量量表标记直接问题写成超长报告的风险', () => {
  const chart = { type: 'bazi', dayMasterStrength: { level: '偏弱', score: 38 } };
  const verbose = ai.buildExpertReplyScorecard(
    '到底身强还是身弱？',
    chart,
    '结论是偏弱。反证存在，但不足以推翻。' + '盘面说明。'.repeat(400)
  );
  assert.equal(verbose.verbosityRisk, true);
  assert.ok(verbose.characterCount > 1800);
});

test('师傅质量量表识别绕结论、无盘面证据和无边界预测', () => {
  const chart = {
    type: 'bazi',
    dayMasterStrength: { level: '偏弱', score: 38 },
    fourPillars: { day: { gan: '乙', zhi: '丑' } },
    dayMaster: { gan: '乙' }
  };
  const weak = ai.buildExpertReplyScorecard('到底身强还是身弱，以后事业会好吗？', chart, '整体比较复杂，以后一定会越来越好。');
  assert.equal(weak.grade, 'BLOCKED');
  assert.equal(weak.dimensions.directAnswer, 0);
  assert.equal(weak.dimensions.chartEvidence, 0);
  assert.equal(weak.dimensions.predictionBoundary, 0);
});
