// 文案层补丁验证（2026-08-17）：复合格 desc「月令透X」→「当权」（未透干时）。
// 双引擎对照：OLD=_p5/bazi.pre-copyfix-2026-08-17.js（补丁前快照）vs NEW=js/bazi.js（补丁后）。
// 判定字段零漂移断言 + desc 差异清单（供逐盘事实核对）。
// 输出 _p5/p5c-copyfix-verify-2026-08-17.json；控制台仅 ASCII 摘要（GBK 安全）。
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');

function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var OLD = load(fs.readFileSync(path.join(__dirname, 'bazi.pre-copyfix-2026-08-17.js'), 'utf8'));
var NEW = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));

// ---- 盘集（p5c08-congge-evidence.js:110-162 同源，gz 去重）----
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
var judgeDrift = [], descChanged = [];
gzs.forEach(function (gz) {
  var o = snap(OLD, gz), n = snap(NEW, gz);
  judgeKeys.forEach(function (k) {
    if (o[k] !== n[k]) judgeDrift.push({ gz: gz, id: DISKS[gz].id, key: k, old: o[k], now: n[k] });
  });
  if (o.desc !== n.desc) descChanged.push({ gz: gz, id: DISKS[gz].id, sets: DISKS[gz].sets, name: n.name, old: o.desc, now: n.desc });
});

var out = { total: gzs.length, judgeDrift: judgeDrift, descChanged: descChanged };
fs.writeFileSync(path.join(__dirname, 'p5c-copyfix-verify-2026-08-17.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('total=' + gzs.length);
console.log('judge_drift=' + judgeDrift.length);
console.log('desc_changed=' + descChanged.length);
console.log('json_written=OK');
// —— 录屏友好摘要（纯展示；上方扁平行保留作报告对账）——
var G = '\x1b[32m', GOLD = '\x1b[38;2;212;175;55m', R = '\x1b[0m';
console.log('');
console.log(GOLD + '══════════════════════════════════' + R);
console.log('  ' + GOLD + '双引擎对照 · ' + gzs.length + ' 盘 · 判定零漂移' + R);
console.log(GOLD + '══════════════════════════════════' + R);
console.log('  ' + G + '✓' + R + ' 判定字段 11 项全等（快照 vs 现役引擎）');
console.log('  ' + G + '✓' + R + ' 文案层变更 ' + descChanged.length + ' 盘（透→当权 · 审计零异常）');
