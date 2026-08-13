// P2.3 ⑧½ 杀印相生结构补偿断崖正式反事实（2026-08-13，GPT P2.3 指令）
// BASE = 已部署 main HEAD 的 js/bazi.js（= 线上版本；⑧½ 为 +13/0 二值）
// 内存模型（仅改⑧½决策尾，禁改①休囚/⑤/非日支根气/合化/⑧关系封顶/P1/structuralRisks）：
//   M1 = 旧 +13 完全不动 + 年干印补正（强 +6 / 弱 +3；前提：死令 + 日主长生/禄根 + 旧规则未命中）
//   M2 = 完整四档：A 贴身印(月干/时干/日支藏)且不明显受破 +13；B 年干印有根或得生 +6；
//        C 年干印无根不得生，或贴身印受破(印干被五合合绊非合日主/日支藏印路径时日支被六冲) +3；D 无 +0
//   M3 = M2 但顶档 A=+10
// 断言纪律（CF 标记防静默失效）：
//   A1 工作区 js/bazi.js === git HEAD 字节级（= 线上已部署版本）
//   A2 ⑧½ 补丁锚点在 BASE 源中各恰 1 处
//   A3 各变体源差异面恰为⑧½决策尾（禁改清单零触碰）
//   A4 BASE(未仪表化) === BASE(仪表化)：全样本 × 8 字段全等（仪表化零行为改变）
//   A5 探针侧独立镜像（三会覆盖+死令+印路径+CS/LU+受破+年干印强弱）=== 引擎捕获值（__CF8h_*）
//   A6 逐盘：M1/M2/M3 − INSTR 的⑧½层差值 === 镜像档位分差（命中盘），短路盘零差
// 任一失败立即抛错停止。不改 js/bazi.js、不 push。
// 用法: node _p2_3a_counterfactual.js
// 产物: _p2_3a_counterfactual.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), cp = require('child_process'), ROOT = __dirname;
var ENGINE = path.join(ROOT, 'js', 'bazi.js');
var baseSrcRaw = fs.readFileSync(ENGINE); // 原始字节（含 CRLF）

// ---------- A1: 工作区引擎 === git HEAD（已部署版本） ----------
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
var hHeadShort = cp.execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString('utf-8').trim();
console.log('✅ A1：工作区 js/bazi.js === git HEAD ' + hHeadShort + '（=线上已部署版本）');

// ---------- 归一化 LF 用于补丁构造 ----------
var src = baseSrcRaw.toString('utf-8').replace(/\r\n/g, '\n');

// ---------- ⑧½块锚点（精确抄自引擎 2638-2663） ----------
var HEAD8H =
  '  if (KEWO[dgWx] === mwx) {\n' +
  '    var _yinAdjacent = false;';
var HEAD8H_INSTR =
  '  global.__CF8h_before = score;\n' +
  '  global.__CF8h_dead = (KEWO[dgWx] === mwx) ? 1 : 0;\n' +
  '  global.__CF8h_yinAdj = 0;\n' +
  '  global.__CF8h_csl = 0;\n' +
  HEAD8H;
var TAIL8H_BASE =
  '    if (_yinAdjacent && _hasCSL) {\n' +
  '      score += 13;\n' +
  '    }';
var TAIL8H_INSTR =
  '    global.__CF8h_yinAdj = _yinAdjacent ? 1 : 0;\n' +
  '    global.__CF8h_csl = _hasCSL ? 1 : 0;\n' +
  TAIL8H_BASE;
var TAIL8H_M1 =
  '    global.__CF8h_yinAdj = _yinAdjacent ? 1 : 0;\n' +
  '    global.__CF8h_csl = _hasCSL ? 1 : 0;\n' +
  '    global.__CF8h_tier = \'D\'; global.__CF8h_fired = 0;\n' +
  '    if (_yinAdjacent && _hasCSL) {\n' +
  '      score += 13; global.__CF8h_tier = \'A\'; global.__CF8h_fired = 1;   // 旧规则完全不动\n' +
  '    } else if (_hasCSL && SHENGWO[dgWx] === WU_XING[bazi.year.gan]) {\n' +
  '      // M1 年干印补正：强 +6 / 弱 +3（强 = 印有根于任一支藏干，或得月令生）\n' +
  '      var _M1_SH = {\'木\':\'火\',\'火\':\'土\',\'土\':\'金\',\'金\':\'水\',\'水\':\'木\'};\n' +
  '      var _M1_yinWx = WU_XING[bazi.year.gan];\n' +
  '      var _M1_root = false;\n' +
  '      [\'year\',\'month\',\'day\',\'hour\'].forEach(function(_M1_pos) {\n' +
  '        var _M1_cg = getCangGan(bazi[_M1_pos].zhi);\n' +
  '        for (var _M1_i = 0; _M1_i < _M1_cg.length; _M1_i++) {\n' +
  '          if (WU_XING[_M1_cg[_M1_i]] === _M1_yinWx) _M1_root = true;\n' +
  '        }\n' +
  '      });\n' +
  '      var _M1_strong = _M1_root || (_M1_SH[mwx] === _M1_yinWx);\n' +
  '      if (_M1_strong) { score += 6; global.__CF8h_tier = \'B\'; global.__CF8h_fired = 2; }\n' +
  '      else { score += 3; global.__CF8h_tier = \'C\'; global.__CF8h_fired = 3; }\n' +
  '    }';
var TAIL8H_M2 =
  '    global.__CF8h_yinAdj = _yinAdjacent ? 1 : 0;\n' +
  '    global.__CF8h_csl = _hasCSL ? 1 : 0;\n' +
  '    global.__CF8h_tier = \'D\'; global.__CF8h_fired = 0;\n' +
  '    if (_hasCSL) {\n' +
  '      var _M2_SH = {\'木\':\'火\',\'火\':\'土\',\'土\':\'金\',\'金\':\'水\',\'水\':\'木\'};\n' +
  '      var _M2_CHONG = {\'子\':\'午\',\'午\':\'子\',\'丑\':\'未\',\'未\':\'丑\',\'寅\':\'申\',\'申\':\'寅\',\'卯\':\'酉\',\'酉\':\'卯\',\'辰\':\'戌\',\'戌\':\'辰\',\'巳\':\'亥\',\'亥\':\'巳\'};\n' +
  '      var _M2_yinWx = SHENGWO[dgWx];\n' +
  '      var _M2_hePo = false, _M2_chongPo = false;\n' +
  '      // 受破A：贴身印干被天干五合合绊（合日主除外——印来合身是加强不是破）\n' +
  '      var _M2_HE = [[\'甲\',\'己\'],[\'乙\',\'庚\'],[\'丙\',\'辛\'],[\'丁\',\'壬\'],[\'戊\',\'癸\']];\n' +
  '      [\'month\',\'hour\'].forEach(function(_M2_pos) {\n' +
  '        var _M2_g = bazi[_M2_pos].gan;\n' +
  '        if (WU_XING[_M2_g] !== _M2_yinWx) return;\n' +
  '        _M2_HE.forEach(function(_M2_h) {\n' +
  '          var _M2_other = null;\n' +
  '          if (_M2_h[0] === _M2_g) _M2_other = _M2_h[1];\n' +
  '          else if (_M2_h[1] === _M2_g) _M2_other = _M2_h[0];\n' +
  '          if (_M2_other && _M2_other !== dg) {\n' +
  '            [\'year\',\'month\',\'day\',\'hour\'].forEach(function(_M2_p2) {\n' +
  '              if (bazi[_M2_p2].gan === _M2_other) _M2_hePo = true;\n' +
  '            });\n' +
  '          }\n' +
  '        });\n' +
  '      });\n' +
  '      // 受破B：日支藏印路径时日支被六冲（印之坐地受冲，通关被破）\n' +
  '      var _M2_opp = _M2_CHONG[bazi.day.zhi];\n' +
  '      if (_M2_opp) {\n' +
  '        [\'year\',\'month\',\'hour\'].forEach(function(_M2_p3) {\n' +
  '          if (bazi[_M2_p3].zhi === _M2_opp) _M2_chongPo = true;\n' +
  '        });\n' +
  '      }\n' +
  '      var _M2_dayYin = false;\n' +
  '      var _M2_dcg = getCangGan(bazi.day.zhi);\n' +
  '      for (var _M2_di = 0; _M2_di < _M2_dcg.length; _M2_di++) {\n' +
  '        if (WU_XING[_M2_dcg[_M2_di]] === _M2_yinWx) _M2_dayYin = true;\n' +
  '      }\n' +
  '      var _M2_po = (_M2_hePo || (_M2_dayYin && _M2_chongPo));\n' +
  '      if (_yinAdjacent && !_M2_po) {\n' +
  '        score += 13; global.__CF8h_tier = \'A\'; global.__CF8h_fired = 1;\n' +
  '      } else {\n' +
  '        var _M2_yGanYin = (WU_XING[bazi.year.gan] === _M2_yinWx);\n' +
  '        var _M2_root = false;\n' +
  '        [\'year\',\'month\',\'day\',\'hour\'].forEach(function(_M2_p4) {\n' +
  '          var _M2_cg2 = getCangGan(bazi[_M2_p4].zhi);\n' +
  '          for (var _M2_i2 = 0; _M2_i2 < _M2_cg2.length; _M2_i2++) {\n' +
  '            if (WU_XING[_M2_cg2[_M2_i2]] === _M2_yinWx) _M2_root = true;\n' +
  '          }\n' +
  '        });\n' +
  '        if (_M2_yGanYin && (_M2_root || _M2_SH[mwx] === _M2_yinWx)) {\n' +
  '          score += 6; global.__CF8h_tier = \'B\'; global.__CF8h_fired = 2;\n' +
  '        } else if (_M2_yGanYin || (_yinAdjacent && _M2_po)) {\n' +
  '          score += 3; global.__CF8h_tier = \'C\'; global.__CF8h_fired = 3;\n' +
  '        }\n' +
  '      }\n' +
  '    }';
var TAIL8H_M3 = TAIL8H_M2.replace('score += 13;', 'score += 10;');
var ANCHOR_AFTER =
  '  }\n' +
  '\n' +
  '  // ---------- ⑧¾ 宫位远近修正 ----------';
var ANCHOR_AFTER_INSTR =
  '  }\n' +
  '  global.__CF8h_after = score;\n' +
  '\n' +
  '  // ---------- ⑧¾ 宫位远近修正 ----------';

// ---------- A2: 锚点存在性 ----------
function countOcc(s, sub) { var n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; } return n; }
var checks = [
  ['HEAD8H', HEAD8H, 1], ['TAIL8H_BASE', TAIL8H_BASE, 1], ['ANCHOR_AFTER', ANCHOR_AFTER, 1],
  ['⑧½注释头', '  // ---------- ⑧½ 杀印相生结构修正 ----------', 1],
  ['⑧¾注释头', '  // ---------- ⑧¾ 宫位远近修正 ----------', 1],
  ['钳位行', '  if (score < 1) score = 1;', 1]
];
var a2ok = true;
checks.forEach(function(c) {
  var n = countOcc(src, c[1]);
  if (n !== c[2]) { a2ok = false; console.error('❌ A2 失败：锚点 ' + c[0] + ' 出现 ' + n + ' 次 ≠ ' + c[2]); }
});
if (countOcc(src, 'score += 13;') !== 1) { a2ok = false; console.error('❌ A2 失败：score += 13; 出现 ' + countOcc(src, 'score += 13;') + ' 次 ≠ 1'); }
if (countOcc(src, 'score += 10;') !== 0) { a2ok = false; console.error('❌ A2 失败：引擎原含 score += 10;（M3 锚点受污染）'); }
if (!a2ok) process.exit(1);
console.log('✅ A2：⑧½ 全部补丁锚点在 BASE 源中各恰 1 处（禁改清单零触碰）');

// ---------- 构造五份源：UNIN / INSTR(BASE仪表化) / M1 / M2 / M3 ----------
var srcUnin = src;
var srcInstr = src
  .replace(HEAD8H, HEAD8H_INSTR)
  .replace(TAIL8H_BASE, TAIL8H_INSTR)
  .replace(ANCHOR_AFTER, ANCHOR_AFTER_INSTR);
var srcM1 = srcInstr.replace(TAIL8H_INSTR, TAIL8H_M1);
var srcM2 = srcInstr.replace(TAIL8H_INSTR, TAIL8H_M2);
var srcM3 = srcInstr.replace(TAIL8H_INSTR, TAIL8H_M3);

// ---------- A3: 差异面恰为⑧½决策尾 ----------
var instrStripped = srcInstr
  .replace('  global.__CF8h_before = score;\n  global.__CF8h_dead = (KEWO[dgWx] === mwx) ? 1 : 0;\n  global.__CF8h_yinAdj = 0;\n  global.__CF8h_csl = 0;\n', '')
  .replace(TAIL8H_INSTR, TAIL8H_BASE)
  .replace('  }\n  global.__CF8h_after = score;\n', '  }\n');
if (instrStripped !== srcUnin) { console.error('❌ A3 失败：仪表化差异面超出⑧½捕获点'); process.exit(1); }
if (srcM1.replace(TAIL8H_M1, TAIL8H_INSTR) !== srcInstr) { console.error('❌ A3 失败：M1 差异面超出⑧½决策尾'); process.exit(1); }
if (srcM2.replace(TAIL8H_M2, TAIL8H_INSTR) !== srcInstr) { console.error('❌ A3 失败：M2 差异面超出⑧½决策尾'); process.exit(1); }
if (srcM3.replace(TAIL8H_M3, TAIL8H_INSTR) !== srcInstr) { console.error('❌ A3 失败：M3 差异面超出⑧½决策尾'); process.exit(1); }
if (countOcc(srcM1, TAIL8H_INSTR) !== 0 || countOcc(srcM2, TAIL8H_INSTR) !== 0 || countOcc(srcM3, TAIL8H_INSTR) !== 0) {
  console.error('❌ A3 失败：M 变体残留 INSTR 决策尾'); process.exit(1);
}
console.log('✅ A3：五份源差异面恰为⑧½决策尾（M1 年干印补正 / M2 四档 / M3 顶档10；禁改清单零触碰）');

// ---------- 顺序装载五份引擎并捕获函数引用 ----------
var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function(n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
function load(s) {
  eval(s.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));
  return {
    dm: calcDayMasterStrength, yj: getYongJi, cong: getCongGe, pat: getPattern,
    c1: calcCandidateScores
  };
}
function resetCF() {
  global.__CF8h_before = undefined; global.__CF8h_after = undefined;
  global.__CF8h_dead = undefined; global.__CF8h_yinAdj = undefined; global.__CF8h_csl = undefined;
  global.__CF8h_tier = undefined; global.__CF8h_fired = undefined;
}
resetCF(); var UNIN = load(srcUnin);
resetCF(); var INSTR = load(srcInstr);
resetCF(); var M1 = load(srcM1);
resetCF(); var M2 = load(srcM2);
resetCF(); var M3 = load(srcM3);

// ---------- 样本装载 ----------
// 22 基线（_baseline_22.csv 22 行 = #1-#10 + Round2 A1-A6 + B1-B6；#8≡B1 同盘按行计）
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
// P2.1 专项 18 盘（附加观察集；H11≡A5 同盘）
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
// P1.5 盲测补充观察：P15-19（P2.2边界盘）+ P15-20（用户点名杀重无有效印盘）
var COBS = [
  { set: '附加观察', id: 'P15-19', gz: ['己亥','丙子','辛酉','戊子'] },
  { set: '附加观察', id: 'P15-20', gz: ['壬午','癸卯','戊寅','乙卯'] }
];
// 合成观察盘（非真实案例，仅作机制探针；不属任何正式样本）
// SY1/SY2：c=4 囚盘（P2.2 独立复核保留意见 A 的尾风险探针——⑤=-12 与 ①=-10 同量级，可见分是否被⑤支配）
// SY3：月干印被时干丁合绊（贪财坏印式受破）构造盘——演示 M2 C 档路径（旧规则 +13 vs M2 +3，双可见）
// SY4：杀轻盘（官杀证据仅月令申一支）——⑧½ 代码事实确认问题6的机制展示（旧规则与 M2 均 +13）
var SYN = [
  { set: '合成观察', id: 'SY1', gz: ['壬子','壬子','戊午','戊午'] },
  { set: '合成观察', id: 'SY2', gz: ['壬子','壬子','戊戌','丁巳'] },
  { set: '合成观察', id: 'SY3', gz: ['甲子','壬申','乙卯','丁亥'] },
  { set: '合成观察', id: 'SY4', gz: ['壬寅','戊申','乙卯','壬午'] }
];
var ALL = C22.concat(C6, C18, COBS, SYN);
console.log('样本：22基线×' + C22.length + ' + 锚点×' + C6.length + ' + 18专项×' + C18.length + ' + P15-19/20×2 + 合成×' + SYN.length + ' = ' + ALL.length + ' 行（28盘设计样本 = 前两者；Round2 A/B 已含于22基线）');

// ---------- 探针侧独立镜像 ----------
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
// 探针镜像：独立重算⑧½全部判定输入 + 三模型档位
// 注意：SHENG[k]=火 表示 k 生火（我生者方向）；SHENGWO[dgWx]=生我者（印）需反查 k 使 SHENG[k]===dgWx
function mirror8h(b) {
  var dg = b.day.gan, dgWx = GAN_WX[dg];
  var mwx = huiOverride(b) || ZHI_WX[b.month.zhi];
  var yinWx = shENGWO(dgWx);        // 印星五行（生我者）
  var shaWx = kEWO(dgWx);           // 官杀五行（克我者）
  var dead = (shaWx === mwx);
  // 印介入路径（与引擎同序：月干 → 时干 → 日支藏干）
  var yinPath = '';
  if (GAN_WX[b.month.gan] === yinWx) yinPath = '月干';
  else if (GAN_WX[b.hour.gan] === yinWx) yinPath = '时干';
  else {
    var dcg = CANG[b.day.zhi];
    for (var i = 0; i < dcg.length; i++) if (GAN_WX[dcg[i]] === yinWx) { yinPath = '日支藏'; break; }
  }
  var yinAdj = yinPath !== '';
  // 长生/禄根（查四支）
  var csl = false, cslPos = [];
  POS.forEach(function(p) {
    var z = b[p].zhi;
    if (z === CS[dg]) { csl = true; cslPos.push(z + '(长生)'); }
    else if (z === LU[dg]) { csl = true; cslPos.push(z + '(禄)'); }
  });
  // 年干印 + 根/得生（强 = 有根或得月令生）
  var yGanYin = (GAN_WX[b.year.gan] === yinWx);
  var yinRootPos = [];
  POS.forEach(function(p) {
    var cg = CANG[b[p].zhi];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === yinWx) { yinRootPos.push(b[p].zhi + '(' + cg[i] + ')'); break; }
  });
  var yinDeSheng = (SHENG[mwx] === yinWx);
  var strong = yGanYin && (yinRootPos.length > 0 || yinDeSheng);
  // 受破A：贴身印干被五合合绊（合日主除外）
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
  // 受破B：日支藏印路径时日支被六冲
  var dayChong = false, chongDesc = '';
  var opp = CHONG[b.day.zhi];
  if (opp) {
    ['year','month','hour'].forEach(function(p) {
      if (b[p].zhi === opp) { dayChong = true; chongDesc = b.day.zhi + opp + '冲'; }
    });
  }
  var po = hePo || (yinPath === '日支藏' && dayChong);
  // 官杀强度证据（仅作审计展示；模型不加官杀重扣分——禁改）
  var shaCount = 0, shaTou = [];
  POS.forEach(function(p) {
    if (GAN_WX[b[p].gan] === shaWx) { shaCount++; shaTou.push(b[p].gan + '(' + p + ')'); }
    if (ZHI_WX[b[p].zhi] === shaWx) shaCount++;
  });
  // 日主根气来源（仅作审计展示）
  var dgRootPos = [];
  POS.forEach(function(p) {
    var z = b[p].zhi;
    if (ZHI_WX[z] === dgWx) { dgRootPos.push(z + '(本气)'); return; }
    var cg = CANG[z];
    for (var i = 0; i < cg.length; i++) if (GAN_WX[cg[i]] === dgWx) { dgRootPos.push(z + '(藏' + cg[i] + ')'); break; }
  });
  // 三模型档位
  var oldBonus = (dead && yinAdj && csl) ? 13 : 0;
  var m1Bonus = 0, m1Tier = 'D';
  if (dead) {
    if (oldBonus > 0) { m1Bonus = 13; m1Tier = 'A'; }
    else if (csl && yGanYin) { m1Bonus = strong ? 6 : 3; m1Tier = strong ? 'B' : 'C'; }
  }
  function tier23(topA) {
    if (!dead || !csl) return { tier: 'D', bonus: 0 };
    if (yinAdj && !po) return { tier: 'A', bonus: topA };
    if (yGanYin && (yinRootPos.length > 0 || yinDeSheng)) return { tier: 'B', bonus: 6 };
    if (yGanYin || (yinAdj && po)) return { tier: 'C', bonus: 3 };
    return { tier: 'D', bonus: 0 };
  }
  var t2 = tier23(13), t3 = tier23(10);
  return {
    dg: dg, dgWx: dgWx, mwx: mwx, dead: dead, yinPath: yinPath, yinAdj: yinAdj, csl: csl, cslPos: cslPos,
    yGanYin: yGanYin, yinRootPos: yinRootPos, yinDeSheng: yinDeSheng, strong: strong,
    hePo: hePo, heDesc: heDesc, dayChong: dayChong, chongDesc: chongDesc, po: po,
    shaCount: shaCount, shaTou: shaTou, dgRootPos: dgRootPos,
    oldBonus: oldBonus, m1Bonus: m1Bonus, m1Tier: m1Tier,
    m2Bonus: t2.bonus, m2Tier: t2.tier, m3Bonus: t3.bonus, m3Tier: t3.tier
  };
}
function levelOf(s) { if (s < 30) return '极弱'; if (s < 40) return '偏弱'; if (s < 60) return '中和'; if (s < 80) return '偏强'; return '极强'; }

// ---------- 逐盘跑五引擎 + 断言 ----------
function runRow(eng, b) {
  var dm = eng.dm(b);
  var cap = {
    before: global.__CF8h_before, after: global.__CF8h_after,
    dead: global.__CF8h_dead, yinAdj: global.__CF8h_yinAdj, csl: global.__CF8h_csl,
    tier: global.__CF8h_tier, fired: global.__CF8h_fired
  };
  var yj = eng.yj(b), pat = eng.pat(b), cong = eng.cong(b);
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pat.name + '·' + pat.status, cong: cong.isCong ? cong.name : '否', cap: cap
  };
}
var rows = [];
var a4fail = [], a5fail = [], a6fail = [];
ALL.forEach(function(c) {
  var b = toBazi(c.gz);
  resetCF(); var rU = runRow(UNIN, b);
  resetCF(); var rI = runRow(INSTR, b);
  resetCF(); var rM1 = runRow(M1, b);
  resetCF(); var rM2 = runRow(M2, b);
  resetCF(); var rM3 = runRow(M3, b);
  var mir = mirror8h(b);

  // A4: 仪表化零行为改变
  ['score','level','yong','xi','ji','pattern','cong'].forEach(function(k) {
    if (rU[k] !== rI[k]) a4fail.push(c.id + '.' + k + ': ' + rU[k] + ' ≠ ' + rI[k]);
  });
  // A5: 探针镜像 === 引擎捕获
  if (rI.cap.before === undefined) {
    // 短路（未到达⑧½）：M 变体必须零差异
    if (rM1.score !== rI.score || rM2.score !== rI.score || rM3.score !== rI.score) {
      a6fail.push(c.id + ' ⑧½短路盘却有模型分差');
    }
  } else {
    if (rI.cap.dead !== (mir.dead ? 1 : 0)) a5fail.push(c.id + ' dead: 引擎' + rI.cap.dead + ' ≠ 镜像' + (mir.dead ? 1 : 0));
    // yinAdj/csl 仅死令分支计算（引擎对非死令盘恒 0，镜像按"若死令则如何"口径）——只比对死令盘
    if (mir.dead) {
      if (rI.cap.yinAdj !== (mir.yinAdj ? 1 : 0)) a5fail.push(c.id + ' yinAdj: 引擎' + rI.cap.yinAdj + ' ≠ 镜像' + (mir.yinAdj ? 1 : 0));
      if (rI.cap.csl !== (mir.csl ? 1 : 0)) a5fail.push(c.id + ' csl: 引擎' + rI.cap.csl + ' ≠ 镜像' + (mir.csl ? 1 : 0));
    }
    var bI = rI.cap.after - rI.cap.before;
    if (bI !== mir.oldBonus) a5fail.push(c.id + ' 旧bonus: 引擎' + bI + ' ≠ 镜像' + mir.oldBonus);
    var bM1 = rM1.cap.after - rM1.cap.before;
    var bM2 = rM2.cap.after - rM2.cap.before;
    var bM3 = rM3.cap.after - rM3.cap.before;
    if (bM1 !== mir.m1Bonus) a5fail.push(c.id + ' M1bonus: 引擎' + bM1 + ' ≠ 镜像' + mir.m1Bonus);
    if (bM2 !== mir.m2Bonus) a5fail.push(c.id + ' M2bonus: 引擎' + bM2 + ' ≠ 镜像' + mir.m2Bonus);
    if (bM3 !== mir.m3Bonus) a5fail.push(c.id + ' M3bonus: 引擎' + bM3 + ' ≠ 镜像' + mir.m3Bonus);
    // A6: 模型−INSTR ⑧½层差值 === 镜像档位分差
    if ((rM1.cap.after - rI.cap.after) !== (mir.m1Bonus - mir.oldBonus)) a6fail.push(c.id + ' M1 层差 ' + (rM1.cap.after - rI.cap.after) + ' ≠ ' + (mir.m1Bonus - mir.oldBonus));
    if ((rM2.cap.after - rI.cap.after) !== (mir.m2Bonus - mir.oldBonus)) a6fail.push(c.id + ' M2 层差 ' + (rM2.cap.after - rI.cap.after) + ' ≠ ' + (mir.m2Bonus - mir.oldBonus));
    if ((rM3.cap.after - rI.cap.after) !== (mir.m3Bonus - mir.oldBonus)) a6fail.push(c.id + ' M3 层差 ' + (rM3.cap.after - rI.cap.after) + ' ≠ ' + (mir.m3Bonus - mir.oldBonus));
  }

  var crosses = function(after) {
    return [30,40,50,60,70].filter(function(t) { return rI.cap.before < t && after >= t; }).map(String).join('/') || '';
  };
  var flags = [];
  var ms = { BASE: rI, M1: rM1, M2: rM2, M3: rM3 };
  ['M1','M2','M3'].forEach(function(mk) {
    if (ms[mk].level !== rI.level) flags.push(mk + '翻档');
    if (ms[mk].yong !== rI.yong) flags.push(mk + '用神翻转');
    if (ms[mk].xi !== rI.xi || ms[mk].ji !== rI.ji) flags.push(mk + '喜忌翻转');
    if (ms[mk].pattern !== rI.pattern) flags.push(mk + '格局变化');
  });
  rows.push({
    set: c.set, id: c.id, gz: c.gz.join(' '),
    dg: mir.dg, mz: b.month.zhi, mwx: mir.mwx, dead: mir.dead,
    yinPath: mir.dead ? mir.yinPath : '', yGanYin: mir.dead ? mir.yGanYin : false,
    yinRootPos: mir.dead ? mir.yinRootPos.join(',') : '', yinDeSheng: mir.dead ? mir.yinDeSheng : false,
    strong: mir.dead ? mir.strong : false, heDesc: mir.dead ? mir.heDesc : '', chongDesc: mir.dead ? mir.chongDesc : '',
    shaCount: mir.shaCount, shaTou: mir.shaTou.join(','), dgRootPos: mir.dgRootPos.join(','),
    csl: mir.csl, cslPos: mir.cslPos.join(','),
    oldBonus: mir.oldBonus, m1Tier: mir.m1Tier, m1Bonus: mir.m1Bonus,
    m2Tier: mir.m2Tier, m2Bonus: mir.m2Bonus, m3Tier: mir.m3Tier, m3Bonus: mir.m3Bonus,
    before: rI.cap.before, afterBASE: rI.cap.after, afterM1: rM1.cap.after, afterM2: rM2.cap.after, afterM3: rM3.cap.after,
    crossBASE: crosses(rI.cap.after), crossM1: crosses(rM1.cap.after), crossM2: crosses(rM2.cap.after), crossM3: crosses(rM3.cap.after),
    sBase: rI.score, sM1: rM1.score, sM2: rM2.score, sM3: rM3.score,
    lBase: rI.level, lM1: rM1.level, lM2: rM2.level, lM3: rM3.level,
    yBase: rI.yong, yM1: rM1.yong, yM2: rM2.yong, yM3: rM3.yong,
    xiBase: rI.xi, xiM1: rM1.xi, xiM2: rM2.xi, xiM3: rM3.xi,
    jiBase: rI.ji, jiM1: rM1.ji, jiM2: rM2.ji, jiM3: rM3.ji,
    pBase: rI.pattern, pM1: rM1.pattern, pM2: rM2.pattern, pM3: rM3.pattern,
    cong: rI.cong, short: rI.cap.before === undefined, flags: flags.join(';')
  });
});
if (a4fail.length) { console.error('❌ A4 失败（仪表化改变行为）:'); a4fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
if (a5fail.length) { console.error('❌ A5 失败（探针镜像≠引擎）:'); a5fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
if (a6fail.length) { console.error('❌ A6 失败（差值不精确）:'); a6fail.forEach(function(f) { console.error('   ' + f); }); process.exit(1); }
console.log('✅ A4：仪表化零行为改变（' + ALL.length + ' 行 × 8 字段全等）');
console.log('✅ A5：探针镜像 === 引擎捕获（dead/yinAdj/csl/五引擎bonus 逐盘全等）');
console.log('✅ A6：逐盘 M1/M2/M3−INSTR ⑧½层差值 === 镜像档位分差；短路盘零差');

// ---------- 报告 ----------
var shortRows = rows.filter(function(r) { return r.short; });
if (shortRows.length) console.log('\n⚠ 短路盘（未到达⑧½，模型零差异）：' + shortRows.map(function(r) { return r.id; }).join('、'));

// ========== 旧 +13 命中盘全盘点 + 证据字段 + A/B/C/D 重分类 ==========
var oldHit = rows.filter(function(r) { return r.oldBonus > 0; });
console.log('\n========== 当前 +13 命中盘全盘点（' + oldHit.length + ' 盘）==========');
oldHit.forEach(function(r) {
  console.log('[' + r.set + '] ' + r.id + ' ' + r.gz + ' | ' + r.dg + '日主 ' + r.mz + '月(' + r.mwx + '令·死)');
  console.log('  印路径=' + r.yinPath + (r.yGanYin ? '（年干亦印）' : '') + ' | 印根=' + (r.yinRootPos || '无') + (r.yinDeSheng ? '·得月令生' : '') +
    ' | 受破=' + (r.heDesc || r.chongDesc || '无') + ' | 日主根=' + r.dgRootPos + ' | 长生禄=' + r.cslPos);
  console.log('  官杀证据=' + (r.shaCount >= 1 ? r.shaCount + '字' + (r.shaTou ? '·透' + r.shaTou : '') : '仅月令') +
    ' | 旧+13：' + r.before + '→' + r.afterBASE + ' 跨' + (r.crossBASE || '无') +
    ' | M1=' + r.m1Tier + r.m1Bonus + ' M2=' + r.m2Tier + r.m2Bonus + ' M3=' + r.m3Tier + r.m3Bonus);
  console.log('  终分 ' + r.sBase + '(' + r.lBase + ')→M1 ' + r.sM1 + '(' + r.lM1 + ')/M2 ' + r.sM2 + '(' + r.lM2 + ')/M3 ' + r.sM3 + '(' + r.lM3 + ')' +
    (r.flags ? '  ⚡' + r.flags : ''));
});

// ========== 死令+CSL 但旧规则未命中的盘（M1/M2/M3 补正候选） ==========
var nearMiss = rows.filter(function(r) { return r.dead && r.csl && r.oldBonus === 0 && !r.short; });
console.log('\n========== 死令+长生/禄根但旧规则 +0 的盘（' + nearMiss.length + ' 盘，补正候选）==========');
nearMiss.forEach(function(r) {
  console.log('[' + r.set + '] ' + r.id + ' ' + r.gz + ' | ' + r.dg + '日主 ' + r.mz + '月(' + r.mwx + '令·死)');
  console.log('  印情况=' + (r.yinPath || '无贴身印') + (r.yGanYin ? '·年干印(根=' + (r.yinRootPos || '无') + (r.yinDeSheng ? '·得生' : '') + (r.strong ? '·强' : '·弱') + ')' : '·无年干印') +
    ' | 长生禄=' + r.cslPos + ' | 官杀证据=' + (r.shaCount >= 1 ? r.shaCount + '字' + (r.shaTou ? '·透' + r.shaTou : '') : '仅月令'));
  console.log('  旧0：' + r.before + ' | M1=' + r.m1Tier + r.m1Bonus + ' M2=' + r.m2Tier + r.m2Bonus + ' M3=' + r.m3Tier + r.m3Bonus +
    ' | 终分 ' + r.sBase + '(' + r.lBase + ')→M1 ' + r.sM1 + '(' + r.lM1 + ')/M2 ' + r.sM2 + '(' + r.lM2 + ')/M3 ' + r.sM3 + '(' + r.lM3 + ')' +
    (r.flags ? '  ⚡' + r.flags : ''));
});

// ========== 十项指标 ==========
function stat(setFilter, label) {
  var s = rows.filter(setFilter);
  if (!s.length) return;
  var oldHitS = s.filter(function(r) { return r.oldBonus > 0; });
  var nearMissS = s.filter(function(r) { return r.dead && r.csl && r.oldBonus === 0 && !r.short; });
  var newS = s.filter(function(r) { return r.oldBonus === 0 && (r.m1Bonus > 0 || r.m2Bonus > 0 || r.m3Bonus > 0) && !r.short; });
  console.log('\n----- ' + label + '（' + s.length + ' 行）-----');
  // 指标1：命中面与档位分布
  console.log('① ⑧½介入面：旧+13 命中 ' + oldHitS.length + ' 盘；M1 介入 ' + s.filter(function(r){ return r.m1Bonus > 0; }).length +
    ' 盘（A' + s.filter(function(r){ return r.m1Tier === 'A'; }).length + '/B' + s.filter(function(r){ return r.m1Tier === 'B'; }).length + '/C' + s.filter(function(r){ return r.m1Tier === 'C'; }).length + '）' +
    '；M2 介入 ' + s.filter(function(r){ return r.m2Bonus > 0; }).length +
    ' 盘（A' + s.filter(function(r){ return r.m2Tier === 'A'; }).length + '/B' + s.filter(function(r){ return r.m2Tier === 'B'; }).length + '/C' + s.filter(function(r){ return r.m2Tier === 'C'; }).length + '）' +
    '；M3 介入 ' + s.filter(function(r){ return r.m3Bonus > 0; }).length +
    ' 盘（A' + s.filter(function(r){ return r.m3Tier === 'A'; }).length + '/B' + s.filter(function(r){ return r.m3Tier === 'B'; }).length + '/C' + s.filter(function(r){ return r.m3Tier === 'C'; }).length + '）');
  // 指标2+3：降档/新增
  var downS = s.filter(function(r) { return r.oldBonus > 0 && (r.m1Bonus !== r.oldBonus || r.m2Bonus !== r.oldBonus || r.m3Bonus !== r.oldBonus); });
  console.log('② 旧+13降档盘 ' + downS.length + '：' + (downS.map(function(r) {
    return r.id + '(+13→M1' + r.m1Bonus + '/M2' + r.m2Bonus + '/M3' + r.m3Bonus + ')';
  }).join('、') || '无（M1/M2/M3 对旧命中盘全部保持）'));
  console.log('③ 旧+0新增补偿盘 ' + newS.length + '：' + (newS.map(function(r) {
    return r.id + '(0→M1' + r.m1Bonus + '/M2' + r.m2Bonus + '/M3' + r.m3Bonus + ')';
  }).join('、') || '无'));
  // 指标4：五档翻转
  ['M1','M2','M3'].forEach(function(mk) {
    var fl = s.filter(function(r) { return r['lBase'] !== r['l' + mk]; });
    console.log('④ ' + mk + '五档翻转 ' + fl.length + '：' + (fl.map(function(r) { return r.id + ' ' + r.lBase + '→' + r['l' + mk]; }).join('、') || '无'));
  });
  // 指标5：中和带边界翻转（跨40/60）
  ['M1','M2','M3'].forEach(function(mk) {
    var fl = s.filter(function(r) {
      var a = r.sBase, b = r['s' + mk];
      return ((a < 40 && b >= 40) || (a >= 40 && b < 40) || (a < 60 && b >= 60) || (a >= 60 && b < 60));
    });
    console.log('⑤ ' + mk + '中和带边界翻转(跨40/60) ' + fl.length + '：' + (fl.map(function(r) { return r.id + ' ' + r.sBase + '→' + r['s' + mk]; }).join('、') || '无'));
  });
  // 指标6：用神/喜/忌翻转
  ['M1','M2','M3'].forEach(function(mk) {
    var fy = s.filter(function(r) { return r.yBase !== r['y' + mk]; });
    var fx = s.filter(function(r) { return r.xiBase !== r['xi' + mk] || r.jiBase !== r['ji' + mk]; });
    console.log('⑥ ' + mk + '用神翻转 ' + fy.length + '：' + (fy.map(function(r) { return r.id + ' ' + r.yBase + '→' + r['y' + mk]; }).join('、') || '无') +
      '；喜/忌翻转 ' + fx.length + '：' + (fx.map(function(r) { return r.id; }).join('、') || '无'));
  });
  // 指标7：格局变化
  ['M1','M2','M3'].forEach(function(mk) {
    var fp = s.filter(function(r) { return r.pBase !== r['p' + mk]; });
    console.log('⑦ ' + mk + '格局变化 ' + fp.length + '：' + (fp.map(function(r) { return r.id + ' ' + r.pBase + '→' + r['p' + mk]; }).join('、') || '无'));
  });
  // 指标10：新边界问题（五档未翻但用神翻转）
  ['M1','M2','M3'].forEach(function(mk) {
    var f = s.filter(function(r) { return r['lBase'] === r['l' + mk] && r.yBase !== r['y' + mk]; });
    console.log('⑩ ' + mk + '新边界问题（五档未翻但用神翻转）' + f.length + '：' + (f.map(function(r) { return r.id + ' ' + r.yBase + '→' + r['y' + mk]; }).join('、') || '无'));
  });
}
stat(function(r) { return r.set === '22基线' || r.set === '六盘锚点'; }, '28盘设计样本（22基线+六盘锚点）');
stat(function(r) { return r.set === '18专项(观察)'; }, '18专项观察集');
stat(function(r) { return r.set === '附加观察' || r.set === '合成观察'; }, '附加观察（P15-19/20 + 合成）');

// ========== 指标8：六盘锚点 ==========
console.log('\n----- ⑧ 六盘锚点逐盘（BASE/M1/M2/M3 终分+档）-----');
['P15-03','P15-09','P15-12','P15-14','P15-15','P15-16'].forEach(function(id) {
  var r = rows.filter(function(x) { return x.id === id; })[0];
  if (!r) return;
  console.log(id + ' ' + r.gz + ' | ⑧½前=' + (r.short ? '短路' : r.before) +
    ' 旧bonus=' + r.oldBonus + '(M1' + r.m1Bonus + '/M2' + r.m2Bonus + '/M3' + r.m3Bonus + ')' +
    ' | BASE ' + r.sBase + '(' + r.lBase + ') → M1 ' + r.sM1 + '(' + r.lM1 + ') / M2 ' + r.sM2 + '(' + r.lM2 + ') / M3 ' + r.sM3 + '(' + r.lM3 + ')' +
    (r.flags ? ' ⚡' + r.flags : ''));
});

// ========== 指标9：22基线命中盘逐盘 ==========
console.log('\n----- ⑨ 22基线旧+13盘逐盘（⑧½前/后 + 三模型）-----');
rows.filter(function(r) { return r.set === '22基线' && r.oldBonus > 0; }).forEach(function(r) {
  console.log(r.id + ' ' + r.gz + ' | ⑧½前=' + r.before + ' 旧+13→' + r.afterBASE +
    ' M1' + r.m1Bonus + '/' + r.m2Tier + r.m2Bonus + '/' + r.m3Tier + r.m3Bonus +
    ' | ' + r.sBase + '(' + r.lBase + ')→M1 ' + r.sM1 + '(' + r.lM1 + ')/M2 ' + r.sM2 + '(' + r.lM2 + ')/M3 ' + r.sM3 + '(' + r.lM3 + ')' +
    ' | 用 ' + r.yBase + (r.yM2 !== r.yBase ? '→M2' + r.yM2 : '') + (r.yM3 !== r.yBase ? '→M3' + r.yM3 : '') +
    (r.flags ? ' ⚡' + r.flags : ''));
});

// ========== 重点盘单列 ==========
console.log('\n========== 重点盘单列 ==========');
['#6','P15-03','A3','P15-14','P15-20','A4','A5'].forEach(function(id) {
  var r = rows.filter(function(x) { return x.id === id; })[0];
  if (!r) return;
  console.log(id + ' ' + r.gz + ' | ' + r.dg + '日主 ' + r.mz + '月(' + r.mwx + '令) ' +
    (r.dead ? '死令' : '非死令') + ' | 印路径=' + (r.yinPath || '无') + (r.yGanYin ? '·年干印' : '') +
    (r.heDesc ? '·' + r.heDesc : '') + (r.chongDesc ? '·' + r.chongDesc : '') +
    ' | CSL=' + (r.cslPos || '无') + ' | 官杀' + (r.shaCount >= 1 ? r.shaCount + '字' : '仅月令'));
  console.log('  ⑧½前=' + (r.short ? '短路' : r.before) + ' 旧+13=' + r.oldBonus +
    ' M1=' + r.m1Tier + r.m1Bonus + ' M2=' + r.m2Tier + r.m2Bonus + ' M3=' + r.m3Tier + r.m3Bonus +
    ' | BASE ' + r.sBase + '(' + r.lBase + ')→M1 ' + r.sM1 + '(' + r.lM1 + ')/M2 ' + r.sM2 + '(' + r.lM2 + ')/M3 ' + r.sM3 + '(' + r.lM3 + ')' +
    ' | 用 ' + r.yBase + (r.yM1 !== r.yBase ? '→M1' + r.yM1 : '') + (r.yM2 !== r.yBase ? '→M2' + r.yM2 : '') + (r.yM3 !== r.yBase ? '→M3' + r.yM3 : '') +
    ' | 格局 ' + r.pBase + (r.pM2 !== r.pBase ? '→M2' + r.pM2 : '') + (r.flags ? ' ⚡' + r.flags : ''));
});

// ========== 合成观察：c=4 囚盘 ⑤尾风险（P2.2 保留意见 A） ==========
console.log('\n========== 合成观察：c=4 囚盘（⑤=-12 与 ①=-10 同量级）==========');
['SY1','SY2'].forEach(function(id) {
  var r = rows.filter(function(x) { return x.id === id; })[0];
  if (!r) return;
  console.log(id + ' ' + r.gz + ' | ' + r.dg + '日主 ' + r.mz + '月(' + r.mwx + '令·囚) mwxCount=4' +
    ' | ⑧½未触发(非死令)' + ' | BASE终分=' + r.sBase + '(' + r.lBase + ') 三模型零差异=' + (r.sM1 === r.sBase && r.sM2 === r.sBase && r.sM3 === r.sBase) +
    ' | ⑤贡献=-12 vs ①=-10' + (r.sBase <= 1 ? ' → 钳位（可见面⑤支配性为 0）' : ' → 可见分未钳位'));
});

// ---------- CSV ----------
var head = ['set','id','gz','dg','mz','mwx','dead','csl','cslPos','yinPath','yGanYin','yinRootPos','yinDeSheng','strong','heDesc','chongDesc','shaCount','shaTou','dgRootPos',
  'oldBonus','m1Tier','m1Bonus','m2Tier','m2Bonus','m3Tier','m3Bonus',
  'before','afterBASE','afterM1','afterM2','afterM3','crossBASE','crossM1','crossM2','crossM3',
  'sBase','sM1','sM2','sM3','lBase','lM1','lM2','lM3',
  'yBase','yM1','yM2','yM3','xiBase','xiM1','xiM2','xiM3','jiBase','jiM1','jiM2','jiM3',
  'pBase','pM1','pM2','pM3','cong','short','flags'];
var csv = head.join(',') + '\n';
rows.forEach(function(r) {
  csv += head.map(function(h) {
    var v = r[h];
    if (v === undefined || v === null) v = '';
    v = String(v).replace(/"/g, '""').replace(/,/g, '，').replace(/\r?\n/g, ' ');
    return '"' + v + '"';
  }).join(',') + '\n';
});
fs.writeFileSync(path.join(ROOT, '_p2_3a_counterfactual.csv'), '﻿' + csv);
console.log('\n产物：_p2_3a_counterfactual.csv（' + rows.length + ' 行）');
console.log('P2.3 反事实完成。不改 js/bazi.js、不 push。');
