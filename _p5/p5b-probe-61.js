// P5-B 前置调查：己丑 壬申 丙午 壬辰 内部证据（GPT 三问）
// ① pattern 为什么叫财生官格？② 内部 target 是壬还是癸？③ 命名问题还是十神映射问题？
var fs = require('fs'), vm = require('vm');
function loadEngine(p) {
  var context = { window: {} };
  vm.runInNewContext(fs.readFileSync(p, 'utf8'), context);
  return context.window.BaZiCalculator;
}
var ENG = loadEngine('js/bazi.js');

function buildPillars(gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

var b = buildPillars('己丑 壬申 丙午 壬辰');
var pt = ENG.getPattern(b);
var cg = ENG.getCongGe(b);
var yj = ENG.getYongJi(b);
var ds = ENG.calcDayMasterStrength(b);

console.log('===== getPattern 全量 =====');
console.log(JSON.stringify(pt, null, 2));
console.log('===== getCongGe 全量 =====');
console.log(JSON.stringify(cg, null, 2));
console.log('===== getYongJi 全量 =====');
console.log(JSON.stringify(yj, null, 2));
console.log('===== calcDayMasterStrength 全量 =====');
console.log(JSON.stringify(ds, null, 2));

// 十神映射检查：丙日主下 壬=七杀 癸=正官 庚=偏财 辛=正财 己=伤官 戊=食神
console.log('===== 十神映射事实 =====');
console.log('丙日主：庚=偏财、辛=正财、壬=七杀、癸=正官、己=伤官、戊=食神');
console.log('月支申藏：庚(偏财) 壬(七杀) 戊(食神)');
