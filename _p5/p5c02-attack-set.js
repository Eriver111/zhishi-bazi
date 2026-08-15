// P5-C02 破格救应 +6 专项攻击集（EVIDENCE ONLY，2026-08-15，GPT P5-C01 终裁批准）
// 目标：验证 P5-C-H1——「在中和附近，固定 L3 破格救应 +6 是否过强，从而让局部结构救应压倒全局五行需求」
// 纪律：只输出事实字段，零引擎改动；不改 L3/阈值/root weighting/旺衰。
// 四组：A 中和+月令受冲+通关弱根  B 中和+同break+通关根强  C 偏弱/偏强+同break  D break对照（杂气冲/无冲/其他救应键/从格覆盖）
// 每盘字段（GPT §8）：strengthScore/d/pattern/status/breakReasons/L1-L4/total/L3触发规则/L3救应元素/rootScore/yong/xi/ji/winnerWithoutL3/winnerWithL3
// 用法：node _p5/p5c02-attack-set.js
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

// 反事实：移除全部 L3（含救应分）后，用同一 argmax + F11 决胜链（L2→救应0→根气→固定序）求 winner
function counterfactualWinner(cs, rootQ) {
  var S = {};
  WX.forEach(function (wx) { S[wx] = cs.L1[wx] + cs.L2[wx]; });
  var maxS = -Infinity;
  WX.forEach(function (wx) { if (S[wx] > maxS) maxS = S[wx]; });
  var pool = WX.filter(function (wx) { return S[wx] === maxS; });
  var chain = [
    { name: 'L2', get: function (wx) { return cs.L2[wx]; } },
    { name: '救应', get: function () { return 0; } },
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
  // ===== A 中和区 + 月令受冲 + 通关五行弱根/无支根 =====
  ['A01', 'A', '甲申 庚午 甲子 乙丑'],
  ['A02', 'A', '壬子 壬午 壬午 壬戌'],
  ['A03', 'A', '癸酉 壬午 癸丑 壬子'],
  ['A04', 'A', '甲申 庚午 甲子 甲戌'],
  ['A05', 'A', '壬午 丁酉 壬午 丁卯'],
  ['A06', 'A', '戊午 甲子 甲午 庚午'],
  ['A07', 'A', '戊午 甲子 丙午 丙午'],
  ['A08', 'A', '庚午 甲子 庚辰 戊子'],
  ['A09', 'A', '壬午 戊子 戊午 庚辰'],
  ['A10', 'A', '壬寅 戊申 丙午 甲午'],
  ['A11', 'A', '乙卯 丁酉 壬寅 戊申'],
  // ===== B 中和区 + 同 break + 通关五行根强 =====
  ['B01', 'B', '甲寅 庚午 甲子 乙丑'],
  ['B02', 'B', '丙寅 甲午 甲子 乙巳'],
  ['B03', 'B', '甲寅 丙午 甲子 丙戌'],
  ['B04', 'B', '壬寅 戊午 壬子 癸卯'],
  ['B05', 'B', '癸卯 壬午 癸丑 壬子'],
  ['B06', 'B', '壬寅 戊午 壬子 甲辰'],
  ['B07', 'B', '壬子 丁卯 丁酉 癸卯'],
  ['B08', 'B', '乙亥 壬午 戊子 癸丑'],
  ['B09', 'B', '丙寅 戊申 戊戌 壬子'],
  ['B10', 'B', '戊寅 丙子 甲午 己巳'],
  // ===== C 偏弱/偏强区 + 同 break =====
  ['C01', 'C', '甲寅 丙午 甲子 甲寅'],
  ['C02', 'C', '乙卯 壬午 丙子 甲午'],
  ['C03', 'C', '戊午 戊午 戊子 丙午'],
  ['C04', 'C', '庚申 甲午 庚子 庚辰'],
  ['C05', 'C', '戊申 壬午 甲子 庚午'],
  ['C06', 'C', '己酉 庚午 甲子 辛未'],
  ['C07', 'C', '壬子 戊午 辛酉 己丑'],
  ['C08', 'C', '丙寅 甲午 丙子 甲午'],
  ['C09', 'C', '甲子 庚午 壬午 丙午'],
  ['C10', 'C', '壬子 丙午 戊申 庚申'],
  ['C11', 'C', '癸卯 乙酉 庚午 丙戌'],
  ['C12', 'C', '庚申 庚午 甲子 庚午'],
  // ===== D break 对照组 =====
  ['D01', 'D', '己丑 丁未 甲午 辛未'],
  ['D02', 'D', '庚辰 壬戌 丙子 戊子'],
  ['D03', 'D', '戊戌 乙未 丙午 己丑'],
  ['D04', 'D', '己丑 辛未 癸巳 己未'],
  ['D05', 'D', '壬申 己酉 丙午 甲午'],
  ['D06', 'D', '甲申 庚午 甲辰 乙丑'],
  ['D07', 'D', '戊辰 癸亥 甲子 壬申'],
  ['D08', 'D', '丙寅 壬辰 庚戌 戊寅'],
  ['D09', 'D', '庚子 辛丑 壬午 己未'],
  ['D10', 'D', '甲子 丙寅 甲寅 壬子']
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
  var cf = counterfactualWinner(cs, rootQ);
  // 从格走 getYongJi 短路（不用候选评分），winnerWith 记从格路径赢家，flip 记为 N/A
  var winnerWith = cong.isCong ? (yj.yongShen[0] || '') : cs.yongWx;
  var flip = cong.isCong ? 'N/A(从格短路)' : (winnerWith !== cf.winner);
  rows.push({
    id: id, group: group, gz: c[2],
    strength: dmStr.score, level: dmStr.level, d: cs.d,
    pattern: pat.name, status: pat.status, cong: cong.isCong,
    breakReasons: pat.breakReasons,
    chongReason: chongReason,
    tgWx: tgWx, tgRoot: tgWx ? (rootQ[tgWx] ? rootQ[tgWx].score : 0) : null,
    rescue: rescueNotes.length > 0, rescueNotes: rescueNotes,
    L1: cs.L1, L2: cs.L2, L3: cs.L3, L4: cs.L4, SNeed: cs.SNeed,
    l3Details: cs.l3Details, jiuYing: cs.jiuYing,
    rootScores: { '木': rootQ['木'].score, '火': rootQ['火'].score, '土': rootQ['土'].score, '金': rootQ['金'].score, '水': rootQ['水'].score },
    yong: yj.yongShen, xi: yj.xiShen, ji: yj.jiShen,
    winnerWithL3: winnerWith,
    winnerWithoutL3: cf.winner, SWithout: cf.S,
    flip: flip
  });
});

// ===== 落组验证 =====
console.log('===== 落组验证 =====');
var failed = 0;
rows.forEach(function (r) {
  if (r.error) { console.log(r.id + ' [❌ 构造错误] ' + r.error); failed++; return; }
  var issues = [];
  if (r.group === 'A') {
    if (r.level !== '中和') issues.push('strength=' + r.strength + '(' + r.level + ') 非中和');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
    if (!r.rescue) issues.push('救应未触发');
    if (r.tgRoot > 1.5) issues.push('通关' + r.tgWx + ' rootScore=' + r.tgRoot + ' 偏强');
  } else if (r.group === 'B') {
    if (r.level !== '中和') issues.push('strength=' + r.strength + '(' + r.level + ') 非中和');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
    if (!r.rescue) issues.push('救应未触发');
    if (r.tgRoot < 2) issues.push('通关' + r.tgWx + ' rootScore=' + r.tgRoot + ' 偏弱');
  } else if (r.group === 'C') {
    if (r.level === '中和') issues.push('strength=' + r.strength + ' 仍中和');
    if (r.chongReason.length === 0) issues.push('无月令受冲reason');
    if (!r.rescue) issues.push('救应未触发');
  } else if (r.group === 'D') {
    if (r.chongReason.length > 0 && r.rescue) issues.push('月令受冲+救应同时存在（应为对照）');
  }
  if (issues.length) { console.log(r.id + ' [⚠ ' + r.group + ' 落组问题] ' + issues.join('；')); failed++; }
});
console.log(failed === 0 ? '✅ 全部落组通过' : '⚠ ' + failed + ' 盘需调整');
console.log('');

// ===== 逐盘事实表 =====
console.log('===== 逐盘事实表 =====');
rows.forEach(function (r) {
  if (r.error) return;
  var s = ['木', '火', '土', '金', '水'].map(function (wx) {
    return wx + ':' + r.SNeed[wx].toFixed(0) + '(' + r.L1[wx].toFixed(0) + '+' + r.L2[wx].toFixed(1) + '+' + r.L3[wx].toFixed(1) + '+' + r.L4[wx].toFixed(1) + ')';
  }).join(' ');
  console.log(r.id + ' ' + r.gz + ' | ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + (r.cong ? '【从格】' : '') + ' | 通关' + r.tgWx + '根' + r.tgRoot);
  console.log('  break: ' + (r.breakReasons.length ? r.breakReasons.join('；') : '(无)'));
  console.log('  S_need: ' + s);
  console.log('  L3明细: ' + (r.l3Details.length ? r.l3Details.map(function (d) { return d.wx + '+' + d.val + '「' + d.note + '」'; }).join('；') : '(空)'));
  console.log('  roots: ' + ['木', '火', '土', '金', '水'].map(function (wx) { return wx + r.rootScores[wx]; }).join(' '));
  console.log('  yong=' + r.yong.join('/') + ' xi=' + (r.xi.length ? r.xi.join('/') : '(空)') + ' ji=' + (r.ji.length ? r.ji.join('/') : '(空)') + ' | 无L3赢家=' + r.winnerWithoutL3 + ' 有L3赢家=' + r.winnerWithL3 + ' ' + (r.flip === true ? '【翻转】' : ''));
});

// ===== 汇总统计 =====
console.log('');
console.log('===== 汇总（按组） =====');
['A', 'B', 'C', 'D'].forEach(function (g) {
  var rs = rows.filter(function (r) { return r.group === g && !r.error; });
  var flips = rs.filter(function (r) { return r.flip === true; });
  var weak = rs.filter(function (r) { return r.strength < 50; });
  console.log(g + ' 组 n=' + rs.length + ' | 翻转 ' + flips.length + '/' + rs.length + ' | 弱侧' + weak.length + '/强侧' + (rs.length - weak.length) + ' | 翻转盘: ' + flips.map(function (r) { return r.id + '(' + r.winnerWithoutL3 + '→' + r.winnerWithL3 + ')'; }).join(' '));
});

fs.writeFileSync(path.join(__dirname, 'p5c02-output.json'), JSON.stringify(rows, null, 2));
console.log('\n完整 JSON 已存 _p5/p5c02-output.json');
