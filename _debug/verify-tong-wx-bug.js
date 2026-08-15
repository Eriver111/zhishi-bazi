// 对照验证：同五行兜底分支（bazi.js 4276-4285）的 source 文案 bug 影响面
// 预期：凡 matchedGan !== 月支本气 的透干取格盘，source 文案把透干写成藏干。
global.window = global;
eval(require('fs').readFileSync('js/bazi.js', 'utf8'));

function pillars(values) {
  var records = values.map(function (gz) { return { gan: gz[0], zhi: gz[1] }; });
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

var CASES = [
  // [标签, 四柱, 预期正确藏干]
  ['丁@寅透乙(用户盘)', ['乙酉', '戊寅', '丁丑', '癸卯'], '寅藏甲丙戊，本气甲'],
  ['丙@申透辛',        ['辛巳', '丙申', '丙子', '甲午'], '申藏庚壬戊，本气庚'],
  ['甲@未透戊',        ['戊辰', '己未', '甲子', '庚午'], '未藏己丁乙，本气己'],
  ['癸@亥透壬(精确匹配对照)', ['壬子', '辛亥', '癸酉', '戊午'], '亥藏壬甲，本气壬(精确匹配，文案应正常)']
];

CASES.forEach(function (c) {
  var b = BaZiCalculator.buildFromPillars(pillars(c[1]), 'male');
  var p = BaZiCalculator.getPattern(b);
  console.log(c[0]);
  console.log('  月支藏干:', JSON.stringify(BaZiCalculator.getCangGan(b.month.zhi)), ' 本气十神:', BaZiCalculator.getShiShen(b.day.gan, BaZiCalculator.getCangGan(b.month.zhi)[0]));
  console.log('  pattern:', p.name, '·', p.status, ' type:', p.type);
  console.log('  source :', p.source);
  console.log('');
});
