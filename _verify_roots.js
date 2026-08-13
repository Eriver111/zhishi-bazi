// 临时验证：对 A3/B5/#6/#9 计算五候选根气评分（喂给对账报告演算示例）
// 用法: node _verify_roots.js
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');
var stitch = '';
['getPattern','calcDayMasterStrength','getYongJi','getCongGe','evaluateYongShenQuality'].forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

var CHARTS = [
  ['A3','丙申','庚寅','戊辰','丁巳'],
  ['B5','庚子','甲申','乙卯','丙子'],
  ['#6','甲辰','丙寅','戊午','丁巳'],
  ['#9','甲子','丁卯','己未','庚午']
];

CHARTS.forEach(function(c) {
  var b = {
    year: { gan: c[1][0], zhi: c[1][1] },
    month:{ gan: c[2][0], zhi: c[2][1] },
    day:  { gan: c[3][0], zhi: c[3][1] },
    hour: { gan: c[4][0], zhi: c[4][1] }
  };
  var q = evaluateYongShenQuality(b, { yongShen: ['木','火','土','金','水'], xiShen: [] });
  console.log(c[0] + ' ' + c.slice(1).join(' ') + ' —— 五候选根气：');
  ['木','火','土','金','水'].forEach(function(wx) {
    console.log('  ' + wx + ': ' + q[wx].score + '分 ' + q[wx].quality + (q[wx].roots && q[wx].roots.length ? '（' + q[wx].roots.join('、') + '）' : ''));
  });
});
