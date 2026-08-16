// P4-A 格局边界修复（2026-08-14，GPT 终局裁决）：pre/post 引擎全量 diff 回归。
// 对象：53 盘 P3 冻结图表（_p3_a2_sha_ab.csv 四柱）+ 20 盲盘（_blind20.js DISKS）。
// 断言：仅 A1 类（帝旺月比劫透干：建禄格→羊刃格）与 A2 类（同柱复合+从格：复合名→从格名）变化，
//       且 旺衰/用神/喜神/忌神 五行零漂移；任何其他盘变化 = 传播异常 → 中止。
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

function loadEngine(file) {
  var source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  var context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}
var PRE = loadEngine('_p4a/bazi.pre.js');
var POST = loadEngine('js/bazi.js');

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

// ---- 盘清单：53 冻结图表 + 20 盲盘 + 50 盲测（从冻结结果 md 标题解析） ----
var DISKS = [];
var seen = {};
var shaRows = parseCSV('_p3_a2_sha_ab.csv').slice(1);
shaRows.forEach(function (r) { DISKS.push({ id: r[1], gz: r[2] }); });
// 50 盘综合盲测 = 冒烟 10 + 正式 30 + 压力 10（两张冻结结果 md 的 ## 标题）
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
// 编号优先级：20盲盘 M 编号 > 50盲测 S/BND/PAT/TH/R/X 编号 > 53 冻结图表（去重）
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

// ---- 逐盘 pre/post 计算 + 逐字段 diff ----
function snap(eng, gz) {
  var b = buildPillars(eng, gz);
  var ds = eng.calcDayMasterStrength(b);
  var pt = eng.getPattern(b);
  var yj = eng.getYongJi(b);
  var cg = eng.getCongGe(b);
  return {
    score: String(ds.score), level: ds.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pt.name + '·' + pt.status, ptype: pt.type,
    cong: cg.isCong ? cg.name : '否',
    yjMethod: yj.method || '-', primaryReason: yj.primaryReason || '-'
  };
}

var changed = [], problems = [];
DISKS.forEach(function (d) {
  var pre = snap(PRE, d.gz), post = snap(POST, d.gz);
  var diffs = [];
  ['score', 'level', 'yong', 'xi', 'ji', 'pattern', 'ptype', 'cong', 'yjMethod', 'primaryReason'].forEach(function (k) {
    if (pre[k] !== post[k]) diffs.push(k + ': ' + pre[k] + ' → ' + post[k]);
  });
  if (!diffs.length) return;
  // 分类判定：A1 = pre 建禄格 → post 羊刃格；A2 = pre 同柱复合名 → post 从格名
  var isA1 = pre.pattern.indexOf('建禄格') === 0 && post.pattern.indexOf('羊刃格') === 0;
  var isA2 = pre.ptype === '同柱复合' && post.cong !== '否' && post.pattern.indexOf('从') >= 0;
  // 违规检查：旺衰/用喜忌五行不允许变（A2 允许 yjMethod/primaryReason 之外的任何变化都算传播）
  var coreLeak = ['score', 'level', 'yong', 'xi', 'ji'].some(function (k) { return pre[k] !== post[k]; });
  if (coreLeak || (!isA1 && !isA2)) problems.push(d);
  changed.push({ id: d.id, set: d.set, gz: d.gz, cls: isA1 ? 'A1' : (isA2 ? 'A2' : '??'), diffs: diffs });
});

// ---- 输出 ----
var lines = [];
lines.push('# P4-A pre/post diff 回归（53 冻结盘 + 20 盲盘 + 50 盲测 = ' + DISKS.length + ' 盘，去重后）');
lines.push('');
if (changed.length === 0) {
  lines.push('✅ 零变化——补丁对全部 ' + DISKS.length + ' 盘无影响（不可能，请检查）');
} else {
  lines.push('变化盘 ' + changed.length + ' 盘：');
  lines.push('');
  lines.push('| 盘 | 类 | 四柱 | 变化 |');
  lines.push('|---|---|---|---|');
  changed.forEach(function (c) {
    lines.push('| ' + c.id + ' | ' + c.cls + ' | ' + c.gz + ' | ' + c.diffs.join('<br>') + ' |');
  });
}
lines.push('');
if (problems.length) {
  lines.push('## ❌ 传播异常盘（旺衰/用喜忌漂移 或 非 A1/A2 类变化）——中止，不得进入冻结');
  problems.forEach(function (d) { lines.push('- ' + d.set + ' ' + d.id + ' ' + d.gz); });
} else {
  lines.push('## ✅ 传播检查：旺衰/用神/喜神/忌神五行零漂移，全部变化均属 A1/A2 目标类');
}
fs.writeFileSync(path.join(__dirname, '00-regression-diff.md'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log('\n[总盘数 ' + DISKS.length + ' | 变化 ' + changed.length + ' | 异常 ' + problems.length + ']');
if (problems.length) process.exit(1);
