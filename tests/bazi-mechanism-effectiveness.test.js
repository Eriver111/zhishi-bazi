const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const box = {window:{}};
for (const name of ['bazi.js','structural.js','bazi-chain.js']) vm.runInNewContext(fs.readFileSync(path.join(root,'js',name),'utf8'),box);
const E = box.window.BaZiCalculator;
const chart = text => E.buildFromPillars(Object.fromEntries(text.split(' ').map((s,i) =>
  [['year','month','day','hour'][i],{gan:s[0],zhi:s[1]}])), 'male');
const actions = text => E.evaluateMechanismEvidence(chart(text)).byId;

test('食神制杀区分真实七杀、正官与仅藏余气，不能见水就说比劫抗杀', () => {
  assert.equal(actions('丙寅 戊辰 甲寅 庚申').food_kill.stage,'effective');
  assert.equal(actions('丙寅 戊辰 甲寅 辛酉').food_kill.stage,'absent');
  const weakFire = actions('丙戌 丙申 丙申 戊戌');
  assert.equal(weakFire.food_kill.stage,'relation');
  assert.equal(weakFire.peer_resist_kill.stage,'relation');
  assert.match(weakFire.peer_resist_kill.summary,/不是食伤制杀/);
});

test('相生同现不等于全效：燥土生金受限，换湿土仅撤销润燥限制', () => {
  const dry = actions('丙戌 丙申 丙申 戊戌').food_wealth;
  const moist = actions('丙戌 丙申 丙申 戊辰').food_wealth;
  assert.equal(dry.stage,'partial');
  assert.match(dry.summary,/燥土润泽不足/);
  assert.equal(moist.stage,'effective');
  assert.doesNotMatch(moist.summary,/燥土润泽不足/);
  assert.equal(E.getYongJi(chart('丙戌 丙申 丙申 戊戌')).yongShen[0],'木');
});

test('有根财印受贴邻五合牵制，不能用根气覆盖阻碍', () => {
  const a = actions('庚辰 乙酉 丁亥 壬寅');
  for (const id of ['wealth_seal','seal_support','officer_seal']) {
    assert.equal(a[id].stage,'blocked',id);
    assert.equal(a[id].established,false);
    assert.match(a[id].summary,/五合牵制/);
  }
});

test('遥合未落实不撤销生克；月令本气仍可参与配印任务', () => {
  const y = E.getYongJi(chart('壬子 甲子 丁卯 丁酉'));
  assert.equal(y.mechanismEvidence.byId.kill_seal.stage,'effective');
  assert.equal(y.resolvedPattern.formationStatus,'成立');
  const p = E.getYongJi(chart('辛丑 辛卯 壬申 庚子'));
  assert.equal(p.mechanismEvidence.byId.seal_hurting.stage,'effective');
  assert.match(p.mechanismEvidence.byId.seal_hurting.summary,/月支卯本气乙/);
  assert.ok(p.functionalTasks.some(t => t.type === '印星制伤护格'));
});

test('杀生印不代表印能生身：财克印存在时保留通关代价', () => {
  assert.equal(actions('甲寅 壬子 甲寅 庚申').kill_seal.stage,'effective');
  const a = actions('戊寅 壬子 甲寅 庚申');
  assert.equal(a.wealth_seal.stage,'effective');
  assert.equal(a.seal_support.stage,'partial');
  assert.equal(a.kill_seal.stage,'partial');
  assert.match(a.kill_seal.summary,/后段印生身未畅通/);
});

test('枭制食不能把受损的制杀任务删除后改称有功', () => {
  for (const text of ['庚申 壬午 甲午 丙寅','甲辰 丙寅 戊午 庚申']) {
    const y = E.getYongJi(chart(text));
    assert.equal(y.mechanismEvidence.byId.food_kill.stage,'partial');
    assert.notEqual(y.resolvedPattern.name,'枭神制食格');
    assert.ok(y.resolvedPattern.relatedPatterns.some(x => x.name === '枭神夺食格'));
  }
  const bound = E.getYongJi(chart('癸酉 戊寅 乙酉 丁丑'));
  assert.equal(bound.mechanismEvidence.byId.owl_food.stage,'blocked');
  assert.ok(!bound.resolvedPattern.relatedPatterns.some(x => x.name === '枭神夺食格'));
});

test('L3成立奖励读作用证据，保留独立扶抑需求与明确的待定原因', () => {
  const b = chart('癸未 戊午 乙卯 丙戌'), p = E.getPattern(b);
  const score = box.calcCandidateScores(b,E.calcDayMasterStrength(b),p);
  assert.equal(p.status,'条件待定');
  assert.match(p.pendingReasons.join('；'),/合化/);
  assert.equal(score.L3['土'],0);
  assert.equal(score.L3['火'],0);
  assert.ok(score.L1['水'] > 0);
  const y = E.getYongJi(b);
  assert.equal(y.yongShen[0],'水');
  assert.ok(!y.resolvedPattern.structuralMechanisms.some(x => /生财/.test(x.name)));
});

test('弱身有真实连续流通仍成立，但流通不等于能担财官', () => {
  const b = chart('庚辰 戊子 乙巳 丙戌'), y = E.getYongJi(b);
  assert.equal(y.dayMasterLevel,'偏弱');
  assert.equal(y.weaknessCause.type,'食伤财官连压');
  assert.ok(y.resolvedPattern.structuralMechanisms.some(x => x.name === '伤官生财、财生官'));
  assert.equal(y.yongShen[0],'水');
  assert.match(y.mechanismSummary.mainCause,/承载|泄|耗|克/);
});

test('岁运区分已有根重复增加、藏干透出和与原局合牵，基础喜忌不翻转', () => {
  const y = E.getYongJi(chart('丙戌 丙申 丙申 戊戌'));
  const addedWood = E.classifyFortuneElement('木',y,'测试',{type:'branch',symbol:'寅',companionSymbol:'甲',companionElement:'木'});
  assert.equal(addedWood.role,'用神');
  assert.equal(addedWood.incrementReview.purpose,'补入原局缺项');
  assert.match(addedWood.incrementReview.summary,/寅申冲/);
  assert.ok(addedWood.carrierAdjustment <= 0,'有冲关系不能额外获得无条件补根奖励');
  const boundWater = E.classifyFortuneElement('水',y,'测试',{type:'stem',symbol:'癸',companionSymbol:'亥',companionElement:'水'});
  assert.match(boundWater.incrementReview.summary,/原局戊有五合/);
  assert.equal(boundWater.carrierAdjustment,0);
  const y2 = E.getYongJi(chart('壬子 甲子 丁卯 丁酉'));
  const repeated = E.classifyFortuneElement('木',y2,'测试',{type:'branch',symbol:'卯',companionSymbol:'乙',companionElement:'木'});
  assert.equal(repeated.incrementReview.purpose,'增加已有力量');
  assert.equal(repeated.carrierAdjustment,0);
  assert.equal(y2.yongShen[0],'木');
});

test('五行均有功过与增量边界；作用证据不冒充家庭事实', () => {
  const b = chart('丙戌 丙申 丙申 戊戌'), parents = JSON.stringify(E.analyzeParents(b,'male'));
  const y = E.getYongJi(b);
  assert.equal(y.elementRoleLedger.entries.length,5);
  for (const e of y.elementRoleLedger.entries) {
    assert.ok(e.tradeoff.benefit && e.tradeoff.cost && e.tradeoff.incrementCondition);
    for (const id of e.tradeoff.established) assert.equal(y.mechanismEvidence.byId[id].stage,'effective');
  }
  assert.equal(JSON.stringify(E.analyzeParents(b,'male')),parents);
  assert.match(y.mechanismSummary.scope,/不回写家庭/);
});

test('链分析保留受阻证据，但不把受阻关系合成连续流通或已成取象', () => {
  const b = chart('癸未 戊午 乙卯 丙戌'), y = E.getYongJi(b), chain = box.window.BaZiChain;
  const a = chain.analyze(b), i = chain.interpret(b,y);
  const output = a.mechanisms.find(x => x.name === '食伤生财');
  assert.equal(output.actionStage,'blocked');
  assert.ok(!a.paths.some(x => x.steps.includes('食伤生财')));
  assert.ok(!i.imagery.some(x => x.name === '食伤生财'));
});

test('报告、AI使用同一主因、帮助和代价，保留机制程度而非重新猜测', () => {
  const DeepReport = require('../js/deep-report.js');
  const b = chart('丙戌 丙申 丙申 戊戌');
  const f = DeepReport.buildFacts(b,'male',{anchorYear:2026,deps:{calculator:E,structural:box.window.StructuralAnalysis,chain:box.window.BaZiChain}});
  const y = f.core.yongJi;
  assert.equal(f.storyline.mechanismAccount.cause,y.mechanismSummary.mainCause);
  assert.equal(f.storyline.mechanismAccount.cost,y.mechanismSummary.cost);
  const source = fs.readFileSync(path.join(root,'api/ai-chat.js'),'utf8');
  const match = source.match(/function buildSingleChart\(data\) \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\*\*/);
  const context = new Function('data',match[1])({yongJi:y,pattern:f.core.pattern});
  assert.ok(context.includes(y.mechanismSummary.mainCause));
  assert.match(context,/食神生财：部分成立/);
  assert.match(context,/财克印不自动等于财破喜印/);
});
