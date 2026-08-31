'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_FILES = ['js/bazi.js', 'js/bazi-chain.js', 'js/structural.js'];
const REQUIRED_TAGS = ['明确身强','明确身弱','从格疑似','从格边界','专旺疑似或边界','调候优先','格局与旺衰冲突','月令临界','透干/根气临界','制化临界'];

function bytes(file) { return fs.readFileSync(file); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function canonical(pillars) { return pillars.join('|'); }
function pillarHash(pillars) { return sha(canonical(pillars)); }

function scanPriorPillars(root) {
  root = root || ROOT;
  const result = new Set();
  const allowed = /(?:_blind20|_blindtest_|_baseline_22|_baseline_p15_6|[\\/]_p5[\\/])/;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git','node_modules','audits'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (file.includes('_p5') || dir === root) walk(file); continue; }
      if (!allowed.test(file) || !/\.(?:js|json|csv|md|txt)$/i.test(file)) continue;
      const source = fs.readFileSync(file, 'utf8');
      const matches = source.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:[| ,，、]+[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]){3}/g) || [];
      for (const match of matches) {
        const pillars = match.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g);
        if (pillars && pillars.length === 4) result.add(canonical(pillars));
      }
    }
  }
  walk(root);
  return result;
}

function validateCases(data, options) {
  const cases = data && data.cases;
  if (!Array.isArray(cases) || cases.length !== 10) throw new Error('案例必须正好为10个');
  const ids = new Set(), tuples = new Set();
  const prior = options.priorPillars || scanPriorPillars(options.root);
  const tags = new Set();
  for (const item of cases) {
    if (!/^R\d{2}-C\d{2}$/.test(item.id || '') || ids.has(item.id)) throw new Error('案例ID无效或重复');
    ids.add(item.id);
    if (!Array.isArray(item.pillars) || item.pillars.length !== 4 || item.pillars.some(p => !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(p))) throw new Error('四柱不完整');
    const tuple = canonical(item.pillars);
    if (tuples.has(tuple)) throw new Error('重复四柱: ' + tuple);
    if (prior.has(tuple)) throw new Error('案例已在历史批次使用: ' + tuple);
    tuples.add(tuple);
    (item.coverageTags || []).forEach(tag => tags.add(tag));
  }
  if (options.requireCoverage !== false) {
    const missing = REQUIRED_TAGS.filter(tag => !tags.has(tag));
    if (missing.length) throw new Error('覆盖标签不完整: ' + missing.join('、'));
  }
  return { cases, tuples, tags };
}

function prepare(roundDir, options = {}) {
  const data = json(path.join(roundDir, 'cases.json'));
  const checked = validateCases(data, { ...options, requireCoverage: options.requireCoverage !== false });
  return { cases: checked.cases.length, unique: checked.tuples.size, coverage: checked.tags.size };
}

function engineHashes(root, files) {
  return Object.fromEntries((files || ENGINE_FILES).map(file => [file, sha(bytes(path.join(root, file)))]));
}

function freezeRulings(roundDir, options = {}) {
  const root = options.root || ROOT;
  const casesFile = path.join(roundDir, 'cases.json');
  const rulingsFile = path.join(roundDir, 'independent-rulings.md');
  if (!fs.existsSync(rulingsFile)) throw new Error('缺少独立判断');
  const freeze = {
    casesSha256: sha(bytes(casesFile)),
    rulingsSha256: sha(bytes(rulingsFile)),
    engineFiles: engineHashes(root, options.engineFiles),
    engineCommit: options.engineCommit || safeGit(root, ['rev-parse','HEAD']),
    solarDataVersion: 'county-centroid-v1',
    rulingsFrozenAt: new Date().toISOString()
  };
  writeJson(path.join(roundDir, 'freeze.json'), freeze);
  return freeze;
}

function safeGit(root, args) { try { return execFileSync('git', args, { cwd: root, encoding:'utf8' }).trim(); } catch (_) { return 'unavailable'; } }

function verifyRound(roundDir, options = {}) {
  const root = options.root || ROOT;
  const file = path.join(roundDir, 'freeze.json');
  if (!fs.existsSync(file)) throw new Error('先冻结独立判断');
  const freeze = json(file);
  if (freeze.casesSha256 !== sha(bytes(path.join(roundDir, 'cases.json')))) throw new Error('案例哈希不一致');
  if (freeze.rulingsSha256 !== sha(bytes(path.join(roundDir, 'independent-rulings.md')))) throw new Error('独立判断哈希不一致');
  const current = engineHashes(root, options.engineFiles);
  for (const [name, hash] of Object.entries(freeze.engineFiles || {})) if (current[name] !== hash) throw new Error('引擎文件哈希不一致: ' + name);
  return freeze;
}

function loadCalculator(root) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/bazi.js'), 'utf8'), context);
  return context.window.BaZiCalculator;
}

function chartFrom(calculator, item) {
  const [year,month,day,hour] = item.pillars.map(p => ({ gan:p[0], zhi:p[1] }));
  return calculator.buildFromPillars({ year, month, day, hour }, item.birth.gender, null);
}

function captureEngine(roundDir, options = {}) {
  const root = options.root || ROOT;
  const freeze = verifyRound(roundDir, options);
  const calculator = options.calculator || loadCalculator(root);
  const cases = json(path.join(roundDir, 'cases.json')).cases;
  const results = cases.map(item => {
    const chart = chartFrom(calculator, item);
    return {
      id:item.id,
      pillars:item.pillars,
      strength:calculator.calcDayMasterStrength(chart),
      strengthAudit:typeof calculator.auditDayMasterStrength === 'function' ? calculator.auditDayMasterStrength(chart) : null,
      cong:calculator.getCongGe(chart),
      yongJi:calculator.getYongJi(chart),
      pattern:calculator.getPattern(chart)
    };
  });
  writeJson(path.join(roundDir, 'engine-results.json'), { capturedAt:new Date().toISOString(), results });
  freeze.engineCapturedAt = new Date().toISOString();
  freeze.engineResultsSha256 = sha(bytes(path.join(roundDir, 'engine-results.json')));
  writeJson(path.join(roundDir, 'freeze.json'), freeze);
  return results;
}

function main() {
  const [command, dirArg] = process.argv.slice(2);
  const dir = path.resolve(dirArg || '');
  if (command === 'prepare') console.log(JSON.stringify(prepare(dir)));
  else if (command === 'freeze-rulings') console.log(JSON.stringify(freezeRulings(dir)));
  else if (command === 'capture-engine') console.log('captured=' + captureEngine(dir).length);
  else if (command === 'verify') console.log(JSON.stringify(verifyRound(dir)));
  else throw new Error('unknown command');
}

if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { prepare, freezeRulings, verifyRound, captureEngine, scanPriorPillars, validateCases, pillarHash, REQUIRED_TAGS };
