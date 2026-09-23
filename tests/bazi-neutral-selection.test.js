const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Synthetic mechanism fixtures and calendar-generated dates only. Loading is
// isolated from environment files, production services and the local data store.
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const box = { window:{} };
vm.runInNewContext(read('js/bazi.js'), box);
const E = box.window.BaZiCalculator;
const plain = value => JSON.parse(JSON.stringify(value));
const elements = ['木', '火', '土', '金', '水'];
function chart(text) {
  const p = text.split(' ').map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return E.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}
const zeroChart = E.calculate(2019, 1, 20, 7, 'male', 14 + 1 / 60);
const zero = E.getYongJi(zeroChart);

test('真实日期全零需求：根气排序不能凭空确定首用或喜忌', () => {
  assert.equal(['year','month','day','hour'].map(p => zeroChart[p].gan + zeroChart[p].zhi).join(' '), '戊戌 乙丑 丁巳 丁未');
  assert.equal(zero.dayMasterScore, 50);
  assert.ok(zero.candidateScores.every(c => c.SBase === 0 && c.SNeed === 0));
  assert.equal(zero.selectionStatus, 'undetermined');
  for (const field of ['yongShen','xiShen','jiShen']) assert.deepEqual(plain(zero[field]), []);
  assert.deepEqual(plain(zero.neutralElements), elements);
  assert.equal(zero.tiebreak.winner, null);
  assert.equal(zero.yongShenSource.element, '');
  assert.equal(zero.yongShenSource.primaryType, '取用待定');
  assert.equal(zero.method, '取用待定');
  assert.match(zero.primaryReason, /不足以确定唯一用神/);
  assert.ok(zero.evidence.some(e => e.category === '取用复核'));
  assert.doesNotMatch(zero.reasoning + zero.primaryReason + JSON.stringify(zero.evidence), /undefined|null|以为核心|取土/);
});

test('纯机制夹具：结构需求全零时独立调候证据仍保留，不能替代核心用神', () => {
  // No calendar example was found in the bounded scan. Inject an isolated L4
  // task at the scorer boundary, then exercise the real selection/finalization.
  const marker = 'cs = calcCandidateScores(bazi, dmStr, pattern);';
  const source = read('js/bazi.js');
  assert.equal(source.split(marker).length, 2);
  const scope = {window:{}};
  vm.runInNewContext(source.replace(marker, marker + `
    cs.SNeed['火'] = 6;
    cs.candidates.forEach(function(c) { if (c.wx === '火') { c.L4 = 6; c.SNeed = 6; } });
    cs.tiaoHouYongShen = ['火'];
    cs.tiaoHouNote = '机制夹具：火承担有条件的暖局任务，不替代核心结构需求。';
  `), scope);
  const result = scope.window.BaZiCalculator.getYongJi(zeroChart);
  assert.equal(result.selectionStatus, 'undetermined');
  assert.deepEqual(plain(result.yongShen), []);
  assert.deepEqual(plain(result.tiaoHouYongShen), ['火']);
  assert.equal(result.yongShenSource.element, '');
  assert.equal(result.elementReasons.火.tiaoHouRole, '调候用神');
  assert.match(result.elementReasons.火.tiaoHouReason, /不替代核心结构需求/);
  assert.equal(result.elementRoleLedger.entries.find(e => e.element === '火').tiaoHouRole, '调候用神');
  assert.ok(result.evidence.some(e => e.category === '调候'));
  assert.ok(!result.neutralElements.includes('火'));
  assert.ok(result.candidateScores.every(c => c.role === result.elementClassification[c.wx]));
  const person = {name:'测试',_professionalFacts:{yongJi:result}};
  vm.runInNewContext(read('js/hepan-core.js'), scope);
  const pair = scope.window._hepanHelpers.analyzeXiyong(person, person);
  assert.deepEqual(plain(pair.p1.tiaoHouYongShen), ['火']);
  assert.equal(pair.p1.selectionStatus, 'undetermined');
});

test('非零近中和需求保留原决胜规则，候选角色与最终弱喜弱忌一致', () => {
  const result = E.getYongJi(chart('甲子 丁卯 己未 庚午'));
  assert.equal(result.dayMasterScore, 51);
  assert.equal(result.selectionStatus, 'determined');
  assert.deepEqual(plain(result.yongShen), ['木']);
  assert.deepEqual(plain(result.xiShen), ['木','金','水']);
  assert.deepEqual(plain(result.jiShen), ['火','土']);
  assert.equal(result.elementClassification.金, '弱喜');
  assert.equal(result.elementClassification.火, '弱忌');
  result.candidateScores.forEach(c => assert.equal(c.role, result.elementClassification[c.wx]));
});

test('抵消为零仍保留明确病因的条件辅助，不能当普通喜神增补', () => {
  const result = E.getYongJi(chart('己巳 庚午 甲辰 庚午'));
  const wood = result.candidateScores.find(c => c.wx === '木');
  assert.equal(wood.L1, 40);
  assert.equal(wood.L2, -40);
  assert.equal(wood.SNeed, 0);
  assert.equal(wood.role, '条件喜神');
  assert.ok(result.conditionalAuxiliaryElements.includes('木'));
  assert.match(result.conditionalAuxiliaryReason, /印|制泄/);
  assert.ok(!result.xiShen.includes('木') && !result.jiShen.includes('木'));
  assert.deepEqual(plain(result.yongShen), ['水']);
});

for (const [pillars, yong] of [['丁亥 丁未 辛未 戊戌', '水'], ['丙寅 己亥 庚申 庚辰', '火']]) {
  test(pillars + '：已有调候硬边界的取用来源完整一致', () => {
    const result = E.getYongJi(chart(pillars));
    assert.deepEqual(plain(result.yongShen), [yong]);
    assert.equal(result.method, '调候为主');
    assert.equal(result.yongShenSource.primaryType, '调候用神');
    assert.deepEqual(plain(result.tiaoHouYongShen), [yong]);
    assert.match(result.primaryReason, new RegExp('核心用神为' + yong));
    assert.match(result.primaryReason, /寒暖燥湿/);
    assert.equal(result.yongShenSource.basis, result.primaryReason);
    assert.ok(result.evidence.some(e => e.category === '调候'));
    assert.equal(result.elementRoleLedger.entries.find(e => e.element === yong).tiaoHouRole, '调候用神');
  });
}

test('已润未月弱金不误触发调候硬边界', () => {
  const result = E.getYongJi(chart('壬子 丁未 辛丑 戊子'));
  assert.deepEqual(plain(result.yongShen), ['土']);
  assert.equal(result.yongShenSource.primaryType, '扶抑用神');
  assert.notEqual(result.method, '调候为主');
  assert.deepEqual(plain(result.tiaoHouYongShen), []);
});

test('零证据角色账本、岁运基础方向与财富方位不补出隐含忌神或财星用神', () => {
  for (const entry of zero.elementRoleLedger.entries) {
    assert.equal(entry.fortuneRole, '中性');
    assert.notEqual(entry.natalRole, '原局为病');
    assert.equal(zero.elementReasons[entry.element].role, '中性');
    const direction = E.classifyFortuneElement(entry.element, zero, '测试');
    assert.equal(direction.baseScore, 0);
    assert.equal(direction.score, 0);
    assert.equal(direction.role, '中性');
  }
  const wealth = E.analyzeWealth(zeroChart, 'male', zero);
  assert.equal(wealth.goodDirection, '待定');
  assert.equal(wealth.badDirection, '待定');
  assert.deepEqual(plain(wealth.goodCities), []);
  assert.deepEqual(plain(wealth.badCities), []);
  assert.match(wealth.caiAdvice, /取用尚未确定/);
  assert.doesNotMatch(wealth.wealthSummary, /财库方向/);
  assert.match(E.getProfessionalReportFacts(zeroChart, 'male').summary, /核心用神尚未确定/);
});

test('岁运并临的中性五行不能因不在喜神清单而默认成忌神', () => {
  vm.runInNewContext(read('js/bazi-chain.js'), box);
  const result = box.window.BaZiChain.analyzeLiuNian(zeroChart, {gan:'乙',zhi:'卯'}, {gan:'乙',zhi:'卯'}, zero);
  const trigger = result.triggers.find(t => t.type === '岁运并临');
  assert.equal(trigger.isGood, null);
  assert.match(trigger.detail, /不能仅凭岁运并临判吉凶/);
});

test('合盘保留未定状态，不把空喜用说成双方方向不合或补缺加分', () => {
  vm.runInNewContext(read('js/hepan-core.js'), box);
  const helpers = box.window._hepanHelpers;
  const person = (name, wx) => ({ name, gender:'male', wuxing:wx, _professionalFacts:{yongJi:zero} });
  const a = person('甲', {木:0,火:3,土:3,金:1,水:0});
  const b = person('乙', {木:2,火:0,土:0,金:2,水:4});
  const result = helpers.analyzeXiyong(a, b);
  assert.equal(result.p1.selectionStatus, 'undetermined');
  assert.deepEqual(plain(result.p1.neutralElements), elements);
  assert.match(result.complementDetail, /未定不等于方向相反/);
  assert.deepEqual(plain(helpers.analyzeWuxingComplement(a, b).complementPairs), []);
});

function renderFunction(file, start, end, name, globals = {}) {
  const source = read(file), a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'renderer source boundary changed');
  const scope = {...globals};
  vm.runInNewContext(source.slice(a, b), scope);
  return scope[name];
}
test('个人、专业和合盘实际渲染函数显示未定与中性，避免空用神定论', () => {
  const personal = renderFunction('js/result.js', 'function renderElementRoleLedgerHtml(', 'function renderYongJi(', 'renderElementRoleLedgerHtml');
  const professional = renderFunction('js/pro-analysis.js', 'function renderElementRoleLedger(', '  // ============ 喜用忌神', 'renderElementRoleLedger');
  for (const render of [personal, professional]) {
    const html = render(zero);
    assert.match(html, /data-yong-selection="undetermined"/);
    assert.match(html, /核心用神尚未确定/);
    assert.match(html, />中性</);
    assert.doesNotMatch(html, /undefined|null|土运总体偏顺/);
  }
  const pair = renderFunction('js/hepan-result.js', 'function renderXiyongCard(', '  // =====================================================', 'renderXiyongCard', {escapeHtml:String});
  assert.match(pair('测试', [], [], [], zero), /尚未确定/);
  assert.match(pair('测试', [], [], [], zero), /木、火、土、金、水/);
});

function loadAI(replies = []) {
  const events = [], requests = [];
  const scopeModule = {exports:{}};
  vm.runInNewContext(read('lib/hepan-reply-scopes.js'), {module:scopeModule});
  const db = {
    getUserCredits:async () => 10, isMonthlyActiveByUserId:async () => false,
    deductCreditByUser:async () => {events.push('charged'); return {credits:9};},
    saveUserChatHistory:async (_, role) => events.push('save-' + role)
  };
  const api = {module:{exports:{}}, process:{env:{AI_API_KEY:'fixture-only'}}, console:{log(){},warn(){},error(){}}, setTimeout, clearTimeout, AbortController,
    require(name) {
      if (name === '../lib/supabase.js') return db;
      if (name === '../lib/auth.js') return {requireAuth:() => ({uid:'fixture-user'}),getClientIp:() => '192.0.2.1'};
      if (name === '../lib/ai-abuse-guard.js') return {beginAiRequest:() => ({ok:true,release:() => events.push('release')})};
      if (name === '../lib/ziwei-context.js') return {buildZiweiContext:() => ''};
      if (name === '../lib/hepan-reply-scopes.js') return scopeModule.exports;
      if (name === 'crypto') return require('node:crypto');
      throw new Error('unexpected dependency: ' + name);
    }, async fetch(_, options) {
      requests.push(JSON.parse(options.body));
      const reply = replies[requests.length - 1];
      assert.equal(typeof reply, 'string', 'unexpected model call');
      return {ok:true,json:async () => ({choices:[{message:{content:reply}}]})};
    }
  };
  vm.runInNewContext(read('api/ai-chat.js'), api);
  return {handler:api.module.exports, api, events, requests};
}

test('AI冻结字段校验只拦肯定式断言，兼容旧数据、否定与假设', () => {
  const {handler} = loadAI();
  const data = {type:'bazi', yongJi:zero};
  const validate = text => handler._test.runReplyValidation(data, text, '').filter(w => w.startsWith('E1-取用'));
  for (const text of ['用神为木。','核心用神：土。','喜神水。','忌神是金。','以火为用神。','**用神**：土。','之前尚未确定。用神为木。','之前尚未确定。\n用神为木。','尚未完成复核，但用神为木。']) assert.ok(validate(text).length, text);
  for (const text of ['核心用神尚未确定。','尚不能确定用神为木。','目前不能确定，用神为木只是待核的假设。','水并非忌神。','假设：用神为木，需要另行核对。','若以土为用神，还要核对其依据。','调候用神为火，核心用神尚未确定。', '用神为木的说法尚无依据。','用神为木是否成立还需核对。','木作为用神的条件尚未满足。','忌神水这一结论不能成立。','不能据此断定：\n用神为木。']) assert.equal(validate(text).length, 0, text);
  assert.equal(handler._test.runReplyValidation({type:'bazi',yongJi:{yongShen:[]}}, '用神为木。', '').filter(w => w.startsWith('E1-取用')).length, 0);
  const context = handler._test.buildChartContext(data);
  assert.match(context, /核心用神尚未确定/);
  assert.match(context, /中性.*木、火、土、金、水/);
  assert.doesNotMatch(context, /用神来源：/);
  const pair = {type:'hepan',person1:{name:'甲',yongJi:zero},person2:{name:'乙',yongJi:zero}};
  assert.ok(handler._test.runReplyValidation(pair,'甲方用神土，乙方核心用神木。','').filter(w => w.startsWith('E1-合盘')).length >= 2);
});

test('合盘新中性元数据接管标签校验，旧清单不能重新拦截假设和否定', () => {
  const {handler} = loadAI();
  const pending = {selectionStatus:'determined', yongShen:['火'],xiShen:['火'],jiShen:['金'],neutralElements:['木','水']};
  const pair = {type:'hepan',person1:{name:'甲',yongJi:pending},person2:{name:'乙',yongJi:pending}};
  const validate = text => handler._test.runReplyValidation(pair, text, '').filter(w => w.startsWith('E1-合盘喜用'));
  for (const text of ['甲方用神为木的说法尚无依据。','甲方用神为木是否成立还需核对。','甲方忌神水这一结论不能成立。','甲方：假设用神为木，需要另行核对。','甲方水并非忌神。','甲方木作为用神的条件尚未满足。','甲方以火作为用神。','甲方不能据此断定：\n用神为木。']) assert.equal(validate(text).length, 0, text);
  for (const text of ['甲方用神为木。','甲方忌神是水。','甲方喜神为木。','甲方之前尚未完成复核。甲方用神为木。','甲方以木作为用神。','甲方不能据此断定：\n乙方用神为木。','甲方不能据此断定：\n\n用神为木。','甲方尚未完成复核。\n用神为木。']) assert.ok(validate(text).length, text);
  const normal = {type:'hepan',person1:{name:'甲',yongJi:{...pending,neutralElements:[]}},person2:{name:'乙',yongJi:{...pending,neutralElements:[]}}};
  assert.ok(handler._test.runReplyValidation(normal, '甲方用神水。', '').some(w => w.startsWith('E1-合盘喜用')));
});

for (const repaired of [false, true]) {
  test('AI未定首用的真实处理入口：一次修正后' + (repaired ? '通过才扣次' : '仍冲突不扣次、不保存回答'), async () => {
    const bad = '用神为土。土是当前唯一首要调节力量，建议据此理解五行方向。';
    const good = '核心用神尚未确定。现有五行取用证据不足，根气排序不能代替需求依据，需继续复核。';
    const {handler, events, requests} = loadAI([bad, repaired ? good : bad]);
    const res = {statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'POST',headers:{},body:{question:'这份判读应如何理解',chartData:{type:'bazi',yongJi:zero}}}, res);
    assert.equal(requests.length, 2);
    assert.equal(res.statusCode, repaired ? 200 : 502);
    assert.equal(events.filter(e => e === 'charged').length, repaired ? 1 : 0);
    assert.equal(events.filter(e => e === 'save-assistant').length, repaired ? 1 : 0);
    if (!repaired) {
      assert.equal(res.body.code, 'YONGJI_VALIDATION_FAILED');
      assert.equal(res.body.charged, false);
      assert.equal(res.body.reply, undefined);
    }
  });
}
