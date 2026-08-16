// P5-A2 修复探针第六轮：A09 食伤混制戊主寅月版
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
  ['A09i戊主食伤混制', '辛丑 庚寅 戊子 庚辰'],
  ['A09j戊主食伤混制戌日', '辛丑 庚寅 戊戌 庚辰'],
  ['A09k戊主食伤混制午日', '辛丑 庚寅 戊午 庚辰']
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
