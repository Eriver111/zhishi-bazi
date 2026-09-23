const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const audit = require('../scripts/bazi-audit-round.js');

function write(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bazi-audit-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('bazi-audit-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const directory = path.join(root, 'audits', 'bazi');
  const round = path.join(directory, 'round-09');
  fs.mkdirSync(round, { recursive: true });
  const data = {
    roundId: 'round-09',
    cases: Array.from({ length: 10 }, (_, index) => ({
      id: `R09-C${String(index + 1).padStart(2, '0')}`,
      birth: { year: 1990 + index, month: 1, day: 1, clock: 12, minute: 0, gender: index % 2 ? 'female' : 'male' },
      location: { province: '测试省', city: '测试市', district: `测试县${index}` },
      solarDataVersion: 'county-centroid-v1',
      pillars: ['甲子', '丙寅', '戊辰', ['庚午','辛未','壬申','癸酉','甲戌','乙亥','丙子','丁丑','戊寅','己卯'][index]],
      coverageTags: [audit.REQUIRED_TAGS[index]],
    }))
  };
  const rulings = {
    schemaVersion: 1,
    roundId: data.roundId,
    datasetRole: 'development',
    ruleVersion: 'fixture-rules-v1',
    sources: [{ id: 'rule', kind: 'project-rule', reference: 'fixture-only', description: 'Test structure only, not a real judgement.' }],
    cases: data.cases.map(item => ({
      id: item.id,
      pillars: item.pillars,
      decidedAt: '2026-01-01T00:00:00.000Z',
      engineOutputSeen: false,
      author: { id: 'fixture-author', kind: 'ai' },
      sourceIds: ['rule'],
      review: { status: 'pending', reviewer: null, reviewedAt: null, notes: 'Fixture awaiting review.' },
      strength: { direction: '弱', level: '偏弱', evidence: ['Fixture evidence.'] },
      following: { status: '不从', name: '普通格局', evidence: ['Fixture evidence.'] },
      pattern: { name: '正官格', status: '破格', evidence: ['Fixture evidence.'] },
      yongJi: { status: '已定', primary: '木', favorable: ['木', '火'], unfavorable: ['金', '水'], evidence: ['Fixture evidence.'] },
      disputes: []
    }))
  };
  write(path.join(round, 'cases.json'), data);
  write(path.join(round, 'independent-rulings.json'), rulings);
  fs.writeFileSync(path.join(round, 'independent-rulings.md'), '# Fixture rulings\nSynthetic data for validation tests only.\n');
  write(path.join(directory, 'judgement-quality.json'), { schemaVersion: 1, quarantinedCases: [] });
  return { root, round, directory, data, rulings, options: { root, engineFiles: [], engineCommit: 'fixture' } };
}

function reviewed(f) {
  f.rulings.datasetRole = 'acceptance';
  for (const item of f.rulings.cases) item.review = { status: 'reviewed', reviewer: { id: 'fixture-second-reader', kind: 'human' }, reviewedAt: '2026-01-02T00:00:00.000Z', notes: 'Fixture review only.' };
  write(path.join(f.round, 'independent-rulings.json'), f.rulings);
}
const calculator = {
  buildFromPillars: chart => chart,
  calcDayMasterStrength: () => ({ level: '偏弱' }),
  getCongGe: () => ({ isCong: false }),
  getYongJi: () => ({ yongShen: ['木'], xiShen: ['木', '火'], jiShen: ['金', '水'], resolvedPattern: { name: '最终格', status: '破格' } }),
  getPattern: () => ({ name: '基础格', status: '成格' })
};

test('capture refuses to reveal engine output before independent rulings are frozen', t => {
  const f = fixture(t);
  assert.throws(() => audit.captureEngine(f.round, { ...f.options, calculator }), /先冻结独立判断/);
});

test('case validation rejects duplicate pillars and incomplete coverage', t => {
  const f = fixture(t);
  const duplicate = structuredClone(f.data);
  duplicate.cases[1].pillars = duplicate.cases[0].pillars;
  assert.throws(() => audit.validateCases(duplicate, { priorPillars: new Set() }), /重复四柱/);
  f.data.cases[0].coverageTags = [];
  assert.throws(() => audit.validateCases(f.data, { priorPillars: new Set() }), /覆盖标签不完整/);
});

test('verification detects Markdown and structured ruling changes after freeze', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  const md = path.join(f.round, 'independent-rulings.md');
  const original = fs.readFileSync(md);
  fs.appendFileSync(md, 'changed\n');
  assert.throws(() => audit.verifyRound(f.round, f.options), /独立判断哈希不一致/);
  fs.writeFileSync(md, original);
  f.rulings.cases[0].pattern.name = 'Changed';
  write(path.join(f.round, 'independent-rulings.json'), f.rulings);
  assert.throws(() => audit.verifyRound(f.round, f.options), /结构化独立判断哈希不一致/);
});

test('prior collision scanning retains legacy four-pillar sources', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, '_blindtest_sample.md'), '旧盘：甲子 丙寅 戊辰 庚午');
  assert.throws(() => audit.prepare(f.round, f.options), /案例已在历史批次使用/);
});

test('prior collision scanning includes every audit round and excludes only the current round', t => {
  const f = fixture(t);
  assert.equal(audit.prepare(f.round, f.options).unique, 10);
  const old = path.join(f.directory, 'round-08');
  fs.mkdirSync(old);
  write(path.join(old, 'cases.json'), { cases: [{ id: 'R08-C03', pillars: f.data.cases[0].pillars }] });
  // No registry.json exists: directory records themselves are the source of truth.
  assert.throws(() => audit.prepare(f.round, f.options), /案例已在历史批次使用/);
});

test('new freeze rejects missing structured labels rather than treating a Markdown header as complete', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.round, 'independent-rulings.json'));
  assert.throws(() => audit.freezeRulings(f.round, f.options), /结构化独立判断/);
  assert.equal(fs.existsSync(path.join(f.round, 'freeze.json')), false);
});

test('structured validation checks every judgement, source, identity, time and review record', t => {
  const f = fixture(t);
  const invalid = [
    [r => { r.cases.pop(); }, /10盘/],
    [r => { delete r.cases[0].strength; }, /缺少旺衰/],
    [r => { r.cases[0].yongJi.evidence = []; }, /说明列表/],
    [r => { r.ruleVersion = ''; }, /ruleVersion/],
    [r => { r.cases[0].sourceIds = ['missing']; }, /不存在/],
    [r => { r.cases[0].pillars[0] = '甲戌'; }, /四柱与案例/],
    [r => { r.cases[0].engineOutputSeen = true; }, /未查看引擎/],
    [r => { r.cases[0].decidedAt = '2100-01-01T00:00:00Z'; }, /晚于冻结/],
    [r => { r.cases[0].strength.direction = '强'; }, /方向与档位矛盾/],
    [r => { r.cases[0].yongJi.unfavorable = ['木']; }, /同时列为/],
    [r => { r.cases[0].yongJi.favorable = ['火']; }, /必须包含首用/],
    [r => { r.cases[0].review.status = 'reviewed'; }, /reviewer缺失/],
    [r => { r.cases[0].disputes = ''; }, /说明列表/]
  ];
  for (const [change, error] of invalid) {
    const changed = structuredClone(f.rulings);
    change(changed);
    assert.throws(() => audit.validateRulings(changed, f.data), error);
  }
});

test('development labels can freeze while explicitly remaining ineligible for acceptance', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  const result = audit.verifyRound(f.round, f.options);
  assert.equal(result.verification.artifactIntegrity, 'verified');
  assert.equal(result.verification.acceptance.eligible, false);
  assert.equal(result.verification.acceptance.externalGoldStandardVerified, false);
  assert.throws(() => audit.verifyRound(f.round, { ...f.options, requireAcceptance: true }), /不可作为验收标签/);
});

test('acceptance freeze needs a distinct human review and documented rule source', t => {
  const f = fixture(t);
  reviewed(f);
  const original = structuredClone(f.rulings);
  for (const change of [
    r => { r.cases[0].review.reviewer.kind = 'ai'; },
    r => { r.sources[0].kind = 'ai-assisted'; },
    r => { r.cases[0].disputes = ['Unresolved fixture question.']; },
    r => { r.cases[0].pattern.status = '待定'; },
    r => { r.cases[0].following.name = '待定'; r.cases[0].following.status = '成立'; },
    r => { r.cases[0].pattern.name = '待定'; r.cases[0].pattern.status = '成格'; }
  ]) {
    const changed = structuredClone(original);
    change(changed);
    write(path.join(f.round, 'independent-rulings.json'), changed);
    assert.throws(() => audit.freezeRulings(f.round, f.options), /不能冻结为验收批次/);
  }
  f.rulings.cases[0].review.reviewer.id = f.rulings.cases[0].author.id;
  write(path.join(f.round, 'independent-rulings.json'), f.rulings);
  assert.throws(() => audit.freezeRulings(f.round, f.options), /复核者不能/);
  write(path.join(f.round, 'independent-rulings.json'), original);
  audit.freezeRulings(f.round, f.options);
  const result = audit.verifyRound(f.round, { ...f.options, requireAcceptance: true });
  assert.equal(result.verification.acceptance.eligible, true);
  assert.equal(result.verification.acceptance.scope, 'internal-rule-conformance');
  assert.equal(result.verification.acceptance.externalGoldStandardVerified, false);
});

test('acceptance requires a quality registry and quarantine blocks aliases of the same four pillars', t => {
  const f = fixture(t);
  reviewed(f);
  const registry = path.join(f.directory, 'judgement-quality.json');
  fs.unlinkSync(registry);
  assert.throws(() => audit.freezeRulings(f.round, f.options), /缺少判读质量隔离登记表/);
  write(registry, { schemaVersion: 1, quarantinedCases: [] });
  audit.freezeRulings(f.round, f.options);
  const old = path.join(f.directory, 'round-08');
  fs.mkdirSync(old);
  write(path.join(old, 'cases.json'), { cases: [{ id: 'R08-C03', pillars: f.data.cases[0].pillars }] });
  write(registry, { schemaVersion: 1, quarantinedCases: [{ caseId: 'R08-C03', status: 'pending-review', reason: 'Fixture factual error.' }] });
  const result = audit.verifyRound(f.round, f.options);
  assert.equal(result.verification.acceptance.eligible, false);
  assert.ok(result.verification.acceptance.blockingReasons.some(reason => reason.includes('R09-C01') && reason.includes('隔离')));
  assert.throws(() => audit.verifyRound(f.round, { ...f.options, requireAcceptance: true }), /不可作为验收标签/);
});

test('new freezing cannot overwrite an existing freeze or follow pre-existing engine output', t => {
  const f = fixture(t);
  write(path.join(f.round, 'engine-results.json'), { results: [] });
  assert.throws(() => audit.freezeRulings(f.round, f.options), /已有引擎输出/);
  fs.unlinkSync(path.join(f.round, 'engine-results.json'));
  audit.freezeRulings(f.round, f.options);
  const original = fs.readFileSync(path.join(f.round, 'freeze.json'));
  assert.throws(() => audit.freezeRulings(f.round, f.options), /已有冻结记录/);
  assert.deepEqual(fs.readFileSync(path.join(f.round, 'freeze.json')), original);
});

test('capture records the final resolved pattern, preserves the base pattern, and refuses overwrite', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  const results = audit.captureEngine(f.round, { ...f.options, calculator });
  assert.equal(results.length, 10);
  assert.equal(results[0].basePattern.name, '基础格');
  assert.equal(results[0].pattern.name, '最终格');
  assert.equal(results[0].patternSource, 'resolvedPattern');
  assert.equal(audit.verifyRound(f.round, f.options).verification.artifactIntegrity, 'verified');
  assert.throws(() => audit.captureEngine(f.round, { ...f.options, calculator }), /已有冻结的引擎结果/);
});

test('verification detects changed or missing engine output and uncatalogued output', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  const output = path.join(f.round, 'engine-results.json');
  write(output, { results: [] });
  assert.throws(() => audit.verifyRound(f.round, f.options), /引擎结果没有冻结哈希/);
  fs.unlinkSync(output);
  audit.captureEngine(f.round, { ...f.options, calculator });
  fs.appendFileSync(output, ' ');
  assert.throws(() => audit.verifyRound(f.round, f.options), /引擎结果哈希不一致/);
  fs.unlinkSync(output);
  assert.throws(() => audit.verifyRound(f.round, f.options), /引擎结果哈希不一致/);
});

test('integrity verification reports engine version changes, while capture requires the frozen engine', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'js'));
  const file = path.join(f.root, 'js', 'bazi.js');
  fs.writeFileSync(file, 'fixture engine\n');
  f.options.engineFiles = ['js/bazi.js'];
  audit.freezeRulings(f.round, f.options);
  fs.writeFileSync(file, 'changed engine\n');
  const result = audit.verifyRound(f.round, f.options);
  assert.equal(result.verification.currentEngineMatches, false);
  assert.deepEqual(result.verification.engineMismatches, ['js/bazi.js']);
  assert.throws(() => audit.captureEngine(f.round, { ...f.options, calculator }), /引擎文件哈希不一致/);
});

test('legacy verification is read only, accepts LF/CRLF conversion, and never qualifies as acceptance', t => {
  const f = fixture(t);
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(f.round, file))).digest('hex');
  write(path.join(f.round, 'engine-results.json'), { results: [{ id: 'fixture' }] });
  const legacy = { casesSha256: hash('cases.json'), rulingsSha256: hash('independent-rulings.md'), engineResultsSha256: hash('engine-results.json'), engineFiles: {}, rulingsFrozenAt: '2026-01-02T00:00:00.000Z' };
  write(path.join(f.round, 'freeze.json'), legacy);
  for (const file of ['cases.json', 'independent-rulings.md', 'engine-results.json']) {
    const target = path.join(f.round, file);
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\n/g, '\r\n'));
  }
  const before = fs.readFileSync(path.join(f.round, 'freeze.json'));
  const result = audit.verifyRound(f.round, f.options);
  assert.equal(result.verification.format, 'legacy');
  assert.equal(result.verification.currentEngineMatches, null);
  assert.equal(result.verification.acceptance.eligible, false);
  assert.deepEqual(fs.readFileSync(path.join(f.round, 'freeze.json')), before);
  assert.throws(() => audit.captureEngine(f.round, { ...f.options, calculator }), /旧批次仅允许只读验证/);
  fs.appendFileSync(path.join(f.round, 'engine-results.json'), ' ');
  assert.throws(() => audit.verifyRound(f.round, f.options), /引擎结果哈希不一致/);
});

test('new canonical hashes permit EOL conversion without permitting whitespace or BOM changes', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  const target = path.join(f.round, 'independent-rulings.md');
  const original = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, original.replace(/\n/g, '\r\n'));
  assert.equal(audit.verifyRound(f.round, f.options).verification.artifactIntegrity, 'verified');
  fs.writeFileSync(target, '\uFEFF' + original);
  assert.throws(() => audit.verifyRound(f.round, f.options), /独立判断哈希不一致/);
});

test('comparison separates direction, exact level, first useful element, full sets and pattern status', t => {
  const f = fixture(t);
  const expected = f.rulings.cases[0];
  const actual = structuredClone(expected);
  actual.strength.level = '极弱';
  actual.yongJi.favorable = ['木'];
  actual.yongJi.unfavorable.reverse();
  actual.pattern.status = '成格';
  const result = audit.compareRuling(expected, actual);
  assert.equal(result.strengthDirection, true);
  assert.equal(result.strengthLevel, false);
  assert.equal(result.primaryElement, true);
  assert.equal(result.favorableSet, false);
  assert.equal(result.unfavorableSet, true);
  assert.equal(result.patternName, true);
  assert.equal(result.patternStatus, false);
  expected.strength.level = '待定';
  expected.yongJi.status = '待定';
  expected.pattern.status = '待定';
  const deferred = audit.compareRuling(expected, actual);
  assert.equal(deferred.strengthLevel, null);
  assert.equal(deferred.primaryElement, null);
  assert.equal(deferred.patternName, null);
});

test('read-only compare uses frozen final output and marks development summaries as non-acceptance', t => {
  const f = fixture(t);
  audit.freezeRulings(f.round, f.options);
  audit.captureEngine(f.round, { ...f.options, calculator });
  const before = fs.readFileSync(path.join(f.round, 'freeze.json'));
  const report = audit.compareRound(f.round, f.options);
  assert.equal(report.verification.acceptance.eligible, false);
  assert.equal(report.comparisonPolicy.accuracyClaim, false);
  assert.equal(report.summary.strengthLevel.matched, 10);
  assert.equal(report.summary.patternName.mismatched, 10);
  assert.equal(report.rows[0].actual.pattern.name, '最终格');
  assert.deepEqual(fs.readFileSync(path.join(f.round, 'freeze.json')), before);
  fs.appendFileSync(path.join(f.round, 'engine-results.json'), ' ');
  assert.throws(() => audit.compareRound(f.round, f.options), /引擎结果哈希不一致/);
});

test('read-only comparison blocks an acceptance batch when its quality is subsequently quarantined', t => {
  const f = fixture(t);
  reviewed(f);
  audit.freezeRulings(f.round, f.options);
  audit.captureEngine(f.round, { ...f.options, calculator });
  assert.equal(audit.compareRound(f.round, f.options).verification.acceptance.eligible, true);
  write(path.join(f.directory, 'judgement-quality.json'), { schemaVersion: 1, quarantinedCases: [{ caseId: 'R09-C01', status: 'pending-review', reason: 'Fixture post-freeze discovery.' }] });
  assert.throws(() => audit.compareRound(f.round, f.options), /不可作为验收标签/);
});

test('normalization treats conditional patterns as pending, never compares base patterns as final, and preserves engine sets', () => {
  const normalized = audit.normalizeEngineResult({
    strength: { level: '极弱' }, cong: { isCong: false, isCandidate: true, name: '假从杀候选' },
    yongJi: { yongShen: ['火'], xiShen: ['土'], jiShen: ['水'], resolvedPattern: { name: '正官格', status: '条件待定' } }
  });
  assert.equal(normalized.strength.direction, '弱');
  assert.equal(normalized.following.status, '候选');
  assert.equal(normalized.pattern.status, '待定');
  assert.deepEqual(normalized.yongJi.favorable, ['土']);
  const fallback = audit.normalizeEngineResult({ cong: { isCong: false }, pattern: { name: '基础格', status: '成格' }, patternSource: 'basePattern-fallback' });
  assert.equal(fallback.following.name, '普通格局');
  assert.equal(fallback.pattern.status, '待定');
  assert.equal(fallback.pattern.name, '待定');
});
