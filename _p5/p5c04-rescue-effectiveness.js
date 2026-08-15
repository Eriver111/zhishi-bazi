// P5-C04 救应有效性集（EVIDENCE ONLY，2026-08-15，GPT P5-C03 裁决批准）
// 目标：攻击「当前 +6 是否稳定偏高」——同一破格（月令受冲）下按救应元素质量分四类：
//   A 有透有根（透干+根≥1）→ 质量系数 1
//   B 藏干有根（无透+根≥1）→ 质量系数 0.7
//   C 无承载（无透+根<1，仅理论通关）→ 质量系数 0.3
//   D 救应元素反而造成新问题（扶抑方向错：d>0 给生扶组 / d<0 给克泄耗组）→ 观察档 0
// 方向规则（不含救应分的循环论证）：dirOK = (d<=0) === (通关五行 ∈ 日主生扶组)
// 每盘输出：class/透/根/方向/赢家四列(cur/无L3/质量系数档)/边际/FNQ
// 纪律：EVIDENCE ONLY 零引擎改动；不改 getYongJi/candidateScores/rootScore/neutral threshold。
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var EXPECT_CRLF = '2398e8c71310b7ccc79e4483eb31843ebac6b1d07d4f107889f220490f02d639';
var EXPECT_LF = '774f83bdfe20b94c11c99e7f2b7c63a5ca04434e569510c2aa7edd14e4100be6';

var buf = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
var sha = crypto.createHash('sha256').update(buf).digest('hex');
if (sha !== EXPECT_CRLF && sha !== EXPECT_LF) { console.error('❌ 冻结字节漂移，中止'); process.exit(1); }
console.log('✅ 冻结字节守卫通过（' + (sha === EXPECT_CRLF ? 'CRLF' : 'LF') + '）\n');

global.window = global;
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores','evaluateYongShenQuality','getCangGan','finalizeYongJiResult'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(buf.toString('utf8').replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

function build(gz) {
  var p = gz.split(' ');
  return BaZiCalculator.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

var WX = ['木', '火', '土', '金', '水'];
var GAN_OF = { '木': '甲乙', '火': '丙丁', '土': '戊己', '金': '庚辛', '水': '壬癸' };
var SUPPORT = { '甲': ['木', '水'], '乙': ['木', '水'], '丙': ['火', '木'], '丁': ['火', '木'], '戊': ['土', '火'], '己': ['土', '火'], '庚': ['金', '土'], '辛': ['金', '土'], '壬': ['水', '金'], '癸': ['水', '金'] };
var TONG_GUAN = { '寅': '水', '申': '水', '子': '木', '午': '木', '卯': '水', '酉': '水', '巳': '木', '亥': '木' };

var JIUYING_PREFIX = ['月令受冲，', '伤官克官，', '枭神夺食，', '财星破印，', '七杀无制化，'];
function jiuYingOf(cs) {
  var jy = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  (cs.l3Details || []).forEach(function (d) {
    JIUYING_PREFIX.forEach(function (p) {
      if (d.note.indexOf(p) === 0) jy[d.wx] += d.val;
    });
  });
  return jy;
}

function scaledWinner(cs, jy, rootQ, scale) {
  var S = {};
  WX.forEach(function (wx) {
    var rescue = jy[wx] || 0;
    S[wx] = cs.L1[wx] + cs.L2[wx] + (cs.L3[wx] - rescue) + rescue * scale;
  });
  var maxS = -Infinity, second = -Infinity;
  WX.forEach(function (wx) {
    if (S[wx] > maxS) { second = maxS; maxS = S[wx]; }
    else if (S[wx] > second) second = S[wx];
  });
  var pool = WX.filter(function (wx) { return S[wx] === maxS; });
  var chain = [
    { name: 'L2', get: function (wx) { return cs.L2[wx]; } },
    { name: '救应', get: function (wx) { return (jy[wx] || 0) * scale; } },
    { name: '根气', get: function (wx) { return rootQ[wx] ? rootQ[wx].score : 0; } },
    { name: '固定序', get: function (wx) { return -WX.indexOf(wx); } }
  ];
  for (var i = 0; i < chain.length && pool.length > 1; i++) {
    var best = -Infinity, bestList = [];
    pool.forEach(function (wx) {
      var v = chain[i].get(wx);
      if (v > best) { best = v; bestList = [wx]; }
      else if (v === best) { bestList.push(wx); }
    });
    pool = bestList;
  }
  return { winner: pool[0], S: S, margin: (second === -Infinity) ? null : (maxS - second) };
}

var QUALITY_FACTOR = { A: 1, B: 0.7, C: 0.3, D: 0 };

// [id, declaredClass, gz]
// A 有透有根+方向对（A03=GPT重点盘甲申庚午甲子乙丑透根1；A04-A07=壬日官杀压身水通关）
// B 藏干有根无透+方向对
// C 无承载+方向对
// D 方向错（D11=GPT重点盘戊子丁巳癸亥庚申；D12=C03纠错盘代表）
var CHARTS = [
  ['A01', 'A', '己巳 己亥 丁卯 甲辰'],
  ['A02', 'A', '己巳 己亥 丙寅 乙未'],
  ['A03', 'A', '甲申 庚午 甲子 乙丑'],
  ['A04', 'A', '戊申 戊寅 壬子 己亥'],
  ['A05', 'A', '甲申 戊寅 壬子 戊申'],
  ['A06', 'A', '戊申 甲寅 壬子 己亥'],
  ['A07', 'A', '戊申 甲寅 壬子 戊申'],
  ['A08', 'D', '庚午 甲子 甲午 乙丑'],
  ['A09', 'A', '戊午 戊子 丙寅 甲午'],
  ['A10', 'D', '丙午 甲子 甲寅 乙丑'],
  ['B01', 'B', '戊午 戊子 丙寅 戊子'],
  ['B02', 'B', '戊午 戊子 丁卯 己丑'],
  ['B03', 'B', '己巳 己亥 丙寅 戊子'],
  ['B04', 'B', '己巳 己亥 丙寅 戊戌'],
  ['B05', 'B', '己巳 己亥 丁酉 己酉'],
  ['B06', 'B', '己卯 辛酉 庚寅 甲子'],
  ['B07', 'C', '己卯 乙酉 甲午 甲子'],
  ['B08', 'D', '己卯 辛酉 戊辰 戊午'],
  ['B09', 'D', '己卯 乙酉 壬午 戊申'],
  ['B10', 'B', '戊午 戊子 丙寅 己丑'],
  ['C01', 'C', '戊午 戊子 丙午 戊戌'],
  ['C02', 'C', '己卯 乙酉 甲寅 戊午'],
  ['C03', 'C', '己卯 辛酉 庚寅 戊午'],
  ['C04', 'C', '己卯 丁酉 丁巳 戊午'],
  ['C05', 'C', '壬午 壬子 丙午 戊戌'],
  ['C06', 'C', '壬午 壬子 丁巳 辛丑'],
  ['C07', 'C', '己卯 乙酉 甲午 戊午'],
  ['C08', 'C', '己卯 辛酉 庚午 戊午'],
  ['C09', 'D', '己卯 辛酉 癸巳 己未'],
  ['C10', 'C', '己卯 辛酉 戊戌 戊午'],
  ['D01', 'D', '甲申 庚午 甲子 甲戌'],
  ['D02', 'D', '甲寅 丙午 甲子 甲寅'],
  ['D03', 'D', '乙卯 壬午 丙子 甲午'],
  ['D04', 'D', '丙寅 甲午 丙子 甲午'],
  ['D05', 'D', '壬午 戊子 戊午 庚辰'],
  ['D06', 'D', '甲寅 庚午 甲子 乙丑'],
  ['D07', 'D', '戊午 甲子 甲午 庚午'],
  ['D08', 'D', '丙寅 戊申 戊辰 壬子'],
  ['D09', 'D', '己巳 乙亥 甲子 戊辰'],
  ['D10', 'D', '乙卯 辛酉 癸酉 丙辰'],
  ['D11', 'D', '戊子 丁巳 癸亥 庚申'],
  ['D12', 'D', '癸酉 壬午 癸丑 壬子'],
  ['D13', 'D', '甲午 戊子 丙寅 甲午'],
  ['D14', 'D', '丙子 庚午 甲寅 乙亥'],
  ['D15', 'D', '壬午 戊子 戊午 壬戌'],
  ['D16', 'D', '己卯 辛酉 丙寅 甲子']
];

var ANCHORS = { A03: 'GPT重点盘① 甲申庚午甲子乙丑', D11: 'GPT重点盘② 戊子丁巳癸亥庚申' };

var rows = [];
CHARTS.forEach(function (c) {
  var id = c[0], decl = c[1];
  var b, err = null;
  try { b = build(c[2]); } catch (e) { err = e.message; }
  if (err) { rows.push({ id: id, decl: decl, gz: c[2], error: err }); return; }
  var dmStr = calcDayMasterStrength(b);
  var pat = getPattern(b);
  var cong = getCongGe(b);
  var cs = calcCandidateScores(b, dmStr, pat);
  var rootQ = evaluateYongShenQuality(b, { yongShen: WX.slice(), xiShen: [] });
  var yj = getYongJi(b);
  var chongReason = (pat.breakReasons || []).filter(function (r) { return r.indexOf('月令受') >= 0 && r.indexOf('冲') >= 0; });
  var tgWx = TONG_GUAN[pat.monthZhi] || null;
  var jy = jiuYingOf(cs);
  var rescueTotal = tgWx ? (jy[tgWx] || 0) : 0;
  var isCong = cong.isCong;
  var wCur = isCong ? (yj.yongShen[0] || '') : cs.yongWx;
  var w0 = scaledWinner(cs, jy, rootQ, 0).winner;
  var w1 = scaledWinner(cs, jy, rootQ, 1);
  var check = isCong ? 'N/A(从格)' : (w1.winner === wCur ? '✅' : '❌' + w1.winner + '≠' + wCur);
  var dayGan = c[2].split(' ')[2][0];
  var gans = c[2].split(' ').map(function (p) { return p[0]; }).join('');
  var ganVisible = tgWx ? GAN_OF[tgWx].split('').some(function (g) { return gans.indexOf(g) >= 0; }) : false;
  var tgRoot = tgWx ? (rootQ[tgWx] ? rootQ[tgWx].score : 0) : 0;
  // 方向规则（不含救应循环）：d<=0 时生扶组才对；d>0 时克泄耗组才对
  var dirOK = tgWx ? ((cs.d <= 0) === (SUPPORT[dayGan].indexOf(tgWx) >= 0)) : false;
  var calcCls = (tgWx && !dirOK) ? 'D' : (ganVisible ? 'A' : (tgRoot >= 1 ? 'B' : 'C'));
  var factor = QUALITY_FACTOR[calcCls];
  var wQ = scaledWinner(cs, jy, rootQ, factor);
  var fnQ = (tgWx && !isCong && wCur === tgWx && wQ.winner !== tgWx);
  rows.push({
    id: id, decl: decl, calcCls: calcCls, gz: c[2],
    strength: dmStr.score, level: dmStr.level, d: cs.d,
    pattern: pat.name, status: pat.status, cong: isCong,
    chongReason: chongReason, tgWx: tgWx, tgRoot: tgRoot, ganVisible: ganVisible,
    dirOK: dirOK, rescueTotal: rescueTotal,
    wCur: wCur, w0: w0, wQ: wQ.winner, factor: factor,
    marginCur: w1.margin, marginQ: wQ.margin,
    check: check, fnQ: fnQ, rootDetail: tgWx ? rootQ[tgWx] : null
  });
});

// ===== 落组验证 =====
console.log('===== 落组验证 =====');
var failed = 0;
rows.forEach(function (r) {
  if (r.error) { console.log(r.id + ' [❌ 构造错误] ' + r.error); failed++; return; }
  var issues = [];
  if (r.chongReason.length === 0) issues.push('无月令受冲reason');
  if (r.rescueTotal < 6) issues.push('jiuYing[' + r.tgWx + ']=' + r.rescueTotal + ' 救应未触发');
  if (r.cong) issues.push('从格覆盖');
  if (r.calcCls !== r.decl) issues.push('声明' + r.decl + '≠计算' + r.calcCls + '(透=' + r.ganVisible + ' 根=' + r.tgRoot + ' d=' + r.d + ' 方向' + (r.dirOK ? '对' : '错') + ')');
  if (issues.length) { console.log(r.id + ' [⚠ 落组问题] ' + issues.join('；')); failed++; }
});
console.log(failed === 0 ? '✅ 全部落组通过' : '⚠ ' + failed + ' 盘需调整');
console.log('');

// ===== 自校验 =====
var checkBad = rows.filter(function (r) { return !r.error && r.check.indexOf('❌') >= 0; });
console.log('===== 反事实自校验（scale=1 应=引擎现状） =====');
console.log(checkBad.length === 0 ? '✅ 全部一致' : '⚠ ' + checkBad.length + ' 盘不一致：' + checkBad.map(function (r) { return r.id; }).join(' '));
console.log('');

// ===== 逐盘表 =====
console.log('===== 逐盘表 =====');
rows.forEach(function (r) {
  if (r.error) return;
  console.log(r.id + '[' + r.calcCls + '] ' + r.gz + ' | ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + ' | 通关' + r.tgWx + ': 透' + (r.ganVisible ? '✓' : '✗') + ' 根' + r.tgRoot + ' 方向' + (r.dirOK ? '对' : '错') + ' jiuYing=' + r.rescueTotal);
  console.log('  W: cur=' + r.wCur + ' 无L3=' + r.w0 + ' 系数档(' + r.factor + ')=' + r.wQ + (r.fnQ ? ' 【FNQ】' : '') + ' | 边际 cur=' + (r.marginCur === null ? '-' : r.marginCur) + ' Q=' + (r.marginQ === null ? '-' : r.marginQ) + ' [' + r.check + ']');
});

// ===== 汇总 =====
console.log('');
console.log('===== 汇总（各类：翻转/错向翻转/FNQ/救应赢家） =====');
['A', 'B', 'C', 'D'].forEach(function (cls) {
  var rs = rows.filter(function (r) { return r.calcCls === cls && !r.error; });
  var flipCur = rs.filter(function (r) { return !r.cong && r.wCur !== r.w0; });
  var flipWrong = flipCur.filter(function (r) { return !r.dirOK; });
  var flipQ = rs.filter(function (r) { return !r.cong && r.wQ !== r.w0; });
  var fnQ = rs.filter(function (r) { return r.fnQ; });
  var fnQDirOK = fnQ.filter(function (r) { return r.dirOK; });
  var rescueWinsCur = rs.filter(function (r) { return !r.cong && r.wCur === r.tgWx; });
  var rescueWinsQ = rs.filter(function (r) { return !r.cong && r.wQ === r.tgWx; });
  console.log(cls + ' 组 n=' + rs.length + ' 系数=' + QUALITY_FACTOR[cls] + ' | 翻转现状 ' + flipCur.length + '(其中错向' + flipWrong.length + ') → 系数档 ' + flipQ.length + ' | FNQ ' + fnQ.length + '(方向对' + fnQDirOK.length + ') | 救应赢家 ' + rescueWinsCur.length + '→' + rescueWinsQ.length);
  if (fnQ.length) console.log('  FNQ 盘: ' + fnQ.map(function (r) { return r.id + '(' + r.wCur + '→' + r.wQ + ')'; }).join(' '));
});

// ===== 锚点盘详情 =====
console.log('');
console.log('===== 锚点盘详情 =====');
rows.forEach(function (r) {
  if (r.error || !ANCHORS[r.id]) return;
  console.log(r.id + ' ' + ANCHORS[r.id] + '：');
  console.log('  ' + r.gz + ' | ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + (r.cong ? '【从格】' : ''));
  console.log('  通关' + r.tgWx + '：透' + (r.ganVisible ? '✓' : '✗') + ' 根score=' + r.tgRoot + ' 方向' + (r.dirOK ? '对' : '错') + ' jiuYing=' + r.rescueTotal + ' rootDetail=' + JSON.stringify(r.rootDetail));
  console.log('  W: cur=' + r.wCur + ' 无L3=' + r.w0 + ' 系数档(' + r.factor + ')=' + r.wQ + ' | 边际 cur=' + r.marginCur + ' Q=' + r.marginQ + ' [' + r.check + ']');
});

fs.writeFileSync(path.join(__dirname, 'p5c04-output.json'), JSON.stringify(rows, null, 2));
console.log('\n完整 JSON 已存 _p5/p5c04-output.json');
