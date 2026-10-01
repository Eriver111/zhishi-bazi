const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report.js');

function fixture(overrides = {}) {
  const base = {
    core: { strength: { level: '中和' }, pattern: {}, yongJi: { yongShen: ['木'], xiShen: ['火'], jiShen: ['金'] }, actionChains: [], relationEvents: [], structuralRisks: [] },
    lifeContext: { status: 'working', age: 30 },
    wealth: { resource: { visibleCount: 1, hiddenCount: 1, quality: {} }, capacity: { state: '可承接' }, pathways: [], retention: { risks: [] }, storage: { rows: [] }, partialWealth: { strong: false } },
    relationship: {}, study: { relevant: false, profile: { key: 'composite' }, limitations: [] },
    fiveYear: { years: [] }
  };
  return { ...base, ...overrides, wealth: { ...base.wealth, ...overrides.wealth }, study: { ...base.study, ...overrides.study } };
}
const pathFact = (effect = 'favorable', type = '食伤生财') => ({ type, effect, positive: true, evidence: ['合成链路依据'] });
const narrative = facts => Report.buildNarratives(facts).career;
const keys = n => n.verdicts.map(row => row.meaningKey);
const visible = n => [n.headline, ...n.verdicts.filter(row => !row.detailOnly).map(row => row.outcomeText)].join(' ');
const outcome = (n, key) => n.verdicts.find(row => row.meaningKey === 'career-choice:' + key);

test('only a favorable output-to-income path with carrying capacity selects the skills route', () => {
  const strong = narrative(fixture({ wealth: { pathways: [pathFact()] } }));
  assert.equal(strong.decisionProfile, 'skills-service');
  assert.ok(outcome(strong, 'industry-output'));
  assert.ok(outcome(strong, 'business-conditions'));
  assert.match(outcome(strong, 'business-conditions').outcomeText, /订单|客户/);
  assert.match(outcome(strong, 'business-conditions').outcomeText, /成本|现金/);
  for (const effect of ['mixed', 'adverse']) {
    const weak = narrative(fixture({ wealth: { pathways: [pathFact(effect)] } }));
    assert.equal(weak.decisionProfile, 'compare-offers', effect);
    assert.ok(!outcome(weak, 'industry-output'), effect);
    assert.ok(!outcome(weak, 'business-conditions'), effect);
  }
  const unknown = narrative(fixture({ wealth: { pathways: [{ positive: true, type: '食伤生财' }] } }));
  assert.equal(unknown.decisionProfile, 'compare-offers');
  const blocked = narrative(fixture({ wealth: { pathways: [{ ...pathFact(), positive: false }] } }));
  assert.equal(blocked.decisionProfile, 'compare-offers');
  const limited = narrative(fixture({ wealth: { capacity: { state: '有缓解' }, pathways: [pathFact()] } }));
  assert.notEqual(limited.decisionProfile, 'skills-service');
  assert.ok(!outcome(limited, 'business-conditions'));
});

test('pressure takes priority over an otherwise favorable skills or organization path', () => {
  for (const type of ['食伤生财', '财官印连续流通']) {
    const n = narrative(fixture({ wealth: { capacity: { state: '承压' }, pathways: [pathFact('favorable', type)] } }));
    assert.equal(n.decisionProfile, 'income-first');
    assert.match(outcome(n, 'income-first').outcomeText, /工资|固定进账|固定收入/);
    assert.ok(!outcome(n, 'business-conditions'));
    assert.doesNotMatch(visible(n), /一定亏损|注定亏损|必须辞职|适合高杠杆/);
  }
});

test('carrying pressure without a loss record does not assert that costs or losses already happened', () => {
  const n = narrative(fixture({ wealth: { capacity: { state: '承压' }, retention: { risks: [] } } }));
  assert.equal(n.decisionProfile, 'income-first');
  assert.doesNotMatch(outcome(n, 'income-first').outcomeText, /(?:已经|已然|早已)[^。；]{0,12}(?:发生|亏损|破财|垫款|分账)|已经先发生/);
});

test('investment and distribution risks block business expansion even with carrying capacity', () => {
  for (const type of ['投资后续投入', '比劫分流', '财党杀', '财破印']) {
    const n = narrative(fixture({ wealth: { pathways: [pathFact()], retention: { risks: [{ type }] } } }));
    assert.equal(n.decisionProfile, 'income-first', type);
    assert.ok(!outcome(n, 'business-conditions'), type);
  }
  const partnership = narrative(fixture({ wealth: { retention: { risks: [{ type: '比劫分流' }] } } }));
  assert.ok(outcome(partnership, 'partnership-cost'));
  assert.match(outcome(partnership, 'partnership-cost').outcomeText, /分钱|分成|利润/);
});

test('many visible partial-wealth stars alone never recommend speculation or entrepreneurship', () => {
  const n = narrative(fixture({ wealth: { partialWealth: { strong: true, exposedCount: 4, hiddenCount: 4 }, occurrences: [{ role: '偏财' }, { role: '偏财' }] } }));
  assert.equal(n.decisionProfile, 'compare-offers');
  assert.ok(!outcome(n, 'business-conditions'));
  assert.ok(!outcome(n, 'industry-output'));
  assert.doesNotMatch(visible(n), /适合(?:炒股|赌博|投机)|偏财旺.*创业|必.*赚/);
});

test('one official star does not establish an organization or civil-service career', () => {
  const f = fixture({ study: { discipline: { state: '有规则承接', evidence: ['正官出现'] }, chains: [] } });
  f.core.actionChains = ['正官出现'];
  const n = narrative(f);
  assert.equal(n.decisionProfile, 'compare-offers');
  assert.ok(!outcome(n, 'industry-qualification'));
  assert.ok(!outcome(n, 'work-environment'));
});

test('an established qualification route is conditional on real entry requirements and blocked by study breaks', () => {
  const supported = narrative(fixture({ study: { profile: { key: 'disciplined_guan_yin' }, limitations: [] } }));
  assert.equal(supported.decisionProfile, 'organized-platform');
  assert.match(outcome(supported, 'work-environment').outcomeText, /报考资格|考试表现/);
  const interrupted = narrative(fixture({ study: { profile: { key: 'disciplined_guan_yin' }, limitations: [{ key: 'wealth_breaks_seal' }] } }));
  assert.equal(interrupted.decisionProfile, 'compare-offers');
  assert.ok(!outcome(interrupted, 'industry-qualification'));
});

test('student and minor cases put work after schooling and retain the study-versus-practice choice', () => {
  for (const lifeContext of [{ status: 'student', age: 26 }, { status: 'unknown', age: 16 }]) {
    const n = narrative(fixture({ lifeContext, wealth: { pathways: [pathFact()] } }));
    assert.match(outcome(n, 'skills-service').outcomeText, /毕业后|以后/);
    assert.ok(outcome(n, 'education-choice'));
    assert.doesNotMatch(visible(n), /你(?:已经|目前|现在)(?:在公司|经营公司|有稳定客户)|应该退学|立刻创业/);
  }
});

test('home and retired cases condition work advice on opting into work or a side income', () => {
  for (const status of ['home', 'retired']) {
    const n = narrative(fixture({ lifeContext: { status, age: status === 'retired' ? 68 : 36 }, wealth: { pathways: [pathFact()] } }));
    assert.match(n.headline, /是否|还想|如果/);
    assert.match(outcome(n, 'skills-service').outcomeText, /如果.*工作|如果.*副业/);
    assert.ok(!outcome(n, 'education-choice'));
  }
});

test('unknown adult status does not become an employed person, business owner or student', () => {
  const n = narrative(fixture({ lifeContext: { status: 'unknown', age: 35 } }));
  assert.equal(n.decisionProfile, 'compare-offers');
  assert.ok(!outcome(n, 'education-choice'));
  assert.doesNotMatch(visible(n), /你(?:已经|现在|目前)(?:在公司|工作|经营|有客户|上学)|你(?:的公司|的客户)已经/);
});

test('city guidance uses practical comparisons and keeps symbolic directions out of the main decision', () => {
  const n = narrative(fixture({ wealth: { pathways: [pathFact()] } }));
  const city = outcome(n, 'city-criteria');
  assert.match(city.outcomeText, /岗位|客户/);
  assert.match(city.outcomeText, /收入|房租|生活费/);
  const direction = outcome(n, 'traditional-direction');
  assert.equal(direction.detailOnly, true);
  assert.match(direction.outcomeText, /不.*城市.*吉凶/);
  assert.match(direction.outcomeText, /不.*颜色.*改变.*收入/);
  assert.doesNotMatch(visible(n), /北京|上海|深圳|广州|杭州|喜水.*沿海|穿.*颜色.*(?:旺财|转运)/);
});

test('missing wealth input yields no career module rather than a confident fallback', () => {
  assert.equal(Report.buildNarratives({}).career, null);
  assert.equal(Report.buildNarratives({ wealth: { capacity: { state: '承压' } } }).career, null);
});

test('career build and recalibration attach the same fresh narrative without changing core or A grade', () => {
  const box = { window: {}, console };
  vm.createContext(box);
  for (const file of ['bazi.js', 'structural.js', 'bazi-chain.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), box);
  }
  const calculator = box.window.BaZiCalculator;
  const deps = { calculator, structural: box.window.StructuralAnalysis, chain: box.window.BaZiChain };
  const chart = calculator.calculate(1986, 6, 15, 6, 'male', 12);
  const facts = Report.buildFacts(chart, 'male', { anchorYear: 2026, currentYear: 2026, lifeContext: { status: 'working' }, deps });
  const frozen = JSON.stringify(facts.core);
  const grade = facts.wealth.narrative.grade;
  assert.ok(facts.career.narrative);
  assert.deepEqual(facts.career.narrative, Report.buildNarratives(facts).career);
  const first = facts.career.narrative;
  Report.applyReportReview(facts, { candidates: [], adjustments: [] });
  assert.notEqual(facts.career.narrative, first);
  assert.deepEqual(facts.career.narrative, Report.buildNarratives(facts).career);
  assert.deepEqual(keys(facts.career.narrative), keys(first));
  assert.equal(JSON.stringify(facts.core), frozen);
  assert.equal(facts.wealth.narrative.grade, grade);
  assert.ok(facts.career.narrative.verdicts.every(row => row.realityConfirmed === false && row.scope === 'career' && row.sourceRefs.length));
});
