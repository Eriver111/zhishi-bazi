// 22盘基线冻结：第一轮10盘（含4盘遁法修正）+ 第二轮12盘
// 引擎零改动：探针在内存副本上注入，不动 js/bazi.js
// 产物：_baseline_22.csv（BOM），内置 sanity 断言全过才写盘
// 用法: node _freeze_22.js
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var GAN_SEQ = '甲乙丙丁戊己庚辛壬癸';
var ZHI_IDX = { '子':0,'丑':1,'寅':2,'卯':3,'辰':4,'巳':5,'午':6,'未':7,'申':8,'酉':9,'戌':10,'亥':11 };
var WUHUDUN  = { '甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚','丁':'壬','壬':'壬','戊':'甲','癸':'甲' };
var WUSHUDUN = { '甲':'甲','己':'甲','乙':'丙','庚':'丙','丙':'戊','辛':'戊','丁':'庚','壬':'庚','戊':'壬','癸':'壬' };
function validatePillars(gz) {
  var yg = gz[0][0], mz = gz[1][1], mg = gz[1][0];
  var dg = gz[2][0], hz = gz[3][1], hg = gz[3][0];
  var okMonth = GAN_SEQ[(GAN_SEQ.indexOf(WUHUDUN[yg]) + (ZHI_IDX[mz] - 2 + 12) % 12) % 10] === mg;
  var okHour = GAN_SEQ[(GAN_SEQ.indexOf(WUSHUDUN[dg]) + ZHI_IDX[hz]) % 10] === hg;
  var bad = [];
  if (!okMonth) bad.push('月柱');
  if (!okHour) bad.push('时柱');
  return bad.length ? ('⚠ 排盘校验失败：' + bad.join('、') + '不合遁法') : '';
}

// [编号, 年, 月, 日, 时, 备注]
var CHARTS = [
  ['#1','甲寅','丙寅','甲寅','甲子',''],
  ['#2','庚申','戊子','丙子','壬辰',''],
  ['#3','戊午','丁巳','丙午','甲午',''],
  ['#4','壬子','辛亥','戊子','壬子','已按遁法修正（原癸亥月）'],
  ['#5','己酉','癸酉','庚申','甲申','已按遁法修正（原辛酉月+戊申时）'],
  ['#6','甲辰','丙寅','戊午','丁巳',''],
  ['#7','癸亥','甲寅','乙卯','丙子','已按遁法修正（原壬子时）'],
  ['#8','庚申','壬午','甲午','丙寅',''],
  ['#9','甲子','丁卯','己未','庚午','已按遁法修正（原丙午时）'],
  ['#10','辛酉','癸巳','壬子','庚子',''],
  ['A1','甲辰','丙寅','戊午','庚申',''],
  ['A2','甲子','丁卯','己未','癸酉',''],
  ['A3','丙申','庚寅','戊辰','丁巳',''],
  ['A4','辛亥','庚寅','己巳','庚午',''],
  ['A5','壬辰','癸卯','戊戌','丁巳',''],
  ['A6','癸酉','乙卯','己丑','己巳',''],
  ['B1','庚申','壬午','甲午','丙寅',''],
  ['B2','壬申','丁未','甲辰','乙丑',''],
  ['B3','辛酉','丁酉','甲寅','乙丑',''],
  ['B4','戊辰','戊午','乙亥','戊寅',''],
  ['B5','庚子','甲申','乙卯','丙子',''],
  ['B6','丙申','己亥','丁卯','壬寅','']
];

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

function buildCode(source, opts) {
  opts = opts || {};
  var out = source;
  var fnStart = out.indexOf('function calcDayMasterStrength');
  var fnEnd = out.indexOf('\nfunction ', fnStart + 10);
  var fnSrc = out.slice(fnStart, fnEnd);
  if (opts.trace) {
    MARKERS.forEach(function(pair) {
      if (fnSrc.indexOf(pair[0]) < 0) throw new Error('marker not found: ' + pair[0]);
    });
    var traced = fnSrc;
    for (var i = MARKERS.length - 1; i >= 0; i--) {
      traced = traced.replace(MARKERS[i][0], "global.__TRACE.push(['" + MARKERS[i][1] + "', score]);\n  " + MARKERS[i][0]);
    }
    traced = traced.replace('var score = 50;', "var score = 50;\n  global.__TRACE = [];");
    fnSrc = traced;
  }
  out = out.slice(0, fnStart) + fnSrc + out.slice(fnEnd);
  var stitch = '';
  ['getPattern','calcDayMasterStrength','getYongJi','getCongGe'].forEach(function(name) {
    stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  return out.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
}

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}

// 1) 追踪版：取 ⑧½前/后 分数（t[13]/t[14]）
eval(buildCode(code, { trace: true }));
var traces = {};
CHARTS.forEach(function(c) {
  calcDayMasterStrength(toBazi(c.slice(1, 5)));
  traces[c[0]] = global.__TRACE.slice();
});

// 2) 正常版：全字段
eval(buildCode(code));
var normal = {};
CHARTS.forEach(function(c) {
  var b = toBazi(c.slice(1, 5));
  normal[c[0]] = {
    dm: calcDayMasterStrength(b),
    cong: getCongGe(b),
    pat: getPattern(b),
    yj: getYongJi(b)
  };
});

// —— sanity 断言：全过才写 CSV ——
var failures = [];
function chk(id, cond, detail) {
  if (!cond) failures.push('[' + id + '] ' + detail);
}
CHARTS.forEach(function(c) {
  var id = c[0];
  var n = normal[id];
  if (n.yj.yongShen.length !== 1) chk(id, false, '用神数量=' + n.yj.yongShen.length + ' ≠ 1');
  if (n.yj.xiShen.length === 0) chk(id, false, '喜神为空');
  if (n.yj.jiShen.length === 0) chk(id, false, '忌神为空');
  if (validatePillars(c.slice(1, 5)) !== '') chk(id, false, '排盘校验未过');
});
chk('A3终分', normal['A3'].dm.score === 56, 'A3=' + normal['A3'].dm.score + ' ≠ 56');
chk('A3跨线', traces['A3'][13][1] < 50 && traces['A3'][14][1] >= 50, 'A3 ⑧½跨线标志不符（' + traces['A3'][13][1] + '→' + traces['A3'][14][1] + '）');
chk('B1终分', normal['B1'].dm.score === 24, 'B1=' + normal['B1'].dm.score + ' ≠ 24');
chk('B2终分', normal['B2'].dm.score === 19, 'B2=' + normal['B2'].dm.score + ' ≠ 19');
chk('B5终分', normal['B5'].dm.score === 42, 'B5=' + normal['B5'].dm.score + ' ≠ 42');
chk('#6终分', normal['#6'].dm.score === 62, '#6=' + normal['#6'].dm.score + ' ≠ 62');
chk('#9终分', normal['#9'].dm.score === 51, '#9=' + normal['#9'].dm.score + ' ≠ 51');
chk('#2从格', normal['#2'].cong.isCong === true, '#2 从格标志不符（' + (normal['#2'].cong.isCong ? normal['#2'].cong.name : '非从格') + '）');
chk('#4从格', normal['#4'].cong.isCong === true, '#4 从格标志不符（' + (normal['#4'].cong.isCong ? normal['#4'].cong.name : '非从格') + '）');

// —— 输出 ——
function csvQ(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}
var csv = ['编号,八字,排盘校验,终分,旺衰,格局,从格,用神,喜神,忌神,method,调候备注,primaryReason,用神根气分,用神根气评级,⑧½前分,⑧½后分,因⑧½跨50,引擎提交,备注'];

CHARTS.forEach(function(c) {
  var id = c[0], gzStr = c.slice(1, 5).join(' ');
  var invalid = validatePillars(c.slice(1, 5));
  var n = normal[id], t = traces[id];
  var pre = t[13][1], post = t[14][1];
  var crossed = (post - pre > 0 && pre < 50 && post >= 50);
  var yongWx = n.yj.yongShen[0];
  var q = n.yj.yongShenQuality[yongWx];
  var qStr = q ? (q.score + '/' + q.quality) : '';
  var tiaoHouNote = (n.yj.method || '').indexOf('调候') >= 0 ? n.yj.primaryReason : '';

  console.log('【' + id + '】' + gzStr +
    (invalid ? '  ' + invalid : '') +
    '  ' + n.dm.score + '分' + n.dm.level +
    '  ' + n.pat.name + '·' + n.pat.status +
    (n.cong.isCong ? '（' + n.cong.name + '）' : '') +
    '  用神:' + n.yj.yongShen.join('、') +
    '  喜:' + n.yj.xiShen.join('、') +
    '  忌:' + n.yj.jiShen.join('、') +
    '  [' + n.yj.method + ']' +
    (crossed ? '  ⚠⑧½跨线' : ''));

  csv.push([
    id, gzStr, invalid || '合格',
    n.dm.score, n.dm.level,
    n.pat.name + '·' + n.pat.status,
    n.cong.isCong ? n.cong.name : '否',
    n.yj.yongShen.join('、'), n.yj.xiShen.join('、'), n.yj.jiShen.join('、'),
    n.yj.method, tiaoHouNote, n.yj.primaryReason,
    qStr.split('/')[0] || '', qStr.split('/')[1] || '',
    pre, post, crossed ? '是' : '否',
    'dbed1e0', c[5]
  ].map(csvQ).join(','));
});

if (failures.length > 0) {
  console.log('\n✗ sanity 断言失败 ' + failures.length + ' 条，不写 CSV：');
  failures.forEach(function(f) { console.log('  ' + f); });
  process.exit(1);
}

fs.writeFileSync(__dirname + '/_baseline_22.csv', '﻿' + csv.join('\n'), 'utf-8');
console.log('\n✅ sanity 断言全部通过（22/22 遁法合格、用神恒1、关键盘分数一致），已写入 _baseline_22.csv');
