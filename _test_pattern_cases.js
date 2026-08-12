// 格局回归：Case 2 辛巳辛丑甲申壬申（应断正官格，用神水，喜水木火，忌金土）+ 4 个历史格局用例
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var source = fs.readFileSync(path.join(__dirname, 'js', 'bazi.js'), 'utf8');
var context = { window: {} };
vm.runInNewContext(source, context);
var calculator = context.window.BaZiCalculator;

function pillars(values) {
  var records = values.map(function(gz) { return { gan: gz[0], zhi: gz[1] }; });
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

var cases = [
  { label: 'Case 2 辛巳辛丑甲申壬申', gz: ['辛巳','辛丑','甲申','壬申'], expectPattern: '正官' },
  { label: '回归: 乙酉己卯辛卯戊子', gz: ['乙酉','己卯','辛卯','戊子'], expectPattern: '财' },
  { label: '回归: 己卯辛丑甲辰壬子', gz: ['己卯','辛丑','甲辰','壬子'], expectPattern: '财生官' },
  { label: '回归: 戊午壬寅甲子庚午', gz: ['戊午','壬寅','甲子','庚午'], expectPattern: '建禄' },
  { label: '回归: 癸未壬辰丙申戊子', gz: ['癸未','壬辰','丙申','戊子'], expectPattern: null }
];

var failures = [];
function check(name, cond, detail) {
  var ok = cond ? '✓' : '✗';
  console.log(' ' + ok + ' ' + name + (detail ? '（' + detail + '）' : ''));
  if (!cond) failures.push(name);
}

cases.forEach(function(c) {
  var bazi = calculator.buildFromPillars(pillars(c.gz), 'male');
  var pat = calculator.getPattern(bazi);
  var yj = calculator.getYongJi(bazi);
  var dm = calculator.calcDayMasterStrength(bazi);
  console.log('');
  console.log('┌─ ' + c.label + ' ────────────────────────────');
  console.log('│ 旺衰: ' + dm.score + '分 ' + dm.level);
  console.log('│ 格局: ' + pat.name + '（' + (pat.status || '') + '）');
  console.log('│ 用神: ' + yj.yongShen.join('、'));
  console.log('│ 喜神: ' + yj.xiShen.join('、'));
  console.log('│ 忌神: ' + yj.jiShen.join('、'));
  console.log('│ 判定: ' + yj.method);
  console.log('└────────────────────────────────────────────');
  if (c.expectPattern) {
    check(c.label + ' 格局含「' + c.expectPattern + '」', (pat.name || '').indexOf(c.expectPattern) >= 0, pat.name);
  }
});

// ── Case 2 专项断言（命主反馈：正官格/用神水木/调候火只入喜/忌土金）──
var b2 = calculator.buildFromPillars(pillars(['辛巳','辛丑','甲申','壬申']), 'male');
var p2 = calculator.getPattern(b2);
var y2 = calculator.getYongJi(b2);
console.log('');
console.log('┌─ Case 2 专项断言 ─────────────────────────');
check('格局为正官格', (p2.name || '').indexOf('正官') >= 0, p2.name);
check('用神含水（杀印为用）', y2.yongShen.indexOf('水') >= 0, y2.yongShen.join('、'));
check('用神不含火（调候不顶替用神）', y2.yongShen.indexOf('火') < 0, y2.yongShen.join('、'));
check('忌神含金（官杀为忌）', y2.jiShen.indexOf('金') >= 0, y2.jiShen.join('、'));
check('忌神含土（财为忌）', y2.jiShen.indexOf('土') >= 0, y2.jiShen.join('、'));
check('喜神含水木', y2.xiShen.indexOf('水') >= 0 && y2.xiShen.indexOf('木') >= 0, y2.xiShen.join('、'));
check('喜神含火（调候入喜）', y2.xiShen.indexOf('火') >= 0, y2.xiShen.join('、'));
check('火在喜神末位（调候不喧宾夺主）', y2.xiShen.indexOf('火') === y2.xiShen.length - 1, y2.xiShen.join('、'));
check('火不在忌神', y2.jiShen.indexOf('火') < 0, y2.jiShen.join('、'));
console.log('└────────────────────────────────────────────');
console.log('');
if (failures.length > 0) {
  console.log('❌ 失败: ' + failures.join('; '));
  process.exit(1);
} else {
  console.log('✅ 全部断言通过');
}
