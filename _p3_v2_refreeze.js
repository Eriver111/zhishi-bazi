// _p3_v2_refreeze.js —— v2 旺衰评分（得令×得地联动/日支根气分级/贴身合绊）53 盘重冻结（2026-08-21 用户授权）
// 职责：重生成两个冻结产物（_p2_4a_replay.csv 的 C 侧、_p3_a2_risks.csv 全量），
//       校验 _p3_a2_sha_ab.csv 与 _p3_a1_relation_events.csv 在 v2 下逐字节不变（B1/B3 不重冻）。
// 纪律：不改引擎、不 push；失败即停、逐条归因；重生成前先三件套。
var fs = require('fs'), cp = require('child_process'), path = require('path'), crypto = require('crypto'), vm = require('vm');
var ROOT = __dirname;

// ---------- 三件套（用户纪律：任何 sha 检查前）----------
console.log('pwd = ' + cp.execSync('pwd', { cwd: ROOT }).toString().trim());
console.log('git toplevel = ' + cp.execSync('git rev-parse --show-toplevel', { cwd: ROOT }).toString().trim());
var RAW_SHA = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'js/bazi.js'))).digest('hex');
console.log('sha256(js/bazi.js 原始字节) = ' + RAW_SHA);
var bom = fs.readFileSync(path.join(ROOT, 'js/bazi.js')).slice(0, 3).toString('hex');
console.log('BOM = ' + (bom === 'efbbbf' ? '有(efbbbf)，哈希含 BOM' : '无(' + bom + ')'));

// ---------- 冻结产物（只读）----------
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
var replayHeader = fs.readFileSync(path.join(ROOT, '_p2_4a_replay.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)[0];
var replayFrozen = parseCSV('_p2_4a_replay.csv').slice(1);
var riskFrozen = parseCSV('_p3_a2_risks.csv').slice(1);
var shaFrozen = parseCSV('_p3_a2_sha_ab.csv');
var evFrozen = parseCSV('_p3_a1_relation_events.csv');
if (replayFrozen.length !== 53) { console.error('❌ replay 冻结 !== 53 行'); process.exit(1); }
if (riskFrozen.length !== 59) { console.error('❌ risks 冻结 !== 59 行'); process.exit(1); }
if (shaFrozen.length - 1 !== 53) { console.error('❌ sha_ab 冻结 !== 53 行'); process.exit(1); }
if (evFrozen.length - 1 !== 271) { console.error('❌ events 冻结 !== 271 行'); process.exit(1); }
console.log('✅ 冻结产物行数：replay 53 / risks 59 / sha_ab 53 / events 271');

// 53 盘清单：以 sha_ab 冻结为权威（与 p3-a-structural.test.js chartList 同源）
var chartList = shaFrozen.slice(1).map(function (r) { return { set: r[0], id: r[1], gz: r[2] }; });
var replayById = {};
replayFrozen.forEach(function (r) { replayById[r[0] + '|' + r[1]] = r; });
chartList.forEach(function (c) { if (!replayById[c.set + '|' + c.id]) { console.error('❌ replay 缺锚点: ' + c.set + '|' + c.id); process.exit(1); } });

// ============ A. replay C 侧重生成（eval + trace 注入，与 _p2_4a_replay.js 同源） ============
var src = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8').replace(/\r\n/g, '\n');
var MARKERS = [
  ['// ---------- ① 得令', '基准'],
  ['// ---------- ② 得地', '①得令后'],
  ['// ---------- ③ 得势', '②得地后'],
  ['// ---------- ④ 地支藏干本气', '③得势后'],
  ['// ---------- ⑤ 五行过耗修正', '④藏干本气后'],
  ['// ---------- ⑤½ 土多金埋修正', '⑤过耗后'],
  ['// ---------- ⑥ 调候', '⑤½土多金埋后'],
  ['// ---------- ⑦ 天干合化修正', '⑥调候后'],
  ['// ---------- ⑧ 地支合冲刑害修正', '⑦五合后'],
  ['// 跨柱六合检测', '⑧相邻冲害刑合后'],
  ['// 三会局检测', '⑧跨柱六合后'],
  ['// 跨柱六冲检测', '⑧三会半会后'],
  ['// 日支被合化', '⑧跨柱六冲后'],
  ['// ---------- ⑧½ 杀印相生结构修正', '⑧日支合化重构后'],
  ['// ---------- ⑧¾ 宫位远近修正', '⑧½杀印相生后'],
  ['// ---------- ⑨ 分级输出', '⑧¾宫位远近后']
];
function injectTrace(code) {
  var fnStart = code.indexOf('function calcDayMasterStrength');
  var fnEnd = code.indexOf('\nfunction ', fnStart + 10);
  var fnSrc = code.slice(fnStart, fnEnd);
  MARKERS.forEach(function (p) { if (fnSrc.indexOf(p[0]) < 0) throw new Error('marker missing: ' + p[0]); });
  if (fnSrc.indexOf('var score = 50;') < 0) throw new Error('score init missing');
  var traced = fnSrc;
  for (var i = MARKERS.length - 1; i >= 0; i--) {
    traced = traced.replace(MARKERS[i][0], "global.__TRACE.push(['" + MARKERS[i][1] + "', score]);\n  " + MARKERS[i][0]);
  }
  traced = traced.replace('var score = 50;', 'var score = 50;\n  global.__TRACE = [];');
  return code.slice(0, fnStart) + traced + code.slice(fnEnd);
}
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
global.window = global; global.document = {};
eval(injectTrace(src).replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

// 镜像表（⑧½ tier/bonus 校验用，与 _p2_4a_replay.js 逐字一致）
var GAN_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
var ZHI_WX = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };
var SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
var KE = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
var CANG = { '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'], '卯': ['乙'], '辰': ['戊', '乙', '癸'], '巳': ['丙', '庚', '戊'], '午': ['丁', '己'], '未': ['己', '丁', '乙'], '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲'] };
var CS = { '甲': '亥', '乙': '午', '丙': '寅', '丁': '酉', '戊': '寅', '己': '酉', '庚': '巳', '辛': '子', '壬': '申', '癸': '卯' };
var LU = { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' };
var HE_PAIRS = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']];
var CHONG = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
var POS = ['year', 'month', 'day', 'hour'];
function shENGWO(dg) { for (var k in SHENG) if (SHENG[k] === dg) return k; }
function kEWO(dg) { for (var k in KE) if (KE[k] === dg) return k; }
function huiOverride(b) {
  var zhis = POS.map(function (p) { return b[p].zhi; });
  var sets = [
    { z: ['寅', '卯', '辰'], wx: '木' }, { z: ['巳', '午', '未'], wx: '火' },
    { z: ['申', '酉', '戌'], wx: '金' }, { z: ['亥', '子', '丑'], wx: '水' }
  ];
  for (var i = 0; i < sets.length; i++) {
    var s = sets[i];
    if (s.z.every(function (z) { return zhis.indexOf(z) >= 0; }) && s.z.indexOf(b.month.zhi) >= 0) return s.wx;
  }
  return null;
}
function mirror8h(b) {
  var dg = b.day.gan, dgWx = GAN_WX[dg];
  var mwx = huiOverride(b) || ZHI_WX[b.month.zhi];
  var yinWx = shENGWO(dgWx), shaWx = kEWO(dgWx);
  var dead = (shaWx === mwx);
  var yinPath = '';
  if (GAN_WX[b.month.gan] === yinWx) yinPath = '月干';
  else if (GAN_WX[b.hour.gan] === yinWx) yinPath = '时干';
  else {
    var dcg = CANG[b.day.zhi];
    for (var i = 0; i < dcg.length; i++) if (GAN_WX[dcg[i]] === yinWx) { yinPath = '日支藏'; break; }
  }
  var yinAdj = yinPath !== '';
  var csl = false;
  POS.forEach(function (p) { var z = b[p].zhi; if (z === CS[dg] || z === LU[dg]) csl = true; });
  var yGanYin = (GAN_WX[b.year.gan] === yinWx);
  var yinRootPos = [];
  POS.forEach(function (p) {
    var cg = CANG[b[p].zhi];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === yinWx) { yinRootPos.push(b[p].zhi + '(' + cg[i] + ')'); break; }
  });
  var yinDeSheng = (SHENG[mwx] === yinWx);
  var hePo = false;
  ['month', 'hour'].forEach(function (p) {
    var g = b[p].gan;
    if (GAN_WX[g] !== yinWx) return;
    HE_PAIRS.forEach(function (h) {
      var other = null;
      if (h[0] === g) other = h[1]; else if (h[1] === g) other = h[0];
      if (other && other !== dg) {
        POS.forEach(function (p2) { if (b[p2].gan === other) { hePo = true; } });
      }
    });
  });
  var dayChong = false;
  var opp = CHONG[b.day.zhi];
  if (opp) { ['year', 'month', 'hour'].forEach(function (p) { if (b[p].zhi === opp) dayChong = true; }); }
  var dayYin = false;
  var dcgYin = CANG[b.day.zhi];
  for (var i = 0; i < dcgYin.length; i++) if (GAN_WX[dcgYin[i]] === yinWx) { dayYin = true; break; }
  var po = hePo || (dayYin && dayChong);
  var tier = 'D', bonus = 0;
  if (dead && csl) {
    if (yinAdj && !po) { tier = 'A'; bonus = 13; }
    else if (yGanYin && (yinRootPos.length > 0 || yinDeSheng)) { tier = 'B'; bonus = 6; }
    else if (yGanYin || (yinAdj && po)) { tier = 'C'; bonus = 3; }
  }
  return { dg: dg, dgWx: dgWx, mwx: mwx, dead: dead, yinPath: yinPath, yinAdj: yinAdj, csl: csl, yGanYin: yGanYin, yinRootPos: yinRootPos, yinDeSheng: yinDeSheng, hePo: hePo, dayChong: dayChong, dayYin: dayYin, po: po, tier: tier, bonus: bonus };
}
function toBazi(gz) {
  return { year: { gan: gz[0][0], zhi: gz[0][1] }, month: { gan: gz[1][0], zhi: gz[1][1] }, day: { gan: gz[2][0], zhi: gz[2][1] }, hour: { gan: gz[3][0], zhi: gz[3][1] } };
}
function segD(t) { // 新引擎分段差（②½ 归入 d3，⑦½ 归入 d8lin）
  return {
    d1: t['①得令后'] - t['基准'], d2: t['②得地后'] - t['①得令后'], d3: t['③得势后'] - t['②得地后'],
    d4: t['④藏干本气后'] - t['③得势后'], d5: t['⑤过耗后'] - t['④藏干本气后'], d5b: t['⑤½土多金埋后'] - t['⑤过耗后'],
    d6: t['⑥调候后'] - t['⑤½土多金埋后'], d7: t['⑦五合后'] - t['⑥调候后'],
    d8lin: t['⑧相邻冲害刑合后'] - t['⑦五合后'], d8liu: t['⑧跨柱六合后'] - t['⑧相邻冲害刑合后'],
    d8san: t['⑧三会半会后'] - t['⑧跨柱六合后'], d8chong: t['⑧跨柱六冲后'] - t['⑧三会半会后'],
    d8hehua: t['⑧日支合化重构后'] - t['⑧跨柱六冲后'], d8b: t['⑧½杀印相生后'] - t['⑧日支合化重构后'],
    d8pos: t['⑧¾宫位远近后'] - t['⑧½杀印相生后'], raw: t['⑧¾宫位远近后']
  };
}

var replayNewByKey = {}, replayChanged = [], replayUnchanged = 0;
chartList.forEach(function (c) {
  var key = c.set + '|' + c.id;
  var f = replayById[key]; // 冻结行（0-44）
  var b = toBazi(c.gz.split(' '));
  var dm = calcDayMasterStrength(b);
  var yj = getYongJi(b), pat = getPattern(b), cong = getCongGe(b);
  var tr = {};
  global.__TRACE.forEach(function (e) { tr[e[0]] = e[1]; });
  var dd = segD(tr);
  var mir = mirror8h(b);
  if (mir.bonus !== dd.d8b) { console.error('❌ ⑧½镜像与trace不一致: ' + c.id + ' mirror=' + mir.tier + '/' + mir.bonus + ' d8b=' + dd.d8b); process.exit(1); }
  var sC = String(dm.score), lC = dm.level, yC = yj.yongShen.join('、'), xiC = yj.xiShen.join('、'), jiC = yj.jiShen.join('、'),
      pC = pat.name + '·' + pat.status, congC = cong.isCong ? cong.name : '否';
  var sP = f[11], lP = f[12], yP = f[13], xiP = f[14], jiP = f[15], pP = f[16];
  var n = f.slice();
  n[4] = sC; n[5] = lC; n[6] = yC; n[7] = xiC; n[8] = jiC; n[9] = pC; n[10] = congC;
  n[17] = String(dm.score - Number(sP));
  n[18] = lC !== lP ? '1' : '0';
  n[19] = yC !== yP ? '1' : '0';
  n[20] = (xiC + '|' + jiC) !== (xiP + '|' + jiP) ? '1' : '0';
  n[21] = pC !== pP ? '1' : '0';
  n[22] = String(dd.d1); n[23] = String(dd.d2); n[24] = String(dd.d3); n[25] = String(dd.d4);
  n[26] = String(dd.d5); n[27] = String(dd.d5b); n[28] = String(dd.d6); n[29] = String(dd.d7);
  n[30] = String(dd.d8lin); n[31] = String(dd.d8liu); n[32] = String(dd.d8san); n[33] = String(dd.d8chong);
  n[34] = String(dd.d8hehua); n[35] = String(dd.d8b); n[36] = String(dd.d8pos); n[37] = String(dd.raw);
  n[38] = mir.tier;
  if (mir.tier !== f[38]) { console.error('❌ tier 漂移: ' + c.id + ' ' + f[38] + '→' + mir.tier + '（⑧½ 不应受 v2 影响）'); process.exit(1); }
  var Pd5 = Number(f[42]), Pd8h = Number(f[43]);
  n[39] = (dd.d8hehua !== Pd8h || dd.d8hehua !== 0) ? '1' : '0';
  n[40] = (dd.d5 !== Pd5) ? '1' : '0';
  n[41] = (dd.d8b !== 0) ? '1' : '0';
  if (n.join(',') === f.join(',')) { replayUnchanged++; replayNewByKey[key] = f.join(','); return; }
  // 变化列必须 ⊆ {C侧 4-10, 17-21, 22-37, 38-41}，P侧(11-16,42-44)不得动
  var changedCols = [];
  for (var i = 0; i < 45; i++) if (String(n[i]) !== String(f[i])) changedCols.push(i);
  var bad = changedCols.filter(function (i) { return (i >= 11 && i <= 16) || (i >= 42); });
  if (bad.length) { console.error('❌ ' + c.id + ' P侧列被改动: ' + bad.join(',')); process.exit(1); }
  replayChanged.push({
    id: c.id, gz: c.gz, cols: changedCols,
    s: f[4] + '→' + sC, lv: f[5] + '→' + lC,
    y: f[6] !== yC ? (f[6] + '→' + yC) : '', xi: f[7] !== xiC ? (f[7] + '→' + xiC) : '', ji: f[8] !== jiC ? (f[8] + '→' + jiC) : '',
    p: f[9] !== pC ? (f[9] + '→' + pC) : '', cong: f[10] !== congC ? (f[10] + '→' + congC) : '',
    d2: Number(n[23]) - Number(f[23]), d7: Number(n[29]) - Number(f[29]),
    flagOnly: !(f[4] !== sC || f[5] !== lC || f[6] !== yC || f[7] !== xiC || f[8] !== jiC || f[9] !== pC || f[10] !== congC)
  });
  replayNewByKey[key] = n.join(',');
});
// 按冻结顺序输出（保持 CSV 行序稳定）
var replayOut = [replayHeader];
chartList.forEach(function (c) {
  var f = replayNewByKey[c.set + '|' + c.id];
  if (!f) { console.error('❌ 缺新行: ' + c.set + '|' + c.id); process.exit(1); }
  replayOut.push(f);
});
console.log('\n===== A. replay 53 盘 C 侧重生成 =====');
console.log('  不变 ' + replayUnchanged + ' 盘 / 变化 ' + replayChanged.length + ' 盘（其中仅旗标/trace 漂移 ' + replayChanged.filter(function (r) { return r.flagOnly; }).length + ' 盘）');
replayChanged.forEach(function (r) {
  var mech = [];
  if (r.d2 !== 0) mech.push('②(A/B):' + (r.d2 > 0 ? '+' : '') + r.d2);
  if (r.d7 !== 0) mech.push('⑦(C):' + (r.d7 > 0 ? '+' : '') + r.d7);
  console.log('  ' + r.id + ' ' + r.gz + ' | ' + r.s + ' ' + r.lv + ' | 机制 ' + (mech.join(' ') || '旗标/trace 陈旧修正')
    + (r.y ? ' | 用神 ' + r.y : '') + (r.xi ? ' | 喜 ' + r.xi : '') + (r.ji ? ' | 忌 ' + r.ji : '')
    + (r.p ? ' | 格局 ' + r.p : '') + (r.cong ? ' | 从格 ' + r.cong : ''));
});

// ============ B. risks 全量重生成（vm 模式 + structural.js，与 B2 测试同口径） ============
var SA = require('./js/structural.js');
var vmc = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8'), vmc);
var calculator = vmc.window.BaZiCalculator;
function buildFromPillars(c) {
  var p = c.gz.split(' ');
  return calculator.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
// 与 p3-a-structural.test.js 一致的 08-17 裁决改写（冻结旧值成格→破格）
var APPROVED = { '#10': 1, 'A5': 1, 'H11': 1, 'P15-09': 1, 'H15': 1 };
function approvedPatternStatus(id, value) {
  return APPROVED[id] && /格·成格$/.test(value) ? value.replace(/格·成格$/, '格·破格') : value;
}
var riskHeader = fs.readFileSync(path.join(ROOT, '_p3_a2_risks.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)[0];
var riskOut = [riskHeader]; // 沿用冻结表头
var riskChanged = [], riskCount = 0;
var riskFrozenByChart = {};
riskFrozen.forEach(function (r) { var k = r[0] + '|' + r[1]; (riskFrozenByChart[k] = riskFrozenByChart[k] || []).push(r); });
chartList.forEach(function (c) {
  var b = buildFromPillars(c);
  var events = SA.relationEvents(b);
  var dm = calculator.calcDayMasterStrength(b);
  var yj = calculator.getYongJi(b);
  var pat = calculator.getPattern(b);
  var ab = SA.shaAB(b, events);
  var risks = SA.evaluate(b, calculator).structuralRisks;
  var freshRows = risks.map(function (r) {
    if (r.triggerHint.indexOf('必凶') >= 0) { console.error('❌ triggerHint 禁语: ' + c.id); process.exit(1); }
    if (r.triggerHint.indexOf('任一') >= 0) { console.error('❌ triggerHint 禁语: ' + c.id); process.exit(1); }
    if (r.triggerHint.indexOf('若') < 0 && r.triggerHint.indexOf('可能') < 0) { console.error('❌ triggerHint 非条件语言: ' + c.id); process.exit(1); }
    if (!r.partyEvidence) { console.error('❌ partyEvidence 缺失: ' + c.id); process.exit(1); }
    return [c.set, c.id, c.gz, String(dm.score), dm.level,
      yj.yongShen.join('、'), yj.xiShen.join('、'), yj.jiShen.join('、'),
      pat.name + '·' + pat.status,
      r.type, r.severity, r.parties, r.why, r.mitigations, r.triggerHint, r.evidence, r.partyEvidence];
  });
  riskCount += freshRows.length;
  freshRows.forEach(function (r) { riskOut.push(r.join(',')); });
  // 对比：fresh vs 冻结（冻结侧应用 08-17 裁决改写）
  var freshJoined = freshRows.map(function (r) { return r.join('\x01'); }).sort();
  var frozenJoined = (riskFrozenByChart[c.set + '|' + c.id] || []).map(function (r) {
    var copy = r.slice();
    copy[8] = approvedPatternStatus(c.id, copy[8]);
    return copy.join('\x01');
  }).sort();
  if (JSON.stringify(freshJoined) !== JSON.stringify(frozenJoined)) {
    var diffs = [];
    freshJoined.forEach(function (f, i) {
      var o = frozenJoined[i];
      if (f === o) return;
      var ff = f.split('\x01'), oo = (o || '').split('\x01');
      var colDiff = [];
      for (var k = 0; k < 17; k++) if (String(ff[k]) !== String(oo[k])) colDiff.push(k + ':' + String(oo[k]) + '→' + String(ff[k]));
      diffs.push('[' + (frozenJoined[i] ? '行改' : '新增') + '] 列' + colDiff.join(' '));
    });
    if (frozenJoined.length > freshJoined.length) diffs.push('[删除 ' + (frozenJoined.length - freshJoined.length) + ' 行]');
    riskChanged.push({ id: c.id, n: diffs.length, diffs: diffs });
  }
});
if (riskCount !== 59) { console.error('❌ 新 risks 行数 ' + riskCount + ' !== 59'); process.exit(1); }
console.log('\n===== B. risks 重生成 =====');
console.log('  总行数 ' + riskCount + '（冻结 59）✅');
console.log('  有差异的盘 ' + riskChanged.length + ' 盘');
riskChanged.forEach(function (rc) {
  console.log('  ' + rc.id + ':');
  rc.diffs.forEach(function (d) { console.log('    ' + d); });
});

// ============ C. events / sha_ab 不变性校验（预期零差异，不动文件） ============
var evDiff = 0, shaDiff = 0;
chartList.forEach(function (c) {
  var b = buildFromPillars(c);
  var events = SA.relationEvents(b);
  var ab = SA.shaAB(b, events);
  var keyOf = function (e) {
    return [e.type, e.pillars.join('+'), e.elements.join('|'), String(e.distance),
      e.involvesMonth ? '1' : '0', e.involvesDay ? '1' : '0', e.source, e.target, e.evidence].join('|');
  };
  var frozenEv = (evFrozen.slice(1).filter(function (r) { return r[0] === c.set && r[1] === c.id; })).map(function (r) {
    return [r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]].join('|');
  }).sort();
  var freshEv = events.map(keyOf).sort();
  if (JSON.stringify(freshEv) !== JSON.stringify(frozenEv)) { evDiff++; console.error('  ❌ events 差异: ' + c.id); }
  var frozenSha = shaFrozen.slice(1).filter(function (r) { return r[0] === c.set && r[1] === c.id; })[0];
  var freshSha = [c.set, c.id, c.gz, ab.shaGans, ab.k1, ab.k2,
    String(ab.e1), String(ab.e2), String(ab.e3), String(ab.e4), String(ab.evCount),
    ab.zhihua ? '有' : '无', ab.zhihuaDesc, ab.diff, ab.shaHeDesc];
  if (JSON.stringify(freshSha) !== JSON.stringify(frozenSha)) { shaDiff++; console.error('  ❌ shaAB 差异: ' + c.id + ' ' + freshSha.join('|')); }
});
console.log('\n===== C. events / shaAB 不变性 =====');
console.log(evDiff === 0 && shaDiff === 0 ? '  ✅ events 271 行 / sha_ab 53 行 在 v2 下逐字节不变（B1/B3 不重冻）' : '  ❌ events ' + evDiff + ' / shaAB ' + shaDiff + ' 差异');

// ============ 写回 ============
fs.writeFileSync(path.join(ROOT, '_p2_4a_replay.csv'), replayOut.join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, '_p3_a2_risks.csv'), riskOut.join('\n'), 'utf8');
console.log('\n✅ 已写 _p2_4a_replay.csv（53 行 + 表头）/ _p3_a2_risks.csv（59 行 + 表头）');
console.log('\n📌 新 sha256(js/bazi.js 原始字节) = ' + RAW_SHA + '（供 p3-a-structural.test.js 门控重钉）');
console.log('📌 注：git commit 后该哈希与 git show HEAD:js/bazi.js 的原始字节哈希一致');
