'use strict';
// Offline actual report generation and production HTML rendering. No feedback,
// accounts, credentials or network calls are passed into either stage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { engine, chartFor, birth, reportFor } = require('./real-case-audit-utils');
const { stripHtml } = require('./real-case-study-report');
const root = path.resolve(__dirname, '..');
const auditDir = path.join(root, 'audits/real-cases/2026-10-06-round2');
const sectionNames = ['thisYear', 'wealth', 'marriage', 'career', 'study', 'fortune'];

function renderFacts(facts, chart, gender) {
  const nodes = Object.fromEntries(sectionNames.flatMap(name => [name + 'Content', name + 'Section']).map(id => [id, {
    id, innerHTML: '', style: {}, classList: { add() {}, remove() {} },
    cloneNode() { return { innerHTML: this.innerHTML, querySelectorAll() { return []; } }; },
  }]));
  const context = { console, Date, Math, setTimeout, clearTimeout,
    document: { addEventListener() {}, getElementById(id) { return nodes[id] || null; },
      querySelector() { return null; }, querySelectorAll() { return []; } },
    fetch() { throw new Error('Network calls forbidden in offline report audit'); },
    auditFacts: facts, auditChart: chart, auditGender: gender,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/result.js'), 'utf8'), context, { filename: 'result.js' });
  vm.runInContext('_bazi = auditChart; _params = {gender:auditGender,mode:"pillars",timing:"unknown"}; _deepReportFacts = auditFacts; renderPaidContent();', context);
  if (vm.runInContext('_deepReportFacts', context) !== facts) throw new Error('Production report rendering failed');
  const sections = Object.fromEntries(sectionNames.map(name => [name, {
    html: nodes[name + 'Content'].innerHTML,
    visibleText: stripHtml(nodes[name + 'Content'].innerHTML, true),
    hidden: nodes[name + 'Section'].style.display === 'none',
  }]));
  for (const name of sectionNames) if (!sections[name].html && !sections[name].hidden) throw new Error('Visible report section empty: ' + name);
  return sections;
}

async function main() {
  const e = await engine();
  const source = JSON.parse(fs.readFileSync(path.join(auditDir, 'sources.json'), 'utf8'));
  const holdout = JSON.parse(fs.readFileSync(path.join(auditDir, 'holdout-sources.json'), 'utf8'));
  const selectedYears = { 'R2-01': 2013, 'R2-02': 2012, 'R2-03': 2022, 'R2-04': 2023,
    'R2-05': 2017, 'R2-06': 2022, 'R2-07': 2020, 'R2-08': 2016 };
  const cases = source.cases.filter(c => Object.hasOwn(selectedYears, c.id)).map(c => ({ c, year: selectedYears[c.id], holdout: false }))
    .concat(holdout.cases.map(c => ({ c, year: c.blindProbeYear || c.probeYear, holdout: true })));
  const resultSource = fs.readFileSync(path.join(root, 'js/result.js'));
  const output = { reviewedAt: '2026-10-06', method: 'Actual reportFor/buildFacts → result.js renderPaidContent, source feedback excluded',
    independentVerification: false, labelLeakage: false, hashes: { ...e.hashes,
      'result.js': crypto.createHash('sha256').update(resultSource).digest('hex') }, results: [] };
  const htmlDirectory = path.join(auditDir, 'rendered-reports');
  fs.mkdirSync(htmlDirectory, { recursive: true });
  for (const { c, year, holdout: isHoldout } of cases) {
    // Whitelist input: in particular source, feedback and evidence are omitted.
    const input = { id: c.id, pillars: c.pillars, gender: c.gender,
      birth: c.birth ? { date: c.birth.date, clock: c.birth.clock, trueSolarClock: c.birth.trueSolarClock } : null,
      birthYear: c.birthYear, cycles: (c.cycles || []).map(({ gan, zhi, startYear, endYear }) => ({ gan, zhi, startYear, endYear })) };
    const facts = reportFor(e, input, year);
    const sections = renderFacts(facts, chartFor(e, input), c.gender);
    const partial = !birth(input) || !facts.fiveYear.hasDaYun;
    const limitation = partial ? '缺少完整出生时间；实际报告没有纳入大运，只可检查四柱与流年部分，不计完整岁运预测。' : '';
    const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>离线报告检查 ' + c.id + '</title><style>body{max-width:850px;margin:24px auto;padding:16px;background:#f5eddf;color:#312c25;font:16px/1.8 system-ui}section{padding:20px;margin:20px 0;background:#fffaf2;border-radius:18px}details{margin:12px 0}h1,h2,h3{line-height:1.4}.audit-note{padding:16px;background:#eee2cb}</style>' +
      '<h1>' + c.id + ' · ' + year + '年</h1><p class="audit-note">离线生产报告渲染；未输入案例反馈。' + limitation + '</p>' +
      sectionNames.map(name => '<section id="' + name + '">' + sections[name].html + '</section>').join('') + '</html>';
    const filename = c.id + '-' + year + '.html';
    fs.writeFileSync(path.join(htmlDirectory, filename), html);
    output.results.push({ id: c.id, year, holdout: isHoldout, partial, limitation, hasDaYun: facts.fiveYear.hasDaYun,
      pillars: c.pillars, wealthGrade: facts.wealth.narrative.grade,
      headline: facts.currentYear.narrative.headline,
      verdicts: facts.currentYear.narrative.verdicts,
      fiveYear: facts.fiveYear.narrative,
      sections, htmlFile: 'rendered-reports/' + filename });
  }
  const destination = path.join(auditDir, 'report-render.json');
  fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ reports: output.results.length, partial: output.results.filter(r => r.partial).map(r => r.id), destination }) + '\n');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { renderFacts };
