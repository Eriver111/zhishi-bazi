// P5-A2A 探针：A 组 30 盘逐盘定级核对（预期见各盘注释）
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
// [编号, 四柱, 预期]：预期 = 成(成格) / 破(破格) / 成P(成格+partial提示) / 破+reason(新增理由)
var tests = [
  ['#1', '丙午 丙申 甲子 甲子', '成'],
  ['#2', '丙辰 丙申 甲子 甲子', '破:食神虚透'],
  ['#3', '丙申 丙申 甲子 甲子', '破:食神虚透'],
  ['#4', '辛巳 丙申 甲子 甲子', '成P:被合'],
  ['#5', '壬子 丙申 甲子 甲子', '破:枭夺'],
  ['#6', '壬子 丙申 甲子 戊子', '破:枭夺'],
  ['#7', '庚辰 丙申 甲子 甲子', '破:食神虚透'],
  ['#8', '甲寅 甲辰 壬子 甲辰', '成'],
  ['#9', '辛丑 庚寅 戊戌 庚辰', '成'],
  ['#10', '丙午 丙申 甲寅 甲子', '破:冲'],
  ['#11', '丙午 丙申 甲子 甲寅', '破:冲'],

  ['#12', '丙寅 丙申 甲子 甲子', '破:冲'],
  ['#13', '丙子 丙申 甲子 庚午', '破:承载'],
  ['#14', '辛巳 丙戌 乙亥 甲子', '成P:被合'],
  ['#15', '辛巳 丙戌 乙亥 壬午', '成P:印制伤'],
  ['#16', '辛巳 丙戌 乙亥 癸未', '成P:印制伤'],
  ['#17', '己酉 戊子 丁卯 丙午', '破:冲'],
  ['#18', '丙寅 癸巳 庚申 己丑', '成P:印制伤'],
  ['#19', '丁巳 癸未 辛亥 戊子', '成P:被合'],
  ['#20', '丙午 丙申 甲子 甲辰', '成P:根冲'],
  ['#21', '甲辰 甲辰 壬子 甲辰', '成'],
  ['#22', '庚辰 丙申 甲子 庚子', '破:承载+虚透'],
  ['#23', '庚辰 丙申 甲子 壬子', '破:枭夺'],
  ['#24', '辛巳 丙申 甲子 壬子', '破:枭夺'],
  ['#25', '庚辰 丙申 甲子 乙丑', '破:食神虚透'],
  ['#26', '乙亥 辛未 己巳 丙寅', '成P:被合'],
  ['#27', '壬子 丙申 甲子 壬子', '破:枭夺'],
  ['#28', '壬子 丙申 甲子 丙戌', '破:枭夺'],
  ['#29', '甲辰 甲辰 壬子 戊子', '成'],
  ['#30', '丙午 丙申 甲子 壬子', '破:枭夺']
];
var fail = 0;
tests.forEach(function (t) {
  var b = bp(t[1]);
  var pt = ENG.getPattern(b);
  var cond = '';
  (pt.establishConditions || []).forEach(function (c) {
    if (c.condition === '制神有效制杀') cond = (c.met ? 'V' : 'X') + ':' + c.detail;
  });
  var rs = (pt.breakReasons || []).join('/') || '—';
  var got = pt.status + (cond ? ' | 制杀' + cond : '') + ' | ' + rs;
  var exp = t[2];
  var ok = (exp.indexOf('破') === 0) === (pt.status === '破格');
  if (!ok) fail++;
  console.log((ok ? 'OK  ' : 'DIFF') + ' ' + t[0] + ' 预期[' + exp + '] 实际[' + got + ']');
});
console.log(fail ? ('\n❌ 不一致 ' + fail + ' 盘') : '\n✅ 30 盘预期全对');
process.exit(fail ? 1 : 0);
