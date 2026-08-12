// 旺衰逐步追踪：在 calcDayMasterStrength 各步骤边界注入探针，打印每一步后的分数
// 用法: node _trace_strength.js 庚申 壬午 甲午 丙寅
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

// 只截取 calcDayMasterStrength 函数源码，在其内部注入探针（不改动引擎文件）
var fnStart = code.indexOf('function calcDayMasterStrength');
var fnEnd = code.indexOf('\nfunction ', fnStart + 10);
var fnSrc = code.slice(fnStart, fnEnd);

// [marker注释, 该marker处push的标签] —— 在每段注释前插入探针，记录进入该段前的分数
var MARKERS = [
  ['// ---------- ① 得令',            '基准'],
  ['// ---------- ② 得地',            '①得令后'],
  ['// ---------- ③ 得势',            '②得地后'],
  ['// ---------- ④ 地支藏干本气',    '③得势后'],
  ['// ---------- ⑤ 五行过耗修正',    '④藏干本气后'],
  ['// ---------- ⑤½ 土多金埋修正',   '⑤过耗后'],
  ['// ---------- ⑥ 调候',            '⑤½土多金埋后'],
  ['// ---------- ⑦ 天干合化修正',    '⑥调候后'],
  ['// ---------- ⑧ 地支合冲刑害修正','⑦五合后'],
  ['// 跨柱六合检测',                 '⑧相邻冲害刑合后'],
  ['// 三会局检测',                   '⑧跨柱六合后'],
  ['// 跨柱六冲检测',                 '⑧三会半会后'],
  ['// 日支被合化',                   '⑧跨柱六冲后'],
  ['// ---------- ⑧½ 杀印相生结构修正','⑧日支合化重构后'],
  ['// ---------- ⑧¾ 宫位远近修正',   '⑧½杀印相生后'],
  ['// ---------- ⑨ 分级输出',        '⑧¾宫位远近后']
];
MARKERS.forEach(function(pair) {
  if (fnSrc.indexOf(pair[0]) < 0) throw new Error('marker not found: ' + pair[0]);
});
// 反向注入，避免前一个注入影响后一个 marker 的位置判断
var traced = fnSrc;
for (var i = MARKERS.length - 1; i >= 0; i--) {
  var marker = MARKERS[i][0], label = MARKERS[i][1];
  traced = traced.replace(marker, "global.__TRACE.push(['" + label + "', score]);\n  " + marker);
}

// 拼回完整代码，并保证探针数组初始存在（在函数开头声明处注入）
traced = traced.replace('var score = 50;', "var score = 50;\n  global.__TRACE = [];");
var modifiedCode = code.slice(0, fnStart) + traced + code.slice(fnEnd);

// internals stitch + eval
var stitch = '';
['getPattern','calcDayMasterStrength','getYongJi','getCongGe'].forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
modifiedCode = modifiedCode.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(modifiedCode);

var args = process.argv.slice(2);
if (args.length < 4) {
  console.log('用法: node _trace_strength.js 年柱 月柱 日柱 时柱');
  process.exit(1);
}
var bazi = {
  year: { gan: args[0][0], zhi: args[0][1] },
  month:{ gan: args[1][0], zhi: args[1][1] },
  day:  { gan: args[2][0], zhi: args[2][1] },
  hour: { gan: args[3][0], zhi: args[3][1] }
};

var dm = calcDayMasterStrength(bazi);
console.log(args.join(' ') + ' —— 日主' + bazi.day.gan + '（' + dm.score + '分 ' + dm.level + '）逐步明细:');
var prev = 50;
global.__TRACE.forEach(function(entry) {
  var delta = entry[1] - prev;
  prev = entry[1];
  console.log('  ' + entry[0] + ': ' + entry[1] + '分' + (delta === 0 ? '' : '（' + (delta > 0 ? '+' : '') + delta + '）'));
});
console.log('  ' + dm.level + '（限幅后终分）: ' + dm.score + '分');
