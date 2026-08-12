// 单盘体检：打印网站引擎对任意四柱的当前判定（用于 AI 交叉比对对账）
// 用法: node _check_chart.js 戊寅 甲寅 癸未 乙卯
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var exportsToGlobal = [
  'getPattern','calcDayMasterStrength','getYongJi','getCongGe'
];
var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

var args = process.argv.slice(2);
if (args.length < 4) {
  console.log('用法: node _check_chart.js 年柱 月柱 日柱 时柱');
  console.log('示例: node _check_chart.js 戊寅 甲寅 癸未 乙卯');
  process.exit(1);
}

var bazi = {
  year: { gan: args[0][0], zhi: args[0][1] },
  month:{ gan: args[1][0], zhi: args[1][1] },
  day:  { gan: args[2][0], zhi: args[2][1] },
  hour: { gan: args[3][0], zhi: args[3][1] }
};

var dm = calcDayMasterStrength(bazi);
var cong = getCongGe(bazi);
var pat = getPattern(bazi);
var yj = getYongJi(bazi);

console.log('═══════════════════════════════════════════════');
console.log(' ' + args.join(' ') + ' —— 网站当前判定');
console.log('═══════════════════════════════════════════════');
console.log(' 旺衰: ' + dm.score + '分 ' + dm.level + (cong.isCong ? '（成' + cong.name + '）' : ''));
console.log(' 明细: ' + dm.detail);
console.log(' 格局: ' + pat.name + '（' + pat.status + '）' + (pat.basePattern ? ' 原局: ' + pat.basePattern : ''));
console.log(' 用神: ' + yj.yongShen.join('、'));
console.log(' 喜神: ' + yj.xiShen.join('、'));
console.log(' 忌神: ' + yj.jiShen.join('、'));
console.log(' 方法: ' + yj.method);
console.log(' 理由: ' + yj.primaryReason);
console.log('═══════════════════════════════════════════════');
