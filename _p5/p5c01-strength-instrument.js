// P5-C01 旺衰加减项机械验证（EVIDENCE ONLY，2026-08-15）
// 从冻结字节中提取 calcDayMasterStrength 函数文本（原文件不动），逐行注入 __AD 记账，
// 输出每次 score 增减的原始行号/增量/累计值，与未插桩引擎得分对账。
// 用法：node _p5/p5c01-strength-instrument.js
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var EXPECT_CRLF = '2398e8c71310b7ccc79e4483eb31843ebac6b1d07d4f107889f220490f02d639';
var EXPECT_LF = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6';

var buf = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
var sha = crypto.createHash('sha256').update(buf).digest('hex');
if (sha !== EXPECT_CRLF && sha !== EXPECT_LF) { console.error('❌ 冻结字节漂移，中止'); process.exit(1); }
var src = buf.toString('utf8');

// 提取函数文本（含原文件行号偏移）
var START_LINE = 2178; // function calcDayMasterStrength(bazi) { 的 1-index 行号
var m = src.match(/function calcDayMasterStrength\(bazi\) \{[\s\S]*?\r?\n\}\r?\n\r?\n\/\/ ==================== 父母关系分析/);
if (!m) { console.error('❌ 函数提取失败'); process.exit(1); }
var fnText = m[0].replace(/\r?\n\r?\n\/\/ ==================== 父母关系分析[\s\S]*$/, '');
var lines = fnText.split('\n');

// 逐行注入记账：score += X; / score -= X; → score = __AD(行号, score, X);
var log = [];
var instrumented = lines.map(function (line, i) {
  var ln = START_LINE + i;
  line = line.replace(/\r$/, '');
  var mm = line.match(/^(.*?)\bscore ([\+\-])= (.+);(\s*\/\/.*)?$/);
  if (!mm) return line;
  var op = mm[2] === '+' ? 1 : -1;
  return mm[1] + 'score = __AD(' + ln + ', score, ' + op + ' * (' + mm[3] + '));' + (mm[4] || '');
}).join('\n');

global.window = global;
global.__AD = function (ln, prev, delta) {
  var next = prev + delta;
  log.push({ line: ln, delta: delta, after: next });
  return next;
};
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores','evaluateYongShenQuality','getCangGan','finalizeYongJiResult'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(src.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

var b = BaZiCalculator.buildFromPillars({
  year: { gan: '甲', zhi: '申' },
  month: { gan: '庚', zhi: '午' },
  day: { gan: '甲', zhi: '子' },
  hour: { gan: '乙', zhi: '丑' }
}, 'male', null);

// 未插桩基准
var ref = calcDayMasterStrength(b);

// 插桩函数：剥离函数头尾，仅取函数体；依赖的引擎常量经参数绑定（不触碰冻结字节）
var bodyLines = instrumented.split('\n').slice(1, -1); // 去 function 头与尾部 }
var fn = new Function('bazi', 'WU_XING', 'DI_ZHI_WU_XING', 'getCangGan', 'getDaysFromJieQi', 'getRenYuanSiLing', '__AD', bodyLines.join('\n'));
log.length = 0;
var result = fn(b, BaZiCalculator.WU_XING, BaZiCalculator.DI_ZHI_WU_XING, BaZiCalculator.getCangGan, BaZiCalculator.getDaysFromJieQi, BaZiCalculator.getRenYuanSiLing, __AD);

console.log('== 对账 ==');
console.log('未插桩引擎得分: ' + ref.score + '（' + ref.level + '）');
console.log('插桩函数得分:   ' + result.score);
console.log('对账: ' + (ref.score === result.score ? '✅ 一致' : '❌ 不一致') + '\n');
console.log('== 逐项记账（行号=冻结文件原行号） ==');
var sum = 50;
console.log('start: 50');
log.forEach(function (e) {
  sum += e.delta;
  console.log('  L' + e.line + ': ' + (e.delta >= 0 ? '+' : '') + e.delta + ' → ' + e.after + (sum === e.after ? '' : ' ⚠累积不符'));
});
console.log('end: ' + sum);
