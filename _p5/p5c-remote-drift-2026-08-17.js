// 远端引擎漂移测量（2026-08-17）：origin/main 出现并行线 5 个尾 commit 改动了 js/bazi.js
// （5ad0508 调候硬边界+conditions/desc 63 行、4fa0d6e 建禄透比劫 2 行；其余 3 commit 仅报告层）。
// 本脚本对照：OLD=工作区 js/bazi.js（C07+文案补丁冻结版，CRLF 835df4d8）=NEW=_p5/bazi.remote-2026-08-17.js（bea4a643）。
// 测量 540+ 盘池判定漂移（name/status/est/score/level/yong/xi/ji/method/cls/cong + desc）。
// 输出 _p5/p5c-remote-drift-2026-08-17.json；控制台仅 ASCII 摘要（GBK 安全）。
var fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..');

function shaOf(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var OLD_SRC = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8');
var NEW_SRC = fs.readFileSync(path.join(__dirname, 'bazi.remote-2026-08-17.js'), 'utf8');
var OLD = load(OLD_SRC);
var NEW = load(NEW_SRC);
console.log('old_sha=' + shaOf(path.join(ROOT, 'js', 'bazi.js')));
console.log('new_sha=' + shaOf(path.join(__dirname, 'bazi.remote-2026-08-17.js')));

// ---- 盘池（p5c08-congge-evidence.js:110-162 同源，gz 去重）----
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
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚戌'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
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
[['ANCH1', '丁亥 丙午 癸巳 己卯'], ['ANCH2', '戊子 丁巳 癸亥 庚申'], ['ANCH3', '己丑 甲戌 癸巳 丙辰'],
 ['USER-Q', '庚寅 丙戌 庚子 乙酉']].forEach(function (a) { addDisk(a[0], a[1], 'extra'); });

// ---- 双引擎快照 ----
function build(ENG, gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
function snap(ENG, gz) {
  var b = build(ENG, gz);
  var dm = ENG.calcDayMasterStrength(b);
  var yj = ENG.getYongJi(b);
  var pat = ENG.getPattern(b);
  var cong = ENG.getCongGe(b);
  return {
    name: pat.name, status: pat.status, est: !!pat.isEstablished, desc: pat.desc,
    score: dm.score, level: dm.level,
    yong: (yj.yongShen || []).join(''), xi: (yj.xiShen || []).join(''), ji: (yj.jiShen || []).join(''),
    method: yj.method || '', cls: JSON.stringify(yj.elementClassification || {}),
    cong: !!cong.isCong
  };
}
var judgeKeys = ['name', 'status', 'est', 'score', 'level', 'yong', 'xi', 'ji', 'method', 'cls', 'cong'];

var gzs = Object.keys(DISKS);
var drift = [], descChanged = [];
gzs.forEach(function (gz) {
  var o = snap(OLD, gz), n = snap(NEW, gz);
  judgeKeys.forEach(function (k) {
    if (o[k] !== n[k]) drift.push({ gz: gz, id: DISKS[gz].id, sets: DISKS[gz].sets, key: k, old: o[k], now: n[k] });
  });
  if (o.desc !== n.desc) descChanged.push({ gz: gz, id: DISKS[gz].id, sets: DISKS[gz].sets, name: n.name, old: o.desc, now: n.desc });
});

var byKey = {}, bySet = {}, driftedGz = {};
drift.forEach(function (d) {
  byKey[d.key] = (byKey[d.key] || 0) + 1;
  Object.keys(d.sets).forEach(function (s) { bySet[s] = (bySet[s] || 0) + 1; });
  driftedGz[d.gz] = (driftedGz[d.gz] || 0) + 1;
});

var out = { total: gzs.length, drift: drift, descChanged: descChanged, byKey: byKey, bySet: bySet, driftedDiskCount: Object.keys(driftedGz).length };
fs.writeFileSync(path.join(__dirname, 'p5c-remote-drift-2026-08-17.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('total=' + gzs.length);
console.log('drifted_disks=' + Object.keys(driftedGz).length);
console.log('by_key=' + JSON.stringify(byKey));
console.log('by_set=' + JSON.stringify(bySet));
console.log('desc_changed=' + descChanged.length);
console.log('json_written=OK');
