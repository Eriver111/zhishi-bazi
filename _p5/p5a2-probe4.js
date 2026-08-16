// P5-A2 修复探针第四轮
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
  ['A08b双食午根时柱', '丙午 丙申 甲子 丙午'],
  ['A08d壬主双食强根', '甲寅 甲辰 壬子 甲辰'],
  ['A09b乙主食伤混制', '戊午 丙戌 乙亥 丁丑'],
  ['A29b弱主加印', '丙午 丙申 甲子 壬子'],
  ['B19b癸主食加财', '乙卯 己未 癸亥 丙辰'],
  ['B19c癸主食加印', '乙卯 己未 癸亥 庚申'],
  ['E118b丁壬合午根', '壬午 辛亥 丁卯 戊申'],
  ['E118c丁壬合印时', '壬子 辛亥 丁卯 甲午']
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
