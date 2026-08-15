// P5-C01 数值链审计（EVIDENCE ONLY，2026-08-15）：甲申 庚午 甲子 乙丑（网站喜/用木、忌[]）
// 只读：不修改引擎字节；sha 守卫冻结字节；全部内部数值一次性导出供 GPT 审阅。
// 用法：node _p5/p5c01-trace.js
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var EXPECT_CRLF = '2398e8c71310b7ccc79e4483eb31843ebac6b1d07d4f107889f220490f02d639'; // 工作区 BOM+CRLF
var EXPECT_LF = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6'; // git blob LF（线上字节）

var buf = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
var sha = crypto.createHash('sha256').update(buf).digest('hex');
console.log('== 冻结字节守卫 ==');
console.log('bazi.js raw-byte sha256 = ' + sha);
if (sha !== EXPECT_CRLF && sha !== EXPECT_LF) { console.error('❌ 冻结字节漂移，审计中止'); process.exit(1); }
console.log('✅ 冻结字节守卫通过（' + (sha === EXPECT_CRLF ? '工作区 BOM+CRLF 口径' : 'git blob LF 口径') + '）\n');

global.window = global;
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores','evaluateYongShenQuality','getCangGan','finalizeYongJiResult'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(buf.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

var b = BaZiCalculator.buildFromPillars({
  year: { gan: '甲', zhi: '申' },
  month: { gan: '庚', zhi: '午' },
  day: { gan: '甲', zhi: '子' },
  hour: { gan: '乙', zhi: '丑' }
}, 'male', null);

console.log('===== A. calcDayMasterStrength 全量 =====');
var dmStr = calcDayMasterStrength(b);
console.log(JSON.stringify(dmStr, null, 2));
console.log('bazi._siLing = ' + JSON.stringify(b._siLing));
console.log('藏干事实：申=' + JSON.stringify(getCangGan('申')) + ' 午=' + JSON.stringify(getCangGan('午')) + ' 子=' + JSON.stringify(getCangGan('子')) + ' 丑=' + JSON.stringify(getCangGan('丑')));

console.log('\n===== 格局 getPattern 全量 =====');
var pat = getPattern(b);
console.log(JSON.stringify(pat, null, 2));

console.log('\n===== 从格 getCongGe 全量 =====');
var cong = getCongGe(b);
console.log(JSON.stringify(cong, null, 2));

console.log('\n===== C. calcCandidateScores 全量（d/g1/counts/L1-L4/SBase/SNeed/明细/tiebreak/candidates） =====');
var cs = calcCandidateScores(b, dmStr, pat);
console.log(JSON.stringify(cs, null, 2));

console.log('\n===== 用神最终 getYongJi 全量 =====');
var yj = getYongJi(b);
console.log(JSON.stringify(yj, null, 2));
