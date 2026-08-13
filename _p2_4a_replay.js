// P2 总复盘第一阶段：历史疑点盘回放（2026-08-14）
// 双引擎：P1冻结 13e588b vs 当前部署 63fafaa。不改引擎、不 push、不做参数搜索。
// 输出：逐盘双引擎 trace + 四焦点（A非日支根气/B休囚静态交换/C⑧尾部/D休眠覆盖）。
var fs = require('fs'), cp = require('child_process'), path = require('path');
var ROOT = __dirname;
global.window = global; global.document = {};

// ---------- 引擎源码（断言工作区===部署 blob）----------
var curSrc = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8').replace(/\r\n/g, '\n');
var deployed = cp.execSync('git show 63fafaa:js/bazi.js', { cwd: ROOT }).toString('utf8');
if (curSrc !== deployed) { console.error('❌ 工作区 js/bazi.js(LF归一化后) !== 63fafaa 部署 blob'); process.exit(1); }
console.log('✅ 回放引擎 = 线上部署 blob（63fafaa）');
var p1Src = cp.execSync('git show 13e588b:js/bazi.js', { cwd: ROOT }).toString('utf8');

// ---------- trace 注入（_trace_strength.js 同款）----------
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
// 每次 load 在自己的函数作用域内 eval，两引擎互不污染；setDm 闭包可在该作用域内重绑 calcDayMasterStrength
function load(src) {
  eval(injectTrace(src).replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  return {
    dm: calcDayMasterStrength, yj: getYongJi, cong: getCongGe, pat: getPattern,
    setDm: function (f) { calcDayMasterStrength = f; }
  };
}
var P1 = load(p1Src);
var CUR = load(curSrc);
var REAL_DM = CUR.dm;

// ---------- 探针镜像（⑧½档位，与 _p2_3b 同源）----------
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
  var hePo = false, heDesc = '';
  ['month', 'hour'].forEach(function (p) {
    var g = b[p].gan;
    if (GAN_WX[g] !== yinWx) return;
    HE_PAIRS.forEach(function (h) {
      var other = null;
      if (h[0] === g) other = h[1]; else if (h[1] === g) other = h[0];
      if (other && other !== dg) {
        POS.forEach(function (p2) { if (b[p2].gan === other) { hePo = true; heDesc = g + other + '合'; } });
      }
    });
  });
  var dayChong = false, chongDesc = '';
  var opp = CHONG[b.day.zhi];
  if (opp) { ['year', 'month', 'hour'].forEach(function (p) { if (b[p].zhi === opp) { dayChong = true; chongDesc = b.day.zhi + opp + '冲'; } }); }
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
  return { dg: dg, dgWx: dgWx, mwx: mwx, dead: dead, yinPath: yinPath, yinAdj: yinAdj, csl: csl, yGanYin: yGanYin, yinRootPos: yinRootPos, yinDeSheng: yinDeSheng, hePo: hePo, heDesc: heDesc, dayChong: dayChong, chongDesc: chongDesc, dayYin: dayYin, po: po, tier: tier, bonus: bonus };
}

// ---------- 样本 ----------
function toBazi(gz) {
  return { year: { gan: gz[0][0], zhi: gz[0][1] }, month: { gan: gz[1][0], zhi: gz[1][1] }, day: { gan: gz[2][0], zhi: gz[2][1] }, hour: { gan: gz[3][0], zhi: gz[3][1] } };
}
function csvCols(line) { return line.split(','); }
var ALL = [];
var C22 = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
C22.forEach(function (line) { var m = line.match(/^"([^"]+)","([^"]+)"/); ALL.push({ set: '22基线', id: m[1], gz: m[2].split(' ') }); });
var C6 = [
  { set: '六盘锚点', id: 'P15-03', gz: ['乙丑', '戊寅', '己巳', '庚午'] },
  { set: '六盘锚点', id: 'P15-09', gz: ['丁丑', '癸卯', '庚申', '丙戌'] },
  { set: '六盘锚点', id: 'P15-12', gz: ['戊子', '甲寅', '庚申', '丁亥'] },
  { set: '六盘锚点', id: 'P15-14', gz: ['丙寅', '庚寅', '戊辰', '癸亥'] },
  { set: '六盘锚点', id: 'P15-15', gz: ['癸未', '戊午', '乙卯', '丙戌'] },
  { set: '六盘锚点', id: 'P15-16', gz: ['丁卯', '壬寅', '壬午', '庚子'] }
];
var C18 = [
  { id: 'H01', gz: ['癸未', '戊午', '乙卯', '丙戌'] }, { id: 'H02', gz: ['戊辰', '甲寅', '丁亥', '庚子'] },
  { id: 'H03', gz: ['甲寅', '戊辰', '壬子', '辛丑'] }, { id: 'H04', gz: ['甲申', '庚午', '辛卯', '戊戌'] },
  { id: 'H05', gz: ['庚子', '乙酉', '甲辰', '甲子'] }, { id: 'H06', gz: ['乙巳', '壬午', '丁未', '戊申'] },
  { id: 'H07', gz: ['己丑', '丙寅', '丁亥', '甲辰'] }, { id: 'H08', gz: ['丁酉', '丙午', '丁卯', '庚戌'] },
  { id: 'H09', gz: ['甲寅', '壬申', '壬辰', '己酉'] }, { id: 'H10', gz: ['癸未', '丁巳', '丙戌', '辛卯'] },
  { id: 'H11', gz: ['壬辰', '癸卯', '戊戌', '丁巳'] }, { id: 'H12', gz: ['甲申', '丁丑', '壬辰', '己酉'] },
  { id: 'H13', gz: ['壬寅', '丙午', '丙戌', '辛卯'] }, { id: 'H14', gz: ['乙丑', '己丑', '壬子', '辛丑'] },
  { id: 'H15', gz: ['甲寅', '庚午', '庚辰', '乙酉'] }, { id: 'H16', gz: ['丙辰', '庚子', '癸巳', '庚申'] },
  { id: 'H17', gz: ['甲子', '丙子', '癸亥', '甲寅'] }, { id: 'H18', gz: ['癸卯', '己未', '甲午', '壬申'] }
].map(function (c) { c.set = '18专项'; return c; });
var COBS = [
  { set: '附加观察', id: 'P15-19', gz: ['己亥', '丙子', '辛酉', '戊子'] },
  { set: '附加观察', id: 'P15-20', gz: ['壬午', '癸卯', '戊寅', '乙卯'] }
];
var SYN = [
  { set: '合成观察', id: 'SY1', gz: ['壬子', '壬子', '戊午', '戊午'] },
  { set: '合成观察', id: 'SY2', gz: ['壬子', '壬子', '戊戌', '丁巳'] },
  { set: '合成观察', id: 'SY3', gz: ['甲子', '壬申', '乙卯', '丁亥'] },
  { set: '合成观察', id: 'SY4', gz: ['壬寅', '戊申', '乙卯', '壬午'] }
];
var ROUND2 = fs.readFileSync(path.join(ROOT, '_round2_results.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
ROUND2.forEach(function (line) {
  var f = csvCols(line);
  var dup = ALL.some(function (c) { return c.id === f[0]; });
  if (!dup) ALL.push({ set: 'Round2', id: f[0], gz: f[1].split(' ') });
});
ALL = ALL.concat(C6, C18, COBS, SYN);
ALL.push({ set: '测试盘', id: 'wetearth', gz: ['庚申', '己丑', '癸卯', '丁巳'] });
// B1 ≡ #8 去重标记
var byGz = {};
ALL.forEach(function (c) {
  var k = c.gz.join('');
  if (!byGz[k]) byGz[k] = [];
  byGz[k].push(c.id);
});
ALL.forEach(function (c) { c.alias = byGz[c.gz.join('')].filter(function (x) { return x !== c.id; }).join(','); });
console.log('样本共 ' + ALL.length + ' 盘（含 Round2 12 盘 + wetearth）');

// ---------- 逐盘双引擎回放 ----------
function runRow(eng, b) {
  var dm = eng.dm(b);
  var yj = eng.yj(b), pat = eng.pat(b), cong = eng.cong(b);
  var tr = {};
  global.__TRACE.forEach(function (e) { tr[e[0]] = e[1]; });
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pat.name + '·' + pat.status, cong: cong.isCong ? cong.name : '否',
    trace: tr
  };
}
var BANDS = [30, 40, 60, 80];
function bandOf(s) { return s >= 80 ? '极强' : s >= 60 ? '偏强' : s >= 40 ? '中和' : s >= 30 ? '偏弱' : '极弱'; }
var rows = [];
ALL.forEach(function (c) {
  var b = toBazi(c.gz);
  var rP = runRow(P1, b), rC = runRow(CUR, b);
  var tr = rC.trace;
  var d = {
    d1: tr['①得令后'] - tr['基准'], d2: tr['②得地后'] - tr['①得令后'], d3: tr['③得势后'] - tr['②得地后'],
    d4: tr['④藏干本气后'] - tr['③得势后'], d5: tr['⑤过耗后'] - tr['④藏干本气后'], d5b: tr['⑤½土多金埋后'] - tr['⑤过耗后'],
    d6: tr['⑥调候后'] - tr['⑤½土多金埋后'], d7: tr['⑦五合后'] - tr['⑥调候后'],
    d8lin: tr['⑧相邻冲害刑合后'] - tr['⑦五合后'], d8liu: tr['⑧跨柱六合后'] - tr['⑧相邻冲害刑合后'],
    d8san: tr['⑧三会半会后'] - tr['⑧跨柱六合后'], d8chong: tr['⑧跨柱六冲后'] - tr['⑧三会半会后'],
    d8hehua: tr['⑧日支合化重构后'] - tr['⑧跨柱六冲后'], d8b: tr['⑧½杀印相生后'] - tr['⑧日支合化重构后'],
    d8pos: tr['⑧¾宫位远近后'] - tr['⑧½杀印相生后'],
    raw: tr['⑧¾宫位远近后']
  };
  var mir = mirror8h(b);
  if (mir.bonus !== d.d8b) { console.error('❌ 镜像档位与引擎⑧½Δ不一致: ' + c.id + ' mirror=' + mir.tier + '/' + mir.bonus + ' traceΔ=' + d.d8b); process.exit(1); }
  var tP = rP.trace;
  var dP = {
    d1: tP['①得令后'] - tP['基准'], d2: tP['②得地后'] - tP['①得令后'], d3: tP['③得势后'] - tP['②得地后'],
    d4: tP['④藏干本气后'] - tP['③得势后'], d5: tP['⑤过耗后'] - tP['④藏干本气后'], d5b: tP['⑤½土多金埋后'] - tP['⑤过耗后'],
    d6: tP['⑥调候后'] - tP['⑤½土多金埋后'], d7: tP['⑦五合后'] - tP['⑥调候后'],
    d8lin: tP['⑧相邻冲害刑合后'] - tP['⑦五合后'], d8liu: tP['⑧跨柱六合后'] - tP['⑧相邻冲害刑合后'],
    d8san: tP['⑧三会半会后'] - tP['⑧跨柱六合后'], d8chong: tP['⑧跨柱六冲后'] - tP['⑧三会半会后'],
    d8hehua: tP['⑧日支合化重构后'] - tP['⑧跨柱六冲后'], d8b: tP['⑧½杀印相生后'] - tP['⑧日支合化重构后'],
    d8pos: tP['⑧¾宫位远近后'] - tP['⑧½杀印相生后'],
    raw: tP['⑧¾宫位远近后']
  };
  rows.push({
    set: c.set, id: c.id, alias: c.alias, gz: c.gz.join(' '),
    sC: rC.score, lC: rC.level, yC: rC.yong, xiC: rC.xi, jiC: rC.ji, pC: rC.pattern, congC: rC.cong,
    sP: rP.score, lP: rP.level, yP: rP.yong, xiP: rP.xi, jiP: rP.ji, pP: rP.pattern,
    d: d, dP: dP, tier: mir.tier, bonus: mir.bonus, mir: mir,
    p21hit: d.d8hehua !== dP.d8hehua || d.d8hehua !== 0,
    p22hit: d.d5 !== dP.d5,
    p23hit: d.d8b !== 0,
    bandChg: rC.level !== rP.level, yongChg: rC.yong !== rP.yong,
    xijiChg: (rC.xi + '|' + rC.ji) !== (rP.xi + '|' + rP.ji), patternChg: rC.pattern !== rP.pattern
  });
});
// CSV
var hdr = ['set', 'id', 'alias', 'gz', 'sC', 'lC', 'yC', 'xiC', 'jiC', 'pC', 'congC', 'sP', 'lP', 'yP', 'xiP', 'jiP', 'pP', 'delta', 'bandChg', 'yongChg', 'xijiChg', 'patternChg', 'd1', 'd2', 'd3', 'd4', 'd5', 'd5b', 'd6', 'd7', 'd8lin', 'd8liu', 'd8san', 'd8chong', 'd8hehua', 'd8b', 'd8pos', 'raw', 'tier', 'p21hit', 'p22hit', 'p23hit', 'P_d5', 'P_d8hehua', 'P_d8b'];
var out = [hdr.join(',')];
rows.forEach(function (r) {
  out.push([r.set, r.id, r.alias, r.gz, r.sC, r.lC, r.yC, r.xiC, r.jiC, r.pC, r.congC, r.sP, r.lP, r.yP, r.xiP, r.jiP, r.pP, r.sC - r.sP, r.bandChg ? 1 : 0, r.yongChg ? 1 : 0, r.xijiChg ? 1 : 0, r.patternChg ? 1 : 0, r.d.d1, r.d.d2, r.d.d3, r.d.d4, r.d.d5, r.d.d5b, r.d.d6, r.d.d7, r.d.d8lin, r.d.d8liu, r.d.d8san, r.d.d8chong, r.d.d8hehua, r.d.d8b, r.d.d8pos, r.d.raw, r.tier, r.p21hit ? 1 : 0, r.p22hit ? 1 : 0, r.p23hit ? 1 : 0, r.dP.d5, r.dP.d8hehua, r.dP.d8b].join(','));
});
fs.writeFileSync(path.join(ROOT, '_p2_4a_replay.csv'), out.join('\n'), 'utf8');
console.log('✅ _p2_4a_replay.csv 已写（' + rows.length + ' 行）');

// ================= 焦点A：非日支根气 =================
console.log('\n===== A. 非日支根气扫描（强根=禄/长生不在日支，且日支无同五行藏干）=====');
var aRows = [];
ALL.forEach(function (c) {
  var b = toBazi(c.gz);
  var dg = b.day.gan, dgWx = GAN_WX[dg];
  var rootZhi = [], strongZhi = [];
  POS.forEach(function (p) {
    var z = b[p].zhi;
    var cg = CANG[z];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === dgWx) { rootZhi.push(z + '(' + cg[i] + ')' + (i === 0 ? '本气' : i === 1 ? '中气' : '余气')); break; }
    if (z === LU[dg] || z === CS[dg]) strongZhi.push(z + (z === LU[dg] ? '禄' : '长生'));
  });
  var dayRoot = rootZhi.some(function (x) { return x.indexOf(b.day.zhi) === 0; });
  if (strongZhi.length > 0 && !dayRoot) aRows.push({ c: c, rootZhi: rootZhi.join(' '), strongZhi: strongZhi.join(' ') });
});
aRows.forEach(function (a) {
  var r = rows[ALL.indexOf(a.c)];
  console.log('  ' + a.c.id + ' ' + a.c.gz.join(' ') + ' | 强根柱:' + a.strongZhi + ' | 全部根:' + (a.rootZhi || '无') + ' | ②' + r.d.d2 + ' ④' + r.d.d4 + ' | ' + r.sC + ' ' + r.lC);
});
console.log('  合计 ' + aRows.length + ' 盘（全样本 ' + ALL.length + ' 盘）');
console.log('  —— 拓宽：日支无同五行根（不论禄/长生）但年/月/时支有根 ——');
rows.forEach(function (r) {
  var b = toBazi(r.gz.split(' '));
  var dgWx = GAN_WX[b.day.gan];
  var dayHas = CANG[b.day.zhi].some(function (g) { return GAN_WX[g] === dgWx; });
  if (dayHas) return;
  var others = [];
  ['year', 'month', 'hour'].forEach(function (p) {
    var z = b[p].zhi;
    var cg = CANG[z];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === dgWx) { others.push(z + '(' + cg[i] + ')' + (i === 0 ? '本气' : i === 1 ? '中气' : '余气')); break; }
  });
  if (others.length) console.log('  ' + r.id + ' ' + r.gz + ' | 根在:' + others.join(' ') + ' | ②' + r.d.d2 + ' ④' + r.d.d4 + ' | ' + r.sC + ' ' + r.lC);
});

// ================= 焦点B：①休/囚静态交换 =================
console.log('\n===== B. ①休/囚顺序静态交换（休-15→-10 即+5；囚-10→-15 即-5；只算不动引擎）=====');
var bRows = [];
rows.forEach(function (r) {
  var swap = 0, tag = '';
  if (r.d.d1 === -15) { swap = 5; tag = '休'; }
  else if (r.d.d1 === -10) { swap = -5; tag = '囚'; }
  if (!swap) return;
  var raw2 = Math.max(1, Math.min(100, r.d.raw + swap));
  var lv2 = bandOf(raw2);
  var b = toBazi(r.gz.split(' '));
  // 静态重放：把换分后的 strength 对象喂进未改动的引擎（引擎零改动，仅重绑作用域内的计算函数）
  var dm2 = { score: raw2, level: lv2, label: '静态换分', detail: '' };
  var yj2 = null, pat2 = null, cong2 = null;
  try {
    CUR.setDm(function () { return dm2; });
    var b2 = toBazi(r.gz.split(' ')); // 全新对象，避开 _siLing 等任何对象级状态
    yj2 = CUR.yj(b2);
    pat2 = CUR.pat(b2);
    cong2 = CUR.cong(b2);
    CUR.setDm(REAL_DM);
  } catch (e) { CUR.setDm(REAL_DM); yj2 = pat2 = cong2 = null; }
  var crossed = [];
  BANDS.forEach(function (x) { if ((r.sC >= x) !== (raw2 >= x)) crossed.push(x); });
  var yong2 = yj2 ? yj2.yongShen.join('、') : 'ERR';
  var xi2 = yj2 ? yj2.xiShen.join('、') : 'ERR';
  var ji2 = yj2 ? yj2.jiShen.join('、') : 'ERR';
  var congChg = (cong2.isCong ? cong2.name : '否') !== r.congC;
  bRows.push({ id: r.id, gz: r.gz, tag: tag, swap: swap, sC: r.sC, raw2: raw2, lv2: lv2, crossed: crossed, yongChg: yong2 !== r.yC, xijiChg: (xi2 + '|' + ji2) !== (r.xiC + '|' + r.jiC), patternChg: (pat2.name + '·' + pat2.status) !== r.pC, congChg: congChg, yong2: yong2, lC: r.lC, lv2b: lv2 });
});
bRows.forEach(function (r) {
  if (!r.crossed.length && !r.yongChg && !r.xijiChg && !r.patternChg && !r.congChg) return;
  console.log('  ' + r.id + ' ' + r.gz + ' | ' + r.tag + r.swap + ' | ' + r.sC + '→' + r.raw2 + ' ' + r.lC + '→' + r.lv2b + ' | 跨线:' + (r.crossed.join('/') || '无') + ' | 用神:' + (r.yongChg ? '变(' + r.yong2 + ')' : '不变') + ' | 喜忌:' + (r.xijiChg ? '变' : '不变') + ' | 格局:' + (r.patternChg ? '变' : '不变') + ' | 从格:' + (r.congChg ? '变' : '不变'));
});
var bAny = bRows.filter(function (r) { return r.crossed.length || r.yongChg || r.xijiChg || r.patternChg || r.congChg; });
console.log('  休/囚盘共 ' + bRows.length + ' 盘；交换后有任何可见变化的 ' + bAny.length + ' 盘');
bRows.filter(function (r) { return r.crossed.length; }).forEach(function (r) { console.log('    跨线: ' + r.id + ' ' + r.sC + '→' + r.raw2); });
bRows.filter(function (r) { return r.yongChg; }).forEach(function (r) { console.log('    用神变: ' + r.id + ' (' + r.yC + '→' + r.yong2 + ')'); });
// stub 有效性对照：极端分数下用神必须改变（证明重绑链路真实生效）
var cOut = [];
[1, 100].forEach(function (s) {
  CUR.setDm(function () { return { score: s, level: bandOf(s), label: '对照', detail: '' }; });
  cOut.push(s + '分→用' + CUR.yj(toBazi(['己亥', '丙子', '辛酉', '戊子'])).yongShen.join('、'));
  CUR.setDm(REAL_DM);
});
console.log('  stub对照: ' + cOut.join(' | ') + ' | 链路有效=' + (cOut[0] !== cOut[1]));

// ================= 焦点C：⑧关系总贡献分布 =================
console.log('\n===== C. ⑧关系总贡献分布（相邻冲害刑合+跨柱六合+三会半会+跨柱六冲+日支合化）=====');
rows.forEach(function (r) {
  r.rel8 = r.d.d8lin + r.d.d8liu + r.d.d8san + r.d.d8chong + r.d.d8hehua;
  r.singleMin = Math.min(r.d.d8lin, r.d.d8liu, r.d.d8san, r.d.d8chong, r.d.d8hehua);
});
var byRel = rows.slice().sort(function (a, b) { return a.rel8 - b.rel8; });
console.log('  最低10盘:');
byRel.slice(0, 10).forEach(function (r) { console.log('    ' + r.id + ' ' + r.gz + ' rel8=' + r.rel8 + ' 单层最小=' + r.singleMin + ' (' + [r.d.d8lin, r.d.d8liu, r.d.d8san, r.d.d8chong, r.d.d8hehua].join(',') + ')'); });
console.log('  最高10盘:');
byRel.slice(-10).reverse().forEach(function (r) { console.log('    ' + r.id + ' ' + r.gz + ' rel8=' + r.rel8 + ' (' + [r.d.d8lin, r.d.d8liu, r.d.d8san, r.d.d8chong, r.d.d8hehua].join(',') + ')'); });
console.log('  |rel8|>10 全部:');
byRel.filter(function (r) { return Math.abs(r.rel8) > 10; }).forEach(function (r) { console.log('    ' + r.id + ' ' + r.gz + ' rel8=' + r.rel8); });
console.log('  单层≤-15 的盘:');
rows.filter(function (r) { return r.singleMin <= -15; }).forEach(function (r) { console.log('    ' + r.id + ' ' + r.gz + ' 单层=' + r.singleMin + ' (' + [r.d.d8lin, r.d.d8liu, r.d.d8san, r.d.d8chong, r.d.d8hehua].join(',') + ')'); });

// ================= 焦点D：P2.3 休眠分支覆盖 =================
console.log('\n===== D. P2.3 休眠分支覆盖统计（全样本 ' + ALL.length + ' 盘）=====');
var d1 = [], d2 = [], d3 = [];
rows.forEach(function (r) {
  var m = r.mir;
  if (m.dead && m.csl && m.yinAdj && m.po && m.yGanYin && (m.yinRootPos.length > 0 || m.yinDeSheng)) d1.push(r.id);
  if (m.tier === 'A' && m.yinRootPos.length === 0) d2.push(r.id);
  // 印被强克未判受破：贴身印干可见 + 另一可见干克印（财坏印）+ 未判合绊
  if (m.dead && m.csl && m.yinAdj && !m.hePo) {
    var yinWx = shENGWO(m.dgWx), keYinWx = kEWO(yinWx);
    var yinGan = '';
    ['month', 'hour'].forEach(function (p) { if (GAN_WX[toBazi(r.gz.split(' '))[p].gan] === yinWx) yinGan = p; });
    var keYinGan = false;
    if (yinGan) {
      POS.forEach(function (p) {
        var g = toBazi(r.gz.split(' '))[p].gan;
        if (GAN_WX[g] === keYinWx) keYinGan = true;
      });
    }
    if (keYinGan) d3.push(r.id);
  }
});
console.log('  1) 贴身印受破 ∧ 年干印有效（B/C优先级休眠）: ' + (d1.length ? d1.join(' ') : '样本内零覆盖'));
console.log('  2) A档但印无根: ' + (d2.length ? d2.join(' ') : '样本内零覆盖'));
console.log('  3) 贴身印干被财干克（财坏印）但未判受破: ' + (d3.length ? d3.join(' ') : '样本内零覆盖'));

// ================= P2前 vs 当前 汇总 =================
console.log('\n===== P2前(P1冻结13e588b) vs 当前(63fafaa) 汇总 =====');
var bandF = rows.filter(function (r) { return r.bandChg; });
var yongF = rows.filter(function (r) { return r.yongChg; });
var xijiF = rows.filter(function (r) { return r.xijiChg; });
var patF = rows.filter(function (r) { return r.patternChg; });
var scoreF = rows.filter(function (r) { return r.sC !== r.sP; });
console.log('  分数变化 ' + scoreF.length + '/' + rows.length + ' 盘：' + scoreF.map(function (r) { return r.id + '(' + r.sP + '→' + r.sC + ')'; }).join(' '));
console.log('  五档翻转 ' + bandF.length + ' 盘：' + bandF.map(function (r) { return r.id + '(' + r.lP + '→' + r.lC + ')'; }).join(' '));
console.log('  用神变化 ' + yongF.length + ' 盘：' + yongF.map(function (r) { return r.id + '(' + r.yP + '→' + r.yC + ')'; }).join(' '));
console.log('  喜忌变化 ' + xijiF.length + ' 盘：' + xijiF.map(function (r) { return r.id; }).join(' '));
console.log('  格局变化 ' + patF.length + ' 盘：' + patF.map(function (r) { return r.id + '(' + r.pP + '→' + r.pC + ')'; }).join(' '));
console.log('\n===== P2 三层归因验证（P2.1日支合化 / P2.2过耗 / P2.3四档杀印）=====');
var attrOk = true;
scoreF.forEach(function (r) {
  // P2.1 的足迹跨两个层：合化记账从⑧相邻层移入⑧日支合化层，两层一起算
  var a21 = (r.d.d8lin - r.dP.d8lin) + (r.d.d8hehua - r.dP.d8hehua);
  var a22 = r.d.d5 - r.dP.d5;
  var a23 = r.d.d8b - r.dP.d8b;
  var sum = a21 + a22 + a23;
  var rawDelta = r.d.raw - r.dP.raw; // 未钳位 raw 差（P1 终钳位会掩盖 raw>100 的盘）
  var clamped = r.sC - r.sP;
  var ok = Math.abs(sum - rawDelta) < 0.01;
  if (!ok) attrOk = false;
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + r.id + ' rawΔ=' + rawDelta + ' = P2.1(' + a21 + ') + P2.2(' + a22 + ') + P2.3(' + a23 + ')' + (Math.abs(rawDelta - clamped) > 0.01 ? '  [终分Δ=' + clamped + ' 被钳位掩盖]' : ''));
  if (!ok) {
    var kk = ['d1', 'd2', 'd3', 'd4', 'd5', 'd5b', 'd6', 'd7', 'd8lin', 'd8liu', 'd8san', 'd8chong', 'd8hehua', 'd8b', 'd8pos'];
    console.log('      P1各层: ' + kk.map(function (k) { return k + '=' + r.dP[k]; }).join(' '));
    console.log('      当前各层: ' + kk.map(function (k) { return k + '=' + r.d[k]; }).join(' '));
    console.log('      逐层差: ' + kk.map(function (k) { var v = r.d[k] - r.dP[k]; return v ? k + ':' + v : ''; }).filter(Boolean).join(' '));
  }
});
console.log(attrOk ? '  归因完备：所有分数变化盘的 rawΔ 均完全分解到三层（P2.1跨层足迹=⑧相邻+⑧日支合化），无残余项' : '  ❌ 存在无法归因的残余项');
console.log('\nP2 总复盘第一阶段回放完成。');
