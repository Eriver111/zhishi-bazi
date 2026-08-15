// P5-A2 修复探针：验证改盘后的强度与成破
var fs = require('fs'), vm = require('vm');
var source = fs.readFileSync('js/bazi.js', 'utf8');
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
  ['A食有根辰年', '丙辰 丙申 甲子 甲子'],
  ['A食被合', '辛巳 丙申 甲子 甲子'],
  ['A食被枭', '壬子 丙申 甲子 甲子'],
  ['A杀透党杀', '庚辰 丙申 甲子 甲子'],
  ['A双透', '丙子 丙申 甲子 甲子'],
  ['A枭+财', '壬子 丙申 甲子 戊子'],
  ['A食伤混制', '庚辰 丙申 甲子 丁卯'],
  ['A三食', '丙午 丙申 甲子 丙子'],
  ['A杀重制轻', '庚辰 丙申 甲子 庚子'],
  ['A食被合+枭', '辛巳 丙申 甲子 壬子'],
  ['A杀被合', '庚辰 丙申 甲子 乙丑'],
  ['A双枭', '壬子 丙申 甲子 壬子'],
  ['A坐墓', '庚辰 丙申 甲子 丙戌'],
  ['A杀根党杀', '庚辰 丙申 甲子 庚辰'],
  ['A弱主', '庚辰 丙申 甲子 丙子'],
  ['B05食制+财', '戊辰 庚申 甲子 丙子'],
  ['B05b双甲子', '戊辰 庚申 甲子 甲子'],
  ['B07财虚透', '戊子 庚申 甲子 丙子'],
  ['B08印化+财', '戊辰 庚申 甲子 壬子'],
  ['B10财印并透', '壬子 庚申 甲子 戊辰'],
  ['B45官透+印', '辛巳 庚申 甲子 壬辰'],
  ['B47壬主杀+财+印', '丙寅 戊辰 壬子 庚辰'],
  ['B48壬主食制+财', '丙寅 戊辰 壬子 甲辰'],
  ['B52杀轻财重', '丙寅 戊辰 壬子 丙辰'],
  ['E101食被合', '辛巳 庚申 甲子 丙子'],
  ['E102杀被合', '庚辰 庚申 甲子 乙丑'],
  ['E103印被合', '丁巳 庚申 甲子 壬子'],
  ['E104财被合', '戊辰 庚申 甲子 癸酉'],
  ['E106六合巳申', '己巳 庚申 甲子 丙子'],
  ['E107三合申子辰', '戊辰 庚申 甲子 丙子'],
  ['E108日主被财合', '庚辰 庚申 甲子 己丑']
];
tests.forEach(function (t) {
  var b = bp(t[1]);
  var ds = ENG.calcDayMasterStrength(b);
  var pt = ENG.getPattern(b);
  var cg = ENG.getCongGe(b);
  var rs = (pt.breakReasons || []).join('/') || '—';
  console.log(t[0] + ' | ' + ds.level + '(' + ds.score + ') | ' + pt.name + '·' + pt.status + ' | ' + rs + ' | 从=' + (cg.isCong ? cg.name : '否'));
});
