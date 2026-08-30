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

test('财官印相生要求三者透干有根且官星清纯', () => {
  const pattern = resolved(['癸未', '丁亥', '己未', '甲子']);
  assert.equal(pattern.name, '财官印相生格');
  assert.equal(pattern.status, '成格');
  assert.ok(pattern.establishConditions.every(row => row.met));
  assert.match(pattern.source, /财→.*官→.*印/);
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

test('伤官克官按最终喜用忌拆成制官与见官', () => {
  const control = resolved(['丁未', '乙未', '庚子', '癸酉']);
  const damage = resolved(['己巳', '癸巳', '丙寅', '丁未']);
  assert.equal(control.name, '伤官制官格');
  assert.equal(control.status, '成格');
  assert.match(control.source, /官星为忌，伤官为喜用/);
  assert.equal(damage.name, '建禄格');
  const damageRelation = damage.relatedPatterns.find(row => row.name === '伤官见官格');
  assert.equal(damageRelation.status, '破格');
  assert.match(damageRelation.breakReasons.join('；'), /喜用正官/);
});

test('伤官制官力量超过两倍时不伪装成好格', () => {
  const pattern = resolved(['丙申', '己未', '辛亥', '壬戌']);
  assert.equal(pattern.name, '偏印格');
  const excessive = pattern.relatedPatterns.find(row => row.name === '伤官制官太过格');
  assert.equal(excessive.status, '破格');
  assert.ok(excessive.breakReasons.includes('伤官制官太过'));
});

test('偏印克食神按任务和喜忌拆成制食与夺食', () => {
  const control = resolved(['甲寅', '乙酉', '丙申', '戊寅']);
  const damage = resolved(['癸酉', '戊寅', '乙酉', '丁丑']);
  assert.equal(control.name, '枭神制食格');
  assert.equal(control.status, '成格');
  assert.match(control.source, /食神为忌，偏印为喜用/);
  assert.equal(damage.name, '枭神夺食格');
  assert.equal(damage.status, '破格');
  assert.match(damage.source, /制杀、生财任务|食神为喜用/);
});

test('枭神制食力量超过两倍时转为制食太过', () => {
  const pattern = resolved(['戊寅', '庚午', '庚戌', '壬子']);
  assert.equal(pattern.name, '枭神制食太过格');
  assert.equal(pattern.status, '破格');
  assert.ok(pattern.breakReasons.includes('枭神制食太过'));
});

test('专业报告和喜用忌共享同一后置格局裁决', () => {
  const bazi = build(['丁未', '乙未', '庚子', '癸酉']);
  const yongJi = E.getYongJi(bazi);
  const facts = E.getProfessionalReportFacts(bazi, 'male');
  assert.equal(yongJi.patternStatus.name, '伤官制官格');
  assert.equal(facts.pattern.name, '伤官制官格');
  assert.equal(facts.pattern.basePattern, yongJi.resolvedPattern.basePattern);
});
