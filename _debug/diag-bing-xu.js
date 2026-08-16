// 诊断：乙酉 戊寅 丁丑 癸卯 —— 为什么判正印格且文案说「寅里藏乙」
global.window = global;
eval(require('fs').readFileSync('js/bazi.js', 'utf8'));

function pillars(values) {
  var records = values.map(function (gz) { return { gan: gz[0], zhi: gz[1] }; });
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}
var b = BaZiCalculator.buildFromPillars(pillars(['乙酉', '戊寅', '丁丑', '癸卯']), 'male');

console.log('=== 基础事实 ===');
console.log('寅藏干:', JSON.stringify(BaZiCalculator.getCangGan('寅')));
console.log('丁对寅本气(甲)十神:', BaZiCalculator.getShiShen('丁', '甲'));
console.log('丁对乙十神:', BaZiCalculator.getShiShen('丁', '乙'));
console.log('丁长生表:', JSON.stringify(BaZiCalculator.getChangSheng('丁')));
console.log('');

console.log('=== getPattern ===');
var p = BaZiCalculator.getPattern(b);
console.log(JSON.stringify(p, null, 2));
console.log('');

console.log('=== getCongGe ===');
var c = BaZiCalculator.getCongGe(b);
console.log('isCong:', c.isCong, 'name:', c.name, 'source:', c.source);
console.log('');

console.log('=== getRenYuanEvidence ===');
var r = BaZiCalculator.getRenYuanEvidence(b);
console.log(JSON.stringify(r, null, 2));
console.log('');

console.log('=== getYongJi ===');
var yj = BaZiCalculator.getYongJi(b);
console.log('method:', yj.method);
console.log('patternStatus:', JSON.stringify(yj.patternStatus));
console.log('primaryReason:', yj.primaryReason);
console.log('yongShen:', yj.yongShen, 'xiShen:', yj.xiShen, 'jiShen:', yj.jiShen);
console.log('evidence 格局类:', JSON.stringify((yj.evidence || []).filter(function (e) { return e.category === '格局'; }), null, 2));
console.log('');

console.log('=== getProfessionalReportFacts ===');
var f = BaZiCalculator.getProfessionalReportFacts(b, 'male');
console.log('pattern:', JSON.stringify(f.pattern, null, 2));
console.log('summary 前3条:');
(f.summary || []).slice(0, 3).forEach(function (s) { console.log(' -', s); });
console.log('actionChains:');
(f.actionChains || []).forEach(function (a) { console.log(' -', a.priority, a.title, '|', a.detail); });
