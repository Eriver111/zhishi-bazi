// P5-A2B 探针：确认『食神生财格』同样漏掉「日主能担财」condition（裁决只报了伤官生财格）
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
  ['食神生财格测试盘', '庚申 丙寅 壬子 丙午'],
  ['C75伤官生财格', '庚申 辛未 丙申 丙子']
];
tests.forEach(function (t) {
  var b = bp(t[1]);
  var pt = ENG.getPattern(b);
  var conds = (pt.establishConditions || []).map(function (c) { return c.condition + '=' + (c.met ? 'V' : 'X'); }).join(',') || '—空—';
  console.log(t[0] + ' | ' + pt.name + '·' + pt.status + ' | ' + (pt.breakReasons || []).join('/') + ' | conds: ' + conds);
});
