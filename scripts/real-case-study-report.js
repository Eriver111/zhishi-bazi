'use strict';
// Offline production-generation audit. No account, datastore, secrets or AI call.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');

function stripHtml(html, visibleOnly = false) {
  const source = visibleOnly ? html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '') : html;
  return source.replace(/<[^>]+>/g, ' ').replace(/&(?:amp|lt|gt|quot|#39);/g,
    value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[value]))
    .replace(/\s+/g, ' ').trim();
}

function generateStudyReport(item) {
  const ids = ['thisYear', 'marriage', 'wealth', 'career', 'study', 'fortune'];
  const nodes = Object.fromEntries(ids.flatMap(id => [id + 'Content', id + 'Section']).map(id => [id, {
    id, innerHTML: '', style: {}, classList: { add() {}, remove() {} },
    cloneNode() { return { innerHTML: this.innerHTML, querySelectorAll() { return []; } }; },
  }]));
  const context = { console, Date, Math, setTimeout, clearTimeout,
    document: { addEventListener() {}, getElementById(id) { return nodes[id] || null; },
      querySelector() { return null; }, querySelectorAll() { return []; } },
    fetch() { throw new Error('Network calls forbidden in offline study audit'); },
  };
  context.window = context;
  context.DeepReportAnchor = { resolve() { return 2026; } };
  vm.createContext(context);
  for (const file of ['bazi.js', 'bazi-chain.js', 'structural.js', 'deep-report.js', 'result.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
  }
  const raw = Object.fromEntries(['year', 'month', 'day', 'hour'].map((key, i) =>
    [key, { gan: item.pillars[i][0], zhi: item.pillars[i][1] }]));
  context.auditChart = context.BaZiCalculator.buildFromPillars(raw, item.gender);
  context.auditGender = item.gender;
  context.renderStudy(context.auditChart);
  const basicHtml = nodes.studyContent.innerHTML;
  vm.runInContext('_bazi = auditChart; _params = {gender: auditGender, mode: "pillars", timing: "unknown"}; renderPaidContent();', context);
  const facts = vm.runInContext('_deepReportFacts', context);
  if (!facts || !nodes.studyContent.innerHTML) throw new Error('Actual report generation/render failed for ' + item.id);
  const deepHtml = nodes.studyContent.innerHTML;
  return {
    id: item.id, pillars: item.pillars, gender: item.gender,
    ordinary: { facts: context.BaZiCalculator.analyzeStudy(context.auditChart), html: basicHtml, visibleText: stripHtml(basicHtml, true) },
    paid: { facts: facts.study, html: deepHtml, visibleText: stripHtml(deepHtml, true) },
    wealthGrade: facts.wealth.narrative.grade,
  };
}

function run() {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'audits/real-cases/2026-10-06/cases.json'), 'utf8'));
  const results = source.cases.flatMap(item => {
    const primary = generateStudyReport(item);
    primary.split = item.split;
    primary.source = item.source;
    primary.sourceFacts = item.facts.filter(fact => /education|work-plan/.test(fact.type));
    const variants = [primary];
    if (item.alternativeHour) variants.push(generateStudyReport({ ...item, id: item.id + '-hour-alternative', pillars: [...item.pillars.slice(0, 3), item.alternativeHour] }));
    return variants;
  });
  const output = {
    reviewedAt: '2026-10-06', purpose: '实际buildFacts→renderPaidContent与普通renderStudy离线对照；案例反馈不传入生成器',
    independentlyVerifiedCases: 0,
    limitation: '修复无印/结构积分直接推断学历和学习习惯；本轮不是学历或具体考试年份预测准确率评估。',
    sha256: Object.fromEntries(['bazi.js', 'deep-report.js', 'result.js'].map(file => [file,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js', file))).digest('hex')])),
    results,
  };
  const destination = path.join(root, 'audits/real-cases/2026-10-06-round2/report-study.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ reports: results.length, destination }) + '\n');
}

if (require.main === module) run();
module.exports = { generateStudyReport, stripHtml };
