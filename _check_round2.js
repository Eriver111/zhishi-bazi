// 第二轮定向压力测试：12 盘，每盘输出逐步明细 + ⑧½补偿删除对比
// 引擎零改动：探针与⑧½删除均在内存副本上完成，不改 js/bazi.js
// 用法: node _check_round2.js
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

var CHARTS = [
  ['A1','甲辰','丙寅','戊午','庚申'],
  ['A2','甲子','丁卯','己未','癸酉'],
  ['A3','丙申','庚寅','戊辰','丁巳'],
  ['A4','辛亥','庚寅','己巳','庚午'],
  ['A5','壬辰','癸卯','戊戌','丁巳'],
  ['A6','癸酉','乙卯','己丑','己巳'],
  ['B1','庚申','壬午','甲午','丙寅'],
  ['B2','壬申','丁未','甲辰','乙丑'],
  ['B3','辛酉','丁酉','甲寅','乙丑'],
  ['B4','戊辰','戊午','乙亥','戊寅'],
  ['B5','庚子','甲申','乙卯','丙子'],
  ['B6','丙申','己亥','丁卯','壬寅']
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
  if (opts.killShaYin) {
    // 删除⑧½补偿：仅禁掉 +13 分支，其余照旧
    if (fnSrc.indexOf('if (_yinAdjacent && _hasCSL) {') < 0) throw new Error('shayin anchor not found');
    fnSrc = fnSrc.replace('if (_yinAdjacent && _hasCSL) {', 'if (false && _yinAdjacent && _hasCSL) {');
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

// 1) 追踪版：跑全部 12 盘逐步明细
eval(buildCode(code, { trace: true }));
var traces = {};
CHARTS.forEach(function(c) {
  calcDayMasterStrength(toBazi(c.slice(1)));
  traces[c[0]] = global.__TRACE.slice();
});

// 2) 正常版
eval(buildCode(code));
var normal = {};
CHARTS.forEach(function(c) {
  var b = toBazi(c.slice(1));
  normal[c[0]] = {
    dm: calcDayMasterStrength(b),
    cong: getCongGe(b),
    pat: getPattern(b),
    yj: getYongJi(b)
  };
});

// 3) 删除⑧½版
eval(buildCode(code, { killShaYin: true }));
var noShaYin = {};
CHARTS.forEach(function(c) {
  var b = toBazi(c.slice(1));
  noShaYin[c[0]] = {
    dm: calcDayMasterStrength(b),
    yj: getYongJi(b)
  };
});

function delta(cur, prev) {
  var d = cur - prev;
  return d === 0 ? '' : '（' + (d > 0 ? '+' : '') + d + '）';
}

var csv = ['编号,八字,遁法,①得令,②得地,③得势,④藏干,⑤过耗,⑥调候,⑦五合,⑧合冲刑害,⑧½结构补偿,⑧¾宫位,终分,旺衰,格局,用神,喜神,忌神,特殊格局,⑧½前分,⑧½后分,因⑧½跨50,无⑧½终分,无⑧½旺衰,无⑧½用神,无⑧½喜神,无⑧½忌神,喜用忌是否改变'];

CHARTS.forEach(function(c) {
  var id = c[0], gzStr = c.slice(1).join(' ');
  var invalid = validatePillars(c.slice(1));
  var t = traces[id];
  var n = normal[id], k = noShaYin[id];
  var pre = t[13][1], post = t[14][1];
  var shaYinDelta = post - pre;
  var crossed = (shaYinDelta > 0 && pre < 50 && post >= 50);
  var listsSame = n.yj.yongShen.join() === k.yj.yongShen.join()
    && n.yj.xiShen.join() === k.yj.xiShen.join()
    && n.yj.jiShen.join() === k.yj.jiShen.join();

  // ⑧内部非零子项
  var sub8 = [
    ['相邻冲害刑合+三合半合', t[9][1] - t[8][1]],
    ['跨柱六合', t[10][1] - t[9][1]],
    ['三会半会', t[11][1] - t[10][1]],
    ['跨柱六冲', t[12][1] - t[11][1]],
    ['日支合化重构', t[13][1] - t[12][1]]
  ].filter(function(s) { return s[1] !== 0; })
   .map(function(s) { return s[0] + (s[1] > 0 ? '+' : '') + s[1]; }).join('、');

  var out = [];
  out.push('【' + id + '】' + gzStr + (invalid ? '  ' + invalid : ''));
  out.push('初始 50');
  out.push('① 得令：' + t[1][1] + delta(t[1][1], t[0][1]));
  out.push('② 得地：' + t[2][1] + delta(t[2][1], t[1][1]));
  out.push('③ 得势：' + t[3][1] + delta(t[3][1], t[2][1]));
  out.push('④ 藏干：' + t[4][1] + delta(t[4][1], t[3][1]));
  out.push('⑤ 过耗：' + t[6][1] + delta(t[6][1], t[4][1]) + (t[6][1] !== t[5][1] ? '（含土多金埋' + delta(t[6][1], t[5][1]) + '）' : ''));
  out.push('⑥ 调候：' + t[7][1] + delta(t[7][1], t[6][1]));
  out.push('⑦ 五合：' + t[8][1] + delta(t[8][1], t[7][1]));
  out.push('⑧ 合冲刑害：' + t[13][1] + delta(t[13][1], t[8][1]) + (sub8 ? '（' + sub8 + '）' : ''));
  out.push('⑧½ 结构补偿：' + t[14][1] + delta(t[14][1], t[13][1]));
  out.push('⑧¾ 宫位：' + t[15][1] + delta(t[15][1], t[14][1]));
  out.push('最终分：' + n.dm.score + (n.dm.score !== t[15][1] ? '（限幅）' : ''));
  out.push('旺衰：' + n.dm.level);
  out.push('格局：' + n.pat.name + '·' + n.pat.status + (n.pat.basePattern ? '（原局：' + n.pat.basePattern + '）' : ''));
  out.push('用神：' + n.yj.yongShen.join('、'));
  out.push('喜神：' + n.yj.xiShen.join('、'));
  out.push('忌神：' + n.yj.jiShen.join('、'));
  out.push('特殊格局：' + (n.cong.isCong ? '是（' + n.cong.name + '）' : '否'));
  out.push('');
  out.push('【额外】');
  out.push('⑧½之前分数：' + pre);
  out.push('⑧½之后分数：' + post);
  out.push('是否因⑧½跨过50线：' + (crossed ? '是' : '否'));
  out.push('如果删除⑧½补偿，最终旺衰：' + k.dm.score + '分 ' + k.dm.level);
  out.push('如果删除⑧½补偿，喜用忌是否改变：' + (listsSame ? '否（不变）' : '是（用神 ' + n.yj.yongShen.join('、') + '→' + k.yj.yongShen.join('、') + '，喜 ' + n.yj.xiShen.join('、') + '→' + k.yj.xiShen.join('、') + '，忌 ' + n.yj.jiShen.join('、') + '→' + k.yj.jiShen.join('、') + '）'));
  console.log(out.join('\n'));
  console.log('');

  csv.push([
    id, gzStr, invalid || '合格',
    t[1][1], t[2][1], t[3][1], t[4][1], t[6][1], t[7][1], t[8][1], t[13][1],
    shaYinDelta, t[15][1] - t[14][1], n.dm.score, n.dm.level,
    n.pat.name + '·' + n.pat.status, n.yj.yongShen.join('、'), n.yj.xiShen.join('、'), n.yj.jiShen.join('、'),
    n.cong.isCong ? n.cong.name : '否',
    pre, post, crossed ? '是' : '否',
    k.dm.score, k.dm.level, k.yj.yongShen.join('、'), k.yj.xiShen.join('、'), k.yj.jiShen.join('、'),
    listsSame ? '否' : '是'
  ].join(','));
});

fs.writeFileSync(__dirname + '/_round2_results.csv', '﻿' + csv.join('\n'), 'utf-8');
console.log('已写入 _round2_results.csv');
