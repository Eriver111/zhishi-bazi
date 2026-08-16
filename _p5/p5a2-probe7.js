// P5-A2 修复探针第七轮：E103/E104 换基避免与 B24/B23 重复
var fs = require('fs'), vm = require('vm');
var source = fs.readFileSync(__dirname + '/../js/bazi.js', 'utf8');
var context = { window: {} };
vm.runInNewContext(source, context);
var ENG = context.window.BaZiCalculator;
function bp(gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
var tests = [
  ['E103b印被合乙卯', '乙卯 戊辰 壬子 庚辰'],
  ['E103c印被合丁壬', '丁丑 庚申 甲子 壬辰'],
  ['E104b财被合戊癸', '癸亥 庚申 甲子 戊辰'],
  ['E104c财被合壬主', '丙寅 戊辰 壬子 癸丑']
];
tests.forEach(function (t) {
  var b = bp(t[1]);
  var ds = ENG.calcDayMasterStrength(b);
  var pt = ENG.getPattern(b);
  var cg = ENG.getCongGe(b);
  var rs = (pt.breakReasons || []).join('/') || '—';
  var conds = (pt.establishConditions || []).map(function (c) { return c.condition + '=' + (c.met ? 'V' : 'X'); }).join(',');
  console.log(t[0] + ' | ' + ds.level + '(' + ds.score + ') | ' + pt.name + '·' + pt.status + ' | ' + rs + ' | 从=' + (cg.isCong ? cg.name : '否') + ' | conds:' + conds);
});
