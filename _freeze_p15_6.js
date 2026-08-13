// P1.5 六盘永久回归样本冻结（GPT 判定 P1.5 PASS 后升级的六盘）
// 冻结当前 P1 引擎输出作为 P2 反事实回归锚点：任何 P2 改动导致此处偏离，须逐盘解释
// 用法: node _freeze_p15_6.js（断言全过才写 CSV）
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var code = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');
var stitch = '';
['getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'].forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

// 六盘（P1 引擎当前输出——P1.5 盲测实跑值）
var SIX = [
  { id: 'P15-03', gz: ['乙丑','戊寅','己巳','庚午'], score: 51, level: '中和', pattern: '正官格·破格', yong: ['火'], xi: ['火','水'], ji: [] },
  { id: 'P15-09', gz: ['丁丑','癸卯','庚申','丙戌'], score: 47, level: '中和', pattern: '正财格·破格', yong: ['土'], xi: ['土'], ji: [] },
  { id: 'P15-12', gz: ['戊子','甲寅','庚申','丁亥'], score: 27, level: '极弱', pattern: '偏财格·破格', yong: ['土'], xi: ['土','金'], ji: ['木','火','水'] },
  { id: 'P15-14', gz: ['丙寅','庚寅','戊辰','癸亥'], score: 22, level: '极弱', pattern: '食神制杀格·破格', yong: ['土'], xi: ['土','火'], ji: ['木','水','金'] },
  { id: 'P15-15', gz: ['癸未','戊午','乙卯','丙戌'], score: 19, level: '极弱', pattern: '食神生财格·破格', yong: ['木'], xi: ['木','水'], ji: ['金','火','土'] },
  { id: 'P15-16', gz: ['丁卯','壬寅','壬午','庚子'], score: 26, level: '极弱', pattern: '食神格·破格', yong: ['水'], xi: ['水','金'], ji: ['木','土','火'] }
];

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

var csv = ['编号,八字,终分,旺衰,格局,从格,用神,喜神,忌神,method,备注'];
var failures = [];
SIX.forEach(function(c) {
  var b = toBazi(c.gz);
  var dm = calcDayMasterStrength(b);
  var cong = getCongGe(b);
  var pat = getPattern(b);
  var yj = getYongJi(b);
  var errs = [];
  if (dm.score !== c.score) errs.push('终分 ' + dm.score + '≠' + c.score);
  if (dm.level !== c.level) errs.push('旺衰 ' + dm.level + '≠' + c.level);
  if (pat.name + '·' + pat.status !== c.pattern) errs.push('格局 ' + pat.name + '·' + pat.status + '≠' + c.pattern);
  if (yj.yongShen.join('、') !== c.yong.join('、')) errs.push('用神 ' + yj.yongShen.join('、') + '≠' + c.yong.join('、'));
  if (yj.xiShen.join('、') !== c.xi.join('、')) errs.push('喜神 ' + yj.xiShen.join('、') + '≠' + c.xi.join('、'));
  if (yj.jiShen.join('、') !== c.ji.join('、')) errs.push('忌神 ' + yj.jiShen.join('、') + '≠' + c.ji.join('、'));
  csv.push([c.id, c.gz.join(' '), dm.score, dm.level, pat.name + '·' + pat.status, cong.isCong ? cong.name : '否',
    yj.yongShen.join('、'), yj.xiShen.join('、'), yj.jiShen.join('、'), yj.method,
    errs.length ? '⚠ ' + errs.join('；') : '冻结锚点一致'
  ].map(csvQ).join(','));
  if (errs.length) failures.push(c.id + ': ' + errs.join('；'));
});

if (failures.length) {
  console.log('❌ 冻结失败 ' + failures.length + ' 盘偏离锚点（引擎已被改动？）：');
  failures.forEach(function(f) { console.log('  ' + f); });
  process.exit(1);
}
fs.writeFileSync(path.join(ROOT, '_baseline_p15_6.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('✅ 六盘冻结锚点全部一致，已写入 _baseline_p15_6.csv');
