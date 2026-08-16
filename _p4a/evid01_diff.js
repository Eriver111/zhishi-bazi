// P4-A-EVID-01（2026-08-15）：pre=P4-A 冻结版（bazi.p4a-frozen.js）vs post=工作区。
// 断言（严格于 P4-A）：判定字段（分数/旺衰/用喜忌/格局名状态/type/从格/用神method/primaryReason）
// 必须【零变化】；source 文案变化仅允许出现在「同五行兜底类」盘（pre source 含「(同X透)」），
// 其余盘 source 必须逐字相同。
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
var PRE = loadEngine('_p4a/bazi.p4a-frozen.js');
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

var DISKS = [];
var shaRows = parseCSV('_p3_a2_sha_ab.csv').slice(1);
shaRows.forEach(function (r) { DISKS.push({ id: r[1], gz: r[2] }); });
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
    yjMethod: yj.method || '-', primaryReason: yj.primaryReason || '-',
    source: pt.source || '-'
  };
}

var JUDGE_FIELDS = ['score', 'level', 'yong', 'xi', 'ji', 'pattern', 'ptype', 'cong', 'yjMethod', 'primaryReason'];
var changed = [], problems = [];
DISKS.forEach(function (d) {
  var pre = snap(PRE, d.gz), post = snap(POST, d.gz);
  var jdiffs = [];
  JUDGE_FIELDS.forEach(function (k) {
    if (pre[k] !== post[k]) jdiffs.push(k + ': ' + pre[k] + ' → ' + post[k]);
  });
  if (jdiffs.length) { problems.push({ d: d, msg: '判定字段变化: ' + jdiffs.join('; ') }); return; }
  if (pre.source !== post.source) {
    // 允许类：pre source 含「(同X透)」= 同五行兜底类盘（文案修复目标）
    if (/\(同[木火土金水]透\)/.test(pre.source)) {
      changed.push({ id: d.id, set: d.set, gz: d.gz, pre: pre.source, post: post.source });
    } else {
      problems.push({ d: d, msg: '非兜底类 source 变化: ' + pre.source + ' → ' + post.source });
    }
  }
});

var lines = [];
lines.push('# P4-A-EVID-01 107 盘 diff（pre=P4-A 冻结版 vs post=文案修复后）');
lines.push('');
lines.push('- 总盘数：' + DISKS.length + '（53 冻结 + 20 盲盘 + 50 盲测去重）');
lines.push('- 判定字段（分数/旺衰/用喜忌/格局·状态/type/从格/用神method/primaryReason）：' + (problems.length ? '❌ 有变化' : '✅ 零变化'));
lines.push('- source 文案变化：' + changed.length + ' 盘，全部为同五行兜底类' + (problems.length ? ' ❌' : ' ✅'));
lines.push('');
if (changed.length) {
  lines.push('| 盘 | 类 | 四柱 | pre source | post source |');
  lines.push('|---|---|---|---|---|');
  changed.forEach(function (c) { lines.push('| ' + c.id + ' | ' + c.set + ' | ' + c.gz + ' | ' + c.pre + ' | ' + c.post + ' |'); });
}
lines.push('');
if (problems.length) {
  lines.push('## ❌ 传播异常——中止');
  problems.forEach(function (p) { lines.push('- ' + p.d.set + ' ' + p.d.id + ' ' + p.d.gz + ' | ' + p.msg); });
} else {
  lines.push('## ✅ 判定零漂移 + 文案变化仅限目标类');
}
fs.writeFileSync(path.join(__dirname, '00-EVID01-107盘diff.md'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log('\n[总盘数 ' + DISKS.length + ' | 文案变化 ' + changed.length + ' | 异常 ' + problems.length + ']');
process.exit(problems.length ? 1 : 0);
