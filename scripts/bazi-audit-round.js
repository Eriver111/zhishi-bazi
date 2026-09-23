'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { validateRulings, acceptanceReasons, compareRuling, normalizeEngineResult } = require('./bazi-audit-schema.js');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_FILES = ['js/bazi.js', 'js/bazi-chain.js', 'js/structural.js'];
const REQUIRED_TAGS = ['明确身强','明确身弱','从格疑似','从格边界','专旺疑似或边界','调候优先','格局与旺衰冲突','月令临界','透干/根气临界','制化临界'];

function bytes(file) { return fs.readFileSync(file); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function canonical(pillars) { return pillars.join('|'); }
function pillarHash(pillars) { return sha(canonical(pillars)); }
function lf(value) { return value.toString('utf8').replace(/\r\n/g, '\n'); }
function textHash(file) { return sha(lf(bytes(file))); }
function hashMatches(file, expected, mode) {
  const raw = bytes(file);
  if (mode === 'utf8-lf') return sha(lf(raw)) === expected;
  // Legacy records were frozen on both Windows and Unix. Accept only newline
  // conversion, not whitespace trimming, Unicode normalization or BOM removal.
  const normalized = lf(raw);
  return [sha(raw), sha(normalized), sha(normalized.replace(/\n/g, '\r\n'))].includes(expected);
}

function historicalRounds(root, excludeRoundDir) {
  const directory = path.join(root, 'audits', 'bazi');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^round-\d+$/.test(entry.name))
    .map(entry => path.join(directory, entry.name))
    .filter(dir => !excludeRoundDir || path.resolve(dir) !== path.resolve(excludeRoundDir));
}

function scanPriorPillars(root, excludeRoundDir) {
  root = root || ROOT;
  const result = new Set();
  for (const dir of historicalRounds(root, excludeRoundDir)) {
    const data = json(path.join(dir, 'cases.json'));
    if (!Array.isArray(data.cases)) throw new Error('历史批次案例无效: ' + path.basename(dir));
    for (const item of data.cases) {
      if (!Array.isArray(item.pillars) || item.pillars.length !== 4) throw new Error('历史批次四柱不完整: ' + item.id);
      result.add(canonical(item.pillars));
    }
  }
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

function validateCases(data, options = {}) {
  const cases = data && data.cases;
  if (!Array.isArray(cases) || cases.length !== 10) throw new Error('案例必须正好为10个');
  if (!/^round-\d{2}$/.test(data.roundId || '')) throw new Error('批次ID无效');
  const ids = new Set(), tuples = new Set();
  const prior = options.priorPillars || scanPriorPillars(options.root, options.roundDir);
  const tags = new Set();
  for (const item of cases) {
    if (!/^R\d{2}-C\d{2}$/.test(item.id || '') || ids.has(item.id) || !item.id.startsWith('R' + data.roundId.slice(-2) + '-')) throw new Error('案例ID无效、重复或与批次不符');
    ids.add(item.id);
    if (!Array.isArray(item.pillars) || item.pillars.length !== 4 || item.pillars.some(p => !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(p))) throw new Error('四柱不完整');
    if (!item.birth || !['male', 'female'].includes(item.birth.gender)) throw new Error('案例性别缺失或无效: ' + item.id);
    if (!Array.isArray(item.coverageTags) || item.coverageTags.some(tag => !REQUIRED_TAGS.includes(tag))) throw new Error('覆盖标签无效: ' + item.id);
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
  const checked = validateCases(data, { ...options, roundDir, requireCoverage: options.requireCoverage !== false });
  return { cases: checked.cases.length, unique: checked.tuples.size, coverage: checked.tags.size };
}

function engineHashes(root, files) {
  return Object.fromEntries((files || ENGINE_FILES).map(file => [file, textHash(path.join(root, file))]));
}

function qualityReasons(caseData, root) {
  const file = path.join(root, 'audits', 'bazi', 'judgement-quality.json');
  if (!fs.existsSync(file)) return ['缺少判读质量隔离登记表'];
  const quality = json(file);
  if (quality.schemaVersion !== 1 || !Array.isArray(quality.quarantinedCases)) throw new Error('判读质量隔离登记表无效');
  const blockedIds = new Set();
  for (const record of quality.quarantinedCases) {
    if (!/^R\d{2}-C\d{2}$/.test(record.caseId || '') || typeof record.reason !== 'string' || !record.reason.trim() || record.status !== 'pending-review' || blockedIds.has(record.caseId)) throw new Error('判读质量隔离记录无效');
    blockedIds.add(record.caseId);
  }
  const blockedPillars = new Set();
  for (const dir of historicalRounds(root)) {
    for (const item of json(path.join(dir, 'cases.json')).cases) {
      if (blockedIds.has(item.id)) blockedPillars.add(canonical(item.pillars));
    }
  }
  return caseData.cases.filter(item => blockedIds.has(item.id) || blockedPillars.has(canonical(item.pillars)))
    .map(item => item.id + '在待复核隔离中，不可作为验收标签');
}

function assessAcceptance(roundDir, options = {}) {
  const root = options.root || ROOT;
  const caseData = json(path.join(roundDir, 'cases.json'));
  const structuredFile = path.join(roundDir, 'independent-rulings.json');
  let reasons = qualityReasons(caseData, root);
  if (options.legacy || !fs.existsSync(structuredFile)) reasons.push('旧批次没有按新规范冻结的结构化判读，仅可验证材料完整性');
  else {
    const data = json(structuredFile);
    validateRulings(data, caseData, { frozenAt: options.frozenAt });
    reasons = reasons.concat(acceptanceReasons(data));
  }
  return { eligible: reasons.length === 0, scope: 'internal-rule-conformance', externalGoldStandardVerified: false, blockingReasons: reasons };
}

function freezeRulings(roundDir, options = {}) {
  const root = options.root || ROOT;
  const casesFile = path.join(roundDir, 'cases.json');
  const rulingsFile = path.join(roundDir, 'independent-rulings.md');
  const structuredFile = path.join(roundDir, 'independent-rulings.json');
  if (fs.existsSync(path.join(roundDir, 'freeze.json'))) throw new Error('已有冻结记录，不可覆盖；请建立新的审计批次');
  if (fs.existsSync(path.join(roundDir, 'engine-results.json'))) throw new Error('已有引擎输出，不能再声明为冻结前的独立判断');
  prepare(roundDir, options);
  if (!fs.existsSync(rulingsFile)) throw new Error('缺少独立判断');
  if (!fs.readFileSync(rulingsFile, 'utf8').trim()) throw new Error('独立判断正文为空');
  if (!fs.existsSync(structuredFile)) throw new Error('缺少完整结构化独立判断independent-rulings.json');
  const rulings = json(structuredFile);
  const frozenAt = new Date().toISOString();
  validateRulings(rulings, json(casesFile), { frozenAt });
  const acceptance = assessAcceptance(roundDir, { root, frozenAt });
  if (rulings.datasetRole === 'acceptance' && !acceptance.eligible) throw new Error('不能冻结为验收批次: ' + acceptance.blockingReasons.join('；'));
  const freeze = {
    schemaVersion: 2,
    textHashMode: 'utf8-lf',
    comparisonPolicy: 'exact-dimensions-v1',
    casesSha256: textHash(casesFile),
    rulingsSha256: textHash(rulingsFile),
    structuredRulingsSha256: textHash(structuredFile),
    engineFiles: engineHashes(root, options.engineFiles),
    engineCommit: options.engineCommit || safeGit(root, ['rev-parse','HEAD']),
    solarDataVersion: 'county-centroid-v1',
    rulingsFrozenAt: frozenAt
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
  const modern = freeze.schemaVersion === 2;
  if (freeze.schemaVersion != null && !modern) throw new Error('不支持的冻结版本');
  if (modern && freeze.textHashMode !== 'utf8-lf') throw new Error('冻结哈希模式无效');
  if (modern && freeze.comparisonPolicy !== 'exact-dimensions-v1') throw new Error('冻结比较口径无效');
  for (const [name, hash, label] of [
    ['cases.json', freeze.casesSha256, '案例'],
    ['independent-rulings.md', freeze.rulingsSha256, '独立判断'],
    ...(modern ? [['independent-rulings.json', freeze.structuredRulingsSha256, '结构化独立判断']] : [])
  ]) if (!hashMatches(path.join(roundDir, name), hash, modern ? freeze.textHashMode : null)) throw new Error(label + '哈希不一致');
  const resultFile = path.join(roundDir, 'engine-results.json');
  if (freeze.engineResultsSha256) {
    if (!fs.existsSync(resultFile) || !hashMatches(resultFile, freeze.engineResultsSha256, modern ? freeze.textHashMode : null)) throw new Error('引擎结果哈希不一致');
  } else if (freeze.engineCapturedAt || fs.existsSync(resultFile)) throw new Error('引擎结果没有冻结哈希');
  const engineMismatches = [];
  const recordedEngineFiles = Object.entries(freeze.engineFiles || {});
  for (const [name, hash] of recordedEngineFiles) {
    const engineFile = path.resolve(root, name);
    if (!engineFile.startsWith(path.resolve(root) + path.sep)) throw new Error('引擎文件路径不在仓库内');
    if (!fs.existsSync(engineFile) || !hashMatches(engineFile, hash, modern ? freeze.textHashMode : null)) engineMismatches.push(name);
  }
  if (options.requireCurrentEngine && !recordedEngineFiles.length && options.engineFiles?.length !== 0) throw new Error('缺少冻结的引擎文件记录');
  if (options.requireCurrentEngine && engineMismatches.length) throw new Error('引擎文件哈希不一致: ' + engineMismatches.join('、'));
  const acceptance = assessAcceptance(roundDir, { root, legacy: !modern, frozenAt: freeze.rulingsFrozenAt });
  if (options.requireAcceptance && !acceptance.eligible) throw new Error('不可作为验收标签: ' + acceptance.blockingReasons.join('；'));
  return { ...freeze, verification: { format: modern ? 'structured-v2' : 'legacy', artifactIntegrity: 'verified', currentEngineMatches: recordedEngineFiles.length ? engineMismatches.length === 0 : null, engineMismatches, acceptance } };
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
  const verified = verifyRound(roundDir, { ...options, requireCurrentEngine: true });
  if (verified.schemaVersion !== 2) throw new Error('旧批次仅允许只读验证，不可追加或覆盖引擎结果');
  if (verified.engineResultsSha256) throw new Error('已有冻结的引擎结果，不可覆盖');
  const { verification, ...freeze } = verified;
  const calculator = options.calculator || loadCalculator(root);
  const cases = json(path.join(roundDir, 'cases.json')).cases;
  const results = cases.map(item => {
    const chart = chartFrom(calculator, item);
    const yongJi = calculator.getYongJi(chart);
    const basePattern = calculator.getPattern(chart);
    return {
      id:item.id,
      pillars:item.pillars,
      strength:calculator.calcDayMasterStrength(chart),
      strengthAudit:typeof calculator.auditDayMasterStrength === 'function' ? calculator.auditDayMasterStrength(chart) : null,
      cong:calculator.getCongGe(chart),
      yongJi,
      basePattern,
      pattern:yongJi.resolvedPattern || basePattern,
      patternSource:yongJi.resolvedPattern ? 'resolvedPattern' : 'basePattern-fallback'
    };
  });
  writeJson(path.join(roundDir, 'engine-results.json'), { capturedAt:new Date().toISOString(), results });
  freeze.engineCapturedAt = new Date().toISOString();
  freeze.engineResultsSha256 = textHash(path.join(roundDir, 'engine-results.json'));
  writeJson(path.join(roundDir, 'freeze.json'), freeze);
  return results;
}

function compareRound(roundDir, options = {}) {
  const verified = verifyRound(roundDir, options);
  if (verified.schemaVersion !== 2) throw new Error('旧批次只有非结构化判读，不能按新验收口径自动比较');
  if (!verified.engineResultsSha256) throw new Error('先采集并冻结引擎结果');
  const rulings = json(path.join(roundDir, 'independent-rulings.json'));
  if (rulings.datasetRole === 'acceptance' && !verified.verification.acceptance.eligible) throw new Error('不可作为验收标签: ' + verified.verification.acceptance.blockingReasons.join('；'));
  const captured = json(path.join(roundDir, 'engine-results.json')).results;
  if (!Array.isArray(captured) || captured.length !== rulings.cases.length) throw new Error('冻结引擎结果案例数不一致');
  const outputs = new Map(captured.map(item => [item.id, item]));
  if (outputs.size !== captured.length) throw new Error('冻结引擎结果案例ID重复');
  const rows = rulings.cases.map(expected => {
    const output = outputs.get(expected.id);
    if (!output || canonical(output.pillars || []) !== canonical(expected.pillars)) throw new Error('冻结引擎结果案例身份不一致: ' + expected.id);
    const actual = normalizeEngineResult(output);
    return {
      id: expected.id,
      pillars: expected.pillars,
      expected: Object.fromEntries(['strength', 'following', 'pattern', 'yongJi'].map(key => [key, expected[key]])),
      actual,
      match: compareRuling(expected, actual)
    };
  });
  const dimensions = Object.keys(rows[0].match);
  return {
    roundId: rulings.roundId,
    datasetRole: rulings.datasetRole,
    ruleVersion: rulings.ruleVersion,
    comparisonPolicy: {
      id: 'exact-dimensions-v1',
      favorableSet: '完整喜用集合沿用xiShen，必须包含首用；引擎原集合原样比较，不自动增删',
      undetermined: '裁判待定维度不判匹配，单独计数；引擎待定不能算与确定裁判一致',
      enginePattern: '最终resolvedPattern；基础格不能代替最终格局',
      accuracyClaim: false
    },
    verification: verified.verification,
    summary: Object.fromEntries(dimensions.map(dimension => [dimension, {
      matched: rows.filter(row => row.match[dimension] === true).length,
      mismatched: rows.filter(row => row.match[dimension] === false).length,
      undetermined: rows.filter(row => row.match[dimension] === null).length,
      total: rows.length
    }])),
    rows
  };
}

function main() {
  const [command, dirArg, flag] = process.argv.slice(2);
  if (flag && (command !== 'verify' || flag !== '--require-acceptance')) throw new Error('不支持的选项');
  const dir = path.resolve(dirArg || '');
  if (command === 'prepare') console.log(JSON.stringify(prepare(dir)));
  else if (command === 'freeze-rulings') console.log(JSON.stringify(freezeRulings(dir)));
  else if (command === 'capture-engine') console.log('captured=' + captureEngine(dir).length);
  else if (command === 'verify') console.log(JSON.stringify(verifyRound(dir, { requireAcceptance: flag === '--require-acceptance' })));
  else if (command === 'compare') console.log(JSON.stringify(compareRound(dir)));
  else throw new Error('unknown command');
}

if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { prepare, freezeRulings, verifyRound, captureEngine, compareRound, scanPriorPillars, validateCases, validateRulings, compareRuling, normalizeEngineResult, pillarHash, REQUIRED_TAGS };
