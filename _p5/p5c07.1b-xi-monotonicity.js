// P5-C07.1 验收补充（用户规格 2026-08-16）：old xi ⊆ new xi / old ji ⊆ new ji 全池单调性校验。
// C07 是分类层全覆盖：旧正式喜神（sn>3）不得在新版翻忌、旧正式忌神（sn<-3）不得翻喜。
// 同时复核禁止变化项：candidateScores/S_need/yong/pattern/strength/cong（零漂移）。
// 双引擎对照：_p5/bazi.pre-c07.js（C07 前快照） vs js/bazi.js（AFTER_P5_C07）。纯证据零改动。
// 输出 _p5/p5c07.1b-monotonicity.json；控制台仅 ASCII 摘要（Windows GBK 安全）。
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');

function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var OLD = load(fs.readFileSync(path.join(__dirname, 'bazi.pre-c07.js'), 'utf8'));
var NEW = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));

// 同一盘对象喂两个引擎（buildFromPillars 返回纯数据对象，跨 context 安全）
function build(eng, gz, sex) {
  var p = gz.split(' ');
  return eng.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, sex || 'male', null);
}

// ---- 盘池（与 p5c08-congge-evidence.js 同源）----
var DISKS = {};
function addDisk(id, gz, set) {
  if (!DISKS[gz]) DISKS[gz] = { id: id, gz: gz, sets: {} };
  DISKS[gz].sets[set] = true;
}
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
parseCSV('_p3_a2_sha_ab.csv').slice(1).forEach(function (r) { addDisk(r[1], r[2], '53freeze'); });
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm, m;
  while ((m = re.exec(md)) !== null) addDisk(m[1], m[2], '50blind');
});
[
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
].forEach(function (m) { addDisk(m[0], m[1], '20blind'); });
var ATTACK_SETS = { '00-P5A1-格局攻击集.md': 120, '00-P5A2-格局成败攻击集.md': 120, '00-P5A3-财党杀攻击集.md': 61 };
Object.keys(ATTACK_SETS).forEach(function (f) {
  var md = fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) { addDisk(f.replace(/\.md$/, '') + '#' + m[1], m[2], 'attack'); n++; }
  if (n !== ATTACK_SETS[f]) throw new Error(f + ' parse count anomaly: ' + n);
});
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a', '00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  addDisk('P4A-' + p4aCount, m[1], 'P4A');
});
if (p4aCount !== 32) throw new Error('P4A parse count anomaly: ' + p4aCount);
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) addDisk('IMPACT', r.gz, '105impact'); });
});
JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-output.json'), 'utf8')).forEach(function (r) {
  addDisk(r.id, r.gz, 'C05-28');
});

// ---- 执行 ----
var out = { meta: { title: 'P5-C07.1 xi/ji monotonicity check (old xi subset new xi)', date: '2026-08-16', oldEngine: '_p5/bazi.pre-c07.js', newEngine: 'js/bazi.js AFTER_P5_C07' }, summary: {}, violations: [], samples: [], stillEmptyJi: [], emptyJiFilled: [] };

var S = { total: 0, yongDiff: 0, levelDiff: 0, scoreDiff: 0, patternDiff: 0, congDiff: 0, methodDiff: 0, xiFlip: 0, jiFlip: 0, oldJiEmpty: 0, oldJiEmptyNowFilled: 0, oldXiEmpty: 0, xiAdded: 0, jiAdded: 0 };

Object.keys(DISKS).forEach(function (gz) {
  var d = DISKS[gz];
  var bNew = build(NEW, gz, 'male');
  var bOld = build(OLD, gz, 'male');
  var n = NEW.getYongJi(bNew), o = OLD.getYongJi(bOld);
  S.total++;

  // ---- 禁止变化项复核 ----
  if (o.yongShen.join('') !== n.yongShen.join('')) { S.yongDiff++; out.violations.push({ gz: gz, kind: 'yong', old: o.yongShen, neu: n.yongShen }); }
  if (o.dayMasterLevel !== n.dayMasterLevel) { S.levelDiff++; out.violations.push({ gz: gz, kind: 'level', old: o.dayMasterLevel, neu: n.dayMasterLevel }); }
  if (o.dayMasterScore !== n.dayMasterScore) { S.scoreDiff++; out.violations.push({ gz: gz, kind: 'score', old: o.dayMasterScore, neu: n.dayMasterScore }); }
  if (o.method !== n.method) { S.methodDiff++; out.violations.push({ gz: gz, kind: 'method', old: o.method, neu: n.method }); }
  var oPat = NEW.getPattern(bOld), nPat = NEW.getPattern(bNew);
  if (oPat.name !== nPat.name || oPat.status !== nPat.status) { S.patternDiff++; out.violations.push({ gz: gz, kind: 'pattern', old: oPat.name + '/' + oPat.status, neu: nPat.name + '/' + nPat.status }); }
  var oCong = !!o.congGe, nCong = !!n.congGe;
  if (oCong !== nCong) { S.congDiff++; out.violations.push({ gz: gz, kind: 'cong', old: oCong, neu: nCong }); }

  // ---- 单调性：old xi ⊆ new xi / old ji ⊆ new ji ----
  var xiFlip = o.xiShen.filter(function (w) { return n.xiShen.indexOf(w) < 0; });
  var jiFlip = o.jiShen.filter(function (w) { return n.jiShen.indexOf(w) < 0; });
  var xiAdd = n.xiShen.filter(function (w) { return o.xiShen.indexOf(w) < 0; });
  var jiAdd = n.jiShen.filter(function (w) { return o.jiShen.indexOf(w) < 0; });
  if (xiFlip.length) { S.xiFlip++; out.violations.push({ gz: gz, kind: 'xiFlip', oldXi: o.xiShen, newXi: n.xiShen, flipped: xiFlip }); }
  if (jiFlip.length) { S.jiFlip++; out.violations.push({ gz: gz, kind: 'jiFlip', oldJi: o.jiShen, newJi: n.jiShen, flipped: jiFlip }); }
  if (xiAdd.length || jiAdd.length) { S.xiAdded += xiAdd.length; S.jiAdded += jiAdd.length; }
  if (!o.jiShen.length) {
    S.oldJiEmpty++;
    if (n.jiShen.length) { S.oldJiEmptyNowFilled++; out.emptyJiFilled.push({ gz: gz, sets: Object.keys(d.sets), newJi: n.jiShen, newXi: n.xiShen }); }
    else out.stillEmptyJi.push({ gz: gz, sets: Object.keys(d.sets), newXi: n.xiShen, elementClassification: n.elementClassification, method: n.method });
  }
  if (!o.xiShen.length) S.oldXiEmpty++;
  if (out.samples.length < 8 && (xiAdd.length || jiAdd.length)) {
    out.samples.push({ gz: gz, sets: Object.keys(d.sets), old: { xi: o.xiShen, ji: o.jiShen }, neu: { xi: n.xiShen, ji: n.jiShen }, elementClassification: n.elementClassification });
  }
});

out.summary = S;
fs.writeFileSync(path.join(__dirname, 'p5c07.1b-monotonicity.json'), JSON.stringify(out, null, 1), 'utf8');

console.log('=== C07.1 monotonicity (old subset new) ===');
console.log('total=' + S.total);
console.log('forbidden-drift: yong=' + S.yongDiff + ' level=' + S.levelDiff + ' score=' + S.scoreDiff + ' pattern=' + S.patternDiff + ' cong=' + S.congDiff + ' method=' + S.methodDiff);
console.log('flips: xiFlip=' + S.xiFlip + ' jiFlip=' + S.jiFlip + ' (must be 0)');
console.log('added: xi=' + S.xiAdded + ' elements, ji=' + S.jiAdded + ' elements');
console.log('oldJiEmpty=' + S.oldJiEmpty + ' -> nowFilled=' + S.oldJiEmptyNowFilled + ' oldXiEmpty=' + S.oldXiEmpty);
console.log('output -> _p5/p5c07.1b-monotonicity.json');
