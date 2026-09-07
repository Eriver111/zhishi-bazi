const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const handler = require('../api/ai-chat.js');

function person(id, role, name, gender, pillars) {
  return {
    personId: id, roleLabel: role, name, gender,
    birthInfo: { name, gender },
    fourPillars: Object.fromEntries(['year', 'month', 'day', 'hour'].map((pos, i) => [pos, {
      gan: pillars[i][0], zhi: pillars[i][1]
    }])),
    dayMaster: { gan: pillars[2][0], wuXing: id === 'P1' ? '火' : '水' }
  };
}

function withDaYun(base, startAge, cycles) {
  return {
    ...base,
    daYun: {
      direction: base.gender === 'male' ? '顺行' : '逆行',
      startAge,
      cycles: cycles.map(([displayAge, gz], index) => ({
        displayAge: String(displayAge), gan: gz[0], zhi: gz[1],
        startYear: 2000 + index * 10, endYear: 2009 + index * 10
      }))
    }
  };
}

test('合盘上下文用双身份锁完整隔离甲乙四柱', () => {
  const chart = {
    type: 'hepan', relationType: '情侣',
    person1: person('P1', '甲方', '青禾', 'male', ['甲子', '乙丑', '丙寅', '丁卯']),
    person2: person('P2', '乙方', '知夏', 'female', ['庚午', '辛未', '壬申', '癸酉'])
  };
  const context = handler._test.buildChartContext(chart);
  assert.match(context, /甲方身份锁：P1｜青禾｜男｜四柱 甲子 乙丑 丙寅 丁卯/);
  assert.match(context, /乙方身份锁：P2｜知夏｜女｜四柱 庚午 辛未 壬申 癸酉/);
  assert.match(context, /\[P1\/甲方，只属于甲方\]/);
  assert.match(context, /\[P2\/乙方，只属于乙方\]/);
});

test('合盘上下文逐人携带起运年龄和完整大运顺序', () => {
  const chart = {
    type: 'hepan', relationType: '情侣',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉'], [26, '丙戌']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子'], [24, '辛亥']])
  };
  const context = handler._test.buildChartContext(chart);
  assert.match(context, /P1\/person1\.daYun/);
  assert.match(context, /大运（逆行，5\.2岁起运）/);
  assert.match(context, /6岁：甲申/);
  assert.match(context, /16岁：乙酉/);
  assert.match(context, /大运（顺行，3\.4岁起运）/);
  assert.match(context, /4岁：癸丑/);
});

test('合盘回复审计拦截双方大运互换或自行重排', () => {
  const chart = {
    type: 'hepan',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉'], [26, '丙戌']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子'], [24, '辛亥']])
  };
  const correct = handler._test.runReplyValidation(chart, '你（甲方，女）：\n- 6-15岁：甲申\n- 16-25岁：乙酉\n他（乙方，男）：\n- 4-13岁：癸丑\n- 14-23岁：壬子');
  assert.equal(correct.some(item => item.includes('合盘大运')), false);

  const wrong = handler._test.runReplyValidation(chart, '你（甲方，女）：6岁起运\n- 6-15岁：丙子\n- 16-25岁：丁丑\n他（乙方，男）：4岁起运\n- 4-13岁：甲申');
  assert.ok(wrong.some(item => item.includes('甲方6-15岁') && item.includes('甲申')));
  assert.ok(wrong.some(item => item.includes('乙方4-13岁') && item.includes('癸丑')));
});

test('合盘回复审计按男女称呼映射回甲乙方校验大运', () => {
  const chart = {
    type: 'hepan',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子']])
  };
  const correct = handler._test.runReplyValidation(chart, '女方：\n- 6-15岁：甲申\n男方：\n- 4-13岁：癸丑');
  assert.equal(correct.some(item => item.includes('合盘大运')), false);

  const wrong = handler._test.runReplyValidation(chart, '女方：\n- 6-15岁：癸丑\n男方：\n- 4-13岁：甲申');
  assert.ok(wrong.some(item => item.includes('甲方6-15岁') && item.includes('甲申')));
  assert.ok(wrong.some(item => item.includes('乙方4-13岁') && item.includes('癸丑')));
});

test('合盘回复审计拦截双方日主与旺衰张冠李戴', () => {
  const p1 = person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']);
  const p2 = person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']);
  p1.dayMasterStrength = { level: '偏弱', score: 41 };
  p2.dayMasterStrength = { level: '偏强', score: 68 };
  const chart = { type: 'hepan', person1: p1, person2: p2 };

  const correct = handler._test.runReplyValidation(chart, '你（甲方，女，戊土日主，命局偏弱）\n他（乙方，男，日主壬水，命局身强）');
  assert.equal(correct.some(item => item.includes('合盘日主归属') || item.includes('合盘旺衰归属')), false);

  const wrong = handler._test.runReplyValidation(chart, '甲方：日主壬水，命局偏强。\n乙方：戊土日主，旺衰为偏弱。');
  assert.ok(wrong.some(item => item.includes('合盘日主归属冲突：甲方') && item.includes('戊日主')));
  assert.ok(wrong.some(item => item.includes('合盘旺衰归属冲突：甲方') && item.includes('偏弱')));
  assert.ok(wrong.some(item => item.includes('合盘日主归属冲突：乙方') && item.includes('壬日主')));
  assert.ok(wrong.some(item => item.includes('合盘旺衰归属冲突：乙方') && item.includes('偏强')));
});

test('合盘回复审计拦截双方格局与喜用忌互换', () => {
  const p1 = person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']);
  const p2 = person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']);
  p1.pattern = { name: '正官格' };
  p2.pattern = { name: '建禄格' };
  p1.yongJi = { yongShen: ['火'], xiShen: ['土'], jiShen: ['金'] };
  p2.yongJi = { yongShen: ['土'], xiShen: ['火'], jiShen: ['水'] };
  const chart = { type: 'hepan', person1: p1, person2: p2 };

  const correct = handler._test.runReplyValidation(chart, '甲方：格局为正官格，用神火，喜神土，忌神金。\n乙方：主格：建禄格，用神土，喜神火，忌神水。');
  assert.equal(correct.some(item => item.includes('合盘格局归属') || item.includes('合盘喜用忌归属')), false);

  const wrong = handler._test.runReplyValidation(chart, '甲方：格局为建禄格，用神土，忌神水。\n乙方：主格：正官格，用神火，忌神金。');
  assert.ok(wrong.some(item => item.includes('合盘格局归属冲突：甲方') && item.includes('正官格')));
  assert.ok(wrong.some(item => item.includes('合盘喜用忌归属冲突：甲方') && item.includes('用神')));
  assert.ok(wrong.some(item => item.includes('合盘格局归属冲突：乙方') && item.includes('建禄格')));
  assert.ok(wrong.some(item => item.includes('合盘喜用忌归属冲突：乙方') && item.includes('忌神')));
});

test('合盘身份校验失败时返回双方冻结身份而不是错误推断', () => {
  const p1 = person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']);
  const p2 = person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']);
  p1.dayMasterStrength = { level: '偏弱' };
  p2.dayMasterStrength = { level: '偏强' };
  p1.pattern = { name: '正官格' };
  p1.yongJi = { yongShen: ['火'], xiShen: ['土'], jiShen: ['金'] };
  const fallback = handler._test.buildHepanIdentityFactFallback({ type: 'hepan', person1: p1, person2: p2 }, ['E1-合盘日主归属冲突']);
  assert.match(fallback, /甲方（我，女）/);
  assert.match(fallback, /四柱：戊寅 癸未 戊辰 丁巳/);
  assert.match(fallback, /日主：戊/);
  assert.match(fallback, /旺衰：偏弱/);
  assert.match(fallback, /主格：正官格/);
  assert.match(fallback, /喜用忌：用神：火；喜神：土；忌神：金/);
  assert.match(fallback, /乙方（对方，男）/);
  assert.match(fallback, /日主：壬/);
  assert.equal(handler._test.runReplyValidation({ type: 'hepan', person1: p1, person2: p2 }, fallback).some(item => item.startsWith('E1-合盘')), false);
});

test('合盘大运校验失败时只返回双方各自冻结的排盘事实', () => {
  const chart = {
    type: 'hepan',
    person1: withDaYun(person('P1', '甲方', '我', 'female', ['戊寅', '癸未', '戊辰', '丁巳']), 5.2, [[6, '甲申'], [16, '乙酉']]),
    person2: withDaYun(person('P2', '乙方', '对方', 'male', ['乙亥', '壬午', '壬子', '辛亥']), 3.4, [[4, '癸丑'], [14, '壬子']])
  };
  const fallback = handler._test.buildHepanDaYunFactFallback(chart);
  assert.match(fallback, /甲方（我，女）/);
  assert.match(fallback, /6-15岁：甲申/);
  assert.match(fallback, /16-25岁：乙酉/);
  assert.match(fallback, /乙方（对方，男）/);
  assert.match(fallback, /4-13岁：癸丑/);
  assert.match(fallback, /14-23岁：壬子/);
  assert.equal(handler._test.runReplyValidation(chart, fallback).some(item => item.includes('合盘大运')), false);
});

test('合盘回复关系校验会读取双方地支，不把跨盘三合误报为缺员', () => {
  const chart = {
    type: 'hepan',
    person1: person('P1', '甲方', '甲', 'male', ['甲申', '乙寅', '丙午', '丁戌']),
    person2: person('P2', '乙方', '乙', 'female', ['庚子', '辛卯', '壬辰', '癸酉'])
  };
  const warnings = handler._test.runReplyValidation(chart, '甲方申与乙方子、辰构成申子辰三合水局。');
  assert.equal(warnings.some((item) => item.includes('三合水缺少成员')), false);
});

test('合盘页面加载会话隔离并以 hepan 类型装饰请求', () => {
  const html = fs.readFileSync(path.join(root, 'hepan-result.html'), 'utf8');
  const integration = fs.readFileSync(path.join(root, 'js', 'ai-chat-integration.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api', 'ai-chat.js'), 'utf8');
  assert.match(html, /chat-persistence\.js\?v=3/);
  assert.match(integration, /p\._daYunData\.list\.map/);
  assert.match(integration, /d\.currentDaYun = currentCycle/);
  assert.match(integration, /d\.parentAnalysis = BaZiCalculator\.analyzeParents\(p\._bazi/);
  assert.match(integration, /d\.fortuneAnalysis = window\.BaZiChain\.analyzeFortune\(p\._bazi, d\.daYun\.cycles, d\.yongJi\)/);
  assert.match(integration, /chartData\.type === 'hepan' \? 'hepan'/);
  assert.match(api, /conversation\.mode !== conversationMode/);
  assert.match(api, /conversation\.chart_key !== chart_key/);
  assert.match(api, /【合盘身份锁】/);
});

test('合盘父母分析保持在双方各自身份区块内', () => {
  const p1 = person('P1', '甲方', '甲', 'male', ['甲子', '乙丑', '丙寅', '丁卯']);
  const p2 = person('P2', '乙方', '乙', 'female', ['庚午', '辛未', '壬申', '癸酉']);
  p1.parentAnalysis = { fatherText: '甲方父亲冻结结论', motherText: '甲方母亲冻结结论' };
  p2.parentAnalysis = { fatherText: '乙方父亲冻结结论', motherText: '乙方母亲冻结结论' };
  const context = handler._test.buildChartContext({ type: 'hepan', person1: p1, person2: p2 });
  const p1Start = context.indexOf('--- [P1/甲方');
  const p2Start = context.indexOf('--- [P2/乙方');

  assert.ok(context.indexOf('甲方父亲冻结结论') > p1Start && context.indexOf('甲方父亲冻结结论') < p2Start);
  assert.ok(context.indexOf('乙方父亲冻结结论') > p2Start);
});

test('合盘上下文只传结构证据，不把评分和关系文案冻结为现实事实', () => {
  const chart = {
    type: 'hepan', relationType: '情侣',
    person1: person('P1', '甲方', '甲', 'male', ['甲子', '乙丑', '丙寅', '丁卯']),
    person2: person('P2', '乙方', '乙', 'female', ['庚午', '辛未', '壬申', '癸酉']),
    score: { total: 88, label: '很高' },
    analysis: {
      dailyRelation: { ganRelation: '合', zhiRelation: '六冲', ganDesc: '你们天生幸福', score: 99 },
      dayGanStrength: { p1Strength: { level: '偏强' }, p2Strength: { level: '偏弱' }, detail: '甲方一定更强势' },
      xiyong: { p1: { yongShen: ['水'] }, p2: { yongShen: ['火'] }, complementDetail: '命中注定互补' },
      crossPillars: [{ type: '冲', pillar1: '甲的日柱(丙寅)', pillar2: '乙的日柱(壬申)', detail: '一定经常争吵' }],
      coreMode: { detail: '婚姻必定幸福' },
      yearlyAdvice: [{ detail: '今年一定结婚' }],
      dosAndDonts: { dos: ['共同投资成功率90%'] }
    }
  };
  const context = handler._test.buildChartContext(chart);
  assert.match(context, /契合度规则指数（仅供排序解释，非现实质量或概率）：88/);
  assert.match(context, /合盘结构证据与关系推断边界/);
  assert.match(context, /"ganRelation": "合"/);
  assert.match(context, /"zhiRelation": "六冲"/);
  assert.match(context, /用户确认的真实相处经历优先/);
  assert.doesNotMatch(context, /你们天生幸福|甲方一定更强势|命中注定互补|一定经常争吵|婚姻必定幸福|今年一定结婚|成功率90%/);
});

test('合盘核心输出声明推断边界且不再宣称共同投资成功率更高', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'hepan-core.js'), 'utf8');
  assert.match(source, /analysisType: 'relationship_hypothesis'/);
  assert.match(source, /userCorrectable: true/);
  assert.match(source, /契合评分、性格、相处模式、关系结果、宜忌与年度事项属于候选推断/);
  assert.doesNotMatch(source, /日支相生是个好兆头|成功率比别人高/);
});

test('合盘前端把分数标为规则指数并展示现实经历优先边界', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'hepan-result.js'), 'utf8');
  assert.match(source, /规则结构指数（非现实相处评分）/);
  assert.match(source, /五行互补规则指数/);
  assert.match(source, /关系规则指数/);
  assert.match(source, /若与你们的真实经历不一致，以真实经历为准/);
  assert.doesNotMatch(source, /互补度评分：|契合评分：/);
});

test('回复审计把命理数字概率标记为软警告', () => {
  const chart = { fourPillars: {} };
  const warnings = handler._test.runReplyValidation(chart, '得到家人庇护的概率约七至八成，事业成功率70%。');
  assert.ok(warnings.filter((item) => item.startsWith('E5-伪概率')).length >= 2);
  assert.equal(handler._test.runReplyValidation(chart, '日主评分70分，证据置信度为中。').some((item) => item.startsWith('E5')), false);
});

test('用户诱导 AI 改判旺衰并重新取用时触发硬事实警告', () => {
  const chart = { dayMasterStrength: { level: '中和', score: 57 } };
  const wrong = handler._test.runReplyValidation(chart, '按身弱视角重排：此局属于身弱喜帮扶之象，用火土。');
  assert.ok(wrong.some((item) => item.startsWith('E1-冻结旺衰改判')));

  const comparison = handler._test.runReplyValidation(chart, '系统结论是中和。其他流派可能称为偏弱，但本站不据此改判。');
  assert.equal(comparison.some((item) => item.startsWith('E1-冻结旺衰改判')), false);
});

test('缺少排运字段时拦截 AI 自行编造当前大运和具体年份', () => {
  const chart = { fourPillars: {}, dayMasterStrength: { level: '中和' } };
  const reply = '您目前走的是壬申大运。当前流年2026丙午，2034年是最需要留意的年份。';
  const warnings = handler._test.runReplyValidation(chart, reply);
  assert.ok(warnings.some((item) => item.startsWith('E1-缺失大运却自行排运')));
  assert.ok(warnings.some((item) => item.startsWith('E1-缺失岁运却断具体年份')));
  assert.ok(warnings.some((item) => item.startsWith('E1-缺失流年却自行排年')));

  const safe = handler._test.runReplyValidation(chart, '当前缺少完整大运排盘信息，不能给出具体年份判断。');
  assert.equal(safe.some((item) => item.startsWith('E1-缺失')), false);
});

test('拦截把原局喜用五行机械写成整步岁运必顺', () => {
  const chart = { yongJi: { yongShen: ['水'] } };
  const warnings = handler._test.runReplyValidation(chart, '岁运见水，才是真正顺遂之时。');
  assert.ok(warnings.some((item) => item.startsWith('E1-机械岁运结论')));
  const safe = handler._test.runReplyValidation(chart, '水是原局基础有利方向，具体水运仍需结合干支与原局复核。');
  assert.equal(safe.some((item) => item.startsWith('E1-机械岁运结论')), false);
});

test('格局条件未提供时拦截 AI 自行补造条件清单', () => {
  const chart = { pattern: { name: '伤官格', status: '成格' } };
  const warnings = handler._test.runReplyValidation(chart, '三条成格条件均满足，因此层次很高。');
  assert.ok(warnings.some((item) => item.startsWith('E1-虚构格局条件')));
});
