// P5-C05 救应方向门控攻击集（EVIDENCE ONLY，2026-08-16，GPT P5-C04 终裁批准）
// 终裁口径：不采用纯质量三档；采用「方向优先(direction gate) → 质量系数缩放」。
//   gate = 复用引擎 F4 方向基准：L1[通关] >= 0（生扶组在偏弱、克泄耗组在偏强为方向无矛盾；d=0 时 L1 全 0 → 全部放行）
//   通过 → jiuYing × qualityFactor(A 透+根=1 / B 藏干有根=0.7 / C 无承载=0.3)（GPT 批准表）
//   不通过 → 0（F6 先例模式：l3Details note 保留、val=0）
// 三反事实：wCur(现状+6) / wQual(纯质量缩放无gate——被终裁否决的方案) / wGateQ(gate+质量——终裁方向)
// 三攻击组（GPT 指定，不扩随机盘）：
//   G1 救应元素强但方向错（质量高 ≠ 应该获救）
//   G2 救应元素弱但方向对（质量低 ≠ 应该取消）
//   G3 冲突盘对（同结构仅方向/根气不同，看 gate 能否区分）
// 附：全样本影响面（C02 43 + C03 60 + C04 46 去重）+ 5 键救应方向审计 + 两锚点盘（GPT 指定回归锚点）
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
var TONG_GUAN = { '寅': '水', '申': '水', '子': '木', '午': '木', '卯': '水', '酉': '水', '巳': '木', '亥': '木' };

var JIUYING_PREFIX = ['月令受冲，', '伤官克官，', '枭神夺食，', '财星破印，', '七杀无制化，'];
var JIUYING_KEY = ['月令受冲', '伤官克官', '枭神夺食', '财星破印', '七杀无制化'];
function jiuYingOf(cs) {
  var jy = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  (cs.l3Details || []).forEach(function (d) {
    JIUYING_PREFIX.forEach(function (p) {
      if (d.note.indexOf(p) === 0) jy[d.wx] += d.val;
    });
  });
  return jy;
}

function scaledWinner(cs, jy, rootQ, scaleOf) {
  var S = {};
  WX.forEach(function (wx) {
    var rescue = jy[wx] || 0;
    S[wx] = cs.L1[wx] + cs.L2[wx] + (cs.L3[wx] - rescue) + rescue * scaleOf(wx);
  });
  var maxS = -Infinity, second = -Infinity;
  WX.forEach(function (wx) {
    if (S[wx] > maxS) { second = maxS; maxS = S[wx]; }
    else if (S[wx] > second) second = S[wx];
  });
  var pool = WX.filter(function (wx) { return S[wx] === maxS; });
  var chain = [
    { name: 'L2', get: function (wx) { return cs.L2[wx]; } },
    { name: '救应', get: function (wx) { return (jy[wx] || 0) * scaleOf(wx); } },
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

var QUALITY = { A: 1, B: 0.7, C: 0.3 };

// [id, set, gz]
// G1 强但错向（质量 A/B 高 × 方向错）；G2 弱但对向（C 类 × 方向对）；G3 冲突对
var CHARTS = [
  ['G1-01', 'G1', '甲申 庚午 甲子 甲戌'],
  ['G1-02', 'G1', '甲寅 庚午 甲子 乙丑'],
  ['G1-03', 'G1', '戊午 甲子 甲午 庚午'],
  ['G1-04', 'G1', '丙寅 戊申 戊辰 壬子'],
  ['G1-05', 'G1', '丙子 丁巳 癸亥 甲寅'],
  ['G1-06', 'G1', '庚子 壬午 壬辰 戊午'],
  ['G1-07', 'G1', '己巳 乙亥 甲子 戊辰'],
  ['G1-08', 'G1', '甲寅 戊申 戊辰 壬子'],
  ['G1-09', 'G1', '丙寅 庚申 戊子 甲寅'],
  ['G2-01', 'G2', '戊午 戊子 丙午 戊戌'],
  ['G2-02', 'G2', '己卯 乙酉 甲寅 戊午'],
  ['G2-03', 'G2', '己卯 辛酉 庚寅 戊午'],
  ['G2-04', 'G2', '己卯 丁酉 丁巳 戊午'],
  ['G2-05', 'G2', '己卯 辛酉 庚午 戊午'],
  ['G2-06', 'G2', '己卯 辛酉 戊戌 戊午'],
  ['G2-07', 'G2', '庚子 壬午 壬子 戊申'],
  ['G2-08', 'G2', '戊子 戊午 己丑 己巳'],
  ['G2-09', 'G2', '壬午 壬子 丙午 戊戌'],
  ['G2-10', 'G2', '己卯 乙酉 甲午 戊午'],
  ['G2-11', 'G2', '丙子 庚午 乙丑 丙子'],
  ['G3-A1', 'G3', '丙子 丁巳 癸亥 甲寅'],
  ['G3-B1', 'G3', '庚子 壬午 壬子 戊申'],
  ['G3-A2', 'G3', '甲寅 戊申 戊辰 壬子'],
  ['G3-B2', 'G3', '丙寅 戊申 戊戌 戊午'],
  ['G3-A3', 'G3', '甲寅 庚午 甲子 乙丑'],
  ['G3-B3', 'G3', '甲申 庚午 甲子 乙丑'],
  ['ANCHOR-A03', 'ANCHOR', '甲申 庚午 甲子 乙丑'],
  ['ANCHOR-D11', 'ANCHOR', '戊子 丁巳 癸亥 庚申']
];

function computeOne(gz) {
  var b, err = null;
  try { b = build(gz); } catch (e) { return { gz: gz, error: e.message }; }
  var dmStr = calcDayMasterStrength(b);
  var pat = getPattern(b);
  var cong = getCongGe(b);
  var cs = calcCandidateScores(b, dmStr, pat);
  var rootQ = evaluateYongShenQuality(b, { yongShen: WX.slice(), xiShen: [] });
  var yj = getYongJi(b);
  var tgWx = TONG_GUAN[pat.monthZhi] || null;
  var jy = jiuYingOf(cs);
  var isCong = cong.isCong;
  var wCur = isCong ? (yj.yongShen[0] || '') : cs.yongWx;
  var gans = gz.split(' ').map(function (p) { return p[0]; }).join('');
  var ganVisible = tgWx ? GAN_OF[tgWx].split('').some(function (g) { return gans.indexOf(g) >= 0; }) : false;
  var tgRoot = tgWx ? (rootQ[tgWx] ? rootQ[tgWx].score : 0) : 0;
  // gate = 引擎 F4 方向基准复用：L1[wx] >= 0；质量=该元素自身透/根（逐元素判定，非仅通关）
  var visibleOf = function (wx) { return GAN_OF[wx].split('').some(function (g) { return gans.indexOf(g) >= 0; }); };
  var rootOf = function (wx) { return rootQ[wx] ? rootQ[wx].score : 0; };
  var qualityOf = function (wx) { return visibleOf(wx) ? 1 : (rootOf(wx) >= 1 ? 0.7 : 0.3); };
  var gateOf = function (wx) { return cs.L1[wx] >= 0; };
  var scaleAll1 = function () { return 1; };
  var scaleAll0 = function () { return 0; };
  var scaleQual = function (wx) { return qualityOf(wx); };
  var scaleGateQ = function (wx) { return gateOf(wx) ? qualityOf(wx) : 0; };
  var gatePass = tgWx ? gateOf(tgWx) : false;
  var cls = gatePass ? (ganVisible ? 'A' : (tgRoot >= 1 ? 'B' : 'C')) : 'D';
  var factor = gatePass ? QUALITY[cls] : 0;
  var w1 = scaledWinner(cs, jy, rootQ, scaleAll1);
  var w0 = scaledWinner(cs, jy, rootQ, scaleAll0);
  var wQual = scaledWinner(cs, jy, rootQ, scaleQual);
  var wGateQ = scaledWinner(cs, jy, rootQ, scaleGateQ);
  var fnQual = (tgWx && !isCong && wCur === tgWx && wQual.winner !== tgWx);
  var fnGateQ = (tgWx && !isCong && wCur === tgWx && wGateQ.winner !== tgWx);
  return {
    gz: gz, error: null, strength: dmStr.score, level: dmStr.level, d: cs.d,
    pattern: pat.name, status: pat.status, cong: isCong, chong: pat.breakReasons && pat.breakReasons.some(function (r) { return r.indexOf('月令受') >= 0 && r.indexOf('冲') >= 0; }),
    tgWx: tgWx, tgRoot: tgRoot, ganVisible: ganVisible, gatePass: gatePass, cls: cls, factor: factor,
    jiuYing: jy[tgWx] || 0, L1: cs.L1,
    wCur: wCur, w0: w0.winner, wQual: wQual.winner, wGateQ: wGateQ.winner,
    marginCur: w1.margin, marginQual: wQual.margin, marginGateQ: wGateQ.margin,
    check: (w1.winner === wCur) ? '✅' : '❌' + w1.winner + '≠' + wCur,
    fnQual: fnQual, fnGateQ: fnGateQ, rootDetail: tgWx ? rootQ[tgWx] : null
  };
}

var rows = CHARTS.map(function (c) {
  var r = computeOne(c[2]);
  r.id = c[0]; r.set = c[1];
  return r;
});

// ===== 自校验 =====
console.log('===== 反事实自校验（scale=1 应=引擎现状） =====');
var bad = rows.filter(function (r) { return r.error || r.check.indexOf('❌') >= 0; });
console.log(bad.length === 0 ? '✅ 全部一致（' + rows.length + ' 盘）' : '⚠ 不一致：' + bad.map(function (r) { return r.id; }).join(' '));
console.log('');

// ===== 组落位验证 =====
console.log('===== 组落位验证 =====');
var vBad = 0;
rows.forEach(function (r) {
  var issues = [];
  if (r.error) { issues.push('构造错误 ' + r.error); }
  if (!r.chong) issues.push('无月令受冲reason');
  if (r.jiuYing < 6) issues.push('jiuYing=' + r.jiuYing + ' 救应未触发');
  if (r.cong) issues.push('从格覆盖');
  if (r.set === 'G1' && r.gatePass) issues.push('方向对（应错）');
  if (r.set === 'G2' && !r.gatePass) issues.push('方向错（应对）');
  if (issues.length) { console.log(r.id + ' [⚠] ' + issues.join('；') + ' | ' + r.gz + ' ' + r.strength + r.level + ' d=' + r.d.toFixed(2)); vBad++; }
});
console.log(vBad === 0 ? '✅ 全部落位' : '⚠ ' + vBad + ' 盘需调整');
console.log('');

// ===== 逐盘表 =====
console.log('===== 逐盘表（gate=方向门控，factor=门控后质量系数） =====');
rows.forEach(function (r) {
  if (r.error) return;
  console.log(r.id + '[' + r.set + '] ' + r.gz + ' | ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + ' | 通关' + r.tgWx + ': 透' + (r.ganVisible ? '✓' : '✗') + ' 根' + r.tgRoot + ' L1=' + r.L1[r.tgWx] + ' gate' + (r.gatePass ? '✓' : '✗') + ' 类' + r.cls + ' 系数' + r.factor + ' jiuYing=' + r.jiuYing);
  console.log('  W: cur=' + r.wCur + ' 无L3=' + r.w0 + ' 纯质量(' + (r.gatePass ? r.factor : (r.ganVisible ? '1' : (r.tgRoot >= 1 ? '0.7' : '0.3'))) + ')=' + r.wQual + ' gate+质量=' + r.wGateQ + (r.fnQual ? ' 【FN·纯质量】' : '') + (r.fnGateQ ? ' 【FN·gate】' : '') + ' | 边际 cur=' + r.marginCur + ' Q=' + r.marginQual + ' GQ=' + r.marginGateQ + ' [' + r.check + ']');
});

// ===== 汇总 =====
console.log('');
console.log('===== 汇总 =====');
function summary(setName, rs) {
  var flipCur = rs.filter(function (r) { return !r.cong && r.wCur !== r.w0; });
  var wrongFlipCur = flipCur.filter(function (r) { return r.gatePass === false; });
  var fnQual = rs.filter(function (r) { return r.fnQual; });
  var fnGateQ = rs.filter(function (r) { return r.fnGateQ; });
  var rescueWins = rs.filter(function (r) { return !r.cong && r.wCur === r.tgWx; });
  var gateRescueWins = rs.filter(function (r) { return !r.cong && r.wGateQ === r.tgWx; });
  console.log(setName + ' n=' + rs.length + ' | 现状翻转 ' + flipCur.length + '(错向' + wrongFlipCur.length + ') | 纯质量FN ' + fnQual.length + ' | gate+质量FN ' + fnGateQ.length + ' | 救应赢家 ' + rescueWins.length + '→' + gateRescueWins.length);
  if (fnQual.length) console.log('  纯质量残留错向: ' + fnQual.map(function (r) { return r.id + '(' + r.wCur + '→' + r.wQual + ')'; }).join(' '));
  if (fnGateQ.length) console.log('  gate+质量FN: ' + fnGateQ.map(function (r) { return r.id + '(' + r.wCur + '→' + r.wGateQ + ')'; }).join(' '));
}
summary('G1 强但错向', rows.filter(function (r) { return r.set === 'G1' && !r.error; }));
summary('G2 弱但对向', rows.filter(function (r) { return r.set === 'G2' && !r.error; }));
['A1', 'B1', 'A2', 'B2', 'A3', 'B3'].forEach(function (pid) {
  var rs = rows.filter(function (r) { return r.id === 'G3-' + pid; });
  if (rs.length) summary('G3-' + pid, rs);
});

// ===== 5 键救应方向审计（全样本） =====
console.log('');
console.log('===== 5 键救应方向审计（全样本，L1 方向基准） =====');
var IMPACT_GZ = [];
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) IMPACT_GZ.push(r.gz); });
});
var uniq = {};
IMPACT_GZ.forEach(function (gz) { uniq[gz] = true; });
var gzList = Object.keys(uniq);
console.log('全样本 ' + gzList.length + ' 盘（C02+C03+C04 去重）');
var audit = { '月令受冲': { n: 0, wrong: 0 }, '伤官克官': { n: 0, wrong: 0 }, '枭神夺食': { n: 0, wrong: 0 }, '财星破印': { n: 0, wrong: 0 }, '七杀无制化': { n: 0, wrong: 0 } };
var impactRows = [];
gzList.forEach(function (gz) {
  var r = computeOne(gz);
  if (r.error) return;
  impactRows.push(r);
  if (!r.cong) {
    var cs = calcCandidateScores(build(gz), calcDayMasterStrength(build(gz)), getPattern(build(gz)));
    (cs.l3Details || []).forEach(function (d) {
      JIUYING_PREFIX.forEach(function (p, i) {
        if (d.note.indexOf(p) === 0) {
          audit[JIUYING_KEY[i]].n++;
          if (cs.L1[d.wx] < 0) audit[JIUYING_KEY[i]].wrong++;
        }
      });
    });
  }
});
JIUYING_KEY.forEach(function (k) {
  console.log('  ' + k + '：note ' + audit[k].n + ' 条，方向错 ' + audit[k].wrong + ' 条（' + (audit[k].n ? Math.round(100 * audit[k].wrong / audit[k].n) : 0) + '%）');
});

// ===== 全样本影响面（gate+质量 vs 现状） =====
console.log('');
console.log('===== 全样本影响面（gate+质量 vs 现状赢家） =====');
var diffs = impactRows.filter(function (r) { return !r.cong && r.wGateQ !== r.wCur; });
var jiuCuo = diffs.filter(function (r) { return r.L1[r.wCur] < 0 && r.L1[r.wGateQ] >= 0; });
var huanWei = diffs.filter(function (r) { return (r.L1[r.wCur] >= 0 && r.L1[r.wGateQ] >= 0) || (r.L1[r.wCur] < 0 && r.L1[r.wGateQ] < 0); });
var sunShang = diffs.filter(function (r) { return r.L1[r.wCur] >= 0 && r.L1[r.wGateQ] < 0; });
console.log('差异盘 ' + diffs.length + '：纠错 ' + jiuCuo.length + ' / 换位 ' + huanWei.length + ' / 损伤 ' + sunShang.length + (sunShang.length === 0 ? ' ✅' : ' ❌❌❌'));
diffs.forEach(function (r) {
  var kind = sunShang.indexOf(r) >= 0 ? '【损伤】' : (jiuCuo.indexOf(r) >= 0 ? '纠错' : '换位');
  console.log('  ' + kind + ' ' + r.gz + ' ' + r.strength + r.level + ' 通关' + r.tgWx + ' gate' + (r.gatePass ? '✓' : '✗') + ' ' + r.wCur + '→' + r.wGateQ);
});

// ===== 锚点盘详情 =====
console.log('');
console.log('===== 锚点盘详情（GPT 指定回归锚点） =====');
rows.forEach(function (r) {
  if (r.set !== 'ANCHOR' || r.error) return;
  console.log(r.id + ' ' + r.gz + '：');
  console.log('  ' + r.strength + r.level + ' d=' + r.d.toFixed(2) + ' | ' + r.pattern + '·' + r.status + (r.cong ? '【从格】' : ''));
  console.log('  通关' + r.tgWx + '：透' + (r.ganVisible ? '✓' : '✗') + ' 根score=' + r.tgRoot + ' L1=' + r.L1[r.tgWx] + ' → gate' + (r.gatePass ? '通过' : '不通过') + ' 类' + r.cls + ' 系数' + r.factor + ' jiuYing=' + r.jiuYing);
  console.log('  W: cur=' + r.wCur + ' 无L3=' + r.w0 + ' 纯质量=' + r.wQual + ' gate+质量=' + r.wGateQ + ' | 边际 cur=' + r.marginCur + ' Q=' + r.marginQual + ' GQ=' + r.marginGateQ + ' [' + r.check + ']');
});

fs.writeFileSync(path.join(__dirname, 'p5c05-output.json'), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(__dirname, 'p5c05-impact.json'), JSON.stringify({ diffs: diffs.map(function (r) { return { gz: r.gz, strength: r.strength, level: r.level, tgWx: r.tgWx, gatePass: r.gatePass, wCur: r.wCur, wGateQ: r.wGateQ }; }) }, null, 2));
console.log('\nJSON 已存 _p5/p5c05-output.json + p5c05-impact.json');
