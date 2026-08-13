// 22盘 P1 before/after diff（GPT 对账交付物）
// before = docs/backups/2026-08-13-pre-yongshen-refactor-bazi.js（P0 冻结快照，即生成 _baseline_22.csv 的引擎）
// after  = js/bazi.js（P1 候选评分引擎，当前工作区）
// 输出：_diff_p1.csv（22盘×5五行=110 行明细）+ _diff_p1_summary.csv（22 行盘级对比）+ 控制台摘要
// 用法: node _diff_p1.js
global.window = global;
global.document = {};

var fs = require('fs');
var path = require('path');
var ROOT = __dirname;

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

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}

// 载入引擎：把指定函数缝到 global（仿 _freeze_22.js 模式，引擎文件零改动）
function loadEngine(file, names) {
  var code = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  var stitch = '';
  names.forEach(function(name) {
    stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
  eval(code);
}

// ① before 引擎（P0 快照）
loadEngine('docs/backups/2026-08-13-pre-yongshen-refactor-bazi.js',
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern']);
var before = {};
CHARTS.forEach(function(c) {
  var b = toBazi(c.slice(1, 5));
  before[c[0]] = {
    dm: calcDayMasterStrength(b),
    yj: getYongJi(b),
    pat: getPattern(b)
  };
});

// ② after 引擎（P1 当前工作区）
loadEngine('js/bazi.js',
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores']);
var after = {};
CHARTS.forEach(function(c) {
  var b = toBazi(c.slice(1, 5));
  after[c[0]] = {
    dm: calcDayMasterStrength(b),
    yj: getYongJi(b),
    pat: getPattern(b)
  };
});

// —— sanity ①：before 引擎必须复现冻结基线 CSV ——
var baseCsv = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').replace(/^﻿/, '');
var baseRows = {};
baseCsv.trim().split('\n').slice(1).forEach(function(line) {
  var cols = line.split(',').map(function(s) { return s.replace(/^"|"$/g, '').replace(/""/g, '"'); });
  baseRows[cols[0]] = cols;
});
var sanityFail = [];
CHARTS.forEach(function(c) {
  var id = c[0], row = baseRows[id], b = before[id];
  if (!row) { sanityFail.push(id + ' 基线缺失'); return; }
  if (b.yj.yongShen.join('、') !== row[7]) sanityFail.push(id + ' before用神 ' + b.yj.yongShen.join('、') + ' ≠ 基线 ' + row[7]);
  if (b.yj.xiShen.join('、') !== row[8]) sanityFail.push(id + ' before喜神 ≠ 基线');
  if (b.yj.jiShen.join('、') !== row[9]) sanityFail.push(id + ' before忌神 ≠ 基线');
  if (String(b.dm.score) !== row[3]) sanityFail.push(id + ' before终分 ' + b.dm.score + ' ≠ 基线 ' + row[3]);
});
if (sanityFail.length) {
  console.log('✗ 基线复现失败 ' + sanityFail.length + ' 条（before 引擎与冻结基线不一致，diff 无效）：');
  sanityFail.forEach(function(s) { console.log('  ' + s); });
  process.exit(1);
}
console.log('✅ before 引擎与 _baseline_22.csv 逐盘复现一致（用神/喜/忌/终分 22/22）\n');

// —— sanity ②：P1 不得改变旺衰终分 ——
CHARTS.forEach(function(c) {
  if (before[c[0]].dm.score !== after[c[0]].dm.score) {
    sanityFail.push(c[0] + ' 终分漂移 ' + before[c[0]].dm.score + '→' + after[c[0]].dm.score);
  }
});
if (sanityFail.length) {
  console.log('✗ P1 改动波及 calcDayMasterStrength：');
  sanityFail.forEach(function(s) { console.log('  ' + s); });
  process.exit(1);
}

// —— 输出 ——
function csvQ(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}
function r2(n) { return Math.round(n * 100) / 100; }
var WX = ['木','火','土','金','水'];
var changed = [], unchanged = [];
var catCount = { '用神翻转': [], '喜忌成员': [], '仅排序': [] };

// CSV 明细：22×5 行
var detailCsv = ['编号,八字,终分,旺衰,格局,五行,与日主关系,成势,L1,L2,L3,L4,S_need,根气分,根气质量,角色,变化类型,before用神,before喜,before忌,before_method,after用神,after喜,after忌,after_method,tiebreak'];
// CSV 盘级摘要：22 行
var sumCsv = ['编号,八字,变化,before用神,after用神,before喜,after喜,before忌,after忌,before_method,after_method,tiebreak决胜链'];

CHARTS.forEach(function(c) {
  var id = c[0], gzStr = c.slice(1, 5).join(' ');
  var b = before[id], a = after[id];
  var bYj = b.yj, aYj = a.yj;
  var yongChanged = bYj.yongShen[0] !== aYj.yongShen[0];
  var bXi = bYj.xiShen.slice().sort().join(), aXi = aYj.xiShen.slice().sort().join();
  var bJi = bYj.jiShen.slice().sort().join(), aJi = aYj.jiShen.slice().sort().join();
  var memberChanged = bXi !== aXi || bJi !== aJi;
  var orderChanged = bYj.xiShen.join('、') !== aYj.xiShen.join('、') ||
    bYj.jiShen.join('、') !== aYj.jiShen.join('、');
  var isChanged = yongChanged || memberChanged;
  var cat = yongChanged ? '用神翻转' : (memberChanged ? '喜忌成员' : (orderChanged ? '仅排序' : '不变'));
  if (cat === '不变') unchanged.push(id);
  else if (isChanged) changed.push(id);
  if (cat !== '不变') catCount[cat].push(id);

  var ctx = null;
  var cs = aYj.candidateScores;
  var tb = aYj.tiebreak;
  if (cs) ctx = calcCandidateScores(toBazi(c.slice(1, 5)), a.dm, a.pat);
  var tbStr = '';
  if (tb && tb.used) {
    tbStr = tb.steps.map(function(s) { return s.step + '(' + s.values + '→' + s.advance.join('') + ')'; }).join(' → ');
  } else if (tb) {
    tbStr = '无需决胜（唯一最高分）';
  }

  var line = '【' + id + '】' + gzStr + '  ' + a.dm.score + '分' + a.dm.level +
    '  ' + a.pat.name + '·' + a.pat.status;
  console.log(line);
  console.log('  before: 用神:' + bYj.yongShen.join('、') +
    '  喜:' + bYj.xiShen.join('、') +
    '  忌:' + bYj.jiShen.join('、') +
    '  [' + bYj.method + ']');
  console.log('  after : 用神:' + aYj.yongShen.join('、') +
    '  喜:' + aYj.xiShen.join('、') +
    '  忌:' + aYj.jiShen.join('、') +
    '  [' + aYj.method + ']' + (isChanged ? '   ← ' + cat : ''));

  if (cs) {
    // 变化盘：打印五元素明细 + 加分细节
    if (isChanged) {
      console.log('    d=' + ctx.d.toFixed(2) + ' g1=' + ctx.g1.toFixed(2) +
        ' 成势:' + (WX.filter(function(wx) { return ctx.counts[wx] >= 3; }).map(function(wx) { return wx + ctx.counts[wx]; }).join(' ') || '无'));
      cs.forEach(function(e) {
        console.log('    ' + e.wx + '(' + e.relation + ') L1=' + r2(e.L1) + ' L2=' + r2(e.L2) + ' L3=' + r2(e.L3) +
          ' L4=' + r2(e.L4) + ' S_need=' + r2(e.SNeed) + ' 根气' + r2(e.rootScore) + '/' + e.rootQuality + ' → ' + e.role);
      });
      ctx.l2Details.forEach(function(dt) { console.log('      L2: ' + dt.wx + '+' + r2(dt.val) + ' ' + dt.note); });
      ctx.l3Details.forEach(function(dt) { console.log('      L3: ' + dt.wx + '+' + r2(dt.val) + ' ' + dt.note); });
      ctx.l4Details.forEach(function(dt) { console.log('      L4: ' + dt.wx + '+' + r2(dt.val) + ' ' + dt.note); });
      if (tb && tb.used) console.log('      tiebreak: ' + tbStr + ' → 用神=' + tb.winner);
    }
    cs.forEach(function(e) {
      detailCsv.push([id, gzStr, a.dm.score, a.dm.level, a.pat.name + '·' + a.pat.status,
        e.wx, e.relation,
        ctx && ctx.counts[e.wx] >= 3 ? '是(' + ctx.counts[e.wx] + ')' : '否',
        r2(e.L1), r2(e.L2), r2(e.L3), r2(e.L4), r2(e.SNeed), r2(e.rootScore), e.rootQuality, e.role,
        cat,
        bYj.yongShen.join('、'), bYj.xiShen.join('、'), bYj.jiShen.join('、'), bYj.method,
        aYj.yongShen.join('、'), aYj.xiShen.join('、'), aYj.jiShen.join('、'), aYj.method, tbStr
      ].map(csvQ).join(','));
    });
  } else {
    console.log('    （从格/穷通特例短路——无候选评分，喜用忌维持短路规则）');
  }

  sumCsv.push([id, gzStr, cat,
    bYj.yongShen.join('、'), aYj.yongShen.join('、'),
    bYj.xiShen.join('、'), aYj.xiShen.join('、'),
    bYj.jiShen.join('、'), aYj.jiShen.join('、'),
    bYj.method, aYj.method, tbStr].map(csvQ).join(','));
});

fs.writeFileSync(path.join(ROOT, '_diff_p1.csv'), '﻿' + detailCsv.join('\n'), 'utf-8');
fs.writeFileSync(path.join(ROOT, '_diff_p1_summary.csv'), '﻿' + sumCsv.join('\n'), 'utf-8');

console.log('\n========== 汇总 ==========');
function catLine(label, key) {
  var list = catCount[key];
  console.log(label + list.length + ' 盘：' + (list.length ? list.join('、') : '无'));
}
catLine('用神翻转 ', '用神翻转');
catLine('喜忌成员变化 ', '喜忌成员');
catLine('仅忌神排序变化 ', '仅排序');
console.log('完全不变盘 ' + unchanged.length + ' 个：' + (unchanged.length ? unchanged.join('、') : '无'));
console.log('已写入 _diff_p1.csv（五元素明细）+ _diff_p1_summary.csv（盘级对比）');
