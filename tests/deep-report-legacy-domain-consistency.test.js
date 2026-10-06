const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../js/deep-report');
const { engine, reportFor } = require('../scripts/real-case-audit-utils');
const { renderFacts } = require('../scripts/real-case-report-render');

function narratives(interactions) {
  const annual = { year: 2023, pillar: { gan: '癸', zhi: '卯' }, interactions,
    triggeredRisks: [], reliefs: [], career: {}, wealth: {}, relationship: {}, study: {}, wellbeing: {} };
  return Report.buildNarratives({ core: {}, wealth: {}, relationship: {}, study: {}, currentYear: annual,
    fiveYear: { years: [annual] } });
}
const row = (domain, direction, extra = {}) => ({ source: '流年', type: '六合', targetPillar: 'year',
  direction, domains: [domain], sourceText: domain + ':' + direction, ...extra });
const body = section => section.verdicts.filter(v => !v.detailOnly).map(v => v.outcomeText).join(' ');

test('legacy mixed money signals produce one qualified outcome, without opposite retained-money promises', () => {
  const output = narratives([row('wealth', 'adverse'), row('wealth', 'favorable'), row('wealth', 'favorable')]);
  const money = output.currentYear.verdicts.filter(v => v.title === '钱和收入会怎么变');
  assert.equal(money.length, 1);
  const copy = money[0].outcomeText;
  assert.match(copy, /垫款|额外支出|分钱/);
  assert.match(copy, /可能/);
  assert.doesNotMatch(copy, /真正的代价是|回款会更顺|钱也更有机会存下来|留住资产.*改善|净收入增加/);
  assert.equal(output.fiveYear.years[0].summary, copy);
  assert.equal(output.currentYear.painPoint, '', 'the domain card already contains the outcome');
});

test('a lower-priority adverse money effect constrains summaries as well as the domain card', () => {
  const rows = [row('wealth', 'favorable', { formationStatus: 'qualified' }),
    row('wealth', 'adverse', { type: '伏吟' }), row('relationship', 'adverse', { type: '伏吟' })];
  const output = narratives(rows);
  const money = output.currentYear.verdicts.find(v => v.title === '钱和收入会怎么变');
  for (const copy of [money.outcomeText, output.fiveYear.years[0].summary]) {
    assert.match(copy, /留钱.*压力/);
    assert.match(copy, /垫款|额外支出|分钱/);
    assert.doesNotMatch(copy, /两个人|争执/, 'unselected domain must not become part of the prioritized summary');
  }
});

test('opposing career signals are merged, and a positive local interaction does not promise promotion', () => {
  const output = narratives([row('career', 'favorable'), row('career', 'adverse')]);
  const work = output.currentYear.verdicts.filter(v => v.title === '工作和职位会怎么变');
  assert.equal(work.length, 1);
  assert.match(work[0].outcomeText, /返工.*压力/);
  assert.doesNotMatch(work[0].outcomeText, /职位.*上升|收入.*上涨|升职机会.*增加/);
  const positive = narratives([row('career', 'favorable')]).currentYear;
  assert.match(body(positive), /取决于实际岗位/);
  assert.doesNotMatch(body(positive), /职位.*上升|收入.*上涨/);
});

test('negative-only money and career effects remain explicit, not softened into a beneficial year', () => {
  const output = narratives([row('wealth', 'adverse'), row('career', 'adverse')]);
  assert.match(output.currentYear.headline, /偏不利/);
  assert.match(body(output.currentYear), /留下的钱.*减少/);
  assert.match(body(output.currentYear), /返工/);
  assert.doesNotMatch(body(output.currentYear), /有转机|有重新推进的机会/);
});

test('actual incomplete-birth source chart renders every available report section without inserting the known loss', async () => {
  const e = await engine();
  // Independent input contains neither case feedback nor its source title.
  const c = { id: 'incomplete-birth', pillars: ['戊辰', '丁巳', '己巳', '丁卯'], gender: 'male',
    cycles: [{ gan: '庚', zhi: '申', startYear: 2015, endYear: 2024 }] };
  const report = reportFor(e, c, 2023);
  const { chartFor } = require('../scripts/real-case-audit-utils');
  const sections = renderFacts(report, chartFor(e, c), c.gender);
  assert.equal(report.fiveYear.hasDaYun, false, 'missing birth data cannot be replaced with fabricated data');
  assert.match(sections.thisYear.visibleText, /垫款|额外支出|分钱/);
  assert.doesNotMatch(sections.thisYear.visibleText, /股票|期货|全员降薪|真正的代价是/);
  assert.match(report.wealth.narrative.grade, /^A(?:10|[6-9])$/);
  assert.equal(Object.keys(sections).length, 6);
  assert.match(sections.fortune.html, /2023/);
  for (const title of ['工作和职位会怎么变', '钱和收入会怎么变']) {
    const text = report.currentYear.narrative.verdicts.find(v => v.title === title).outcomeText;
    assert.equal(sections.thisYear.visibleText.split(text).length - 1, 1, title + ' appears once on the actual reading surface');
  }
  // Repeated annual evidence keeps all years, but the five-year overview and
  // individual rows must not print the same full money paragraph six times.
  const repeated = JSON.parse(JSON.stringify(report));
  repeated.fiveYear.years.forEach(annual => {
    annual.interactions = [row('wealth', 'favorable', { formationStatus: 'qualified' })];
    annual.triggeredRisks = []; annual.reliefs = [];
  });
  repeated.currentYear = repeated.fiveYear.years[0];
  const normalized = Report.buildNarratives(repeated);
  repeated.currentYear.narrative = normalized.currentYear;
  repeated.fiveYear.narrative = normalized.fiveYear;
  const repeatSections = renderFacts(repeated, chartFor(e, c), c.gender);
  const moneyParagraph = normalized.currentYear.verdicts.find(v => v.title === '钱和收入会怎么变').outcomeText;
  assert.equal(repeatSections.fortune.visibleText.split(moneyParagraph).length - 1, 1);
  for (const annual of normalized.fiveYear.years.slice(1)) assert.match(annual.summary, /上方五年重点/);
});
