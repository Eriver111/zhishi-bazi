// 文案补丁审计（2026-08-17）：对 80 盘 desc 变化逐盘核对——
// ①变化必须都是「月令透X，」→「月令X当权，」前缀替换（正文不动）
// ②变化的盘必须真实满足：同柱复合 + 月支格神本星未透干（matchMode != exact-canggan）
// ③顺带全池扫描同类未改的单格局路径（desc 仍含「月令透X」但本星未透）——留待用户裁决是否扩大范围。
// 控制台仅 ASCII 摘要（GBK 安全），细节进 JSON。
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var NEW = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));
var data = JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c-copyfix-verify-2026-08-17.json'), 'utf8'));

function build(gz) {
  var p = gz.split(' ');
  return NEW.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

// ---- ①+② 80 盘审计 ----
var byName = {};
var anomalies = [];
data.descChanged.forEach(function (d) {
  byName[d.name] = (byName[d.name] || 0) + 1;
  var head = (d.old.match(/^月干.+?——[^，]+，/) || [''])[0];
  if (!head) { anomalies.push({ gz: d.gz, why: 'no compound head', old: d.old, now: d.now }); return; }
  var oldRest = d.old.slice(head.length);
  var newRest = d.now.slice(head.length);
  if (d.now.slice(0, head.length) !== head) anomalies.push({ gz: d.gz, why: 'head changed', old: d.old, now: d.now });
  if (!/^月令透[^，]+，/.test(oldRest)) anomalies.push({ gz: d.gz, why: 'old rest not tou', oldRest: oldRest, newRest: newRest });
  if (!/^月令[^，]+当权，/.test(newRest)) anomalies.push({ gz: d.gz, why: 'new rest not dangquan', oldRest: oldRest, newRest: newRest });
  if (oldRest.replace(/^月令透[^，]+，/, '') !== newRest.replace(/^月令[^，]+当权，/, '')) {
    anomalies.push({ gz: d.gz, why: 'body text changed', oldRest: oldRest, newRest: newRest });
  }
  var pat = NEW.getPattern(build(d.gz));
  if (pat.matchMode === 'exact-canggan') anomalies.push({ gz: d.gz, why: 'changed but exact-canggan', matchMode: pat.matchMode });
  if (pat.type !== '同柱复合') anomalies.push({ gz: d.gz, why: 'changed but not compound', type: pat.type });
});

// ---- ③ 全池同类扫描（单格局路径未改）----
// 重建盘池：从 verify 输出无法反推全集，此处复用 p5c-copyfix-verify 的盘集加载（复制加载段）。
var DISKS = {};
function addDisk(id, gz, set) { if (!DISKS[gz]) DISKS[gz] = { id: id, gz: gz, sets: {} }; DISKS[gz].sets[set] = true; }
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

var singlePath = [];
Object.keys(DISKS).forEach(function (gz) {
  var pat = NEW.getPattern(build(gz));
  if (pat.type === '同柱复合') return;
  if (pat.matchMode === 'exact-canggan') return;
  if (/^月令透/.test(pat.desc)) {
    singlePath.push({ gz: gz, id: DISKS[gz].id, name: pat.name, type: pat.type, matchMode: pat.matchMode, desc: pat.desc });
  }
});

var out = {
  changedTotal: data.descChanged.length,
  byName: byName,
  anomalies: anomalies,
  singlePathSameClass: singlePath,
  singlePathCount: singlePath.length
};
fs.writeFileSync(path.join(__dirname, 'p5c-copyfix-audit-2026-08-17.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('changed=' + data.descChanged.length);
console.log('anomalies=' + anomalies.length);
console.log('by_name=' + JSON.stringify(byName));
console.log('single_path_same_class=' + singlePath.length);
console.log('json_written=OK');
