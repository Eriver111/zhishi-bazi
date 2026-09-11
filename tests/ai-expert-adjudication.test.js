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

test('岁运问答只注入所问领域的应期候选并强调主次裁决', () => {
  const chart = {
    daYun: { cycles: [{ gan:'甲', zhi:'子' }] },
    timingAdjudication: {
      byDomain: {
        study: [{ year:2028, age:18, daYunGan:'甲', daYunZhi:'子', liuNianGan:'戊', liuNianZhi:'申', label:'学业考试', direction:'偏不利', confidence:'高', eventCandidate:'考试或录取更容易受阻', evidence:['财破印被引动'] }],
        relationship: [{ year:2030, age:20, daYunGan:'甲', daYunZhi:'子', liuNianGan:'庚', liuNianZhi:'戌', label:'婚恋合作', direction:'偏有利', confidence:'中', eventCandidate:'关系推进', evidence:['日支被合'] }]
      },
      overall: []
    }
  };
  const instruction = ai.buildExpertAdjudicationInstruction('哪一年考试最难？', chart, 'pro');
  assert.match(instruction, /所问领域=学业考试/);
  assert.match(instruction, /2028年/);
  assert.match(instruction, /财破印被引动/);
  assert.doesNotMatch(instruction, /2030年/);
  assert.match(instruction, /先选最强的一年.*再给一个次选/);
});

test('明确年份和相对年份会精确读取该年裁决而非泛用候选榜', () => {
  const chart = {
    daYun: { cycles: [{ gan:'丙', zhi:'寅' }] },
    timingAdjudication: {
      current: { year:2026, age:28, primaryEvent:{ domain:'career', label:'事业工作', activationScore:6, direction:'条件性', confidence:'中高', eventCandidate:'事业主题被引动', evidence:['流年食神引动成果输出'], hasIndependentAnnualTrigger:false }, domainRecords:[] },
      requestedYear: { year:2027, overallVerdict:'偏凶', adjudication:{ year:2027, age:29, primaryEvent:{ domain:'relationship', label:'婚恋合作', activationScore:9, direction:'偏不利', confidence:'高', eventCandidate:'关系边界调整', evidence:['流年冲日支'], hasIndependentAnnualTrigger:true }, domainRecords:[] } },
      overall: [{ year:2038, label:'事业工作', direction:'偏有利', eventCandidate:'岗位推进', evidence:['其他年份'] }]
    }
  };
  const current = ai.buildTimingAdjudicationBrief('2026年最可能发生什么？', chart);
  assert.match(current, /本轮年份强制锚点.*2026年/);
  assert.match(current, /事业工作.*条件性/);
  assert.match(current, /不是强应期/);
  assert.doesNotMatch(current, /2038年/);

  const next = ai.buildTimingAdjudicationBrief('明年会怎样？', chart);
  assert.match(next, /本轮年份强制锚点.*2027年/);
  assert.match(next, /婚恋合作.*偏不利/);
  assert.equal(ai.detectTimingQuestionYear('我是1998年出生，想看2027年'), 2027);
});

test('回复校验阻断用全年偏吉覆盖具体领域裁决', () => {
  const chart = { type:'bazi', timingAdjudication:{ current:{
    year:2026, age:28,
    primaryEvent:{ domain:'career', label:'事业工作', activationScore:6, direction:'条件性', confidence:'中高', eventCandidate:'事业主题被引动', evidence:['流年食神'], hasIndependentAnnualTrigger:false },
    domainRecords:[]
  } } };
  const wrong = ai.runReplyValidation(chart, '结论：2026年事业与求财方向偏有利，会出现明显推进。', '2026年最可能发生在哪个领域，是好还是坏？');
  assert.ok(wrong.some(item => item.startsWith('E8-应期方向冲突')));
  assert.ok(wrong.some(item => item.startsWith('E8-把大运背景冒充流年应期')));
  const right = ai.runReplyValidation(chart, '结论：2026年最容易引动事业工作，但方向是条件性的；这不是强应期，只能确定事业主题，不能断具体事件。', '2026年最可能发生在哪个领域，是好还是坏？');
  assert.equal(right.some(item => item.startsWith('E8-')), false);
});

test('高考能否录取必须先给方向裁决并可按出生年年推定高考年份', () => {
  const record = {
    domain:'study', label:'学业考试', direction:'偏不利', confidence:'高',
    eventCandidate:'考试、录取或学习进度更容易受阻', evidence:['财破印被引动'],
    hasIndependentAnnualTrigger:true,
    scenarioCandidates:['复习节奏、临场发挥或成绩稳定性更容易受阻', '志愿、审核或录取推进需要预留备选']
  };
  const chart = {
    type:'bazi', birthInfo:{ year:2008 }, daYun:{ cycles:[{ gan:'甲', zhi:'子' }] },
    timingAdjudication:{ requestedYear:{ year:2026, overallVerdict:'偏凶', adjudication:{ year:2026, age:18, primaryEvent:record, domainRecords:[record] } }, byDomain:{ study:[] }, overall:[] }
  };
  assert.equal(ai.detectTimingQuestionYear('我高考那年能不能考上？', chart), 2026);
  const brief = ai.buildTimingAdjudicationBrief('我高考那年能不能考上？', chart);
  assert.match(brief, /封闭问题直接裁决.*比较困难/);
  assert.match(brief, /最可能的现实落点.*临场发挥/);

  const evasive = ai.runReplyValidation(chart, '流年财破印，印星代表学习，情况需要综合分析，也存在多种可能。', '我高考那年能不能考上？');
  assert.ok(evasive.some(item => item.startsWith('E9-封闭问题未直接裁决')));
  const direct = ai.runReplyValidation(chart, '结论：比较困难。2026年学业考试方向偏不利，临场发挥与录取推进容易受阻。', '我高考那年能不能考上？');
  assert.equal(direct.some(item => item.startsWith('E9-')), false);
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
