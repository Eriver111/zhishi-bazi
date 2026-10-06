const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Exercise the actual pure prompt/validator source without importing the API,
// auth, production configuration or datastore initialization.
function loadPureLibrary(name) {
  const scope = { module:{ exports:{} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib', name), 'utf8'), scope);
  return scope.module.exports;
}
const ai = {
  ...loadPureLibrary('ai-conversation-evidence.js'),
  ...loadPureLibrary('ai-chart-evidence.js'),
  ...loadPureLibrary('hepan-reply-scopes.js')
};
const apiSource = fs.readFileSync(path.join(__dirname, '../api/ai-chat.js'), 'utf8');
const pureStart = apiSource.indexOf('function validateFrozenYongSelection(');
const pureEnd = apiSource.indexOf('function buildHepanDaYunFactFallback(', pureStart);
assert.ok(pureStart >= 0 && pureEnd > pureStart);
vm.runInNewContext(apiSource.slice(pureStart, pureEnd), ai);

test('legacy saved annual ranking without a full adjudication still answers an open requested-year question', () => {
  const candidate={year:2020,domain:'career',label:'事业工作',direction:'条件性',confidence:'中',
    hasIndependentAnnualTrigger:true,eventCandidate:'工作事项被引动',evidence:['旧年度候选保留的依据']};
  const chart={timingAdjudication:{overall:[candidate]}};
  const text=ai.buildTimingAdjudicationBrief('回看2020年最突出的事件是什么？',chart);
  assert.match(text,/本轮年份强制锚点.*2020年/);
  assert.match(text,/旧年度候选保留的依据/);
  assert.doesNotMatch(text,/同年其他领域依据/);
});

test('AI keeps decade domain support separate from the requested annual direction', () => {
  const record={domain:'career',label:'事业工作',direction:'条件性',confidence:'中',hasIndependentAnnualTrigger:true,
    eventCandidate:'工作事项被引动',evidence:['当年具体作用'],scenarioCandidates:['机会与压力并存']};
  const chart={timingAdjudication:{requestedYear:{year:2011,adjudication:{age:30,primaryEvent:record,domainRecords:[record],
    daYunBackground:{domainRecords:[{domain:'career',label:'事业工作',direction:'偏有利',conclusion:'十年平台背景有支持'}]}}}}};
  const brief=ai.buildTimingAdjudicationBrief('2011年工作如何？',chart);
  assert.match(brief,/该领域方向=条件性/);
  assert.match(brief,/对应十年背景（与当年分开）=事业工作·偏有利/);
  assert.match(brief,/不能再用“这步运好\/坏”覆盖该年结果/);
});

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

test('裁决层缺输入时指出缺项，有依据时不用待核标签代替答案', () => {
  const instruction = ai.buildExpertAdjudicationInstruction('我哪一步大运事业会变好？', {}, 'pro');
  assert.match(instruction, /当前缺少：对应岁运字段/);
  assert.match(instruction, /关键输入时明确点出缺哪项，不编造/);
  assert.match(instruction, /才问1个具体问题/);
  assert.match(instruction, /不以“待复核”“方向待核”“目前不能确认”作为结论/);
  assert.match(instruction, /不将中性信号改成灾难/);
});

test('explicit historical year activates timing evidence even without 大运 or 流年 wording',()=>{
 const instruction=ai.buildExpertAdjudicationInstruction('2020年家庭方面怎么回事？',{daYun:{cycles:[{gan:'壬',zhi:'子'}]}},'simple');
 assert.match(instruction,/本轮任务：岁运应事/);
 assert.match(instruction,/最强反证在内部核对/);
 assert.match(instruction,/算法判出的格局旺衰不是现实生活的已证实事实/);
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
  assert.match(instruction, /比较各年实际作用，不把排序第一自动当命中/);
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
  assert.match(current, /这个局部标记不代表全年没有结构作用/);
  assert.doesNotMatch(current, /没有当年刑冲合害|本轮回答须保留/);
  assert.doesNotMatch(current, /2038年/);

  const next = ai.buildTimingAdjudicationBrief('明年会怎样？', chart);
  assert.match(next, /本轮年份强制锚点.*2027年/);
  assert.match(next, /婚恋合作.*偏不利/);
  assert.equal(ai.detectTimingQuestionYear('我是1998年出生，想看2027年'), 2027);
});

test('明确领域回复校验保留方向与背景边界，开放问不被首域绑定', () => {
  const record={ domain:'career', label:'事业工作', activationScore:6, direction:'条件性', confidence:'中高', eventCandidate:'事业主题被引动', evidence:['流年食神'], hasIndependentAnnualTrigger:false };
  const chart = { type:'bazi', timingAdjudication:{ current:{
    year:2026, age:28,
    primaryEvent:record,
    domainRecords:[record]
  } } };
  const reply='结论：2026年事业与求财方向偏有利，会出现明显推进。';
  const wrong = ai.runReplyValidation(chart, reply, '2026年事业工作是好还是坏？');
  assert.ok(wrong.some(item => item.startsWith('E8-应期方向冲突')));
  assert.ok(wrong.some(item => item.startsWith('E8-把大运背景冒充流年应期')));
  const right = ai.runReplyValidation(chart, '结论：2026年最容易引动事业工作，但方向是条件性的；这不是强应期，只能确定事业主题，不能断具体事件。', '2026年事业工作是好还是坏？');
  assert.equal(right.some(item => item.startsWith('E8-')), false);
  const open = ai.runReplyValidation(chart, reply, '回看2026年，最突出的事情是什么？');
  assert.equal(open.some(item=>item.startsWith('E8-')),false,'first-domain score cannot adjudicate an open reply');
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
  assert.match(brief, /事件级直接裁决.*比较困难/);
  assert.match(brief, /取象参考（规则模板，不是新增证据或已发生结果，不要求复述）.*临场发挥/);

  const evasive = ai.runReplyValidation(chart, '流年财破印，印星代表学习，情况需要综合分析，也存在多种可能。', '我高考那年能不能考上？');
  assert.ok(evasive.some(item => item.startsWith('E9-封闭问题未直接裁决')));
  const direct = ai.runReplyValidation(chart, '结论：比较困难。2026年学业考试方向偏不利，临场发挥与录取推进容易受阻。', '我高考那年能不能考上？');
  assert.equal(direct.some(item => item.startsWith('E9-')), false);
});

test('婚事完成和关系压力分开，领域偏不利不能机械判不婚或离婚', () => {
  const relationship = {
    domain:'relationship', label:'婚恋合作', direction:'偏不利', confidence:'高', activationScore:9,
    eventCandidate:'关系边界与稳定性受考验', evidence:['流年冲日支'], hasIndependentAnnualTrigger:true,
    scenarioCandidates:['关系边界、争执或合作稳定性更容易受考验']
  };
  const chart = { type:'bazi', timingAdjudication:{ requestedYear:{ year:2027, adjudication:{ year:2027, age:29, primaryEvent:relationship, domainRecords:[relationship] } } } };

  const divorce = ai.buildTimingAdjudicationBrief('2027年会离婚吗？', chart);
  assert.match(divorce, /用户问的是“离婚”/);
  assert.doesNotMatch(divorce, /第一句话必须直接回答“关系破裂风险较高”/);
  const marriage = ai.buildTimingAdjudicationBrief('2027年能不能结婚？', chart);
  assert.match(marriage, /用户问的是“结婚完成”/);
  assert.match(marriage, /没有经过案例验证的婚事完成分类器/);
  assert.match(marriage, /配偶星参与、宫位及岁运具体作用/);
  assert.doesNotMatch(marriage, /降低结婚|第一句话必须直接回答“推进比较困难”/);

  const evasive = ai.runReplyValidation(chart, '2027年婚恋合作受到流年冲日支影响，需要结合双方情况综合看。', '2027年会离婚吗？');
  assert.ok(evasive.some(item => item.startsWith('E9-婚恋事项答非所问')));
  const direct = ai.runReplyValidation(chart, '离婚不是这条日支被冲就能定下来的结果；这里直接支持的是夫妻争执，尚没有解除婚姻的独立依据。', '2027年会离婚吗？');
  assert.equal(direct.some(item => item.startsWith('E9-')), false);
});

function relationshipChart(direction = '偏不利', independent = true) {
  const record = {
    domain:'relationship', label:'婚恋合作', direction, confidence:'高', activationScore:9,
    eventCandidate:'伴侣相处的压力', evidence:['流年辛合丙日主', '丑刑日戌'],
    hasIndependentAnnualTrigger:independent, concreteOutcomeEstablished:false,
    relationshipScopes:['marriage']
  };
  return { type:'bazi', timingAdjudication:{ requestedYear:{ year:2021,
    adjudication:{ year:2021, age:34, primaryEvent:record, domainRecords:[record] }
  } } };
}

test('开放前事问答的婚事候选也不由相处吉凶裁决，明确问相处仍校验方向', () => {
  for (const independent of [true, false]) {
    const chart = relationshipChart('偏不利', independent);
    const year = chart.timingAdjudication.requestedYear.year;
    const reply = year + '年我优先列出结婚这个候选。婚事更容易推进，依据是年干合日主；这不代表夫妻相处顺利，是否完成要与事实对照。';
    const warnings = ai.runReplyValidation(chart, reply, year + '年发生过什么具体事情？');
    assert.equal(warnings.some(w => /^E8-(?:应期方向冲突|把大运背景冒充流年应期)/.test(w)), false);
    const quality = ai.runReplyValidation(chart, '这一年婚恋方向偏有利，相处更容易推进，结婚也是一个候选。', year + '年感情整体如何？');
    assert.ok(quality.some(w => w.startsWith('E8-应期方向冲突')));
  }
});

test('positive marriage candidate is not blocked by adverse relationship quality or incomplete domain trigger flag', () => {
  const q = '2021年会不会结婚？';
  const answer = '我会把2021年结婚列为首选候选。辛财星与丙日主相合，岁运对关系位置的作用同时需要核对；相处有摩擦不等于婚事不能完成。这是传统取象候选，不是已发生事实。';
  for (const direction of ['偏不利','偏有利','条件性']) {
    for (const independent of [true,false]) {
      const chart = relationshipChart(direction, independent);
      const record = chart.timingAdjudication.requestedYear.adjudication.primaryEvent;
      assert.equal(ai.closedOutcomeVerdict(record, q), null);
      const warnings = ai.runReplyValidation(chart, answer, q);
      assert.equal(warnings.some(w => /^E[89]-/.test(w)), false, warnings.join('\n'));
    }
  }
});

test('unverified completion-looking fields cannot create a marriage verdict', () => {
  const record = relationshipChart('偏有利').timingAdjudication.requestedYear.adjudication.primaryEvent;
  Object.assign(record, { marriageCompleted:true, outcome:'结婚', verified:true, confidence:'高' });
  for (const q of ['2021年能不能结婚？','2021年会离婚吗？','2021年能领证吗？']) {
    assert.equal(ai.closedOutcomeVerdict(record, q), null);
  }
});

test('恋爱同居订婚领证婚礼离婚分居分手复合分别回答', () => {
  const cases = [
    ['能恋爱吗','恋爱或确定交往关系'],['能同居吗','同居'],['能订婚吗','订婚'],
    ['能领证吗','登记领证'],['能登记结婚吗','登记领证'],['能办婚礼吗','举办婚礼'],
    ['会结婚吗','结婚完成'],['会离婚吗','离婚'],['会分居吗','分居'],
    ['会分手吗','分手'],['能复合吗','复合']
  ];
  for (const [q, expected] of cases) {
    assert.equal(ai.detectRelationshipOutcomeEvent('2021年'+q).key, expected);
    assert.equal(ai.detectTimingQuestionDomain(q), 'relationship');
  }
  for (const [q, wrong] of [
    ['2021年能领证吗？','2021年恋爱有机会。'],
    ['2021年能办婚礼吗？','2021年可以把领证列为候选。'],
    ['2021年会离婚吗？','2021年有分居的倾向。'],
    ['2021年会分居吗？','2021年可能会争吵。']
  ]) assert.ok(ai.runReplyValidation(relationshipChart(), wrong, q).some(w => w.startsWith('E9-婚恋事项答非所问')));
});

test('已发生恋爱分手领证是背景，不成为本轮必须再预测的结局', () => {
  const cases = [
    ['我恋爱五年了，2021年能结婚吗？','结婚完成','2021年结婚是首选候选，具体仍要核对岁运依据。'],
    ['去年分手，2021年能不能复合？','复合','2021年复合不是现有证据的首选；不能把联系恢复当成重新在一起。'],
    ['已经领证，2021年能办婚礼吗？','举办婚礼','2021年办婚礼有推进线索，登记完成的背景不重复当作本年事件。']
  ];
  for (const [q, key, reply] of cases) {
    assert.equal(ai.detectRelationshipOutcomeEvent(q).key, key);
    assert.equal(ai.runReplyValidation(relationshipChart(), reply, q).some(w=>w.startsWith('E9-')), false);
  }
  assert.equal(ai.detectRelationshipOutcomeEvent('今年能领证和办婚礼吗？').key, '登记领证、举办婚礼');
});

test('只问相处质量与其他事件的方向契约仍保留', () => {
  const chart = relationshipChart('偏不利');
  const warnings = ai.runReplyValidation(chart, '2021年感情方向偏有利。', '2021年感情整体如何？');
  assert.ok(warnings.some(w => w.startsWith('E8-应期方向冲突')));
  const record = { direction:'偏不利', hasIndependentAnnualTrigger:true, activationScore:8 };
  for (const [q, expected] of [
    ['会不会破财？','破财风险较高'],['会不会失业？','岗位中断风险较高'],
    ['能否考上？','比较困难'],['能不能升职？','推进比较困难'],
    ['能不能回款？','兑现比较困难'],['会不会换工作？','变动倾向较强']
  ]) assert.equal(ai.closedOutcomeVerdict(record,q),expected);
});

test('事故、破财、失业等负面事件使用风险高低而不是好运坏运套话', () => {
  const health = {
    domain:'health', label:'身心安全', direction:'偏不利', confidence:'高', activationScore:10,
    eventCandidate:'行动安全与身体负担受考验', evidence:['驿马逢日支受扰'], hasIndependentAnnualTrigger:true
  };
  const chart = { type:'bazi', timingAdjudication:{ requestedYear:{ year:2028, adjudication:{ year:2028, age:30, primaryEvent:health, domainRecords:[health] } } } };
  const brief = ai.buildTimingAdjudicationBrief('2028年会不会发生车祸？', chart);
  assert.match(brief, /用户问的是“事故、受伤或医疗事件”/);
  assert.match(brief, /第一句话必须直接回答“风险较高”/);
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
