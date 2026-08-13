// P2.1 第四轮·附查：当前 P1 冻结引擎 BASE 结果 vs 冻结 22-CSV（引擎提交列=dbed1e0，早于 P1 冻结 13e588b）
// 目的：核实 1g 中 H11/A5 的 BASE 用神/喜/忌与冻结 CSV 不符的原因——是 CSV 过期（P1 改变了用神输出），还是我的 BASE 运行有误。
// 用法: node _p2_1h_baseline_csv_check.js
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');
var stitched = '';
['getYongJi','calcDayMasterStrength'].forEach(function(name) {
  stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
eval(baseCode.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {'));

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function run(gz) {
  var b = toBazi(gz);
  var dm = global.calcDayMasterStrength(b);
  var yj = global.getYongJi(b);
  return { score: dm.score, level: dm.level, yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、') };
}

// 冻结 CSV 期望值（终分/旺衰/用神/喜神/忌神）
var lines = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').split('\n').slice(1);
var diff = [], scoreMismatch = [];
lines.forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var cells = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (cells.length < 10 || !cells[1]) return;
  var id = cells[0], gz = cells[1].split(/\s+/);
  if (gz.length !== 4) return;
  var exp = { score: parseInt(cells[3], 10), level: cells[4], yong: cells[7], xi: cells[8], ji: cells[9] };
  var r = run(gz);
  if (r.score !== exp.score || r.level !== exp.level) scoreMismatch.push(id + ' 分' + exp.score + '/' + exp.level + '→' + r.score + '/' + r.level);
  if (r.yong !== exp.yong || r.xi !== exp.xi || r.ji !== exp.ji) {
    diff.push(id + ' 用神' + exp.yong + '→' + r.yong + ' 喜' + exp.xi + '→' + r.xi + ' 忌' + (exp.ji || '空') + '→' + (r.ji || '空'));
  }
});
console.log('分/旺衰与冻结 CSV 不一致：' + (scoreMismatch.length ? scoreMismatch.join('；') : '无（22/22 一致）'));
console.log('用神/喜/忌与冻结 CSV 不一致（' + diff.length + ' 盘）：');
diff.forEach(function(d) { console.log('  ' + d); });
