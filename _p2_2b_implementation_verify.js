// P2.2 ⑤过耗降权正式实装验证（2026-08-13，GPT P2.2 最终裁决第6-9条）
// 正式引擎 js/bazi.js 已按裁决实装：⑤ 囚×(mwxCount-1)×4 / 休×(mwxCount-1)×2（原 ×8/×4）
// 本脚本验证：正式实装与反事实 P22 内存预览逐盘全等，并复核对 GPT 第8条预期值。
// 断言组：
//   B1 单变量提交：工作区 === 基线 47f6ae6（P2.2 反事实 BASE，main 部署态）仅替换⑤块两处系数（其余逐字节一致，禁改清单零触碰）
//   B2 正式引擎 47 行 × 6 字段 === _p2_2a_counterfactual.csv 的 P22 侧全等
//   B3 BASE→正式 差异集与反事实记录一致（28盘翻档恰{P15-12}、用/喜/忌/格局0翻转；18专项恰H18；P15-19用喜忌翻转）
//   B4 GPT 裁决第8条预期值硬断言（P15-12=31偏弱、P15-15=29.75极弱、P15-16=28极弱、B2=27、#8/B1=28、H18=31偏弱+正财格·成格、#4=1极弱）
//   B5 ⑥重复表达审计：除#4外 |⑤|/|①| ≤0.8；#4=2.0（钳位掩盖，裁决第3条已接受）
// 任一失败立即抛错停止。不 push。
// 用法: node _p2_2b_implementation_verify.js
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), cp = require('child_process'), ROOT = __dirname;
var ENGINE = path.join(ROOT, 'js', 'bazi.js');
// 基线钉死 47f6ae6（不用 HEAD：提交到分支后 HEAD 已含 P2.2 改动）
var headRaw = cp.execFileSync('git', ['-C', ROOT, 'show', '47f6ae6:js/bazi.js']);
var normBuf = function(b) { return b.toString('utf-8').replace(/\r\n/g, '\n'); };
var wsSrc = normBuf(fs.readFileSync(ENGINE));
var headSrc = normBuf(headRaw);

// ---------- ⑤块（BASE 与 实装后，精确抄自引擎 2297-2313 / 裁决第6条） ----------
var BLOCK5_BASE =
'  if (mwxCount >= 2) {\n' +
'    if (WOKE[dgWx] === mwx) score -= (mwxCount - 1) * 8;   // 囚令：日主克月令反被耗（如金克木，木多金缺）\n' +
'    else if (WOSHENG[dgWx] === mwx) score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重\n' +
'  }';
var BLOCK5_NEW =
'  if (mwxCount >= 2) {\n' +
'    if (WOKE[dgWx] === mwx) score -= (mwxCount - 1) * 4;   // 囚令：日主克月令反被耗（如金克木，木多金缺）\n' +
'    else if (WOSHENG[dgWx] === mwx) score -= (mwxCount - 1) * 2; // 休令：日主生月令泄气过重\n' +
'  }';

// ---------- B1: 单变量提交 ----------
function countOcc(s, sub) { var n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
var expectedSrc = headSrc.replace(BLOCK5_BASE, BLOCK5_NEW);
if (wsSrc !== expectedSrc) {
  console.error('❌ B1 失败：工作区 js/bazi.js ≠ 基线 47f6ae6 仅替换⑤块两处系数（存在⑤以外的差异面！）');
  process.exit(1);
}
if (countOcc(headSrc, BLOCK5_BASE) !== 1) { console.error('❌ B1 失败：基线 47f6ae6 中 BASE⑤块出现次数 ≠ 1'); process.exit(1); }
if (countOcc(wsSrc, BLOCK5_BASE) !== 0 || countOcc(wsSrc, BLOCK5_NEW) !== 1) { console.error('❌ B1 失败：工作区⑤块形态不符（BASE 残留或 NEW 缺失）'); process.exit(1); }
console.log('✅ B1：单变量提交——工作区 === 基线 47f6ae6 仅⑤块两处系数 8→4 / 4→2，其余逐字节一致（禁改清单零触碰）');

// ---------- 装载正式引擎 ----------
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function(n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(wsSrc.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
var FORMAL = { dm: calcDayMasterStrength, yj: getYongJi, pat: getPattern, cong: getCongGe };

// ---------- 样本装载（与 _p2_2a 完全一致） ----------
var csvLines = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
var C22 = csvLines.map(function(line) {
  var m = line.match(/^"([^"]+)","([^"]+)"/);
  return { set: '22基线', id: m[1], gz: m[2].split(' ') };
});
if (C22.length !== 22) { console.error('❌ 22 基线行数 ' + C22.length + ' ≠ 22'); process.exit(1); }
var C6 = [
  { set: '六盘锚点', id: 'P15-03', gz: ['乙丑','戊寅','己巳','庚午'] },
  { set: '六盘锚点', id: 'P15-09', gz: ['丁丑','癸卯','庚申','丙戌'] },
  { set: '六盘锚点', id: 'P15-12', gz: ['戊子','甲寅','庚申','丁亥'] },
  { set: '六盘锚点', id: 'P15-14', gz: ['丙寅','庚寅','戊辰','癸亥'] },
  { set: '六盘锚点', id: 'P15-15', gz: ['癸未','戊午','乙卯','丙戌'] },
  { set: '六盘锚点', id: 'P15-16', gz: ['丁卯','壬寅','壬午','庚子'] }
];
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
var COBS = [{ set: '附加观察', id: 'P15-19', gz: ['己亥','丙子','辛酉','戊子'] }];
var ALL = C22.concat(C6, C18, COBS);

// ---------- 反事实 CSV（P22 侧权威记录） ----------
function parseCsv(path_) {
  var text = fs.readFileSync(path_, 'utf-8').replace(/^﻿/, '');
  return text.split(/\r?\n/).filter(Boolean).map(function(line) {
    return line.split(',').map(function(f) { return f.replace(/^"|"$/g, '').replace(/""/g, '"'); });
  });
}
var cfRows = parseCsv(path.join(ROOT, '_p2_2a_counterfactual.csv'));
if (cfRows.length !== 1 + ALL.length) { console.error('❌ CSV 行数 ' + cfRows.length + ' ≠ ' + (1 + ALL.length)); process.exit(1); }
var cfHead = cfRows[0];
var col = {}; cfHead.forEach(function(h, i) { col[h] = i; });
var cfById = {}; cfRows.slice(1).forEach(function(r) { cfById[r[col['编号']]] = r; });
if (Object.keys(cfById).length !== ALL.length) { console.error('❌ CSV 编号去重后行数 ≠ 样本数'); process.exit(1); }

// ---------- 逐盘：正式引擎 vs CSV P22 侧 ----------
function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function sides(field) { // "a→b" 或 "a→同"
  var parts = field.split('→');
  return { b: parts[0], p: parts[1] === '同' ? parts[0] : parts[1] };
}
var b2fail = [], b3fail = [], b4fail = [], b5fail = [];
var lvFlip28 = [], lvFlip18 = [], yongFlip = [], xiFlip = [], jiFlip = [], patFlip = [];
var hitRows = [];
ALL.forEach(function(c) {
  var b = toBazi(c.gz);
  var r = cfById[c.id];
  var dm = FORMAL.dm(b);
  var yj = FORMAL.yj(b), pat = FORMAL.pat(b);
  var score = dm.score, level = dm.level;
  var yong = yj.yongShen.join('、'), xi = yj.xiShen.join('、'), ji = yj.jiShen.join('、');
  var pattern = pat.name + '·' + pat.status;
  var fYong = sides(r[col['用神']]), fXi = sides(r[col['喜神']]), fJi = sides(r[col['忌神']]), fPat = sides(r[col['格局']]);
  var fScore = r[col['P22分']], fLevel = r[col['P22档']], bScore = r[col['BASE分']], bLevel = r[col['BASE档']];

  // B2: 正式 === CSV P22 侧（6 字段）
  if (String(score) !== fScore) b2fail.push(c.id + ' 分：正式 ' + score + ' ≠ CSV P22 ' + fScore);
  if (level !== fLevel) b2fail.push(c.id + ' 档：正式 ' + level + ' ≠ CSV P22 ' + fLevel);
  if (yong !== fYong.p) b2fail.push(c.id + ' 用神：正式 ' + yong + ' ≠ CSV P22 ' + fYong.p);
  if (xi !== fXi.p) b2fail.push(c.id + ' 喜神：正式 ' + xi + ' ≠ CSV P22 ' + fXi.p);
  if (ji !== fJi.p) b2fail.push(c.id + ' 忌神：正式 ' + ji + ' ≠ CSV P22 ' + fJi.p);
  if (pattern !== fPat.p) b2fail.push(c.id + ' 格局：正式 ' + pattern + ' ≠ CSV P22 ' + fPat.p);

  // B3: BASE→正式 差异集（以 CSV BASE 侧为参照）
  if (bLevel !== fLevel) {
    if (c.set === '22基线' || c.set === '六盘锚点') lvFlip28.push(c.id + ' ' + bLevel + '→' + fLevel);
    else if (c.set === '18专项(观察)') lvFlip18.push(c.id + ' ' + bLevel + '→' + fLevel);
  }
  if (fYong.b !== fYong.p) yongFlip.push(c.id);
  if (fXi.b !== fXi.p) xiFlip.push(c.id);
  if (fJi.b !== fJi.p) jiFlip.push(c.id);
  if (fPat.b !== fPat.p) patFlip.push(c.id);

  // B5: ⑥重复表达审计（P22 侧比值，col |⑤|/|①|P22）
  var isHit = r[col['⑤命中']] === '是';
  if (isHit) {
    var ratioP = r[col['|⑤|/|①|P22']];
    var ratioN = parseFloat(ratioP);
    hitRows.push({ id: c.id, set: c.set, gz: c.gz.join(' '), s: score, l: level, ratio: ratioN, v22: parseInt(r[col['⑤P22']], 10) });
    if (c.id !== '#4' && ratioN > 0.8) b5fail.push(c.id + ' 比值 ' + ratioP + ' > 0.8');
    if (c.id === '#4' && Math.abs(ratioN - 2.0) > 1e-9) b5fail.push('#4 比值 ' + ratioP + ' ≠ 2.0（钳位掩盖）');
  }
});

// B4: GPT 裁决第8条预期值硬断言
var EXPECT = {
  'P15-12': { s: '31', l: '偏弱' }, 'P15-15': { s: '29.75', l: '极弱' }, 'P15-16': { s: '28', l: '极弱' },
  'B2': { s: '27', l: '极弱' }, '#8': { s: '28', l: '极弱' }, 'B1': { s: '28', l: '极弱' },
  'H18': { s: '31', l: '偏弱' }, '#4': { s: '1', l: '极弱' }
};
Object.keys(EXPECT).forEach(function(id) {
  var r = cfById[id];
  var fScore = r[col['P22分']], fLevel = r[col['P22档']];
  if (fScore !== EXPECT[id].s) b4fail.push(id + ' 预期分 ' + EXPECT[id].s + ' 实得分 ' + fScore);
  if (fLevel !== EXPECT[id].l) b4fail.push(id + ' 预期档 ' + EXPECT[id].l + ' 实得档 ' + fLevel);
});
if (sides(cfById['H18'][col['格局']]).p !== '正财格·成格') b4fail.push('H18 格局预期 正财格·成格 实得 ' + cfById['H18'][col['格局']]);

if (b2fail.length) { console.error('❌ B2 失败（正式 ≠ CSV P22）:'); b2fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
console.log('✅ B2：正式引擎 ' + ALL.length + ' 行 × 6 字段 === 反事实 CSV P22 侧全等');

// B3 差异集断言
function sameSet(actual, expected, label) {
  if (actual.join('|') !== expected.join('|')) {
    console.error('❌ B3 失败：' + label + ' 实际 [' + actual.join('、') + '] ≠ 预期 [' + expected.join('、') + ']');
    process.exit(1);
  }
}
sameSet(lvFlip28, ['P15-12 极弱→偏弱'], '28盘五档翻转集');
sameSet(lvFlip18, ['H18 极弱→偏弱'], '18专项五档翻转集');
sameSet(yongFlip, ['P15-19'], '用神翻转集');
sameSet(xiFlip, ['P15-19'], '喜神翻转集');
sameSet(jiFlip, ['P15-19'], '忌神翻转集');
sameSet(patFlip, ['H18'], '格局变化集');
console.log('✅ B3：BASE→正式 差异集与反事实记录一致（28盘翻档恰{P15-12}，28盘用/喜/忌/格局 0 翻转；18专项恰H18；P15-19 用喜忌翻转不阻塞）');

if (b4fail.length) { console.error('❌ B4 失败（GPT 第8条预期值）:'); b4fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
console.log('✅ B4：GPT 裁决第8条预期值全中（P15-12=31偏弱、P15-15=29.75、P15-16=28、B2=27、#8/B1=28、H18=31偏弱+正财格·成格、#4=1）');

if (b5fail.length) { console.error('❌ B5 失败（⑥重复表达审计）:'); b5fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
console.log('✅ B5：⑥重复表达审计——除#4(2.0，钳位掩盖，裁决第3条已接受)外全部 |⑤|/|①| ≤0.8');

// ---------- 报告 ----------
console.log('\n========== 正式实装 ⑤命中清单（' + hitRows.length + ' 行，与反事实一致）==========');
hitRows.forEach(function(r) {
  console.log('[' + r.set + '] ' + r.id + ' ' + r.gz + ' | ⑤P22=' + r.v22 + ' 比值=' + r.ratio + ' | ' + r.s + '(' + r.l + ')');
});
console.log('\n✅ 实装验证全部通过：正式引擎 === 反事实 P22 内存预览（' + ALL.length + ' 行 × 6 字段），单变量提交成立');
