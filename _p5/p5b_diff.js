// P5-B diff（2026-08-15）：pre=git HEAD js/bazi.js（b8e9ebaa blob）vs post=工作区 bazi.js。
// 白名单（P5-B 仅新增输出层字段，判定零漂移）：
//   ① getPattern 新增 mechanism 键（财生官格盘=财生杀/财生官，其余盘=null）；
//   ② getYongJi.evidence 新增「候选对比」条目（有 candidateScores 的盘）；
//   ③ getYongJi.chainHints/chainAdjustments 为空数组时的差异（本 diff 两引擎均不加载 bazi-chain，应同为 []）。
// 白名单之外任何字段差异 = 判定漂移，脚本报错退出非零。
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
function loadEngineSrc(src) {
  var context = { window: {} };
  vm.runInNewContext(src, context);
  return context.window.BaZiCalculator;
}
var HEAD_SRC = cp.execFileSync('git', ['show', 'HEAD:js/bazi.js'], { cwd: ROOT, encoding: 'utf8' });
var PRE = loadEngineSrc(HEAD_SRC);
var POST = loadEngineSrc(fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8'));

function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
function buildPillars(eng, gz) {
  var p = gz.split(' ');
  return eng.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

// ---- 盘集：53冻结 + 50盲测 + 20盲盘 + P5-A1 120 + P5-A2 120（与 a2a_diff 同口径） ----
var DISKS = [];
var shaRows = parseCSV('_p3_a2_sha_ab.csv').slice(1);
shaRows.forEach(function (r) { DISKS.push({ id: r[1], gz: r[2], set: '53冻结' }); });
var BLIND50 = [];
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm;
  var m;
  while ((m = re.exec(md)) !== null) BLIND50.push({ id: m[1], gz: m[2] });
});
if (BLIND50.length !== 50) throw new Error('50 盲测解析数量异常: ' + BLIND50.length);
DISKS = DISKS.concat(BLIND50);
var BLIND20 = [
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
];
var dedup = {};
DISKS.forEach(function (d) { dedup[d.gz] = { id: d.id, gz: d.gz, set: '53冻结' }; });
var final = [];
BLIND20.forEach(function (m) {
  final.push({ id: m[0], gz: m[1], set: '20盲盘' });
  delete dedup[m[1]];
});
BLIND50.forEach(function (d) {
  if (dedup[d.gz]) { final.push({ id: d.id, gz: d.gz, set: '50盲测' }); delete dedup[d.gz]; }
});
Object.keys(dedup).forEach(function (gz) { final.push(dedup[gz]); });
DISKS = final;
['00-P5A1-格局攻击集.md', '00-P5A2-格局成败攻击集.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, '_p5', f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) { DISKS.push({ id: f.replace(/\.md$/, '') + '#' + m[1], gz: m[2], set: '攻击集' }); n++; }
  if (n !== 120) throw new Error(f + ' 解析数量异常: ' + n);
});

// P4-A 定向 32 盘（A1 24 + A2 8，与 a2a_diff 同口径）
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a/00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  DISKS.push({ id: 'P4A-' + p4aCount, gz: m[1], set: 'P4A定向' });
});
if (p4aCount !== 32) throw new Error('P4-A 定向盘解析数量异常: ' + p4aCount);

// ---- 白名单比较 ----
function stripYongJiWhitelist(yj) {
  var out = JSON.parse(JSON.stringify(yj));
  if (out.evidence) out.evidence = out.evidence.filter(function (e) { return e.category !== '候选对比'; });
  return out;
}
function stripPatternWhitelist(pt) {
  var out = JSON.parse(JSON.stringify(pt));
  delete out.mechanism;
  return out;
}

var total = 0, drift = 0, mechCount = 0, candCount = 0, mechBad = [];
DISKS.forEach(function (d) {
  total++;
  var bPre, bPost;
  try { bPre = buildPillars(PRE, d.gz); } catch (e) { console.log('PRE构造失败', d.id, e.message); process.exit(1); }
  try { bPost = buildPillars(POST, d.gz); } catch (e) { console.log('POST构造失败', d.id, e.message); process.exit(1); }
  var ptPre = PRE.getPattern(bPre), ptPost = POST.getPattern(bPost);
  var cgPre = PRE.getCongGe(bPre), cgPost = POST.getCongGe(bPost);
  var yjPre = PRE.getYongJi(bPre), yjPost = POST.getYongJi(bPost);

  // ① mechanism 键合法性：财生官格必须有值（财生杀/财生官）；其余格局一律 null/undefined
  if (ptPost.name === '财生官格') {
    if (ptPost.mechanism === '财生杀' || ptPost.mechanism === '财生官') mechCount++;
    else mechBad.push(d.id + ': name=' + ptPost.name + ' mechanism=' + ptPost.mechanism);
  } else if (ptPost.mechanism !== null && ptPost.mechanism !== undefined) {
    mechBad.push(d.id + ': name=' + ptPost.name + ' mechanism应为null实际=' + ptPost.mechanism);
  }

  // ② 候选对比条目合法性
  var hasCand = (yjPost.evidence || []).some(function (e) { return e.category === '候选对比'; });
  var hasCandScores = !!(yjPost.candidateScores && yjPost.candidateScores.length);
  if (hasCand && hasCandScores) candCount++;
  else if (hasCand !== hasCandScores) mechBad.push(d.id + ': 候选对比条目与 candidateScores 存在性不一致');

  // ③ 白名单外零漂移
  if (JSON.stringify(stripPatternWhitelist(ptPre)) !== JSON.stringify(stripPatternWhitelist(ptPost)) ||
      JSON.stringify(cgPre) !== JSON.stringify(cgPost) ||
      JSON.stringify(stripYongJiWhitelist(yjPre)) !== JSON.stringify(stripYongJiWhitelist(yjPost))) {
    drift++;
    console.log('漂移: ' + d.id + ' ' + d.gz + ' [' + d.set + ']');
  }
});

console.log('总盘数: ' + total);
console.log('mechanism 合法盘: ' + mechCount + ' / mechanism 异常: ' + mechBad.length);
console.log('候选对比条目盘: ' + candCount);
console.log('白名单外漂移: ' + drift);
if (mechBad.length) { mechBad.forEach(function (x) { console.log('  异常: ' + x); }); }
process.exit((drift === 0 && mechBad.length === 0) ? 0 : 1);
