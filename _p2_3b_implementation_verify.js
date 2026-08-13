// _p2_3b_implementation_verify.js — P2.3 M2 四档实装候选验证
// 裁决依据：GPT P2.3 反事实最终裁决——M2 四档（A13/B6/C3/D0），A4/A5 按 C，A5 不按 D，顶档 13 保留
// 验证组：
//   B1 字节级单变量：工作区 js/bazi.js === 8ec5f71 源，仅⑧½块被替换（块外逐字节一致）
//   B2 正式引擎 52 盘 × 8 字段 === 反事实 CSV M2 列（sM2/lM2/yM2/xiM2/jiM2/pM2/cong/m2Tier/m2Bonus）
//   B3 六盘锚点 + 单列盘精确值（A4/A5/H11/P15-14/#6/#9/A3/P15-20）
//   B4 受破口径钉死：独立镜像复算 hePo/chongPo/po/档位，逐盘与 CSV 对账；受破盘集断言
//   B5 传播面：BASE→正式 差异集恰为 {A4, A5(≡H11), P15-14, SY3}；52 盘用神/格局零翻转；喜忌仅 A5/H11
//   B6 A5 永久回归盘字段冻结
'use strict';
var fs = require('fs'), path = require('path');
var cp = require('child_process');
var ROOT = path.resolve(__dirname);

// ---------- B1: 字节级单变量 ----------
var HEAD8H = '  // ---------- ⑧½ 杀印相生结构修正 ----------';
var ANCHOR_AFTER = '  // ---------- ⑧¾ 宫位远近修正 ----------';
var OLD_TAIL = '    if (_yinAdjacent && _hasCSL) {\n      score += 13;\n    }';
var baseSrc = cp.execSync('git show 8ec5f71:js/bazi.js', { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }).toString('utf-8').replace(/\r\n/g, '\n');
var formSrc = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8').replace(/\r\n/g, '\n');
function countOcc(s, sub) { var n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
var b1fail = [];
function grab(src) {
  var i1 = src.indexOf(HEAD8H);
  var i2 = src.indexOf(ANCHOR_AFTER, i1);
  if (i1 < 0 || i2 < 0) { b1fail.push('⑧½/⑧¾ 锚点缺失'); return null; }
  return src.slice(i1, i2);
}
var baseBlock = grab(baseSrc), formBlock = grab(formSrc);
if (baseBlock !== null && formBlock !== null) {
  if (baseSrc.replace(baseBlock, formBlock) !== formSrc) {
    b1fail.push('形式引擎 ≠ BASE 仅替换⑧½块（块外存在差异）');
  }
  if (countOcc(baseBlock, OLD_TAIL) !== 1) b1fail.push('BASE ⑧½块旧决策尾出现 ' + countOcc(baseBlock, OLD_TAIL) + ' 次 ≠ 1');
  if (countOcc(formBlock, OLD_TAIL) !== 0) b1fail.push('形式引擎仍含旧决策尾');
  if (countOcc(formBlock, 'score += 13;') !== 1) b1fail.push('形式引擎 score += 13; 出现 ' + countOcc(formBlock, 'score += 13;') + ' 次 ≠ 1');
  if (countOcc(formBlock, 'score += 6;') !== 1) b1fail.push('形式引擎 score += 6; 出现 ' + countOcc(formBlock, 'score += 6;') + ' 次 ≠ 1');
  if (countOcc(formBlock, 'score += 3;') !== 1) b1fail.push('形式引擎 score += 3; 出现 ' + countOcc(formBlock, 'score += 3;') + ' 次 ≠ 1');
  if (countOcc(baseBlock, 'score += 6;') !== 0 || countOcc(baseBlock, 'score += 3;') !== 0) b1fail.push('BASE ⑧½块混入 +6/+3');
  if (countOcc(formSrc, '_M2_') !== 0) b1fail.push('形式引擎残留 _M2_ 模型名（应语义化命名）');
  if (countOcc(formSrc, '  if (score < 1) score = 1;') !== 1) b1fail.push('钳位行锚点异常');
}
if (b1fail.length) { b1fail.forEach(function(m) { console.error('❌ B1 失败：' + m); }); process.exit(1); }
console.log('✅ B1：字节级单变量——形式引擎 === 8ec5f71 源，差异面恰为⑧½块（旧二元尾→四档分级，块外逐字节一致）');

// ---------- 引擎装载 ----------
global.window = global;
global.document = {};
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function(n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
function load(s) {
  eval(s.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  return { dm: calcDayMasterStrength, yj: getYongJi, cong: getCongGe, pat: getPattern };
}
var BASE = load(baseSrc);
var FORMAL = load(formSrc);

// ---------- 样本（与 _p2_3a 完全同源）----------
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
var COBS = [
  { set: '附加观察', id: 'P15-19', gz: ['己亥','丙子','辛酉','戊子'] },
  { set: '附加观察', id: 'P15-20', gz: ['壬午','癸卯','戊寅','乙卯'] }
];
var SYN = [
  { set: '合成观察', id: 'SY1', gz: ['壬子','壬子','戊午','戊午'] },
  { set: '合成观察', id: 'SY2', gz: ['壬子','壬子','戊戌','丁巳'] },
  { set: '合成观察', id: 'SY3', gz: ['甲子','壬申','乙卯','丁亥'] },
  { set: '合成观察', id: 'SY4', gz: ['壬寅','戊申','乙卯','壬午'] }
];
var ALL = C22.concat(C6, C18, COBS, SYN);
if (ALL.length !== 52) { console.error('❌ 样本行数 ' + ALL.length + ' ≠ 52'); process.exit(1); }

// ---------- 反事实 CSV（M2 列为权威期望）----------
function parseCsvLine(line) {
  return line.split(/,(?=")/).map(function(s) { return s.replace(/^"|"$/g, '').replace(/""/g, '"'); });
}
var cfLines = fs.readFileSync(path.join(ROOT, '_p2_3a_counterfactual.csv'), 'utf-8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
var cfHead = cfLines[0].split(',');
var cfIdx = {};
['set','id','before','m2Tier','m2Bonus','sM2','lM2','yM2','xiM2','jiM2','pM2','cong','heDesc','chongDesc','yinPath'].forEach(function(k) { cfIdx[k] = cfHead.indexOf(k); });
var cfMap = {};
cfLines.slice(1).forEach(function(line) {
  var f = parseCsvLine(line);
  cfMap[f[cfIdx.set] + '|' + f[cfIdx.id]] = f;
});
if (Object.keys(cfMap).length !== 52) { console.error('❌ 反事实 CSV 行数 ' + Object.keys(cfMap).length + ' ≠ 52'); process.exit(1); }

// ---------- 探针镜像（与 _p2_3a 同源同口径，独立复算）----------
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var SHENG = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
var KE    = {'木':'土','火':'金','土':'水','金':'木','水':'火'};
var CANG = {'子':['癸'],'丑':['己','癸','辛'],'寅':['甲','丙','戊'],'卯':['乙'],'辰':['戊','乙','癸'],'巳':['丙','庚','戊'],'午':['丁','己'],'未':['己','丁','乙'],'申':['庚','壬','戊'],'酉':['辛'],'戌':['戊','辛','丁'],'亥':['壬','甲']};
var CS = {'甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯'};
var LU = {'甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子'};
var HE_PAIRS = [['甲','己'],['乙','庚'],['丙','辛'],['丁','壬'],['戊','癸']];
var CHONG = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
var POS = ['year','month','day','hour'];
function shENGWO(dg) { for (var k in SHENG) if (SHENG[k] === dg) return k; }
function kEWO(dg) { for (var k in KE) if (KE[k] === dg) return k; }
function huiOverride(b) {
  var zhis = POS.map(function(p) { return b[p].zhi; });
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
    year:  { gan: gz[0][0], zhi: gz[0][1] },
    month: { gan: gz[1][0], zhi: gz[1][1] },
    day:   { gan: gz[2][0], zhi: gz[2][1] },
    hour:  { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function mirror8h(b) {
  var dg = b.day.gan, dgWx = GAN_WX[dg];
  var mwx = huiOverride(b) || ZHI_WX[b.month.zhi];
  var yinWx = shENGWO(dgWx);
  var shaWx = kEWO(dgWx);
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
  POS.forEach(function(p) {
    var z = b[p].zhi;
    if (z === CS[dg] || z === LU[dg]) csl = true;
  });
  var yGanYin = (GAN_WX[b.year.gan] === yinWx);
  var yinRootPos = [];
  POS.forEach(function(p) {
    var cg = CANG[b[p].zhi];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === yinWx) { yinRootPos.push(b[p].zhi + '(' + cg[i] + ')'); break; }
  });
  var yinDeSheng = (SHENG[mwx] === yinWx);
  var hePo = false, heDesc = '';
  ['month','hour'].forEach(function(p) {
    var g = b[p].gan;
    if (GAN_WX[g] !== yinWx) return;
    HE_PAIRS.forEach(function(h) {
      var other = null;
      if (h[0] === g) other = h[1]; else if (h[1] === g) other = h[0];
      if (other && other !== dg) {
        POS.forEach(function(p2) {
          if (b[p2].gan === other) { hePo = true; heDesc = g + other + '合'; }
        });
      }
    });
  });
  var dayChong = false, chongDesc = '';
  var opp = CHONG[b.day.zhi];
  if (opp) {
    ['year','month','hour'].forEach(function(p) {
      if (b[p].zhi === opp) { dayChong = true; chongDesc = b.day.zhi + opp + '冲'; }
    });
  }
  // 引擎精确口径：受破B = 日支藏干含印 && 日支被六冲（与 yinPath 无关——_dayYin && _chongPo）
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
  return {
    dg: dg, dgWx: dgWx, mwx: mwx, dead: dead, yinPath: yinPath, yinAdj: yinAdj, csl: csl,
    yGanYin: yGanYin, yinRootPos: yinRootPos, yinDeSheng: yinDeSheng,
    hePo: hePo, heDesc: heDesc, dayChong: dayChong, chongDesc: chongDesc, dayYin: dayYin, po: po,
    tier: tier, bonus: bonus
  };
}
function runRow(eng, b) {
  var dm = eng.dm(b);
  var yj = eng.yj(b), pat = eng.pat(b), cong = eng.cong(b);
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pat.name + '·' + pat.status, cong: cong.isCong ? cong.name : '否'
  };
}

// ---------- 逐盘对账 ----------
var b2fail = [], b4fail = [], b5fail = [], b6fail = [];
var diffSet = [];
var hePoSet = [], chongDayYinSet = [], poSet = [];
ALL.forEach(function(c) {
  var b = toBazi(c.gz);
  var rF = runRow(FORMAL, b);
  var rB = runRow(BASE, b);
  var mir = mirror8h(b);
  var cf = cfMap[c.set + '|' + c.id];
  if (!cf) { b2fail.push(c.id + ' CSV 缺行'); return; }
  // B2: 正式引擎 === 反事实 M2 列
  function eq(field, a, bv) {
    var va = String(a), vb = String(bv);
    if (field === 'sM2') return Math.abs(Number(va) - Number(vb)) < 1e-9;
    return va === vb;
  }
  var b2row = [
    ['sM2', rF.score], ['lM2', rF.level], ['yM2', rF.yong], ['xiM2', rF.xi], ['jiM2', rF.ji], ['pM2', rF.pattern], ['cong', rF.cong]
  ].filter(function(p) { return !eq(p[0], p[1], cf[cfIdx[p[0]]]); });
  if (b2row.length) b2fail.push(c.set + '/' + c.id + ' 正式≠CSV: ' + b2row.map(function(p) { return p[0] + ' ' + p[1] + '≠' + cf[cfIdx[p[0]]]; }).join('; '));
  // B4: 受破口径钉死——镜像复算 === CSV 档位/受破描述（CSV 由反事实引擎捕获+镜像双重锁定）
  if (mir.tier + mir.bonus !== cf[cfIdx.m2Tier] + cf[cfIdx.m2Bonus]) b4fail.push(c.id + ' 镜像档位 ' + mir.tier + mir.bonus + ' ≠ CSV ' + cf[cfIdx.m2Tier] + cf[cfIdx.m2Bonus]);
  if (mir.dead) {
    if (mir.heDesc !== cf[cfIdx.heDesc]) b4fail.push(c.id + ' heDesc 镜像≠CSV: ' + mir.heDesc + '≠' + cf[cfIdx.heDesc]);
    if (mir.chongDesc !== cf[cfIdx.chongDesc]) b4fail.push(c.id + ' chongDesc 镜像≠CSV: ' + mir.chongDesc + '≠' + cf[cfIdx.chongDesc]);
    if (mir.yinPath !== cf[cfIdx.yinPath]) b4fail.push(c.id + ' yinPath 镜像≠CSV: ' + mir.yinPath + '≠' + cf[cfIdx.yinPath]);
  }
  // 盘集仅统计决策相关盘（死令 && CSL && 有印）——受破只在这些盘上参与档位判定
  var relevant = mir.dead && mir.csl && (mir.yinAdj || mir.yGanYin);
  if (relevant && mir.hePo) hePoSet.push(c.id);
  if (relevant && mir.dayYin && mir.dayChong) chongDayYinSet.push(c.id);
  if (relevant && mir.po) poSet.push(c.id);
  // B5: 传播面
  var diff = ['score','level','yong','xi','ji','pattern'].filter(function(k) { return String(rF[k]) !== String(rB[k]); });
  if (diff.length) diffSet.push({ id: c.id, fields: diff });
});
// B4 受破盘集断言（口径钉死：合绊盘集 / 日支藏印坐地被冲盘集 / 受破盘集）
var expHePo = ['A5','H11','SY3'].sort().join(',');
var expChongDayYin = ['A4','A5','H11'].sort().join(',');
var expPo = ['A4','A5','H11','SY3'].sort().join(',');
if (hePoSet.slice().sort().join(',') !== expHePo) b4fail.push('合绊盘集 ' + hePoSet.sort().join(',') + ' ≠ 期望 ' + expHePo);
if (chongDayYinSet.slice().sort().join(',') !== expChongDayYin) b4fail.push('日支藏印坐地受冲盘集 ' + chongDayYinSet.sort().join(',') + ' ≠ 期望 ' + expChongDayYin);
if (poSet.slice().sort().join(',') !== expPo) b4fail.push('受破盘集 ' + poSet.sort().join(',') + ' ≠ 期望 ' + expPo);
// B5 传播面断言
var expDiff = ['A4','A5','H11','P15-14','SY3'].sort().join(',');
if (diffSet.map(function(d) { return d.id; }).sort().join(',') !== expDiff) {
  b5fail.push('差异盘集 ' + diffSet.map(function(d) { return d.id; }).sort().join(',') + ' ≠ 期望 ' + expDiff);
}
// B6: 用神/格局零翻转 + 喜忌仅 A5/H11
ALL.forEach(function(c) {
  var b = toBazi(c.gz);
  var rF = runRow(FORMAL, b), rB = runRow(BASE, b);
  if (rF.yong !== rB.yong) b6fail.push(c.id + ' 用神翻转: ' + rB.yong + '→' + rF.yong);
  if (rF.pattern !== rB.pattern) b6fail.push(c.id + ' 格局变化: ' + rB.pattern + '→' + rF.pattern);
  if ((rF.xi !== rB.xi || rF.ji !== rB.ji) && c.id !== 'A5' && c.id !== 'H11') {
    b6fail.push(c.id + ' 喜忌翻转（非A5）: ' + rB.xi + '/' + rB.ji + '→' + rF.xi + '/' + rF.ji);
  }
});
if (b2fail.length) { b2fail.forEach(function(m) { console.error('❌ B2 失败：' + m); }); process.exit(1); }
if (b4fail.length) { b4fail.forEach(function(m) { console.error('❌ B4 失败：' + m); }); process.exit(1); }
if (b5fail.length) { b5fail.forEach(function(m) { console.error('❌ B5 失败：' + m); }); process.exit(1); }
if (b6fail.length) { b6fail.forEach(function(m) { console.error('❌ B6 失败：' + m); }); process.exit(1); }
console.log('✅ B2：正式引擎 52 盘 × 8 字段 === 反事实 CSV M2 列（分数/五档/用神/喜/忌/格局/从格/档位全等）');
console.log('✅ B4：受破口径钉死——合绊盘集 {' + hePoSet.join('、') + '}；日支藏印坐地受冲盘集 {' + chongDayYinSet.join('、') + '}；受破盘集 {' + poSet.join('、') + '}（A5 双破：丁壬合绊+戌辰冲）');
console.log('✅ B5：传播面 === 期望差异集 {A4, A5(≡H11), P15-14, SY3}，无盘外变化');
console.log('✅ B6：52 盘用神零翻转、格局零变化、喜忌仅 A5/H11');

// ---------- B3: 六盘锚点 + 单列盘精确值 ----------
function rv(gz) { return runRow(FORMAL, toBazi(gz)); }
var pin = [
  ['P15-03', ['乙丑','戊寅','己巳','庚午'], 51, '中和', '火'],
  ['P15-09', ['丁丑','癸卯','庚申','丙戌'], 47, '中和', null],
  ['P15-12', ['戊子','甲寅','庚申','丁亥'], 31, '偏弱', '土'],
  ['P15-14', ['丙寅','庚寅','戊辰','癸亥'], 28, '极弱', '土'],
  ['P15-15', ['癸未','戊午','乙卯','丙戌'], 29.75, '极弱', '木'],
  ['P15-16', ['丁卯','壬寅','壬午','庚子'], 28, '极弱', null],
  ['#6',     ['甲辰','丙寅','戊午','丁巳'], 62, '偏强', '水'],
  ['#9',     ['甲子','丁卯','己未','庚午'], 51, '中和', '木'],
  ['A3',     ['丙申','庚寅','戊辰','丁巳'], 56, '中和', '水'],
  ['A4',     ['辛亥','庚寅','己巳','庚午'], 22, '极弱', '火'],
  ['A5',     ['壬辰','癸卯','戊戌','丁巳'], 38, '偏弱', '土'],
  ['H11',    ['壬辰','癸卯','戊戌','丁巳'], 38, '偏弱', '土'],
  ['P15-20', ['壬午','癸卯','戊寅','乙卯'], 6, '极弱', '火'],
  ['SY3',    ['甲子','壬申','乙卯','丁亥'], 57, '中和', null],
  ['SY4',    ['壬寅','戊申','乙卯','壬午'], 57, '中和', null],
  // 52 盘样本外命中盘：tests/bazi-professional-core.test.js「wet earth adjustment」测试盘
  // 癸日主丑月死令、年干庚印有根(申本气)得生(丑土生金)、日支卯长生 → B 档 +6：26→32（原预存失败修复）
  ['wetearth测试盘', ['庚申','己丑','癸卯','丁巳'], 32, '偏弱', null]
];
var b3fail = [];
pin.forEach(function(p) {
  var r = rv(p[1]);
  if (Math.abs(r.score - p[2]) > 1e-9) b3fail.push(p[0] + ' 分 ' + r.score + ' ≠ ' + p[2]);
  if (r.level !== p[3]) b3fail.push(p[0] + ' 档 ' + r.level + ' ≠ ' + p[3]);
  if (p[4] && r.yong !== p[4]) b3fail.push(p[0] + ' 用神 ' + r.yong + ' ≠ ' + p[4]);
});
if (b3fail.length) { b3fail.forEach(function(m) { console.error('❌ B3 失败：' + m); }); process.exit(1); }
console.log('✅ B3：六盘锚点 + 单列盘 15 项精确值全中');
pin.forEach(function(p) {
  var r = rv(p[1]);
  console.log('   ' + p[0] + ' ' + p[1].join(' ') + ' | ' + r.score + ' ' + r.level + ' 用' + r.yong + ' 喜' + (r.xi || '空') + ' 忌' + (r.ji || '空') + ' | ' + r.pattern);
});

// ---------- B6 附：A5 永久回归盘字段冻结输出 ----------
var rA5 = rv(['壬辰','癸卯','戊戌','丁巳']);
console.log('--- A5 永久回归盘（P2.3 裁决第3条）---');
console.log('   A5/H11 = ' + rA5.score + ' ' + rA5.level + ' | 用' + rA5.yong + ' 喜' + (rA5.xi || '空') + ' 忌' + (rA5.ji || '空') + ' | ' + rA5.pattern + ' | 从格:' + rA5.cong);

console.log('\nP2.3 实装候选验证完成：B1-B6 全过，正式引擎与 M2 反事实完全一致，零新增失败（全量测试/freeze 另跑）。');
