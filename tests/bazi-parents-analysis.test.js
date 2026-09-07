const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function chart(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('父母星固定采用偏财看父、正印看母，不随性别互换', () => {
  const calculator = loadCalculator();
  const bazi = chart(['丙寅', '丁卯', '甲子', '戊辰']);
  const male = calculator.analyzeParents(bazi, 'male');
  const female = calculator.analyzeParents(bazi, 'female');

  assert.equal(male.fatherStar, '偏财');
  assert.equal(male.motherStar, '正印');
  assert.equal(female.fatherStar, '偏财');
  assert.equal(female.motherStar, '正印');
});

test('父母星扫描完整四柱，能够识别日支母星与时柱父星', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['丙寅', '丁卯', '甲子', '戊辰']), 'female');
  const fatherPositions = result.evidence.parentStars.father.appearances.map(item => item.pos);
  const motherPositions = result.evidence.parentStars.mother.appearances.map(item => item.pos);

  assert.ok(fatherPositions.includes('hour'));
  assert.ok(motherPositions.includes('day'));
  assert.match(result.fatherText, /时干戊/);
  assert.match(result.motherText, /日支本气癸/);
});

test('年干生年支时按父生母解释，年支克年干时按母强父弱解释', () => {
  const calculator = loadCalculator();
  const fatherSupports = calculator.analyzeParents(chart(['甲午', '丙寅', '戊戌', '癸亥']), 'male');
  const motherDominates = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.equal(fatherSupports.evidence.palace.intraRelation, '生');
  assert.match(fatherSupports.parentsRelationshipText, /父亲更愿意迁就、支持母亲/);
  assert.equal(motherDominates.evidence.palace.intraRelation, '被克');
  assert.match(motherDominates.parentsRelationshipText, /母亲在家里更强势/);
});

test('父母宫与月柱相冲会进入受损状态并明确说明家庭反复', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.equal(result.evidence.palace.state, 'damaged');
  assert.ok(result.evidence.palace.damageEvents.some(event => event.pair === '申寅' && event.type === '冲'));
  assert.match(result.familyText, /家庭结构不是一直平稳/);
  assert.match(result.parentsRelationshipText, /申寅冲/);
});

test('父母宫相合先判断合出五行喜忌，不再把合直接等同家庭融洽', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲子', '己丑', '丙寅', '戊戌']), 'male');

  assert.ok(result.evidence.palace.combinationEvents.some(event => event.pair === '子丑' && event.resultElement === '土'));
  assert.doesNotMatch(result.parentsRelationshipText, /家庭关系比较融洽/);
  assert.match(result.parentsRelationshipText, /相合后落到土/);
});

test('父母报告提供五段候选解释并把结构证据与推断分层', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  for (const field of ['familyText', 'fatherText', 'motherText', 'parentsRelationshipText', 'childRelationshipText']) {
    assert.ok(result[field].length > 20, field);
  }
  assert.equal(result.evidence.methodVersion, 'parents-v4-evidence-inference-split');
  assert.equal(result.facts, undefined);
  assert.ok(['supportive', 'mixed', 'limited'].includes(result.inferences.family.level));
});

test('父母星跨柱出现时按透干与藏气权重判断主要落点', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲申', '丙寅', '戊戌', '癸亥']), 'male');

  assert.match(result.fatherText, /年支中气壬、时支本气壬/);
  assert.match(result.fatherText, /力量较实的一处在时柱/);
  assert.match(result.fatherText, /本身有根，但根所在的位置同时受冲害/);
  assert.doesNotMatch(result.fatherText, /主要落在年柱/);
  assert.doesNotMatch(result.fatherText, /父亲星根气偏弱/);
});

test('亲疏判断按父母星主要力量而非任一余气位置判定', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲午', '丙寅', '戊戌', '癸亥']), 'male');

  assert.match(result.motherText, /力量较实的一处在年柱/);
  assert.match(result.childRelationshipText, /正印的主要力量离日主较远/);
  assert.doesNotMatch(result.childRelationshipText, /正印的主要力量靠近日主/);
});

test('父母星完全不现时不再误写成远隔或藏而不透', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['甲子', '己丑', '丙寅', '戊戌']), 'female');

  assert.equal(result.fatherPresent, false);
  assert.equal(result.motherPresent, false);
  assert.match(result.childRelationshipText, /正印不现/);
  assert.match(result.childRelationshipText, /偏财不现/);
  assert.doesNotMatch(result.childRelationshipText, /远隔或藏而不透/);
});

test('时柱透根且日支食伤生父星时不误判父子疏远', () => {
  const calculator = loadCalculator();
  const result = calculator.analyzeParents(chart(['癸未', '庚申', '甲寅', '戊辰']), 'male');
  const fatherRelationship = result.inferences.relationship.father;

  assert.equal(fatherRelationship.close, true);
  assert.equal(fatherRelationship.exposedNear, true);
  assert.ok(fatherRelationship.interestChannels.some(item => item.pos === 'day'));
  assert.match(result.childRelationshipText, /不是疏远型关系/);
  assert.match(result.childRelationshipText, /共同话题/);
  assert.match(result.childRelationshipText, /理解并支持你想做的方向/);
  assert.doesNotMatch(result.childRelationshipText, /父亲平时话不算多/);
  assert.doesNotMatch(result.fatherText, /平时联系不算密集/);
  assert.match(result.fatherText, /不能直接拿来判断亲子感情、沟通多少或对方是否支持你/);
});

test('AI 上下文完整传入父母宫星同参五段候选和可校正边界', () => {
  const calculator = loadCalculator();
  const parentAnalysis = calculator.analyzeParents(chart(['癸未', '庚申', '甲寅', '戊辰']), 'male');
  const context = require('../api/ai-chat.js')._test.buildChartContext({ parentAnalysis });

  assert.match(context, /父母关系推断候选（宫星同参，可被用户真实经历校正）/);
  assert.equal(parentAnalysis.analysisType, 'interpretive_hypothesis');
  assert.equal(parentAnalysis.userCorrectable, true);
  assert.equal(parentAnalysis.realityPriority, 'user_confirmed_experience');
  assert.match(context, /性质：规则推断，不是现实事实；可校正=是/);
  assert.match(context, /方法版本：parents-v4-evidence-inference-split/);
  assert.match(context, /父星结构证据：偏财/);
  assert.match(context, /母星结构证据：正印/);
  assert.match(context, /父母宫结构证据：癸未/);
  assert.match(context, /家庭根基：/);
  assert.match(context, /父亲：/);
  assert.match(context, /母亲：/);
  assert.match(context, /父母之间：/);
  assert.match(context, /本人与父母：/);
  assert.match(context, /单一十神不能直接判断亲疏、沟通、支持、健康或寿元/);
  assert.match(context, /用户明确陈述的实际关系与经历优先/);
});

test('单盘页面把父母宫星同参结论加入 AI 数据而不是只显示在前端', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'ai-chat-integration.js'), 'utf8');
  assert.match(source, /data\.parentAnalysis = BaZiCalculator\.analyzeParents\(_bazi/);
});

test('网页把父母与婚姻输出明确标注为可校正取象', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
  assert.match(source, /宫星同参形成的候选解释，不是现实关系的既成事实/);
  assert.match(source, /夫妻宫结构生成的取象参考，不代表已经发生的婚姻事实/);
  assert.match(source, /真实恋爱与婚姻经历优先/);
});

test('父母关系属于可校正推断，不再触发硬事实冲突', () => {
  const chartData = {
    parentAnalysis: { inferences: { relationship: { father: { close: true }, mother: { close: false } } } }
  };
  const warnings = require('../api/ai-chat.js')._test.runReplyValidation(chartData, '你和父亲关系平淡，平时沟通少。');
  assert.equal(warnings.some((item) => item.startsWith('E1-父亲关系冻结冲突')), false);
});

test('系统指令明确用户真实经历高于父母婚姻事业推断', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai-chat.js'), 'utf8');
  assert.match(source, /父母、婚姻、事业、财富、健康以及事件账本属于可校正推断/);
  assert.match(source, /用户明确陈述的本人真实经历.*是第一方事实，优先于这些推断/);
  assert.match(source, /不得为了维护旧推断而否定、淡化或曲解用户经历/);
  assert.match(source, /确认用户事实 → 指出哪条旧推断未得到现实佐证 → 保留相应结构证据 → 从其他机制重新解释/);
  assert.match(source, /若它与 parentAnalysis、dayBranchAnalysis、palaceAnalysis、fortuneAnalysis、liuNianAnalysis、eventLedger 或合盘描述等可校正推断冲突，必须以用户经历为准/);
  assert.doesNotMatch(source, /若与本次 chartData 冲突，必须以本次排盘事实为准，不得用记忆改盘/);
});

test('宫位远近只提供结构取象，不把事业家庭晚年写成事实', () => {
  const palaceAnalysis = {
    analysisType: 'structural_hypothesis',
    userCorrectable: true,
    inferenceBoundary: '柱位和十神分布属于结构证据；家庭、事业、晚年等现实表现属于候选取象。',
    monthDesc: '月柱结构候选',
    hourDesc: '时柱结构候选',
    yearDesc: '年柱结构候选',
    summary: '只记录结构候选'
  };
  const context = require('../api/ai-chat.js')._test.buildChartContext({ palaceAnalysis });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'ai-chat-integration.js'), 'utf8');

  assert.match(context, /宫位结构证据与候选取象（可被真实经历校正）/);
  assert.match(context, /宫位解读候选/);
  assert.match(context, /用户确认的实际经历优先/);
  assert.doesNotMatch(source, /一生压力随身|根基稳固。/);
});

test('夫妻宫把结构事实与婚姻经历推断分开', () => {
  const calculator = loadCalculator();
  const dayBranchAnalysis = calculator.analyzeDayBranch(chart(['戊辰', '乙丑', '辛巳', '甲午']));
  const context = require('../api/ai-chat.js')._test.buildChartContext({ dayBranchAnalysis });

  assert.equal(dayBranchAnalysis.analysisType, 'interpretive_hypothesis');
  assert.equal(dayBranchAnalysis.userCorrectable, true);
  assert.match(context, /日支（夫妻宫）结构证据与婚姻推断候选/);
  assert.match(context, /稳定度候选（可被真实经历校正）/);
  assert.match(context, /用户已确认的恋爱、结婚、离婚、分居等经历优先/);
});
