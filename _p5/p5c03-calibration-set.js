// P5-C03 救应权重校准集（EVIDENCE ONLY，2026-08-15，GPT P5-C02 终裁批准）
// 目标：不是修复，是校准 L3 救应权重。三组 60 盘：
//   A 20盘：必须保留救应优势（月令受冲+结构破坏明显+通关五行有真实根+非中和）→ 测 +6→+4/+3 是否产生 false negative
//   B 20盘：中和过强测试（C02 A/B 类）→ 比较 +6/+4/+3 翻转率
//   C 20盘：叠加救应（+12）边界 → 测 +12 是否接近强制指定用神
// 每盘输出：winnerWithCurrentL3 / winnerWithoutL3 / winnerWithL3_4 / winnerWithL3_3 / falseNegative 标记
// 纪律：只输出事实字段，零引擎改动；不改 getYongJi/candidateScores/rootScore/neutral threshold。
// 用法：node _p5/p5c03-calibration-set.js
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
var TONG_GUAN = { '寅': '水', '申': '水', '子': '木', '午': '木', '卯': '水', '酉': '水', '巳': '木', '亥': '木' };

// jiuYing 是 calcCandidateScores 的局部变量不外露；从 l3Details 按 5 个救应 note 前缀重建（L4841-4846）
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

// 反事实：救应分（jiuYing）按 scale 缩放，L3 主项分不变，argmax 后走 F11 链（L2→救应(缩放)→根气→固定序）
// scale=1 → 引擎现状；scale=0 → 无 L3（C02 口径）；scale=4/6、3/6 → 方案1/方案2
function scaledWinner(cs, jy, rootQ, scale) {
  var S = {};
  WX.forEach(function (wx) {
    var rescue = jy[wx] || 0;
    S[wx] = cs.L1[wx] + cs.L2[wx] + (cs.L3[wx] - rescue) + rescue * scale;
  });
  var maxS = -Infinity;
  WX.forEach(function (wx) { if (S[wx] > maxS) maxS = S[wx]; });
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
  return { winner: pool[0], S: S };
}

// [id, group, gz]
var CHARTS = [
  // ===== A 组：必须保留救应优势（非中和 + 月令受冲 + 通关五行真实根 tgRoot≥1.5 + 非从格）=====
  // 水日主 + 卯月受酉冲（通关水）+ 甲乙食伤压身（不克水根）+ 子/亥根
  ['A01', 'A', '乙酉 乙卯 壬子 甲辰'],
  ['A02', 'A', '乙酉 乙卯 壬子 乙巳'],
  ['A03', 'A', '乙酉 乙卯 癸亥 甲辰'],
  ['A04', 'A', '乙酉 乙卯 癸亥 丙辰'],
  // 火日主 + 子月受午冲（通关木）+ 戊己食伤压身（不克木根）+ 寅/卯根
  ['A05', 'A', '戊午 戊子 丙寅 戊子'],
  ['A06', 'A', '戊午 戊子 丁卯 己丑'],
  // 火日主 + 亥月受巳冲（通关木）+ 戊己食伤压身 + 寅/卯根
  ['A07', 'A', '己巳 己亥 丙寅 戊子'],
  ['A08', 'A', '己巳 己亥 丙寅 戊戌'],
  // 木日主 + 午月受子冲（通关木）+ 庚杀戊财压身 + 寅根（庚戊直克虽扣根，根气仍≥1.5）
  ['A09', 'A', '戊子 庚午 甲辰 戊寅'],
  ['A10', 'A', '丙子 庚午 甲辰 戊寅'],
  ['A11', 'A', '戊戌 丙午 甲子 戊寅'],
  // 水日主 + 寅月受申冲（通关水）+ 戊己官杀压身 + 子/亥根
  ['A12', 'A', '戊申 戊寅 壬子 己亥'],
  ['A13', 'A', '甲申 戊寅 壬子 戊申'],
  ['A14', 'A', '戊申 甲寅 壬子 己亥'],
  ['A15', 'A', '戊申 甲寅 壬子 戊申'],
  // 偏强侧（通关根强但方向门控压负——救应方向正确性存疑，作对照）
  ['A16', 'A', '甲寅 丙午 甲子 甲寅'],
  ['A17', 'A', '乙卯 壬午 丙子 甲午'],
  ['A18', 'A', '丙寅 甲午 丙子 甲午'],
  // 极弱侧木日主（C02 验证通过：根 2，非从格）
  ['A19', 'A', '戊子 庚午 甲辰 戊寅'],
  ['A20', 'A', '丙子 庚午 甲辰 戊寅'],
  // ===== B 组：中和过强测试（C02 A/B 类复用 + 1 新盘）=====
  ['B01', 'B', '甲申 庚午 甲子 乙丑'],
  ['B02', 'B', '壬子 壬午 壬午 壬戌'],
  ['B03', 'B', '癸酉 壬午 癸丑 壬子'],
  ['B04', 'B', '甲申 庚午 甲子 甲戌'],
  ['B05', 'B', '壬午 丁酉 壬午 丁卯'],
  ['B06', 'B', '戊午 甲子 甲午 庚午'],
  ['B07', 'B', '戊午 甲子 丙午 丙午'],
  ['B08', 'B', '庚午 甲子 庚辰 戊子'],
  ['B09', 'B', '壬午 戊子 戊午 庚辰'],
  ['B10', 'B', '壬寅 戊申 丙午 甲午'],
  ['B11', 'B', '乙卯 丁酉 壬寅 戊申'],
  ['B12', 'B', '甲寅 庚午 甲子 乙丑'],
  ['B13', 'B', '丙寅 甲午 甲子 乙巳'],
  ['B14', 'B', '甲寅 丙午 甲子 丙戌'],
  ['B15', 'B', '壬寅 戊午 壬子 癸卯'],
  ['B16', 'B', '癸卯 壬午 癸丑 壬子'],
  ['B17', 'B', '壬寅 戊午 壬子 甲辰'],
  ['B18', 'B', '壬子 丁卯 丁酉 癸卯'],
  ['B19', 'B', '乙亥 壬午 戊子 癸丑'],
  ['B20', 'B', '己酉 乙卯 壬申 庚子'],
  // ===== C 组：叠加救应（月令受冲 + 第二救应键同元素 → jiuYing≥12，4 种机制各 5 盘）=====
  // 机制①：财星破印（印格+财透）+ 通关水（壬癸日主，比劫=水）
  ['C01', 'C', '己卯 辛酉 癸丑 丙辰'],
  ['C02', 'C', '乙卯 辛酉 癸酉 丙辰'],
  // 机制②：财星破印 + 通关木（甲乙日主，比劫=木）
  ['C03', 'C', '己巳 乙亥 甲子 戊辰'],
  ['C04', 'C', '己巳 乙亥 甲寅 戊辰'],
  ['C05', 'C', '己巳 壬子 甲午 戊辰'],
  ['C06', 'C', '己巳 乙亥 甲子 己巳'],
  // 机制①续：壬癸日主 + 酉月受卯冲 + 丁财透
  ['C07', 'C', '壬午 丁酉 壬子 丁卯'],
  ['C08', 'C', '甲午 丁酉 壬子 丁卯'],
  ['C09', 'C', '癸酉 丁酉 癸丑 丁卯'],
  ['C10', 'C', '乙酉 丁酉 癸丑 丁卯'],
  // 机制③：枭神夺食（食神格+枭透）+ 通关水（戊日主，财=水）
  ['C11', 'C', '丙寅 戊申 戊午 壬子'],
  ['C12', 'C', '丙寅 戊申 戊辰 壬子'],
  ['C13', 'C', '丙寅 戊申 戊子 壬戌'],
  ['C14', 'C', '壬寅 戊申 戊戌 丙辰'],
  // 机制④：枭神夺食 + 通关木（辛日主，财=木）
  ['C15', 'C', '戊午 甲子 甲午 戊辰'],
  ['C16', 'C', '戊午 甲子 甲午 己巳'],
  ['C17', 'C', '戊午 甲子 甲辰 己巳'],
  ['C18', 'C', '甲午 庚子 辛丑 己丑'],
  ['C19', 'C', '甲午 庚子 辛酉 己丑'],
  ['C20', 'C', '丙午 庚子 辛丑 己丑']
];

var rows = [];
CHARTS.forEach(function (c) {
  var id = c[0], group = c[1];
  var b, err = null;
  try { b = build(c[2]); } catch (e) { err = e.message; }
  if (err) { rows.push({ id: id, group: group, gz: c[2], error: err }); return; }
  var dmStr = calcDayMasterStrength(b);
  var pat = getPattern(b);
  var cong = getCongGe(b);
  var cs = calcCandidateScores(b, dmStr, pat);
  var rootQ = evaluateYongShenQuality(b, { yongShen: WX.slice(), xiShen: [] });
  var yj = getYongJi(b);
  var chongReason = (pat.breakReasons || []).filter(function (r) { return r.indexOf('月令受') >= 0 && r.indexOf('冲') >= 0; });
  var tgWx = TONG_GUAN[pat.monthZhi] || null;
  var rescueNotes = cs.l3Details.filter(function (d) { return d.note.indexOf('月令受冲') >= 0; });
  var jy = jiuYingOf(cs);
  var rescueTotal = tgWx ? (jy[tgWx] || 0) : 0;
  var isCong = cong.isCong;
  var wCur = isCong ? (yj.yongShen[0] || '') : cs.yongWx;
  var w0 = scaledWinner(cs, jy, rootQ, 0).winner;
  var w4 = scaledWinner(cs, jy, rootQ, 4 / 6).winner;
  var w3 = scaledWinner(cs, jy, rootQ, 3 / 6).winner;
  var w1 = scaledWinner(cs, jy, rootQ, 1).winner;
  // 自校验：scale=1 应与引擎一致（非从格）
  var check = isCong ? 'N/A(从格)' : (w1 === wCur ? '✅' : '❌' + w1 + '≠' + wCur);
  // false negative：现状救应元素=赢家，缩放到 k 后不再是赢家
  var fn4 = (tgWx && !isCong && wCur === tgWx && w4 !== tgWx) ? true : false;
  var fn3 = (tgWx && !isCong && wCur === tgWx && w3 !== tgWx) ? true : false;
  rows.push({
    id: id, group: group, gz: c[2],
    strength: dmStr.score, level: dmStr.level, d: cs.d,
    pattern: pat.name, status: pat.status, cong: isCong,
    breakReasons: pat.breakReasons, chongReason: chongReason,
    tgWx: tgWx, tgRoot: tgWx ? (rootQ[tgWx] ? rootQ[tgWx].score : 0) : null,
    rescue: rescueNotes.length > 0, rescueTotal: rescueTotal,
    SNeed: cs.SNeed, jiuYing: jy,
    yong: yj.yongShen, xi: yj.xiShen, ji: yj.jiShen,
    wCur: wCur, w0: w0, w4: w4, w3: w3,
    check: check, fn4: fn4, fn3: fn3
  });
});

// ===== 落组验证 =====
console.log('===== 落组验证 =====');
var failed = 0;
rows.forEach(function (r) {
  if (r.error) { console.log(r.id + ' [❌ 构造错误] ' + r.error); failed++; return; }
  var issues = [];
  if (r.group === 'A') {
    if (r.level === '中和') issues.push('strength=' + r.strength + ' 仍中和');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
    if (!r.rescue) issues.push('救应未触发');
    if (r.tgRoot < 1.5) issues.push('通关' + r.tgWx + ' rootScore=' + r.tgRoot + ' 无真实根');
    if (r.cong) issues.push('从格覆盖，救应清零');
  } else if (r.group === 'B') {
    if (r.level !== '中和') issues.push('strength=' + r.strength + '(' + r.level + ') 非中和');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
    if (!r.rescue) issues.push('救应未触发');
  } else if (r.group === 'C') {
    if (r.rescueTotal < 12) issues.push('jiuYing[' + r.tgWx + ']=' + r.rescueTotal + ' 未叠加(<12)');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
  }
  if (issues.length) { console.log(r.id + ' [⚠ ' + r.group + ' 落组问题] ' + issues.join('；')); failed++; }
});
console.log(failed === 0 ? '✅ 全部落组通过' : '⚠ ' + failed + ' 盘需调整');
console.log('');

// ===== 自校验 =====
var checkBad = rows.filter(function (r) { return !r.error && r.check.indexOf('❌') >= 0; });
console.log('===== 反事实自校验（scale=1 应=引擎现状） =====');
console.log(checkBad.length === 0 ? '✅ 全部一致' : '⚠ ' + checkBad.length + ' 盘不一致：' + checkBad.map(function (r) { return r.id; }).join(' '));
console.log('');

// ===== 逐盘表 =====
console.log('===== 逐盘表（赢家四列：cur/无L3/+4/+3） =====');
rows.forEach(function (r) {
  if (r.error) return;
  console.log(r.id + ' ' + r.gz + ' | ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + (r.cong ? '【从格】' : '') + ' | 通关' + r.tgWx + '根' + r.tgRoot + ' jiuYing=' + r.rescueTotal);
  console.log('  W: cur=' + r.wCur + ' 无L3=' + r.w0 + ' +4=' + r.w4 + ' +3=' + r.w3 + (r.fn4 ? ' 【FN4】' : '') + (r.fn3 ? ' 【FN3】' : '') + ' [' + r.check + ']');
  console.log('  jiuYing明细: ' + (Object.keys(r.jiuYing).filter(function (k) { return r.jiuYing[k] > 0; }).map(function (k) { return k + '+' + r.jiuYing[k]; }).join(' ') || '(空)'));
});

// ===== 汇总 =====
console.log('');
console.log('===== 汇总 =====');
['A', 'B', 'C'].forEach(function (g) {
  var rs = rows.filter(function (r) { return r.group === g && !r.error; });
  var flip = function (key) { return rs.filter(function (r) { return !r.cong && r[key] !== r.w0; }); };
  var fCur = flip('wCur'), f4 = flip('w4'), f3 = flip('w3');
  var fn4 = rs.filter(function (r) { return r.fn4; });
  var fn3 = rs.filter(function (r) { return r.fn3; });
  var rescueWinsCur = rs.filter(function (r) { return !r.cong && r.wCur === r.tgWx; });
  var rescueWins3 = rs.filter(function (r) { return !r.cong && r.w3 === r.tgWx; });
  console.log(g + ' 组 n=' + rs.length + ' | 翻转 vs 无L3: 现状' + fCur.length + ' / +4:' + f4.length + ' / +3:' + f3.length + ' | FN4:' + fn4.length + ' FN3:' + fn3.length + ' | 救应元素赢家: 现状' + rescueWinsCur.length + ' → +3:' + rescueWins3.length);
  if (fn4.length) console.log('  FN4 盘: ' + fn4.map(function (r) { return r.id + '(' + r.wCur + '→' + r.w4 + ')'; }).join(' '));
  if (fn3.length) console.log('  FN3 盘: ' + fn3.map(function (r) { return r.id + '(' + r.wCur + '→' + r.w3 + ')'; }).join(' '));
});

fs.writeFileSync(path.join(__dirname, 'p5c03-output.json'), JSON.stringify(rows, null, 2));
console.log('\n完整 JSON 已存 _p5/p5c03-output.json');
