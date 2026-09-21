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

const E = loadCalculator();
function build(values) {
  const p = values.map(gz => ({ gan:gz[0], zhi:gz[1] }));
  return E.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}
function resolved(values) {
  return E.getYongJi(build(values)).resolvedPattern;
}

test('五行专旺格只在原从强硬条件全部成立后细分命名', () => {
  const cases = [
    [['甲寅', '乙卯', '甲寅', '癸亥'], '曲直仁寿格'],
    [['甲寅', '丙午', '丙午', '甲午'], '炎上格'],
    [['丙午', '戊辰', '戊戌', '丁未'], '稼穑格'],
    [['戊申', '辛酉', '庚申', '庚申'], '从革格'],
    [['庚申', '壬子', '壬子', '辛亥'], '润下格'],
  ];
  cases.forEach(([pillars, name]) => {
    const pattern = E.getPattern(build(pillars));
    assert.equal(pattern.name, name);
    assert.equal(pattern.zhuanWang, true);
  });
  assert.notEqual(E.getPattern(build(['甲寅', '丙午', '丙午', '壬子'])).name, '炎上格', '天干透七杀且地支逆势时不得冒充炎上');
});

test('从势格按余气印比分成真从与假从', () => {
  const trueFollowing = E.getPattern(build(['戊寅', '丁卯', '壬寅', '己未']));
  const falseFollowing = E.getPattern(build(['丁未', '丙申', '乙酉', '戊辰']));
  assert.equal(trueFollowing.name, '从势格');
  assert.equal(trueFollowing.trueFollowing, true);
  assert.equal(falseFollowing.name, '假从势格');
  assert.equal(falseFollowing.trueFollowing, false);
});

test('财官印相生要求透干有根、印为核心用神且通路无已知阻碍', () => {
  const pattern = resolved(['甲午', '丁丑', '己卯', '癸酉']);
  assert.equal(pattern.name, '财官印相生格');
  assert.equal(pattern.status, '成格');
  assert.ok(pattern.establishConditions.every(row => row.met));
  assert.match(pattern.source, /财→.*官→.*印/);
});

test('原三透有根样本财印贴邻且印非核心用神时保留月令主格', () => {
  const pattern = resolved(['癸未', '丁亥', '己未', '甲子']);
  assert.equal(pattern.name, '正财格');
  const chain = pattern.relatedPatterns.find(p => p.name === '财官印相生格');
  assert.equal(chain.status, '条件待定');
  assert.equal(chain.breakReasons.length, 0, '待核条件不冒充硬破格证据');
  assert.ok(chain.pendingReasons.some(r => r.includes('财印贴邻')));
  assert.ok(chain.pendingReasons.some(r => r.includes('不是本局核心用神')));
});

test('同一有根通路按印的最终作用裁决，不反向改写旺衰与喜用', () => {
  const bazi = build(['甲午', '丁丑', '己卯', '癸酉']);
  const base = E.getPattern(bazi);
  for (const role of ['喜神', '忌神', undefined]) {
    const pattern = E.adjudicatePattern(bazi, base, {火:role});
    assert.notEqual(pattern.name, '财官印相生格');
    const chain = pattern.relatedPatterns.find(p => p.name === '财官印相生格');
    assert.equal(chain.status, '条件待定');
    assert.ok(chain.establishConditions.some(c => c.condition === '印星为核心用神' && !c.met));
  }
  assert.equal(E.adjudicatePattern(bazi, base, {火:'用神'}).name, '财官印相生格');
});

test('财印五合只记录牵制待核，不凭有根断成格或擅断合化', () => {
  const pattern = resolved(['庚辰', '乙酉', '丁亥', '壬寅']);
  const chain = pattern.relatedPatterns.find(p => p.name === '财官印相生格');
  assert.equal(chain.status, '条件待定');
  assert.ok(chain.pendingReasons.some(r => r.includes('年干庚与月干乙五合')));
  assert.ok(chain.establishConditions.some(c => c.condition === '印星为核心用神' && c.met));
  assert.ok(chain.establishConditions.some(c => c.condition === '链条节点无相互合绊' && !c.met));
  assert.equal(chain.breakReasons.length, 0);
});

test('埋金漂木证据不能被财官印三透有根覆盖', () => {
  for (const [pillars, seal] of [[['乙卯', '己丑', '庚午', '丁丑'], '土'], [['壬子', '庚子', '乙亥', '己丑'], '水']]) {
    const bazi = build(pillars);
    // 独立校验阻断证据，不依赖喜用分类恰好先拦住此盘。
    const pattern = E.adjudicatePattern(bazi, E.getPattern(bazi), {[seal]:'用神'});
    const chain = pattern.relatedPatterns.find(p => p.name === '财官印相生格');
    assert.equal(chain.status, '条件待定');
    assert.ok(chain.establishConditions.some(c => c.condition === '财官印全部透干有根' && c.met));
    assert.ok(chain.establishConditions.some(c => c.condition === '印生身无已知失效证据' && !c.met));
  }
});

test('财官印待核证据传递到专业报告，月令格保持一致', () => {
  const bazi = build(['庚辰', '乙酉', '丁亥', '壬寅']);
  const yong = E.getYongJi(bazi), facts = E.getProfessionalReportFacts(bazi, 'male');
  assert.equal(facts.pattern.name, yong.resolvedPattern.name);
  assert.deepEqual(facts.pattern.relatedPatterns, yong.resolvedPattern.relatedPatterns);
  assert.ok(facts.pattern.relatedPatterns.some(p => p.name === '财官印相生格' && p.pendingReasons.length > 0));
  const context = require('../api/ai-chat.js')._test.buildChartContext({pattern:facts.pattern, yongJi:yong});
  assert.match(context, /兼见结构：财官印相生格·条件待定/);
  assert.match(context, /年干庚与月干乙五合/);
  assert.match(context, /不得称已成格或已破格/);
});

test('伤官合杀只认天干真实五合且双方有根', () => {
  const pattern = resolved(['戊辰', '辛酉', '丁未', '癸亥']);
  assert.equal(pattern.name, '伤官合杀格');
  assert.equal(pattern.status, '成格');
  assert.ok(pattern.establishConditions.some(row => row.condition === '伤官与七杀真实五合' && row.met));
  assert.ok(pattern.establishConditions.some(row => row.condition === '伤官七杀双方有根' && row.met));
});

test('羊刃驾杀必须从羊刃基础格起步且七杀透干有根', () => {
  const pattern = resolved(['庚申', '己巳', '己丑', '乙未']);
  assert.equal(pattern.name, '羊刃驾杀格');
  assert.equal(pattern.status, '成格');
  assert.equal(pattern.basePattern, '羊刃格·成格');
  assert.ok(pattern.establishConditions.some(row => row.condition === '七杀透干有根' && row.met));
});

test('官杀去留只认明确五合去掉一方', () => {
  const leaveOfficer = resolved(['丁卯', '壬申', '丙子', '癸酉']);
  const leaveKilling = resolved(['丙申', '壬子', '庚辰', '丁亥']);
  assert.equal(leaveOfficer.name, '去杀留官格');
  assert.equal(leaveOfficer.status, '成格');
  assert.equal(leaveKilling.name, '去官留杀格');
  assert.equal(leaveKilling.status, '成格');
});

test('伤官克官先检查财星通关，负面机制不覆盖月令主格', () => {
  const control = resolved(['丁未', '乙未', '庚子', '癸酉']);
  const damage = resolved(['己巳', '癸巳', '丙寅', '丁未']);
  // 子癸水已经有根，未月暑燥受制衡后，不能再靠“未月必润”把官星压成忌神。
  assert.equal(control.name, '正官格');
  const controlRisk = control.relatedPatterns.find(row => row.name === '伤官官星相见');
  assert.equal(controlRisk.status, '条件待定');
  assert.match(controlRisk.source, /财星承接伤官并转生正官/);
  assert.ok(control.structuralMechanisms.some(row => row.name === '伤官生财、财生官'));
  assert.equal(damage.name, '建禄格');
  const damageRelation = damage.relatedPatterns.find(row => row.name === '伤官见官格');
  assert.equal(damageRelation.status, '破格');
  assert.match(damageRelation.breakReasons.join('；'), /喜用正官/);
});

test('伤官制官力量超过两倍时不伪装成好格', () => {
  // 单独验证裁决层的两倍门槛；不依赖某一取用短路规则产生的五行分类。
  const chart = build(['丙子', '己亥', '辛亥', '壬子']);
  const pattern = E.adjudicatePattern(chart, E.getPattern(chart), {水:'喜神',火:'忌神'});
  const excessive = pattern.relatedPatterns.find(row => row.name === '伤官制官太过格');
  assert.equal(excessive.status, '破格');
  assert.ok(excessive.breakReasons.includes('伤官制官太过'));
});

test('丙火可由未戌中的丁火通根，不能用漏根的旧力量比裁成制官太过', () => {
  const chart = build(['丙申', '己未', '辛亥', '壬戌']);
  const settlement = E.buildEvidenceSettlement(chart);
  assert.ok(settlement.stemAt('year').rootPower > 0);
  assert.ok(settlement.stemAt('hour').effectivePower < 2 * settlement.stemAt('year').effectivePower);
  const pattern = resolved(['丙申', '己未', '辛亥', '壬戌']);
  assert.ok(!pattern.relatedPatterns.some(row => row.name === '伤官制官太过格'));
});

test('偏印克食神按任务和喜忌拆成制食与夺食', () => {
  const control = resolved(['甲寅', '乙酉', '丙申', '戊寅']);
  const damage = resolved(['癸酉', '戊寅', '乙酉', '丁丑']);
  assert.equal(control.name, '枭神制食格');
  assert.equal(control.status, '成格');
  assert.match(control.source, /食神为忌，偏印为喜用/);
  assert.equal(damage.name, '羊刃格');
  const damageRisk = damage.relatedPatterns.find(row => row.name === '枭神夺食格');
  assert.equal(damageRisk.status, '破格');
  assert.match(damageRisk.source, /制杀、生财任务|食神为喜用/);
});

test('枭神制食的过度判定读取结算后根气', () => {
  const diverted = resolved(['戊寅', '庚午', '庚戌', '壬子']);
  assert.equal(diverted.name, '枭神制食格');
  assert.equal(diverted.status, '成格');

  const excessive = resolved(['壬子', '丙午', '甲申', '壬辰']);
  assert.equal(excessive.name, '伤官格');
  const excessiveRisk = excessive.relatedPatterns.find(row => row.name === '枭神制食太过格');
  assert.equal(excessiveRisk.status, '破格');
  assert.ok(excessiveRisk.breakReasons.includes('枭神制食太过'));
});

test('专业报告和喜用忌共享同一后置格局裁决', () => {
  const bazi = build(['丁未', '乙未', '庚子', '癸酉']);
  const yongJi = E.getYongJi(bazi);
  const facts = E.getProfessionalReportFacts(bazi, 'male');
  assert.equal(yongJi.patternStatus.name, '正官格');
  assert.equal(facts.pattern.name, '正官格');
  assert.ok(facts.pattern.relatedPatterns.some(row => row.name === '伤官官星相见' && row.status === '条件待定'));
  assert.ok(facts.pattern.structuralMechanisms.some(row => row.name === '伤官生财、财生官'));
});

test('伤官生财再生官时以完整通关链为主，不误裁成伤官见官', () => {
  const bazi = build(['庚辰', '戊子', '乙巳', '丙戌']);
  const strength = E.calcDayMasterStrength(bazi, { audit:true });
  const yongJi = E.getYongJi(bazi);
  const pattern = yongJi.resolvedPattern;

  assert.equal(strength.level, '偏弱');
  assert.equal(strength.score, 39);
  assert.equal(strength.audit.stages.find(row => row.id === 'seal-command-carrier').delta, -16);
  assert.equal(pattern.name, '偏印格');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.structuralMechanisms.some(row => row.name === '伤官生财、财生官' && row.status === '成立'));
  assert.ok(pattern.relatedPatterns.some(row => row.name === '伤官官星相见' && row.status === '条件待定'));
  assert.equal(yongJi.weaknessCause.type, '食伤财官连压');
  assert.equal(yongJi.yongShen[0], '水');
});
