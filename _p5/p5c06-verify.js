// P5-C06 回归验证（2026-08-16，GPT 终裁四层门槛）
// 旧引擎 = _p5/bazi.pre-c06.js（冻结字节 2398e8c7…），新引擎 = js/bazi.js（addJiuYing 方向门控+质量缩放）。
// 层① C05 28盘：NEW 赢家 vs C05 wGateQ 预测（gate-fail 必一致；gate-pass 允许引擎 rootScore 口径降权分歧，逐盘解释）。
// 层② 105盘影响面：差异必须全部可解释为错向救应消失或质量降权；旺衰/pattern/status/非L3字段零漂移。
// 层③ 历史回归（p5b_diff 同口径）：53冻结 + 50盲测 + 20盲盘 + P5-A1 120 + P5-A2 120 + P5-A3 61 + P4-A 32。
// 层④ 两锚点：甲申庚午甲子乙丑（gate✓ 不误伤，仍木/忌空可接受）、戊子丁巳癸亥庚申（L1木<0 → 木救应归零 → 金）。
// 观察项：候选分布对 L1 依赖度（纠错/换位/损伤分类计数）。
// 硬失败（exit 1）：L0 漂移 / L3 量级不符 / 损伤 / 旧赢家无救应却变化 / 未解释的预测不一致 / 锚点不达标。
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');

var WX = ['木', '火', '土', '金', '水'];
var GAN_OF = { '木': '甲乙', '火': '丙丁', '土': '戊己', '金': '庚辛', '水': '壬癸' };
var JIUYING_PREFIX = ['月令受冲，', '伤官克官，', '枭神夺食，', '财星破印，', '七杀无制化，'];
var JIUYING_KEY = ['月令受冲', '伤官克官', '枭神夺食', '财星破印', '七杀无制化'];
var GATE_FAIL_SUFFIX = '（方向门控不通过，救应不加分）';
var TOL = 1e-9;

// ---- 引擎双加载（先 OLD 捕获引用，再 NEW；eval 词法闭包保证 OLD 内部互调旧函数）----
function loadEngine(src) {
  global.window = global;
  var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores','evaluateYongShenQuality','getCangGan','finalizeYongJiResult'".slice(1, -1).split("','").map(function (n) {
    return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
  }).join('\n');
  eval(src.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  return {
    buildFromPillars: BaZiCalculator.buildFromPillars,
    getYongJi: getYongJi, calcDayMasterStrength: calcDayMasterStrength, getCongGe: getCongGe,
    getPattern: getPattern, calcCandidateScores: calcCandidateScores,
    evaluateYongShenQuality: evaluateYongShenQuality, getCangGan: getCangGan, finalizeYongJiResult: finalizeYongJiResult
  };
}
var OLD = loadEngine(fs.readFileSync(path.join(ROOT, '_p5', 'bazi.pre-c06.js'), 'utf8'));
var NEW = loadEngine(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));

function build(E, gz) {
  var p = gz.split(' ');
  return E.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
var cache = {};
function compute(E, gz) {
  var k = (E === OLD ? 'O' : 'N') + '|' + gz;
  if (cache[k]) return cache[k];
  var b = build(E, gz);
  var r = {
    b: b,
    dm: E.calcDayMasterStrength(b),
    pt: E.getPattern(b),
    cg: E.getCongGe(b),
    cs: null,
    yj: null
  };
  r.cs = E.calcCandidateScores(b, r.dm, r.pt);
  r.yj = E.getYongJi(b);
  cache[k] = r;
  return r;
}

function close(a, b) { return Math.abs(a - b) < TOL; }
function isRescueNote(note) { return JIUYING_PREFIX.some(function (p) { return note.indexOf(p) === 0; }); }
function rescueOf(cs) {
  var jy = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  (cs.l3Details || []).forEach(function (d) { if (isRescueNote(d.note)) jy[d.wx] += d.val; });
  return jy;
}
function factorOf(E, b, wx) {
  var qr = E.evaluateYongShenQuality(b, { yongShen: [wx], xiShen: [] });
  var rs = (qr[wx] && qr[wx].score) || 0;
  return rs >= 4 ? 1 : (rs >= 2 ? 0.7 : 0.3);
}
// 期望 NEW 救应分（逐元素：L1 方向门控 × 引擎 rootScore 质量系数）
function predictJiuYing(b, csOld) {
  var factors = {};
  WX.forEach(function (wx) { factors[wx] = factorOf(NEW, b, wx); });
  var jyOld = rescueOf(csOld), jyNew = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  (csOld.l3Details || []).forEach(function (d) {
    if (isRescueNote(d.note)) {
      var wx = d.wx;
      jyNew[wx] += (csOld.L1[wx] < 0) ? 0 : d.val * factors[wx];
    }
  });
  return { jyOld: jyOld, jyNew: jyNew, factors: factors };
}
function expectL3(csOld, pred) {
  var exp = {};
  WX.forEach(function (wx) { exp[wx] = csOld.L3[wx] - pred.jyOld[wx] + pred.jyNew[wx]; });
  return exp;
}
function sideOf(SNeedVal) { return SNeedVal > 3 ? 'pos' : (SNeedVal < -3 ? 'neg' : 'mid'); }
function stripNum(s) { return String(s).replace(/-?\d+(?:\.\d+)?/g, '#'); }

// ---- C05 反事实重算（验证 p5c05-output.json 存储的 wGateQ 可复现）----
function c05QualityOf(gans, rootQ, wx) {
  var visible = GAN_OF[wx].split('').some(function (g) { return gans.indexOf(g) >= 0; });
  return visible ? 1 : ((rootQ[wx] && rootQ[wx].score >= 1) ? 0.7 : 0.3);
}
function c05ScaleGateQ(cs, gans, rootQ) {
  return function (wx) { return cs.L1[wx] >= 0 ? c05QualityOf(gans, rootQ, wx) : 0; };
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

// ---- 自校验：OLD 管道复现冻结行为，NEW 管道复现预期新行为 ----
(function selfCheck() {
  var A = '甲申 庚午 甲子 乙丑', D = '戊子 丁巳 癸亥 庚申';
  var oA = compute(OLD, A), nA = compute(NEW, A), oD = compute(OLD, D), nD = compute(NEW, D);
  var ok = true;
  if (oA.cs.L3['木'] !== 6) { console.error('❌ 自校验失败：OLD A03 L3木=' + oA.cs.L3['木'] + '（应 6）'); ok = false; }
  if (oD.cs.L3['木'] !== 6) { console.error('❌ 自校验失败：OLD D11 L3木=' + oD.cs.L3['木'] + '（应 6）'); ok = false; }
  if (!close(nA.cs.L3['木'], 1.8)) { console.error('❌ 自校验失败：NEW A03 L3木=' + nA.cs.L3['木'] + '（应 1.8）'); ok = false; }
  if (nD.cs.L3['木'] !== 0) { console.error('❌ 自校验失败：NEW D11 L3木=' + nD.cs.L3['木'] + '（应 0）'); ok = false; }
  if (!nD.cs.l3Details.some(function (d) { return d.wx === '木' && d.val === 0 && d.note.indexOf(GATE_FAIL_SUFFIX) >= 0; })) {
    console.error('❌ 自校验失败：NEW D11 缺少门控 note 条目'); ok = false;
  }
  if (!ok) process.exit(1);
  console.log('✅ 自校验通过（OLD=冻结行为 / NEW=门控+质量预期）\n');
})();

// ---- 逐盘对比 ----
var HARD = { lvl0: [], l3: [], l3Details: [], sbase: [], unexpected: [], damage: [], text: [], xiJi: [], cong: [], pred: [], anchor: [], audit: [] };
var changedRecs = [];   // 所有赢家变化盘
var xiJiCrossRecs = []; // 赢家未变但喜忌跨越中性带的盘

function verifyOne(gz) {
  var o, n;
  try { o = compute(OLD, gz); } catch (e) { return { gz: gz, error: 'OLD: ' + e.message }; }
  try { n = compute(NEW, gz); } catch (e) { return { gz: gz, error: 'NEW: ' + e.message }; }

  // —— L0 字节级零漂移（GPT 红线：旺衰/pattern/status/非L3字段）——
  if (JSON.stringify(o.b) !== JSON.stringify(n.b)) HARD.lvl0.push(gz + ' buildFromPillars');
  if (JSON.stringify(o.dm) !== JSON.stringify(n.dm)) HARD.lvl0.push(gz + ' dm(旺衰)');
  if (JSON.stringify(o.pt) !== JSON.stringify(n.pt)) HARD.lvl0.push(gz + ' pattern');
  if (JSON.stringify(o.cg) !== JSON.stringify(n.cg)) HARD.lvl0.push(gz + ' cong');
  ['d', 'g1', 'counts', 'L1', 'L2', 'L4', 'l2Details', 'l4Details', 'tiaoHouNote'].forEach(function (k) {
    if (JSON.stringify(o.cs[k]) !== JSON.stringify(n.cs[k])) HARD.lvl0.push(gz + ' cs.' + k);
  });
  ['dayMasterLevel', 'dayMasterScore', 'congGe', 'method', 'patternStatus', 'chainHints', 'chainAdjustments'].forEach(function (k) {
    if (JSON.stringify(o.yj[k]) !== JSON.stringify(n.yj[k])) HARD.lvl0.push(gz + ' yj.' + k);
  });

  // —— L1 层：L3 量级 = 旧 L3 − 旧救应 + 门控×质量救应 ——
  var pred = predictJiuYing(n.b, o.cs);
  var expL3 = expectL3(o.cs, pred);
  WX.forEach(function (wx) {
    if (!close(n.cs.L3[wx], expL3[wx])) HARD.l3.push(gz + ' L3.' + wx + ' 期望=' + expL3[wx] + ' 实际=' + n.cs.L3[wx]);
    if (!close(n.cs.SBase[wx], n.cs.L1[wx] + n.cs.L2[wx] + n.cs.L3[wx])) HARD.sbase.push(gz + ' SBase.' + wx);
    if (!close(n.cs.SNeed[wx], n.cs.SBase[wx] + n.cs.L4[wx])) HARD.sbase.push(gz + ' SNeed.' + wx);
  });

  // —— l3Details 逐条 ——
  var od = o.cs.l3Details || [], nd = n.cs.l3Details || [];
  if (od.length !== nd.length) {
    HARD.l3Details.push(gz + ' l3Details 长度 ' + od.length + '→' + nd.length);
  } else {
    od.forEach(function (d, i) {
      var dn = nd[i];
      if (!isRescueNote(d.note)) {
        if (JSON.stringify(d) !== JSON.stringify(dn)) HARD.l3Details.push(gz + ' #' + i + ' 非救应条目漂移: ' + JSON.stringify(d) + ' → ' + JSON.stringify(dn));
      } else {
        var wantVal = (o.cs.L1[d.wx] < 0) ? 0 : d.val * pred.factors[d.wx];
        var wantNote = (o.cs.L1[d.wx] < 0) ? d.note + GATE_FAIL_SUFFIX : d.note;
        if (!close(dn.val, wantVal) || dn.note !== wantNote) HARD.l3Details.push(gz + ' #' + i + ' 救应条目期望=' + wantVal + '/' + wantNote + ' 实际=' + dn.val + '/' + dn.note);
      }
    });
  }

  // —— 赢家 ——
  var wO = o.cs.yongWx, wN = n.cs.yongWx;
  var jyO = rescueOf(o.cs);
  var changed = wO !== wN;
  var rec = { gz: gz, wO: wO, wN: wN, changed: changed, cls: null, isCong: !!o.cg.isCong, l1wO: o.cs.L1[wO], l1wN: n.cs.L1[wN], jyOldWinner: jyO[wO], factors: pred.factors };
  if (changed) {
    changedRecs.push(rec);
    if (!(jyO[wO] > 0)) HARD.unexpected.push(gz + ' 赢家变化但旧赢家无救应分（jyOld=' + jyO[wO] + '）');
    if (rec.l1wO < 0 && rec.l1wN >= 0) rec.cls = '纠错';
    else if (rec.l1wO >= 0 && rec.l1wN >= 0) rec.cls = '换位';
    else if (rec.l1wO < 0 && rec.l1wN < 0) rec.cls = '同错向换位';
    else { rec.cls = '损伤'; HARD.damage.push(gz + ' ' + wO + '(' + rec.l1wO + ')→' + wN + '(' + rec.l1wN + ')'); }
  }

  // —— yj 字段 ——
  if (JSON.stringify(o.yj.yongShen) !== JSON.stringify(n.yj.yongShen)) {
    var expectYong = changed ? [wN] : null;
    if (!changed || JSON.stringify(n.yj.yongShen) !== JSON.stringify([wN])) HARD.text.push(gz + ' yongShen 漂移: ' + JSON.stringify(o.yj.yongShen) + ' → ' + JSON.stringify(n.yj.yongShen) + ' (expect=' + JSON.stringify(expectYong) + ')');
  }
  // 从格盘：除 candidateScores 外全部字节级一致
  if (o.cg.isCong) {
    ['yongShen', 'xiShen', 'jiShen', 'reasoning', 'evidence', 'elementReasons', 'primaryReason', 'yongShenQuality', 'tiebreak'].forEach(function (k) {
      if (JSON.stringify(o.yj[k]) !== JSON.stringify(n.yj[k])) HARD.cong.push(gz + ' 从格 yj.' + k + ' 漂移');
    });
  } else if (!changed) {
    // 赢家未变：喜忌只允许中性带跨越；文本只允许救应 note 消失/数字变化
    ['xiShen', 'jiShen'].forEach(function (k) {
      if (JSON.stringify(o.yj[k]) !== JSON.stringify(n.yj[k])) {
        var oo = {}, nn = {};
        o.yj[k].forEach(function (x) { oo[x] = true; });
        n.yj[k].forEach(function (x) { nn[x] = true; });
        var allBad = false;
        WX.forEach(function (wx) {
          if (!!oo[wx] !== !!nn[wx] && sideOf(o.cs.SNeed[wx]) === sideOf(n.cs.SNeed[wx])) allBad = true;
        });
        if (allBad) HARD.xiJi.push(gz + ' ' + k + ' 变化无中性带跨越: ' + JSON.stringify(o.yj[k]) + ' → ' + JSON.stringify(n.yj[k]));
        else xiJiCrossRecs.push({ gz: gz, field: k, from: o.yj[k], to: n.yj[k] });
      }
    });
    var notes = [];
    od.forEach(function (d) { if (isRescueNote(d.note)) notes.push(d.note); });
    nd.forEach(function (d) { if (isRescueNote(d.note)) notes.push(d.note); });
    var normText = function (s) {
      var t = String(s);
      notes.forEach(function (nt) { t = t.split(nt).join(''); });
      // 喜/忌清单顺序与成员变化由 xiShen/jiShen 中性带跨越检查单独验证，文本比较时整段剥离
      t = t.replace(/喜：[^。]*。?/g, 'X').replace(/忌：[^。]*。?/g, 'J');
      // 分号是 note 拼接分隔符：门控条目从 reasoning 过滤后剩余分隔符差异属格式化噪声
      t = t.split('；').join('').split(';').join('');
      return t.replace(/-?\d+(?:\.\d+)?/g, '#');
    };
    ['reasoning', 'evidence', 'elementReasons', 'primaryReason'].forEach(function (k) {
      if (normText(o.yj[k]) !== normText(n.yj[k])) HARD.text.push(gz + ' yj.' + k + ' 文本漂移（归一化后仍不同）');
    });
    if (JSON.stringify(o.yj.yongShenQuality) !== JSON.stringify(n.yj.yongShenQuality) &&
        JSON.stringify(o.yj.xiShen) === JSON.stringify(n.yj.xiShen) &&
        JSON.stringify(o.yj.jiShen) === JSON.stringify(n.yj.jiShen)) {
      HARD.text.push(gz + ' yj.yongShenQuality 漂移（赢家与喜忌均未变）');
    }
  }
  // tiebreak 赢家一致性（赢家变化时 tiebreak 可合法变化）
  if (o.yj.tiebreak && n.yj.tiebreak) {
    if (o.yj.tiebreak.winner !== wO) HARD.text.push(gz + ' OLD tiebreak.winner=' + o.yj.tiebreak.winner + ' ≠ cs.yongWx=' + wO);
    if (n.yj.tiebreak.winner !== wN) HARD.text.push(gz + ' NEW tiebreak.winner=' + n.yj.tiebreak.winner + ' ≠ cs.yongWx=' + wN);
  }

  // —— candidateScores 逐候选（部分盘 getYongJi 不挂载或仅部分候选，需两引擎一致）——
  if (!!o.yj.candidateScores !== !!n.yj.candidateScores) HARD.text.push(gz + ' candidateScores 挂载不一致: OLD=' + !!o.yj.candidateScores + ' NEW=' + !!n.yj.candidateScores);
  var oc = {}, nc = {};
  (o.yj.candidateScores || []).forEach(function (c) { if (c && c.wx) oc[c.wx] = c; });
  (n.yj.candidateScores || []).forEach(function (c) { if (c && c.wx) nc[c.wx] = c; });
  var oKeys = Object.keys(oc).sort().join(','), nKeys = Object.keys(nc).sort().join(',');
  if (oKeys !== nKeys) HARD.text.push(gz + ' candidateScores 候选集合漂移: [' + oKeys + '] → [' + nKeys + ']');
  var allKeys = {};
  Object.keys(oc).forEach(function (k) { allKeys[k] = true; });
  Object.keys(nc).forEach(function (k) { allKeys[k] = true; });
  Object.keys(allKeys).forEach(function (wx) {
    if (!oc[wx] || !nc[wx]) return;
    ['L1', 'L2', 'L4', 'relation', 'rootScore', 'rootQuality'].forEach(function (k) {
      if (JSON.stringify(oc[wx][k]) !== JSON.stringify(nc[wx][k])) HARD.text.push(gz + ' cand.' + wx + '.' + k + ' 漂移');
    });
    if (!close(nc[wx].L3, expL3[wx])) HARD.l3.push(gz + ' cand.' + wx + '.L3=' + nc[wx].L3 + ' 期望=' + expL3[wx]);
    if (!close(nc[wx].SBase, n.cs.SBase[wx])) HARD.sbase.push(gz + ' cand.' + wx + '.SBase 与 cs 不一致');
    if (!close(nc[wx].SNeed, n.cs.SNeed[wx])) HARD.sbase.push(gz + ' cand.' + wx + '.SNeed 与 cs 不一致');
    if (JSON.stringify(oc[wx].role) !== JSON.stringify(nc[wx].role)) {
      if (!changed && sideOf(o.cs.SNeed[wx]) === sideOf(n.cs.SNeed[wx]) && wx !== wO) HARD.xiJi.push(gz + ' cand.' + wx + '.role 漂移无跨越: ' + oc[wx].role + '→' + nc[wx].role);
    }
  });
  return rec;
}

// ---- 盘集 ----
// ① C05 28盘（p5c05-output.json）
var C05_ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-output.json'), 'utf8'));
// ② 105盘影响面（C02+C03+C04 去重）
var IMPACT_GZ = [];
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) IMPACT_GZ.push(r.gz); });
});
var uniq = {};
IMPACT_GZ.forEach(function (gz) { uniq[gz] = true; });
var IMPACT = Object.keys(uniq);
var IMPACT_DIFFS = JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-impact.json'), 'utf8')).diffs;
var impactPred = {};
IMPACT_DIFFS.forEach(function (d) { impactPred[d.gz] = d.wGateQ; });

// ③ 历史回归（p5b_diff 同口径：53冻结 + 50盲测 + 20盲盘 + 攻击集 + P4-A）
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
var HIST = [];
parseCSV('_p3_a2_sha_ab.csv').slice(1).forEach(function (r) { HIST.push({ id: r[1], gz: r[2], set: '53冻结' }); });
var BLIND50 = [];
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm;
  var m;
  while ((m = re.exec(md)) !== null) BLIND50.push({ id: m[1], gz: m[2], set: '50盲测' });
});
if (BLIND50.length !== 50) throw new Error('50 盲测解析数量异常: ' + BLIND50.length);
var BLIND20 = [
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
];
var HIST_GZ = {};
HIST.forEach(function (d) { HIST_GZ[d.gz] = true; });
BLIND20.forEach(function (m) { if (!HIST_GZ[m[1]]) { HIST.push({ id: m[0], gz: m[1], set: '20盲盘' }); HIST_GZ[m[1]] = true; } });
BLIND50.forEach(function (d) { if (!HIST_GZ[d.gz]) { HIST.push(d); HIST_GZ[d.gz] = true; } });
var ATTACK_SETS = { '00-P5A1-格局攻击集.md': 120, '00-P5A2-格局成败攻击集.md': 120, '00-P5A3-财党杀攻击集.md': 61 };
Object.keys(ATTACK_SETS).forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, '_p5', f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) {
    if (!HIST_GZ[m[2]]) { HIST.push({ id: f.replace(/\.md$/, '') + '#' + m[1], gz: m[2], set: '攻击集' }); HIST_GZ[m[2]] = true; }
    n++;
  }
  if (n !== ATTACK_SETS[f]) throw new Error(f + ' 解析数量异常: ' + n);
});
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a', '00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  if (!HIST_GZ[m[1]]) { HIST.push({ id: 'P4A-' + p4aCount, gz: m[1], set: 'P4A定向' }); HIST_GZ[m[1]] = true; }
});
if (p4aCount !== 32) throw new Error('P4-A 定向盘解析数量异常: ' + p4aCount);

// ---- 层① C05 28盘 ----
console.log('===== 层① C05 28盘（NEW 引擎 vs C05 wGateQ 预测） =====');
var c05Mismatch = [], c05Divergence = [];
C05_ROWS.forEach(function (r) {
  var v = verifyOne(r.gz);
  if (v.error) { HARD.pred.push(r.id + ' ' + v.error); return; }
  // 复算 C05 wGateQ 并核对存储值
  var o = compute(OLD, r.gz);
  var gans = r.gz.split(' ').map(function (p) { return p[0]; }).join('');
  var rootQ = NEW.evaluateYongShenQuality(o.b, { yongShen: WX.slice(), xiShen: [] });
  var wg = scaledWinner(o.cs, rescueOf(o.cs), rootQ, c05ScaleGateQ(o.cs, gans, rootQ)).winner;
  if (wg !== r.wGateQ) HARD.pred.push(r.id + ' 存储wGateQ=' + r.wGateQ + ' 复算=' + wg);
  // NEW 赢家 vs 预测
  if (v.changed) {
    if (r.wGateQ !== r.wCur) {
      if (v.wN !== r.wGateQ) {
        // 检查是否可解释为引擎 rootScore 口径与 C05 口径（透=1/根≥1=0.7）分歧
        var divergence = false;
        WX.forEach(function (wx) {
          if (r.gatePass && v.jyOldWinner > 0) {
            var c05f = c05ScaleGateQ(o.cs, gans, rootQ)(wx);
            var engf = (o.cs.L1[wx] < 0) ? 0 : v.factors[wx];
            if (c05f !== engf && rescueOf(o.cs)[wx] > 0) divergence = true;
          }
        });
        if (divergence) { c05Divergence.push(r.id + ' ' + r.gz + ': 预测' + r.wGateQ + ' 实际' + v.wN + '（引擎口径与C05口径分歧）'); }
        else HARD.pred.push(r.id + ' ' + r.gz + ' 赢家预测不一致: 预测' + r.wGateQ + ' 实际' + v.wN);
      }
    } else {
      // C05 预测无变化，引擎却变化 → 必为质量降权（gate✓ 且引擎系数<C05口径1/0.7）
      var down = WX.some(function (wx) {
        return rescueOf(o.cs)[wx] > 0 && o.cs.L1[wx] >= 0 &&
               c05ScaleGateQ(o.cs, gans, rootQ)(wx) > v.factors[wx];
      });
      if (down) c05Divergence.push(r.id + ' ' + r.gz + ': C05预测不变，引擎' + v.wO + '→' + v.wN + '（引擎质量降权）');
      else HARD.pred.push(r.id + ' ' + r.gz + ' C05预测无变化但引擎变化且不可解释: ' + v.wO + '→' + v.wN);
    }
  } else {
    if (r.wGateQ !== r.wCur) {
      // C05 预测变化但引擎未变 → 检查引擎系数是否高于 C05 口径（如无透强根 rs≥4 → 1 > 0.7）
      var up = WX.some(function (wx) {
        return rescueOf(o.cs)[wx] > 0 && o.cs.L1[wx] >= 0 &&
               c05ScaleGateQ(o.cs, gans, rootQ)(wx) < v.factors[wx];
      });
      if (up) c05Divergence.push(r.id + ' ' + r.gz + ': C05预测' + r.wCur + '→' + r.wGateQ + '，引擎未变（引擎系数高于C05口径）');
      else HARD.pred.push(r.id + ' ' + r.gz + ' C05预测变化但引擎未变且不可解释: ' + r.wCur + '→' + r.wGateQ);
    }
  }
});
var g1 = C05_ROWS.filter(function (r) { return r.set === 'G1'; });
var g2 = C05_ROWS.filter(function (r) { return r.set === 'G2'; });
var g3 = C05_ROWS.filter(function (r) { return r.set === 'G3'; });
function setSummary(rows) {
  var changes = [];
  rows.forEach(function (r) {
    var rec = changedRecs.filter(function (c) { return c.gz === r.gz; })[0];
    if (rec) changes.push(rec);
  });
  return { n: rows.length, changes: changes };
}
[['G1', g1], ['G2', g2], ['G3', g3]].forEach(function (p) {
  var s = setSummary(p[1]);
  var bad = s.changes.filter(function (c) { return c.cls === '损伤'; });
  console.log(p[0] + ' n=' + s.n + ' | 变化 ' + s.changes.length + ' | 损伤 ' + bad.length + (bad.length === 0 ? ' ✅' : ' ❌'));
  s.changes.forEach(function (c) { console.log('  [' + c.cls + '] ' + c.gz + ' ' + c.wO + '(' + c.l1wO + ')→' + c.wN + '(' + c.l1wN + ')'); });
});

// ---- 层② 105盘影响面 ----
console.log('\n===== 层② 105盘影响面 =====');
var impactChanges = [], impactOk = true;
IMPACT.forEach(function (gz) {
  var v = verifyOne(gz);
  if (v.error) { HARD.pred.push(gz + ' ' + v.error); return; }
  if (v.changed) {
    impactChanges.push(v);
    if (impactPred[gz] !== undefined) {
      if (v.wN !== impactPred[gz]) { HARD.pred.push(gz + ' 影响面12预测不一致: 预测' + impactPred[gz] + ' 实际' + v.wN); impactOk = false; }
    }
  }
});
var iCuo = impactChanges.filter(function (c) { return c.cls === '纠错'; });
var iHuan = impactChanges.filter(function (c) { return c.cls === '换位'; });
var iSun = impactChanges.filter(function (c) { return c.cls === '损伤'; });
console.log('差异盘 ' + impactChanges.length + '：纠错 ' + iCuo.length + ' / 换位 ' + iHuan.length + ' / 损伤 ' + iSun.length + (iSun.length === 0 ? ' ✅' : ' ❌❌❌'));
impactChanges.forEach(function (c) {
  var in12 = impactPred[c.gz] !== undefined ? '【12预测内】' : '【预测外·质量降权】';
  console.log('  [' + c.cls + '] ' + in12 + ' ' + c.gz + ' ' + c.wO + '(' + c.l1wO + ')→' + c.wN + '(' + c.l1wN + ')');
});
var extraIn12 = 0;
Object.keys(impactPred).forEach(function (gz) {
  var rec = changedRecs.filter(function (c) { return c.gz === gz; })[0];
  if (!rec) { console.log('  ⚠ C05 预测变化但引擎未变: ' + gz + ' ' + impactPred[gz]); extraIn12++; }
});
if (extraIn12 > 0) { HARD.pred.push('影响面12中 ' + extraIn12 + ' 盘预测变化未发生'); }

// ---- 5键救应方向审计（105盘，NEW 引擎）----
console.log('\n===== 5键救应方向审计（105盘，NEW 引擎，与 C05 审计对账） =====');
var EXPECT_AUDIT = { '月令受冲': [95, 43], '伤官克官': [6, 3], '枭神夺食': [8, 4], '财星破印': [18, 16], '七杀无制化': [2, 1] };
var audit = { '月令受冲': [0, 0], '伤官克官': [0, 0], '枭神夺食': [0, 0], '财星破印': [0, 0], '七杀无制化': [0, 0] };
IMPACT.forEach(function (gz) {
  var n = compute(NEW, gz);
  if (n.cg.isCong) return;
  (n.cs.l3Details || []).forEach(function (d) {
    JIUYING_PREFIX.forEach(function (p, i) {
      if (d.note.indexOf(p) === 0) {
        audit[JIUYING_KEY[i]][0]++;
        if (d.val === 0 && d.note.indexOf(GATE_FAIL_SUFFIX) >= 0) audit[JIUYING_KEY[i]][1]++;
      }
    });
  });
});
JIUYING_KEY.forEach(function (k) {
  var exp = EXPECT_AUDIT[k], act = audit[k];
  var ok = exp[0] === act[0] && exp[1] === act[1];
  console.log('  ' + k + '：note ' + act[0] + ' 条（C05审计 ' + exp[0] + '），方向错 ' + act[1] + ' 条（C05审计 ' + exp[1] + '）' + (ok ? ' ✅' : ' ❌ 与C05审计不一致'));
  if (!ok) HARD.audit.push(k + ' 审计对账不一致: 实际[' + act + '] 期望[' + exp + ']');
});

// ---- 层④ 锚点 ----
console.log('\n===== 层④ 两锚点（GPT 指定回归锚点） =====');
['甲申 庚午 甲子 乙丑', '戊子 丁巳 癸亥 庚申'].forEach(function (gz) {
  var o = compute(OLD, gz), n = compute(NEW, gz);
  var label = gz === '甲申 庚午 甲子 乙丑' ? 'A03（gate✓ 不误伤）' : 'D11（L1木<0 归零 → 金）';
  console.log(label + ' ' + gz);
  console.log('  ' + n.dm.score + n.dm.level + ' d=' + n.cs.d.toFixed(2) + ' | ' + n.pt.name + '·' + n.pt.status + (n.cg.isCong ? '【从格】' : ''));
  console.log('  L1=' + JSON.stringify(n.cs.L1) + ' L3 OLD=' + JSON.stringify(o.cs.L3) + ' NEW=' + JSON.stringify(n.cs.L3));
  console.log('  l3Details NEW=' + JSON.stringify(n.cs.l3Details));
  console.log('  用神 ' + o.yj.yongShen.join('、') + '→' + n.yj.yongShen.join('、') + ' | 喜 ' + o.yj.xiShen.join('、') + '→' + n.yj.xiShen.join('、') + ' | 忌 ' + o.yj.jiShen.join('、') + '→' + n.yj.jiShen.join('、'));
});
var a03 = compute(NEW, '甲申 庚午 甲子 乙丑'), d11 = compute(NEW, '戊子 丁巳 癸亥 庚申');
if (!(a03.yj.yongShen[0] === '木' && a03.yj.jiShen.length === 0)) HARD.anchor.push('A03 锚点不达标: 用神=' + a03.yj.yongShen.join('、') + ' 忌=' + a03.yj.jiShen.join('、'));
if (!(d11.yj.yongShen[0] === '金' && d11.cs.L3['木'] === 0)) HARD.anchor.push('D11 锚点不达标: 用神=' + d11.yj.yongShen.join('、') + ' L3木=' + d11.cs.L3['木']);

// ---- 层③ 历史回归 ----
console.log('\n===== 层③ 历史回归（' + HIST.length + ' 盘，p5b_diff 同口径） =====');
var histChanges = [];
HIST.forEach(function (d) {
  var v = verifyOne(d.gz);
  if (v.error) { HARD.pred.push(d.id + ' ' + d.gz + ' ' + v.error); return; }
  if (v.changed) histChanges.push(v);
});
var hCuo = histChanges.filter(function (c) { return c.cls === '纠错'; });
var hHuan = histChanges.filter(function (c) { return c.cls === '换位'; });
var hSun = histChanges.filter(function (c) { return c.cls === '损伤'; });
var setNames = {};
HIST.forEach(function (d) { setNames[d.gz] = d.set + ' ' + (d.id || ''); });
console.log('变化 ' + histChanges.length + ' 盘：纠错 ' + hCuo.length + ' / 换位 ' + hHuan.length + ' / 损伤 ' + hSun.length + (hSun.length === 0 ? ' ✅' : ' ❌'));
histChanges.forEach(function (c) {
  console.log('  [' + c.cls + '] ' + c.gz + ' ' + c.wO + '(' + c.l1wO + ')→' + c.wN + '(' + c.l1wN + ') ' + (setNames[c.gz] || ''));
});

// ---- 汇总 ----
console.log('\n===== 硬门禁汇总 =====');
var hardKeys = Object.keys(HARD);
var hardTotal = 0;
hardKeys.forEach(function (k) { hardTotal += HARD[k].length; });
hardKeys.forEach(function (k) {
  if (HARD[k].length) {
    console.log('❌ ' + k + ': ' + HARD[k].length + ' 条');
    HARD[k].slice(0, 10).forEach(function (x) { console.log('   ' + x); });
    if (HARD[k].length > 10) console.log('   … 共 ' + HARD[k].length + ' 条');
  }
});
console.log(hardTotal === 0 ? '✅ 硬门禁全部通过（零 L0 漂移 / 零损伤 / 零未解释预测不一致）' : '❌ 硬门禁失败 ' + hardTotal + ' 条');
if (c05Divergence.length) {
  console.log('\n===== 口径分歧（可解释，随裁观察项） =====');
  c05Divergence.forEach(function (x) { console.log('  ' + x); });
}
if (xiJiCrossRecs.length) {
  console.log('\n===== 喜忌中性带跨越（赢家未变，L3 降权所致） =====');
  xiJiCrossRecs.slice(0, 20).forEach(function (x) { console.log('  ' + x.gz + ' ' + x.field + ' ' + x.from.join('、') + '→' + x.to.join('、')); });
  if (xiJiCrossRecs.length > 20) console.log('  … 共 ' + xiJiCrossRecs.length + ' 条');
}

fs.writeFileSync(path.join(__dirname, 'p5c06-verify-output.json'), JSON.stringify({
  selfCheck: 'PASS',
  c05: { n: C05_ROWS.length, changes: changedRecs.filter(function (c) { return C05_ROWS.some(function (r) { return r.gz === c.gz; }); }), divergence: c05Divergence },
  impact: { n: IMPACT.length, changes: impactChanges, in12Missing: extraIn12 },
  hist: { n: HIST.length, changes: histChanges },
  audit: audit,
  anchors: {
    A03: { yongShen: a03.yj.yongShen, xiShen: a03.yj.xiShen, jiShen: a03.yj.jiShen, L3: a03.cs.L3 },
    D11: { yongShen: d11.yj.yongShen, xiShen: d11.yj.xiShen, jiShen: d11.yj.jiShen, L3: d11.cs.L3 }
  },
  hard: HARD,
  xiJiCross: xiJiCrossRecs
}, null, 2));
console.log('\n输出已存 _p5/p5c06-verify-output.json');
process.exit(hardTotal === 0 ? 0 : 1);
