// P5-C03 候选盘诊断（临时）：看 pat.name/type/breakReasons/jiuYing/strength，用于精确重造 A/C 组
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var EXPECT_CRLF = '2398e8c71310b7ccc79e4483eb31843ebac6b1d07d4f107889f220490f02d639';
var buf = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
if (crypto.createHash('sha256').update(buf).digest('hex') !== EXPECT_CRLF) { console.error('sha drift'); process.exit(1); }
global.window = global;
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores','evaluateYongShenQuality'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(buf.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

var JIUYING_PREFIX = ['月令受冲，', '伤官克官，', '枭神夺食，', '财星破印，', '七杀无制化，'];
function jiuYingOf(cs) {
  var jy = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  (cs.l3Details || []).forEach(function (d) {
    JIUYING_PREFIX.forEach(function (p) { if (d.note.indexOf(p) === 0) jy[d.wx] += d.val; });
  });
  return jy;
}

var LIST = [
  // 旧 C 组失败盘
  ['旧C01', '丙寅 戊申 壬申 庚子'], ['旧C03', '己卯 辛酉 癸丑 丙辰'],
  ['旧C05', '庚申 壬寅 壬辰 庚子'], ['旧C06', '庚申 壬寅 壬午 壬寅'],
  ['旧C09', '己巳 乙亥 甲子 戊辰'], ['旧C13', '壬子 丙午 乙巳 壬午'],
  // 新 A 组候选（水日主+卯月酉冲+食伤压身+子亥根）
  ['A新1', '乙酉 乙卯 壬子 甲辰'], ['A新2', '乙酉 乙卯 壬子 乙巳'],
  ['A新3', '乙酉 乙卯 癸亥 甲辰'], ['A新4', '乙酉 乙卯 癸亥 乙巳'],
  ['A新5', '乙酉 乙卯 癸丑 甲辰'],
  // 新 A 组候选（火日主+子月午冲/亥月巳冲+食伤压身+寅卯根）
  ['A新6', '戊午 戊子 丙寅 己丑'], ['A新7', '戊午 戊子 丙寅 戊子'],
  ['A新8', '戊午 戊子 丙寅 己巳'], ['A新9', '戊午 戊子 丁卯 己丑'],
  ['A新10', '戊午 戊子 丁卯 己巳'], ['A新11', '己巳 己亥 丙寅 戊子'],
  ['A新12', '己巳 己亥 丙寅 戊戌'], ['A新13', '己巳 己亥 丁卯 戊子'],
  ['A新14', '己巳 己亥 丁卯 戊申'],
  // 新 C 组候选
  ['C新a1', '壬午 丁酉 壬子 丁卯'], ['C新a2', '甲午 丁酉 壬子 丁卯'],
  ['C新a3', '癸酉 丁酉 癸丑 丁卯'], ['C新a4', '乙酉 丁酉 癸丑 丁卯'],
  ['C新b1', '丙寅 戊申 戊午 壬子'], ['C新b2', '丙寅 戊申 戊辰 壬子'],
  ['C新b3', '丙寅 戊申 戊子 壬戌'], ['C新b4', '丙寅 戊申 戊寅 壬子'],
  ['C新b5', '壬寅 戊申 戊戌 丙辰'],
  ['C新c1', '戊午 甲子 甲午 戊辰'], ['C新c2', '戊午 甲子 甲午 己巳'],
  ['C新c3', '戊午 甲子 甲辰 己巳'],
  ['C新d1', '甲午 庚子 辛丑 己丑'], ['C新d2', '甲午 庚子 辛酉 己丑'],
  ['C新d3', '丙午 庚子 辛丑 己丑'], ['C新d4', '己巳 辛亥 庚子 戊寅'],
  ['C新d5', '己巳 辛亥 庚戌 戊寅']
];

LIST.forEach(function (it) {
  var g = it[1].split(' ');
  var b = BaZiCalculator.buildFromPillars({
    year: { gan: g[0][0], zhi: g[0][1] }, month: { gan: g[1][0], zhi: g[1][1] },
    day: { gan: g[2][0], zhi: g[2][1] }, hour: { gan: g[3][0], zhi: g[3][1] }
  }, 'male', null);
  var s = calcDayMasterStrength(b), p = getPattern(b), cs = calcCandidateScores(b, s, p);
  var jy = jiuYingOf(cs);
  var jys = Object.keys(jy).filter(function (k) { return jy[k] > 0; }).map(function (k) { return k + '+' + jy[k]; }).join(' ');
  console.log(it[0] + ' ' + it[1] + ' | ' + s.score + s.level + ' | ' + p.name + '(' + p.type + ')·' + p.status + ' | jy: ' + (jys || '(空)') + ' | break: ' + (p.breakReasons || []).join('；'));
});
