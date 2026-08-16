// P5-C07 冒烟（2026-08-16）：A03/D11 锚点 + 从格 S04 + 首个穷通盘。
// 断言（ASCII 输出，中文仅进 JSON）：
//  A03: yong=木 xi=[木,水] ji=[火,土,金] classification 全五元素
//  D11: yong=金 xi=[金,水] ji=[木,火,土] classification 全五元素
//  S04(从格): elementClassification 不挂载 + pre/post 全字段一致
//  穷通盘: elementClassification 不挂载 + pre/post 全字段一致
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
function load(src) {
  var context = { window: {} };
  vm.runInNewContext(src, context);
  return { eng: context.window.BaZiCalculator, ctx: context };
}
var PRE = load(fs.readFileSync(path.join(__dirname, 'bazi.pre-c07.js'), 'utf8'));
var POST = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));
function build(E, gz) {
  var p = gz.split(' ');
  return E.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
var fails = [];
function eq(cond, msg) { if (!cond) fails.push(msg); }

// A03 / D11
[['A03', '甲申 庚午 甲子 乙丑', '木', ['木', '水'], ['火', '土', '金'], { 木: '用神', 火: '弱忌', 土: '弱忌', 金: '弱忌', 水: '弱喜' }],
 ['D11', '戊子 丁巳 癸亥 庚申', '金', ['金', '水'], ['木', '火', '土'], { 木: '弱忌', 火: '弱忌', 土: '弱忌', 金: '用神', 水: '弱喜' }]
].forEach(function (c) {
  var yj = POST.eng.getYongJi(build(POST.eng, c[1]));
  eq(JSON.stringify(yj.yongShen) === JSON.stringify([c[2]]), c[0] + ' yong=' + JSON.stringify(yj.yongShen));
  eq(JSON.stringify(yj.xiShen) === JSON.stringify(c[3]), c[0] + ' xi=' + JSON.stringify(yj.xiShen));
  eq(JSON.stringify(yj.jiShen) === JSON.stringify(c[4]), c[0] + ' ji=' + JSON.stringify(yj.jiShen));
  eq(JSON.stringify(yj.elementClassification) === JSON.stringify(c[5]), c[0] + ' classification=' + JSON.stringify(yj.elementClassification));
  eq(Object.keys(yj.elementClassification).length === 5, c[0] + ' classification 键数=' + Object.keys(yj.elementClassification).length);
});

// S04 从格
var s04 = '壬子 壬子 丁酉 辛亥';
var o4 = PRE.eng.getYongJi(build(PRE.eng, s04)), n4 = POST.eng.getYongJi(build(POST.eng, s04));
eq(n4.elementClassification === undefined, 'S04 从格 elementClassification 应不挂载');
eq(JSON.stringify(o4) === JSON.stringify(n4), 'S04 从格 pre/post 全字段不一致');
eq(JSON.stringify(n4.xiShen) === JSON.stringify(['水', '金']), 'S04 xi=' + JSON.stringify(n4.xiShen));
eq(JSON.stringify(n4.jiShen) === JSON.stringify(['木', '火']), 'S04 ji=' + JSON.stringify(n4.jiShen));

// 首个穷通盘（无 candidateScores 且非从格）——在 BLIND50 中扫描
var found = null;
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  if (found) return;
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm, m;
  while ((m = re.exec(md)) !== null) {
    var yj = PRE.eng.getYongJi(build(PRE.eng, m[2]));
    if (!yj.candidateScores && !(yj.congGe && yj.congGe.isCong)) { found = { id: m[1], gz: m[2] }; return; }
  }
});
if (found) {
  var oq = PRE.eng.getYongJi(build(PRE.eng, found.gz)), nq = POST.eng.getYongJi(build(POST.eng, found.gz));
  eq(nq.elementClassification === undefined, found.id + ' 穷通 elementClassification 应不挂载');
  eq(JSON.stringify(oq) === JSON.stringify(nq), found.id + ' 穷通 pre/post 全字段不一致');
} else {
  fails.push('未找到穷通盘（BLIND50 内）');
}

fs.writeFileSync(path.join(__dirname, 'p5c07-smoke.json'), JSON.stringify({ fails: fails, qiongTong: found }, null, 1), 'utf8');
if (fails.length) { console.log('SMOKE FAIL ' + fails.length); fails.forEach(function (f) { console.log('  ' + f); }); process.exit(1); }
console.log('SMOKE PASS (A03/D11/S04/qiongTong=' + (found ? found.id : 'NONE') + ')');
