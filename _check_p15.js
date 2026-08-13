// P1.5 盲测跑盘器（GPT 20 盘样本外测试）
// 输入：_p15_charts.txt，每行「标签 年柱 月柱 日柱 时柱」（# 开头为注释，空行跳过）
// 输出：控制台逐盘明细 + _p15_results.csv（标签×五行明细）
// 只跑：旺衰 + 格局 + 从格 + 喜用忌 + 五行 candidateScores + tiebreak（不预判任何分类）
// 用法: node _check_p15.js
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

// —— 读盘 ——
var chartFile = path.join(ROOT, '_p15_charts.txt');
if (!fs.existsSync(chartFile)) {
  console.log('缺少 _p15_charts.txt——请按格式填写：标签 年柱 月柱 日柱 时柱（如：P01 甲辰 丙寅 戊午 丁巳）');
  process.exit(0);
}
var charts = [];
fs.readFileSync(chartFile, 'utf-8').split('\n').forEach(function(line) {
  line = line.trim();
  if (!line || line[0] === '#') return;
  var parts = line.split(/\s+/);
  if (parts.length !== 5) {
    console.log('⚠ 行格式错误（应为 5 段）：' + line);
    return;
  }
  charts.push(parts);
});
if (charts.length === 0) {
  console.log('_p15_charts.txt 无有效盘（每行 5 段：标签 年 月 日 时）');
  process.exit(0);
}

// —— 载入 P1 引擎 ——
var code = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');
var stitch = '';
['getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'].forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
function r2(n) { return Math.round(n * 100) / 100; }

// —— 逐盘输出 ——
var csv = ['标签,八字,排盘校验,终分,旺衰,格局,从格,五行,与日主关系,成势,L1,L2,L3,L4,S_need,根气分,根气质量,角色,用神,喜神,忌神,method,tiebreak,破格原因,成格条件清单'];
var badCharts = [];

charts.forEach(function(parts) {
  var label = parts[0], gz = parts.slice(1);
  var invalid = validatePillars(gz);
  if (invalid) badCharts.push(label + ' ' + invalid);
  var b = toBazi(gz);
  var dm = calcDayMasterStrength(b);
  var cong = getCongGe(b);
  var pat = getPattern(b);
  // 结构检测现状采集（供 GPT 五状态对照：评分体现/establishConditions检测/breakReasons检测/漏检/检测未消费）
  var brStr = (pat.breakReasons || []).join('；');
  var condStr = (pat.establishConditions || []).map(function(c) {
    return (c.met ? '✅' : '❌') + c.condition + '（' + c.detail + '）';
  }).join('；');
  var yj = getYongJi(b);
  var cs = yj.candidateScores;
  var tb = yj.tiebreak;
  var tbStr = '';
  if (tb && tb.used) {
    tbStr = tb.steps.map(function(s) { return s.step + '(' + s.values + '→' + s.advance.join('') + ')'; }).join(' → ');
  } else if (tb) {
    tbStr = '无需决胜（唯一最高分）';
  }

  console.log('【' + label + '】' + gz.join(' ') +
    ' · ' + dm.score + '分' + dm.level +
    ' · ' + pat.name + '·' + pat.status +
    (cong.isCong ? ' · 从格:' + cong.name : '') +
    (invalid ? ' · ' + invalid : ''));
  console.log('  用神:' + yj.yongShen.join('、') +
    '  喜:' + yj.xiShen.join('、') +
    '  忌:' + (yj.jiShen.length ? yj.jiShen.join('、') : '无') +
    '  [' + yj.method + ']');
  console.log('  结构: 破格原因=' + (brStr || '无') + '  成格条件=' + (condStr || '无'));

  if (cs) {
    var ctx = calcCandidateScores(b, dm, pat);
    cs.forEach(function(e) {
      console.log('  ' + e.wx + '/' + e.relation +
        '  L1=' + r2(e.L1) + ' L2=' + r2(e.L2) + ' L3=' + r2(e.L3) + ' L4=' + r2(e.L4) +
        ' S=' + r2(e.SNeed) + '  根气' + r2(e.rootScore) + '/' + e.rootQuality + ' → ' + e.role);
      csv.push([label, gz.join(' '), invalid || '合格',
        dm.score, dm.level, pat.name + '·' + pat.status, cong.isCong ? cong.name : '否',
        e.wx, e.relation,
        ctx.counts[e.wx] >= 3 ? '是(' + ctx.counts[e.wx] + ')' : '否',
        r2(e.L1), r2(e.L2), r2(e.L3), r2(e.L4), r2(e.SNeed), r2(e.rootScore), e.rootQuality, e.role,
        yj.yongShen.join('、'), yj.xiShen.join('、'), yj.jiShen.join('、'), yj.method, tbStr,
        brStr, condStr
      ].map(csvQ).join(','));
    });
    if (tb && tb.used) console.log('  tiebreak: ' + tbStr + ' → 用神=' + tb.winner);
  } else {
    console.log('  （从格/穷通特例短路——无候选评分）');
    csv.push([label, gz.join(' '), invalid || '合格',
      dm.score, dm.level, pat.name + '·' + pat.status, cong.isCong ? cong.name : '否',
      '', '', '', '', '', '', '', '', '', '', '', '',
      yj.yongShen.join('、'), yj.xiShen.join('、'), yj.jiShen.join('、'), yj.method, tbStr,
      brStr, condStr
    ].map(csvQ).join(','));
  }
  console.log('');
});

fs.writeFileSync(path.join(ROOT, '_p15_results.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('========== ' + charts.length + ' 盘完成 ==========');
if (badCharts.length) {
  console.log('排盘校验异常 ' + badCharts.length + ' 盘（不合遁法，需向 GPT 报告）：');
  badCharts.forEach(function(s) { console.log('  ' + s); });
} else {
  console.log('排盘校验：全部合格');
}
console.log('已写入 _p15_results.csv（' + (csv.length - 1) + ' 行明细）');
