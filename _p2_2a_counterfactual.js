// P2.2 ⑤过耗降权正式反事实（2026-08-13，GPT P2.2 指令）
// BASE = 已部署 main HEAD（47f6ae6 的 js/bazi.js）＝ ⑤囚×8 / 休×4（P1 冻结口径）
// P22  = ⑤囚×4 / 休×2（内存补丁，仅改⑤系数；禁改①/②③④/⑤½/⑥/⑧/⑧½/P1/structuralRisks）
// 断言纪律（CF 标记防静默失效）：
//   A1 工作区 js/bazi.js === git HEAD 字节级（= 线上已部署版本）
//   A2 ⑤/①/⑤½ 补丁锚点在 BASE 源中各恰好 1 处
//   A3 P22 源 === 仪表化源仅替换⑤块一次（差异面恰为⑤块）
//   A4 BASE(未仪表化) === BASE(仪表化)：全样本 × 8 字段全等（仪表化零行为改变）
//   A5 探针侧独立镜像（三会局覆盖+①分支表+⑤计数）=== 引擎捕获值（__CF1/__CF5）
//   A6 逐盘：P22−BASE 差值 === 命中⑤时 (count−1)×系数差（囚4/休2），未命中/短路时 0
// 任一失败立即抛错停止。不改 js/bazi.js、不 push。
// 用法: node _p2_2a_counterfactual.js
// 产物: _p2_2a_counterfactual.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), cp = require('child_process'), ROOT = __dirname;
var ENGINE = path.join(ROOT, 'js', 'bazi.js');
var baseSrcRaw = fs.readFileSync(ENGINE); // 原始字节（含 CRLF）

// ---------- A1: 工作区引擎 === git HEAD（已部署版本） ----------
// 仓库 core.autocrlf：blob 为 LF（=线上服务器 pull 的字节），工作区检出 CRLF。
// 二者仅行尾差异（工作区字节数−blob 字节数 = 行数 5547），LF 归一化后必须逐字节一致；
// 同时 git hash-object（含 clean filter）必须 === HEAD blob 哈希。
var headRaw = cp.execFileSync('git', ['-C', ROOT, 'show', 'HEAD:js/bazi.js']);
var normBuf = function(b) { return b.toString('utf-8').replace(/\r\n/g, '\n'); };
if (normBuf(baseSrcRaw) !== normBuf(headRaw)) {
  console.error('❌ A1 失败：工作区 js/bazi.js 归一化后 ≠ git HEAD（工作区被改动？）');
  process.exit(1);
}
var hObj = cp.execFileSync('git', ['-C', ROOT, 'hash-object', ENGINE]).toString('utf-8').trim();
var hHead = cp.execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD:js/bazi.js']).toString('utf-8').trim();
if (hObj !== hHead) {
  console.error('❌ A1 失败：hash-object ' + hObj + ' ≠ HEAD blob ' + hHead);
  process.exit(1);
}
console.log('✅ A1：工作区 js/bazi.js === git HEAD 47f6ae6（=线上已部署版本；blob LF/工作区 CRLF 仅行尾差异）');

// ---------- 归一化 LF 用于补丁构造（eval 行为与字节无关；等价性由 A4 断言保证） ----------
var src = baseSrcRaw.toString('utf-8').replace(/\r\n/g, '\n');

// ---------- ⑤块（精确抄自引擎 2297-2313） ----------
var BLOCK5_BASE =
'  if (mwxCount >= 2) {\n' +
'    if (WOKE[dgWx] === mwx) score -= (mwxCount - 1) * 8;   // 囚令：日主克月令反被耗（如金克木，木多金缺）\n' +
'    else if (WOSHENG[dgWx] === mwx) score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重\n' +
'  }';
var BLOCK5_INSTR =
'  global.__CF5 = 0; global.__CF5kind = \'\'; global.__CF5half = 0;\n' +
'  if (mwxCount >= 2) {\n' +
'    if (WOKE[dgWx] === mwx) { score -= (mwxCount - 1) * 8; global.__CF5 = -(mwxCount - 1) * 8; global.__CF5kind = \'囚\'; }   // 囚令：日主克月令反被耗（如金克木，木多金缺）\n' +
'    else if (WOSHENG[dgWx] === mwx) { score -= (mwxCount - 1) * 4; global.__CF5 = -(mwxCount - 1) * 4; global.__CF5kind = \'休\'; } // 休令：日主生月令泄气过重\n' +
'  }';
var BLOCK5_P22 =
'  global.__CF5 = 0; global.__CF5kind = \'\'; global.__CF5half = 0;\n' +
'  if (mwxCount >= 2) {\n' +
'    if (WOKE[dgWx] === mwx) { score -= (mwxCount - 1) * 4; global.__CF5 = -(mwxCount - 1) * 4; global.__CF5kind = \'囚\'; }   // 囚令：日主克月令反被耗（如金克木，木多金缺）\n' +
'    else if (WOSHENG[dgWx] === mwx) { score -= (mwxCount - 1) * 2; global.__CF5 = -(mwxCount - 1) * 2; global.__CF5kind = \'休\'; } // 休令：日主生月令泄气过重\n' +
'  }';
var LINE5HALF = "  if (dgWx === '金' && ['未','戌'].indexOf(bazi.month.zhi) >= 0 && mwxCount >= 3) score -= 8;";
var LINE5HALF_INSTR = "  if (dgWx === '金' && ['未','戌'].indexOf(bazi.month.zhi) >= 0 && mwxCount >= 3) { score -= 8; global.__CF5half = -8; }";
var LINE_CLAMP = '  if (score < 1) score = 1;';
var LINE_CLAMP_INSTR = '  global.__CF_raw = score;\n  if (score < 1) score = 1;';
var ANCHOR1_BEFORE = '  // ---------- ① 得令：月令地支本气与日主关系 (权重最大) ----------';
var ANCHOR1_AFTER = '  // --- v5.3 人元司令分野（独立计算，不覆盖本气得令，仅作参考标注）---';

// ---------- A2: 锚点存在性 ----------
function countOcc(s, sub) { var n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
var checks = [
  ['BLOCK5_BASE', BLOCK5_BASE, 1], ['LINE5HALF', LINE5HALF, 1], ['LINE_CLAMP', LINE_CLAMP, 1],
  ['ANCHOR1_BEFORE', ANCHOR1_BEFORE, 1], ['ANCHOR1_AFTER', ANCHOR1_AFTER, 1]
];
var a2ok = true;
checks.forEach(function(c) {
  var n = countOcc(src, c[1]);
  if (n !== c[2]) { a2ok = false; console.error('❌ A2 失败：锚点 ' + c[0] + ' 出现 ' + n + ' 次 ≠ ' + c[2]); }
});
if (!a2ok) process.exit(1);
console.log('✅ A2：⑤/⑤½/① 全部补丁锚点在 BASE 源中各恰 1 处');

// ---------- 构造三份源：UNIN(原样) / INSTR(BASE仪表化) / P22(仪表化+⑤降权) ----------
var srcUnin = src;
var srcInstr = src
  .replace(ANCHOR1_BEFORE, '  global.__CF1_before = score;\n' + ANCHOR1_BEFORE)
  .replace(ANCHOR1_AFTER, '  global.__CF1_after = score;\n' + ANCHOR1_AFTER)
  .replace(BLOCK5_BASE, BLOCK5_INSTR)
  .replace(LINE5HALF, LINE5HALF_INSTR)
  .replace(LINE_CLAMP, LINE_CLAMP_INSTR);
var srcP22 = srcInstr.replace(BLOCK5_INSTR, BLOCK5_P22);

// ---------- A3: 差异面恰为⑤块 ----------
var cf5n = countOcc(srcInstr, 'global.__CF5');
if (cf5n !== 8) { console.error('❌ A3 失败：INSTR 中 __CF5 出现 ' + cf5n + ' 次 ≠ 8（⑤块7 + ⑤½捕获1）'); process.exit(1); }
if (countOcc(srcP22, BLOCK5_INSTR) !== 0 || countOcc(srcP22, BLOCK5_P22) !== 1) { console.error('❌ A3 失败：P22 未恰好替换⑤块一次'); process.exit(1); }
var instrExtra = srcInstr.replace(BLOCK5_INSTR, BLOCK5_BASE).replace(LINE5HALF_INSTR, LINE5HALF).replace(LINE_CLAMP_INSTR, LINE_CLAMP);
if (instrExtra.replace('  global.__CF1_before = score;\n', '').replace('  global.__CF1_after = score;\n', '') !== srcUnin) {
  console.error('❌ A3 失败：仪表化差异面超出①/⑤/⑤½/钳位 捕获点');
  process.exit(1);
}
console.log('✅ A3：P22 源 = 仪表化源仅替换⑤块一次；差异面恰为①⑤/⑤½/钳位捕获点（禁改清单零触碰）');

// ---------- 顺序装载三份引擎并捕获函数引用 ----------
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function(n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
function load(s) {
  eval(s.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  return {
    dm: calcDayMasterStrength, yj: getYongJi, cong: getCongGe, pat: getPattern,
    c1: global.__CF1_before, c1a: global.__CF1_after, c5: global.__CF5, c5k: global.__CF5kind, c5h: global.__CF5half, raw: global.__CF_raw
  };
}
function resetCF() {
  global.__CF1_before = undefined; global.__CF1_after = undefined;
  global.__CF5 = undefined; global.__CF5kind = undefined; global.__CF5half = undefined;
  global.__CF_raw = undefined;
}
resetCF(); var UNIN = load(srcUnin);
resetCF(); var INSTR = load(srcInstr);
resetCF(); var P22 = load(srcP22);

// ---------- 样本装载 ----------
// 22 基线（_baseline_22.csv 22 行；#8 与 B1 同盘，按行计）
var csvLines = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
var C22 = csvLines.map(function(line) {
  var m = line.match(/^"([^"]+)","([^"]+)"/);
  return { set: '22基线', id: m[1], gz: m[2].split(' ') };
});
if (C22.length !== 22) { console.error('❌ 22 基线行数 ' + C22.length + ' ≠ 22'); process.exit(1); }
// 六盘冻结锚点
var C6 = [
  { set: '六盘锚点', id: 'P15-03', gz: ['乙丑','戊寅','己巳','庚午'] },
  { set: '六盘锚点', id: 'P15-09', gz: ['丁丑','癸卯','庚申','丙戌'] },
  { set: '六盘锚点', id: 'P15-12', gz: ['戊子','甲寅','庚申','丁亥'] },
  { set: '六盘锚点', id: 'P15-14', gz: ['丙寅','庚寅','戊辰','癸亥'] },
  { set: '六盘锚点', id: 'P15-15', gz: ['癸未','戊午','乙卯','丙戌'] },
  { set: '六盘锚点', id: 'P15-16', gz: ['丁卯','壬寅','壬午','庚子'] }
];
// P2.1 专项 18 盘（附加观察集）
var C18 = [
  { id:'H01', gz:['癸未','戊午','乙卯','丙戌'] }, { id:'H02', gz:['戊辰','甲寅','丁亥','庚子'] },
  { id:'H03', gz:['甲寅','戊辰','壬子','辛丑'] }, { id:'H04', gz:['甲申','庚午','辛卯','戊戌'] },
  { id:'H05', gz:['庚子','乙酉','甲辰','甲子'] }, { id:'H06', gz:['乙巳','壬午','丁未','戊申'] },
  { id:'H07', gz:['己丑','丙寅','丁亥','甲辰'] }, { id:'H08', gz:['丁酉','丙午','丁卯','庚戌'] },
  { id:'H09', gz:['甲寅','壬申','壬辰','己酉'] }, { id:'H10', gz:['癸未','丁巳','丙戌','辛卯'] },
  { id:'H11', gz:['壬辰','癸卯','戊戌','丁巳'] }, { id:'H12', gz:['甲申','丁丑','壬辰','己酉'] },
  { id:'H13', gz:['壬寅','丙午','丙戌','辛卯'] }, { id:'H14', gz:['乙丑','己丑','壬子','辛丑'] },
  { id:'H15', gz:['甲寅','庚午','庚辰','乙酉'] }, { id:'H16', gz:['丙辰','庚子','癸巳','庚申'] },
  { id:'H17', gz:['甲子','丙子','癸亥','甲寅'] }, { id:'H18', gz:['癸卯','己未','甲午','壬申'] }
].map(function(c) { c.set = '18专项(观察)'; return c; });
// P15-19（附加观察，不属 28 盘设计样本）
var COBS = [{ set: '附加观察', id: 'P15-19', gz: ['己亥','丙子','辛酉','戊子'] }];
var ALL = C22.concat(C6, C18, COBS);
console.log('样本：22基线×' + C22.length + ' + 锚点×' + C6.length + ' + 18专项×' + C18.length + ' + P15-19×1 = ' + ALL.length + ' 行（28盘设计样本 = 前两者）');

// ---------- 探针侧独立镜像 ----------
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var SHENG = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
var KE    = {'木':'土','火':'金','土':'水','金':'木','水':'火'};
function shENGWO(dg) { for (var k in SHENG) if (SHENG[k] === dg) return k; }
function kEWO(dg) { for (var k in KE) if (KE[k] === dg) return k; }
function huiOverride(b) {
  var zhis = [b.year.zhi, b.month.zhi, b.day.zhi, b.hour.zhi];
  var sets = [
    { z: ['寅','卯','辰'], wx: '木' }, { z: ['巳','午','未'], wx: '火' },
    { z: ['申','酉','戌'], wx: '金' }, { z: ['亥','子','丑'], wx: '水' }
  ];
  for (var i = 0; i < sets.length; i++) {
    var s = sets[i];
    if (s.z.every(function(z) { return zhis.indexOf(z) >= 0; }) && s.z.indexOf(b.month.zhi) >= 0) return s.wx;
  }
  return null;
}
function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function mirrorLing1(dgWx, mwx, monthZhi) {
  var wet = (dgWx === '水' && (monthZhi === '丑' || monthZhi === '辰')) ? 12 : 0;
  if (mwx === dgWx) {
    if (dgWx === '土') { var ts = { '未': 30, '戌': 12, '丑': -8, '辰': -5 }; if (ts[monthZhi] !== undefined) return ts[monthZhi]; }
    return 30;
  }
  if (shENGWO(dgWx) === mwx) {
    if (dgWx === '金' && (monthZhi === '未' || monthZhi === '戌')) return 0;
    return 20;
  }
  if (SHENG[dgWx] === mwx) return -15;
  if (KE[dgWx] === mwx) return -10;
  if (kEWO(dgWx) === mwx) return -(25 - wet);
  return NaN;
}
function mirror5(b, mwx) {
  var c = 0;
  ['year','month','day','hour'].forEach(function(p) {
    if (GAN_WX[b[p].gan] === mwx) c++;
    if (ZHI_WX[b[p].zhi] === mwx) c++;
  });
  var dg = GAN_WX[b.day.gan];
  if (c >= 2) {
    if (KE[dg] === mwx) return { hit: true, kind: '囚', c: c, vBase: -(c-1)*8, vP22: -(c-1)*4 };
    if (SHENG[dg] === mwx) return { hit: true, kind: '休', c: c, vBase: -(c-1)*4, vP22: -(c-1)*2 };
  }
  return { hit: false, kind: '', c: c, vBase: 0, vP22: 0 };
}
function levelOf(s) { if (s < 30) return '极弱'; if (s < 40) return '偏弱'; if (s < 60) return '中和'; if (s < 80) return '偏强'; return '极强'; }

// ---------- 逐盘跑三引擎 + 断言 ----------
function runRow(eng, b) {
  var dm = eng.dm(b);
  var yj = eng.yj(b), pat = eng.pat(b), cong = eng.cong(b);
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pat.name + '·' + pat.status, cong: cong.isCong ? cong.name : '否',
    c1b: global.__CF1_before, c1a: global.__CF1_after, c5: global.__CF5, c5k: global.__CF5kind, c5h: global.__CF5half, raw: global.__CF_raw
  };
}
var rows = [];
var a4fail = [], a5fail = [], a6fail = [];
ALL.forEach(function(c) {
  var b = toBazi(c.gz);
  var dgWx = GAN_WX[b.day.gan];
  resetCF(); var rU = runRow(UNIN, b);
  resetCF(); var rI = runRow(INSTR, b);
  resetCF(); var rP = runRow(P22, b);
  var mwx = huiOverride(b) || ZHI_WX[b.month.zhi];
  var mir1 = mirrorLing1(dgWx, mwx, b.month.zhi);
  var mir5 = mirror5(b, mwx);

  // A4: 仪表化零行为改变
  ['score','level','yong','xi','ji','pattern','cong'].forEach(function(k) {
    if (rU[k] !== rI[k]) a4fail.push(c.id + '.' + k + ': ' + rU[k] + ' ≠ ' + rI[k]);
  });
  // A5: 探针镜像 === 引擎捕获
  var c1val = (rI.c1b !== undefined && rI.c1a !== undefined) ? (rI.c1a - rI.c1b) : undefined;
  if (c1val !== mir1) a5fail.push(c.id + ' ①: 引擎' + c1val + ' ≠ 镜像' + mir1);
  if (rI.c5 !== undefined) { // 到达⑤块
    if (rI.c5 !== mir5.vBase) a5fail.push(c.id + ' ⑤BASE: 引擎' + rI.c5 + ' ≠ 镜像' + mir5.vBase);
    if (rI.c5k !== mir5.kind) a5fail.push(c.id + ' ⑤kind: 引擎' + rI.c5k + ' ≠ 镜像' + mir5.kind);
    if (rP.c5 !== mir5.vP22) a5fail.push(c.id + ' ⑤P22: 引擎' + rP.c5 + ' ≠ 镜像' + mir5.vP22);
    // A6: 原始分差精确（钳位前），可见分 = clamp(raw)
    var expDiff = mir5.vP22 - mir5.vBase;
    if ((rP.raw - rI.raw) !== expDiff) a6fail.push(c.id + ' 原始分差 ' + (rP.raw - rI.raw) + ' ≠ 预期 ' + expDiff);
    var cl = function(s) { return Math.max(1, Math.min(100, s)); };
    if (rI.score !== cl(rI.raw)) a6fail.push(c.id + ' BASE 可见分 ' + rI.score + ' ≠ clamp(' + rI.raw + ')');
    if (rP.score !== cl(rP.raw)) a6fail.push(c.id + ' P22 可见分 ' + rP.score + ' ≠ clamp(' + rP.raw + ')');
  } else {
    // 短路（未到达⑤）：P22 必须零差异
    if (rP.score !== rI.score) a6fail.push(c.id + ' ⑤短路盘却有分差 ' + (rP.score - rI.score));
  }

  var hit = rI.c5 !== undefined && mir5.hit;
  rows.push({
    set: c.set, id: c.id, gz: c.gz.join(' '), dg: dgWx, mz: b.month.zhi, mwx: mwx,
    ling1: mir1, kind: mir5.kind, cnt: mir5.c, hit: hit, shortCircuit: rI.c5 === undefined,
    v5: hit ? mir5.vBase : 0, v22: hit ? mir5.vP22 : 0,
    ratioB: (hit && mir1 !== 0) ? +(Math.abs(mir5.vBase / mir1)).toFixed(2) : '',
    ratioP: (hit && mir1 !== 0) ? +(Math.abs(mir5.vP22 / mir1)).toFixed(2) : '',
    sBase: rI.score, lBase: rI.level, sP22: rP.score, lP22: rP.level,
    rawBase: rI.raw, rawP22: rP.raw, masked: rI.raw !== rP.raw && rI.score === rP.score,
    flipLevel: rI.level !== rP.level,
    yBase: rI.yong, yP22: rP.yong, xiBase: rI.xi, xiP22: rP.xi, jiBase: rI.ji, jiP22: rP.ji,
    pBase: rI.pattern, pP22: rP.pattern, half: rI.c5h
  });
});
if (a4fail.length) { console.error('❌ A4 失败（仪表化改变行为）:'); a4fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
if (a5fail.length) { console.error('❌ A5 失败（探针镜像≠引擎）:'); a5fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
if (a6fail.length) { console.error('❌ A6 失败（差值不精确）:'); a6fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
console.log('✅ A4：仪表化零行为改变（' + ALL.length + ' 行 × 7 字段全等）');
console.log('✅ A5：探针镜像 === 引擎捕获（①分值 + ⑤BASE/P22/kind 逐盘全等）');
console.log('✅ A6：逐盘 P22−BASE 差值精确 === ⑤系数差（命中盘），短路盘零差');

// ---------- 报告 ----------
var hitRows = rows.filter(function(r) { return r.hit; });
var shortRows = rows.filter(function(r) { return r.shortCircuit; });
console.log('\n========== ⑤命中清单（' + hitRows.length + ' 行）==========');
hitRows.forEach(function(r) {
  console.log(
    '[' + r.set + '] ' + r.id + ' ' + r.gz +
    ' | ' + r.dg + '日主 ' + r.mz + '月(' + r.mwx + '令) ' + r.kind + '令 ①=' + r.ling1 +
    ' | mwxCount=' + r.cnt + ' ⑤BASE=' + r.v5 + ' ⑤P22=' + r.v22 +
    ' | 比值' + r.ratioB + '→' + r.ratioP +
    ' | ' + r.sBase + '(' + r.lBase + ')→' + r.sP22 + '(' + r.lP22 + ')' + (r.flipLevel ? ' ⚡翻档' : '') +
    (r.masked ? ' ⚠钳位掩盖(原始' + r.rawBase + '→' + r.rawP22 + ')' : '')
  );
});
if (shortRows.length) {
  console.log('\n从格/短路（未到达⑤，P22 零差异）：' + shortRows.map(function(r) { return r.id; }).join('、'));
}
console.log('\n========== 28盘设计样本统计（22基线+六盘锚点）==========');
var s28 = rows.filter(function(r) { return r.set === '22基线' || r.set === '六盘锚点'; });
var hit28 = s28.filter(function(r) { return r.hit; });
console.log('⑤命中 ' + hit28.length + '/28 行：' + hit28.map(function(r) { return r.id; }).join('、'));
console.log('其中可见分变化 ' + hit28.filter(function(r) { return !r.masked; }).length + ' 行；钳位掩盖：' + (hit28.filter(function(r) { return r.masked; }).map(function(r) { return r.id; }).join('、') || '无'));
console.log('五档翻转 ' + s28.filter(function(r) { return r.flipLevel; }).length + ' 行：' + s28.filter(function(r) { return r.flipLevel; }).map(function(r) { return r.id + ' ' + r.lBase + '→' + r.lP22; }).join('、'));
console.log('用神翻转 ' + s28.filter(function(r) { return r.yBase !== r.yP22; }).length + ' 行：' + s28.filter(function(r) { return r.yBase !== r.yP22; }).map(function(r) { return r.id + ' ' + r.yBase + '→' + r.yP22; }).join('、'));
console.log('喜神翻转 ' + s28.filter(function(r) { return r.xiBase !== r.xiP22; }).length + ' 行：' + s28.filter(function(r) { return r.xiBase !== r.xiP22; }).map(function(r) { return r.id + ' ' + r.xiBase + '→' + r.xiP22; }).join('、'));
console.log('忌神翻转 ' + s28.filter(function(r) { return r.jiBase !== r.jiP22; }).length + ' 行：' + s28.filter(function(r) { return r.jiBase !== r.jiP22; }).map(function(r) { return r.id + ' ' + r.jiBase + '→' + r.jiP22; }).join('、'));
console.log('格局变化 ' + s28.filter(function(r) { return r.pBase !== r.pP22; }).length + ' 行：' + s28.filter(function(r) { return r.pBase !== r.pP22; }).map(function(r) { return r.id + ' ' + r.pBase + '→' + r.pP22; }).join('、'));

console.log('\n========== 18专项观察集（P2.1 相关盘干扰检查）==========');
var s18 = rows.filter(function(r) { return r.set === '18专项(观察)'; });
var hit18 = s18.filter(function(r) { return r.hit; });
console.log('⑤命中 ' + hit18.length + '/18：' + hit18.map(function(r) { return r.id; }).join('、'));
console.log('五档翻转 ' + s18.filter(function(r) { return r.flipLevel; }).map(function(r) { return r.id + ' ' + r.lBase + '→' + r.lP22; }).join('、'));
console.log('用神翻转：' + (s18.filter(function(r) { return r.yBase !== r.yP22; }).map(function(r) { return r.id; }).join('、') || '无'));
console.log('喜/忌翻转：' + (s18.filter(function(r) { return r.xiBase !== r.xiP22 || r.jiBase !== r.jiP22; }).map(function(r) { return r.id; }).join('、') || '无'));
console.log('格局变化：' + (s18.filter(function(r) { return r.pBase !== r.pP22; }).map(function(r) { return r.id; }).join('、') || '无'));

console.log('\n========== ⑥ 重复表达审计（⑤ / ① 量级）==========');
hitRows.forEach(function(r) {
  var flags = [];
  if (Math.abs(r.v5) >= Math.abs(r.ling1)) flags.push('BASE⑤≥①');
  if (Math.abs(r.v22) >= Math.abs(r.ling1)) flags.push('P22⑤≥①');
  if (Math.abs(r.v5) >= 12) flags.push('BASE|⑤|≥12');
  if (Math.abs(r.v22) >= 12) flags.push('P22|⑤|≥12');
  console.log(r.id + ' ' + r.gz + ' | ①=' + r.ling1 + ' ⑤BASE=' + r.v5 + '(' + r.ratioB + ') ⑤P22=' + r.v22 + '(' + r.ratioP + ')' + (flags.length ? '  ⚠ ' + flags.join(' ') : ''));
});

console.log('\n========== 重点盘单列 ==========');
['P15-12','B2','#8','B1','P15-15','P15-19'].forEach(function(id) {
  var r = rows.filter(function(x) { return x.id === id; })[0];
  if (!r) return;
  console.log(id + ' ' + r.gz + ' | ①=' + r.ling1 + '(' + r.kind + '令) ⑤BASE=' + r.v5 + ' ⑤P22=' + r.v22 + ' cnt=' + r.cnt +
    ' | ' + r.sBase + '(' + r.lBase + ')→' + r.sP22 + '(' + r.lP22 + ')' + (r.flipLevel ? ' ⚡翻档' : '') +
    ' | 用 ' + r.yBase + (r.yBase !== r.yP22 ? '→' + r.yP22 : '') +
    ' | 喜 ' + r.xiBase + (r.xiBase !== r.xiP22 ? '→' + r.xiP22 : '') +
    ' | 忌 ' + r.jiBase + (r.jiBase !== r.jiP22 ? '→' + r.jiP22 : ''));
});
var halfRows = rows.filter(function(r) { return r.half; });
console.log('⑤½(土多金埋) 命中：' + (halfRows.map(function(r) { return r.id; }).join('、') || '无（样本内未触发，两变体⑤½均未改动）'));

// ---------- CSV ----------
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
var csvHead = ['样本集','编号','八字','日主','月支','月令五行mwx','①令','①分值','mwxCount','⑤命中','⑤BASE','⑤P22','|⑤|/|①|BASE','|⑤|/|①|P22','BASE分','BASE档','P22分','P22档','档位翻转','用神','喜神','忌神','格局','备注'];
var csv = [csvHead.join(',')];
rows.forEach(function(r) {
  var note = [];
  if (r.hit) note.push('⑤命中');
  if (r.shortCircuit) note.push('短路未达⑤');
  if (Math.abs(r.v5) >= Math.abs(r.ling1) && r.hit) note.push('BASE⑤≥①');
  if (Math.abs(r.v22) >= Math.abs(r.ling1) && r.hit) note.push('P22⑤≥①');
  if (Math.abs(r.v5) >= 12 && r.hit) note.push('BASE|⑤|≥12');
  if (r.flipLevel) note.push('翻档');
  if (r.yBase !== r.yP22) note.push('用神翻转');
  if (r.xiBase !== r.xiP22) note.push('喜翻转');
  if (r.jiBase !== r.jiP22) note.push('忌翻转');
  if (r.pBase !== r.pP22) note.push('格局变');
  if (r.half) note.push('⑤½命中');
  csv.push([r.set, r.id, r.gz, r.dg, r.mz, r.mwx, r.kind, r.ling1, r.cnt, r.hit ? '是' : '否', r.v5, r.v22, r.ratioB, r.ratioP,
    r.sBase, r.lBase, r.sP22, r.lP22, r.flipLevel ? '是' : '否', r.yBase + '→' + r.yP22, r.xiBase + '→' + r.xiP22, r.jiBase + '→' + r.jiP22, r.pBase + '→' + r.pP22, note.join('；')].map(csvQ).join(','));
});
fs.writeFileSync(path.join(ROOT, '_p2_2a_counterfactual.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n✅ 全部断言通过，已写入 _p2_2a_counterfactual.csv（' + rows.length + ' 行）');
