// P5-A2 修复探针第三轮
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
  ['A03食神坐杀年申', '丙申 丙申 甲子 甲子'],
  ['A08双食强根', '丙午 丙申 甲子 丙辰'],
  ['A09食伤混制', '庚辰 丙申 甲子 丁丑'],
  ['A11时柱冲', '丙午 丙申 甲子 甲寅'],
  ['A12年柱冲', '丙寅 丙申 甲子 甲子'],
  ['A14伤官虚透', '辛巳 丙戌 乙亥 甲子'],
  ['A21三食壬主', '甲辰 甲辰 壬子 甲辰'],
  ['A28杀根党杀壬主', '甲辰 甲辰 壬子 戊子'],
  ['A29弱主', '庚辰 丙申 甲子 丙辰'],
  ['B18癸主印化+财', '丙午 己未 癸亥 辛酉'],
  ['B19癸主食制+财', '丙午 己未 癸亥 乙巳'],
  ['B22财印并透财重', '丙午 戊辰 壬子 庚辰'],
  ['B27年食时财', '甲辰 戊辰 壬子 丙辰'],
  ['B28同五行兜底杀+财', '癸亥 癸亥 丙午 庚寅'],
  ['B29财+伤官无制化', '乙巳 戊辰 壬子 丙辰'],
  ['B30财+杀+比劫', '丙寅 戊辰 壬子 壬子'],
  ['C16伤官无制化', '癸丑 庚子 庚申 壬子'],
  ['E102b杀被合强度版', '癸丑 戊辰 壬子 丙申'],
  ['E118官格丁壬合', '壬子 辛亥 丁卯 戊申']
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
