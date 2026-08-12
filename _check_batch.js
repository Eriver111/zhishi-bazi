// 批量体检：读取 _batch_charts.txt，每行一个盘（四柱空格分隔，支持 # 注释和备注）
// 输出固定字段块（供 AI 交叉比对）+ 五虎遁/五鼠遁排盘校验 + 写入 _batch_results.csv
// 输入示例：
//   # 案例1
//   甲寅 丙寅 甲寅 甲子 男 # 明显身旺
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');
var stitch = '';
['getPattern','calcDayMasterStrength','getYongJi','getCongGe'].forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

var GAN_SEQ = '甲乙丙丁戊己庚辛壬癸';
var ZHI_IDX = { '子':0,'丑':1,'寅':2,'卯':3,'辰':4,'巳':5,'午':6,'未':7,'申':8,'酉':9,'戌':10,'亥':11 };
var WUHUDUN  = { '甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚','丁':'壬','壬':'壬','戊':'甲','癸':'甲' };
var WUSHUDUN = { '甲':'甲','己':'甲','乙':'丙','庚':'丙','丙':'戊','辛':'戊','丁':'庚','壬':'庚','戊':'壬','癸':'壬' };

// 五虎遁：由年干定月干；五鼠遁：由日干定时干
function validatePillars(gz) {
  var yg = gz[0][0], mz = gz[1][1], mg = gz[1][0];
  var dg = gz[2][0], hz = gz[3][1], hg = gz[3][0];
  var okMonth = GAN_SEQ[(GAN_SEQ.indexOf(WUHUDUN[yg]) + (ZHI_IDX[mz] - 2 + 12) % 12) % 10] === mg;
  var okHour = GAN_SEQ[(GAN_SEQ.indexOf(WUSHUDUN[dg]) + ZHI_IDX[hz]) % 10] === hg;
  var bad = [];
  if (!okMonth) bad.push('月柱');
  if (!okHour) bad.push('时柱');
  return bad.length ? ('排盘校验失败：' + bad.join('、') + '不合五虎遁/五鼠遁，此盘不存在') : '';
}

var lines = fs.readFileSync(__dirname + '/_batch_charts.txt', 'utf-8').split(/\r?\n/);
var charts = [];
lines.forEach(function(line, idx) {
  line = line.replace(/#.*$/, '').trim();
  if (!line) return;
  var parts = line.split(/\s+/);
  if (parts.length < 4) return;
  var gz = parts.slice(0, 4);
  var ok = gz.every(function(p) { return p.length === 2 && GAN_SEQ.indexOf(p[0]) >= 0 && p[1] in ZHI_IDX; });
  if (!ok) { console.log('!! 第' + (idx + 1) + '行格式不对，跳过: ' + line); return; }
  charts.push({ gz: gz, label: parts.slice(4).join(' ') });
});

console.log('共 ' + charts.length + ' 盘');
console.log('');

var csv = ['序号,八字,排盘校验,旺衰分,等级,格局,状态,从格,喜神,用神,忌神,方法,调候备注'];
charts.forEach(function(c, i) {
  var bazi = {
    year: { gan: c.gz[0][0], zhi: c.gz[0][1] },
    month:{ gan: c.gz[1][0], zhi: c.gz[1][1] },
    day:  { gan: c.gz[2][0], zhi: c.gz[2][1] },
    hour: { gan: c.gz[3][0], zhi: c.gz[3][1] }
  };
  var dm = calcDayMasterStrength(bazi);
  var cong = getCongGe(bazi);
  var pat = getPattern(bazi);
  var yj = getYongJi(bazi);
  var gzStr = c.gz.join(' ');
  var invalid = validatePillars(c.gz);
  var tiaoHou = '';
  (yj.evidence || []).forEach(function(e) { if (e.category === '调候') tiaoHou = e.detail; });

  var out = [];
  out.push('【' + (i + 1) + '】' + gzStr + (c.label ? '  (' + c.label + ')' : ''));
  if (invalid) out.push('⚠ ' + invalid);
  out.push('八字：' + gzStr);
  out.push('身强身弱：' + dm.score + '分 ' + dm.level);
  out.push('格局：' + pat.name + '·' + pat.status + (pat.basePattern ? '（原局：' + pat.basePattern + '）' : ''));
  out.push('喜神：' + (yj.xiShen.length ? yj.xiShen.join('、') : '无'));
  out.push('用神：' + (yj.yongShen.length ? yj.yongShen.join('、') : '无'));
  out.push('忌神：' + (yj.jiShen.length ? yj.jiShen.join('、') : '无'));
  out.push('特殊格局：' + (cong.isCong ? '是（' + cong.name + '）' : '否'));
  out.push('调候备注：' + (tiaoHou || '无'));
  console.log(out.join('\n'));
  console.log('');

  csv.push([
    i + 1, gzStr, invalid || '合格', dm.score, dm.level,
    pat.name, pat.status, cong.isCong ? cong.name : '',
    yj.xiShen.join('、'), yj.yongShen.join('、'), yj.jiShen.join('、'),
    yj.method, tiaoHou || ''
  ].join(','));
});

fs.writeFileSync(__dirname + '/_batch_results.csv', '﻿' + csv.join('\n'), 'utf-8');
console.log('已写入 _batch_results.csv（带BOM，Excel 可直接打开）');
