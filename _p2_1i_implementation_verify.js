// P2.1 实装验证（2026-08-13，GPT 第四轮最终裁决第6/8条）
// 1) formal（工作区 js/bazi.js）=== 内存正式预览补丁（HEAD + 独立预览实现，不抄写实装代码），46 盘硬断言
// 2) 探针镜像（经典午未合土 + qualification v1 + M-A residual 语义）vs formal 引擎：18 盘 dayBranchAdj 硬断言 + 18/18 GPT 标签
// 3) before/after（formal vs BASE=HEAD 引擎）+ 锚点契约 + 28 盘影响集断言 + 46 盘用神零翻转断言 + 五档翻转集断言
// 4) formal vs 已测 M-A（1g CSV）差异表：预期 adj 差 = 趋化语义 9 盘；分差 = 12 盘（+§⑧午未表修正 3 盘）
// 任一断言失败立即抛错停止（不允许现场调参）。产物: _p2_1i_implementation_verify.csv
// 用法: node _p2_1i_implementation_verify.js
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), cp = require('child_process'), ROOT = __dirname;

function gitShow(rel) {
  return cp.execSync('git show HEAD:' + rel, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

// ========== 一、三份源码 ==========
var baseSrc = gitShow('js/bazi.js');                                          // HEAD（P1 冻结引擎）
var formalSrc = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');   // 工作区实装

// 预览补丁：HEAD + 独立实现（变量名/结构/注释与实装互不抄写，仅语义一致：qualification v1 + M-A residual）
var BLOCK_RE = /  \/\/ 日支被合化 → 得地根基重构（如辰酉合金→辰土变金印）\r?\n[\s\S]*?  score \+= dayBranchAdj;\r?\n/;
function buildPreview(src) {
  var hit1 = false, hit2 = false;
  var out = src.replace(/var ZHI_HE = \[\['子','丑','土'\],\['寅','亥','木'\],\['卯','戌','火'\],\['辰','酉','金'\],\['巳','申','水'\],\['午','未','火'\]\];/g, function() {
    hit1 = true;
    return "var ZHI_HE = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];";
  });
  out = out.replace(BLOCK_RE, function() {
    hit2 = true;
    return [
      '  // 日支被合化 → 得地根基重构（预览补丁 P2.1I：独立参考实现）',
      '  var dayBranchAdj = 0;',
      '  var heList = [];',
      "  [['year','month'],['month','day'],['day','hour']].forEach(function(p) {",
      '    var a = bazi[p[0]].zhi, c = bazi[p[1]].zhi;',
      '    if (zhiHeScore[a+c]) heList.push({a:a, c:c, w:zhiHeScore[a+c], x:p[0], y:p[1]});',
      '  });',
      '  for (var i = 0; i < allPositions.length; i++) for (var j = i + 1; j < allPositions.length; j++) {',
      '    if (Math.abs(i - j) === 1) continue;',
      '    var a2 = bazi[allPositions[i]].zhi, c2 = bazi[allPositions[j]].zhi;',
      '    if (zhiHeScore[a2+c2]) heList.push({a:a2, c:c2, w:zhiHeScore[a2+c2], x:allPositions[i], y:allPositions[j]});',
      '  }',
      "  var dPairs = heList.filter(function(h){ return h.x==='day' || h.y==='day'; });",
      '  if (dPairs.length) {',
      '    var HUA = dPairs[0].w, MWX = DI_ZHI_WU_XING[bazi.month.zhi];',
      "    var WXS_T = {'木':{'木':'旺','火':'相','水':'休','金':'囚','土':'死'},'火':{'火':'旺','土':'相','木':'休','水':'囚','金':'死'},'金':{'金':'旺','水':'相','土':'休','火':'囚','木':'死'},'水':{'水':'旺','木':'相','金':'休','土':'囚','火':'死'},'土':{'土':'旺','金':'相','火':'休','木':'囚','水':'死'}};",
      '    var ST = WXS_T[MWX][HUA];',
      "    var S = MWX === HUA ? 1 : (ST === '旺' || ST === '相' ? 2 : 0);",
      '    var TG = (WU_XING[bazi.month.gan] === HUA || WU_XING[bazi.hour.gan] === HUA) ? 2 : (WU_XING[bazi.year.gan] === HUA ? 1 : 0);',
      '    var R1 = false, R2 = false;',
      '    dPairs.forEach(function(h) { allPositions.forEach(function(p) {',
      '      var z = bazi[p].zhi;',
      '      if (chongMap[z] === h.a || chongMap[z] === h.c) R1 = true;',
      '      if (chongMap[z] === bazi.month.zhi) R2 = true;',
      '    }); });',
      "    var CLS = (S === 1 && TG === 2 && !R1 && !R2) ? '真化' : ((S === 1 || S === 2) ? '趋化' : '不化');",
      "    var OR = CLS === '真化' ? 0.5 : (CLS === '趋化' ? 0.75 : 1);",
      "    var NE = CLS === '真化' ? 0.75 : (CLS === '趋化' ? 0.5 : 0);",
      '    var seen = {};',
      '    dPairs.forEach(function(h) {',
      '      var oW = DI_ZHI_WU_XING[bazi.day.zhi], nW = h.w;',
      "      var k = oW + '→' + nW; if (seen[k]) return; seen[k] = true;",
      '      if (oW === nW) return;',
      '      var oldSide = oW === dgWx ? -12 * (1 - OR) : SHENGWO[dgWx] === oW ? -8 * (1 - OR) : KEWO[dgWx] === oW ? 10 * (1 - OR) : WOSHENG[dgWx] === oW ? 7 * (1 - OR) : 6 * (1 - OR);',
      '      var newSide = nW === dgWx ? 12 * NE : SHENGWO[dgWx] === nW ? 8 * NE : KEWO[dgWx] === nW ? -10 * NE : WOSHENG[dgWx] === nW ? -7 * NE : -6 * NE;',
      '      dayBranchAdj += oldSide + newSide;',
      '    });',
      '  }',
      '  score += dayBranchAdj;'
    ].join('\n') + '\n';
  });
  if (!hit1 || !hit2) throw new Error('预览补丁未生效 hit1=' + hit1 + ' hit2=' + hit2);
  return out;
}
var previewSrc = buildPreview(baseSrc);
if (formalSrc === baseSrc) throw new Error('工作区 js/bazi.js 与 HEAD 无差异——实装未生效？');

// 观测补丁：暴露 dayBranchAdj（三引擎同构，仅观测不改计分）
function instrument(src, tag) {
  var hit = false;
  var out = src.replace(/score \+= dayBranchAdj;\r?\n/, function() {
    hit = true;
    return 'score += dayBranchAdj;\n      global.__' + tag + '_adj = dayBranchAdj; // 观测：不改变计分\n';
  });
  if (!hit) throw new Error('观测补丁未生效 ' + tag);
  return out;
}

// ========== 二、引擎装载（BASE / FORMAL / PREVIEW）==========
function loadEngine(src) {
  var stitched = '';
  ['getYongJi', 'calcDayMasterStrength', 'getCongGe', 'getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  eval(src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {'));
  return {
    dm: global.calcDayMasterStrength,
    yj: global.getYongJi,
    cong: global.getCongGe,
    pat: global.getPattern
  };
}
var ENG = {};
ENG.BASE = loadEngine(instrument(baseSrc, 'BASE'));
ENG.FORMAL = loadEngine(instrument(formalSrc, 'FORMAL'));
ENG.PREVIEW = loadEngine(instrument(previewSrc, 'PREVIEW'));

// ========== 三、样本集（18 专项 + 22 基线 + 6 锚点，按四柱去重）==========
var CHARTS18 = [
  { id: 'H01', gz: ['癸未','戊午','乙卯','丙戌'], expAdj: -19 },
  { id: 'H02', gz: ['戊辰','甲寅','丁亥','庚子'], expAdj: 18 },
  { id: 'H03', gz: ['甲寅','戊辰','壬子','辛丑'], expAdj: -22 },
  { id: 'H04', gz: ['甲申','庚午','辛卯','戊戌'], expAdj: -4 },
  { id: 'H05', gz: ['庚子','乙酉','甲辰','甲子'], expAdj: -4 },
  { id: 'H06', gz: ['乙巳','壬午','丁未','戊申'], expAdj: 19 },
  { id: 'H07', gz: ['己丑','丙寅','丁亥','甲辰'], expAdj: 18 },
  { id: 'H08', gz: ['丁酉','丙午','丁卯','庚戌'], expAdj: 4 },
  { id: 'H09', gz: ['甲寅','壬申','壬辰','己酉'], expAdj: 18 },
  { id: 'H10', gz: ['癸未','丁巳','丙戌','辛卯'], expAdj: 19 },
  { id: 'H11', gz: ['壬辰','癸卯','戊戌','丁巳'], expAdj: 0 },
  { id: 'H12', gz: ['甲申','丁丑','壬辰','己酉'], expAdj: 0 },
  { id: 'H13', gz: ['壬寅','丙午','丙戌','辛卯'], expAdj: 19 },
  { id: 'H14', gz: ['乙丑','己丑','壬子','辛丑'], expAdj: -22 },
  { id: 'H15', gz: ['甲寅','庚午','庚辰','乙酉'], expAdj: 0 },
  { id: 'H16', gz: ['丙辰','庚子','癸巳','庚申'], expAdj: 18 },
  { id: 'H17', gz: ['甲子','丙子','癸亥','甲寅'], expAdj: 0 },
  { id: 'H18', gz: ['癸卯','己未','甲午','壬申'], expAdj: 0 }
];
var GPT_LABELS = {
  'H01':'真化','H02':'真化','H03':'真化','H07':'真化','H10':'真化','H13':'真化','H14':'真化','H18':'真化',
  'H04':'趋化','H05':'趋化','H06':'趋化','H08':'趋化','H09':'趋化','H11':'趋化','H12':'趋化','H16':'趋化','H17':'趋化',
  'H15':'合而不化'
};
var SIX = [
  { id: 'P15-03', gz: ['乙丑','戊寅','己巳','庚午'] },
  { id: 'P15-09', gz: ['丁丑','癸卯','庚申','丙戌'] },
  { id: 'P15-12', gz: ['戊子','甲寅','庚申','丁亥'] },
  { id: 'P15-14', gz: ['丙寅','庚寅','戊辰','癸亥'] },
  { id: 'P15-15', gz: ['癸未','戊午','乙卯','丙戌'] },
  { id: 'P15-16', gz: ['丁卯','壬寅','壬午','庚子'] }
];

// 22 基线（_baseline_22.csv 第2列四柱；用神列已确认过期，仅取四柱）
var BASELINE22 = [];
fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').replace(/^﻿/, '').split('\n').slice(1).forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var cells = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (cells.length < 10 || !cells[1]) return;
  var gz = cells[1].split(/\s+/);
  if (gz.length !== 4) return;
  BASELINE22.push({ id: cells[0], gz: gz });
});

// 按四柱去重（H01=P15-15，H11=A5）
var CHART_MAP = {};
function addChart(id, gz, src) {
  var key = gz.join(' ');
  if (!CHART_MAP[key]) CHART_MAP[key] = { gz: gz, ids: [], src: [] };
  CHART_MAP[key].ids.push(id);
  if (CHART_MAP[key].src.indexOf(src) < 0) CHART_MAP[key].src.push(src);
}
CHARTS18.forEach(function(c) { addChart(c.id, c.gz, '专项'); });
BASELINE22.forEach(function(c) { addChart(c.id, c.gz, '基线'); });
SIX.forEach(function(c) { addChart(c.id, c.gz, '锚点'); });
var ALL_KEYS = Object.keys(CHART_MAP);

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month: { gan: gz[1][0], zhi: gz[1][1] },
    day: { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object') {
    var o = {};
    Object.keys(x).sort().forEach(function(k) { o[k] = canon(x[k]); });
    return o;
  }
  return x;
}
function runChart(eng, tag, gz) {
  var b = toBazi(gz);
  global['__' + tag + '_adj'] = null;
  var dm = eng.dm(b);
  var yj = eng.yj(b);
  var cong = eng.cong(b), pat = eng.pat(b);
  return {
    adj: global['__' + tag + '_adj'] === null ? 0 : global['__' + tag + '_adj'],
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    congSig: JSON.stringify(canon(cong)), patSig: JSON.stringify(canon(pat))
  };
}

// ========== 四、探针镜像（经典口径 + qualification v1 + M-A residual，独立复算）==========
var GANS_P = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var GAN_WX_P = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX_P = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var HE6_P = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
var heMap_P = {}; HE6_P.forEach(function(t){ heMap_P[t[0]+t[1]]=t[2]; heMap_P[t[1]+t[0]]=t[2]; });
var chongMap_P = {}; [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']].forEach(function(p){ chongMap_P[p[0]]=p[1]; chongMap_P[p[1]]=p[0]; });
var WXS_P = {
  '木': {'木':'旺','火':'相','水':'休','金':'囚','土':'死'},
  '火': {'火':'旺','土':'相','木':'休','水':'囚','金':'死'},
  '金': {'金':'旺','水':'相','土':'休','火':'囚','木':'死'},
  '水': {'水':'旺','木':'相','金':'休','土':'囚','火':'死'},
  '土': {'土':'旺','金':'相','火':'休','木':'囚','水':'死'}
};
var POS_P = ['year','month','day','hour'];
var ALL_PAIRS_P = [['year','month'],['month','day'],['day','hour'],['year','day'],['year','hour'],['month','hour']];
function probeScan(gz) {
  var b = { year:{gan:gz[0][0],zhi:gz[0][1]}, month:{gan:gz[1][0],zhi:gz[1][1]}, day:{gan:gz[2][0],zhi:gz[2][1]}, hour:{gan:gz[3][0],zhi:gz[3][1]} };
  var mz = gz[1][1];
  var pairs = [];
  ALL_PAIRS_P.forEach(function(pair) {
    var z1 = gz[POS_P.indexOf(pair[0])][1], z2 = gz[POS_P.indexOf(pair[1])][1];
    var hua = heMap_P[z1+z2];
    if (!hua) return;
    if (pair[0] === 'day' || pair[1] === 'day') pairs.push({ z1:z1, z2:z2, hua:hua });
  });
  var huaWx = pairs.length ? pairs[0].hua : null;
  var tou = POS_P.filter(function(p) { return p !== 'day' && GAN_WX_P[b[p].gan] === huaWx; });
  var chongHit = false;
  if (huaWx) pairs.forEach(function(h) {
    POS_P.forEach(function(p) {
      var z = gz[POS_P.indexOf(p)][1];
      if (chongMap_P[z] === h.z1 || chongMap_P[z] === h.z2) chongHit = true;
    });
  });
  var monthChong = false;
  POS_P.forEach(function(p) {
    if (p !== 'month' && chongMap_P[gz[POS_P.indexOf(p)][1]] === mz) monthChong = true;
  });
  return { pairs: pairs, huaWx: huaWx, tou: tou, chongHit: chongHit, monthChong: monthChong };
}
function probeRule(gz) {
  var sc = probeScan(gz);
  if (!sc.pairs.length) return { cls: '合而不化', S: '无合', T: '—', D: '无' };
  var mwx = ZHI_WX_P[gz[1][1]], hua = sc.huaWx;
  var st = WXS_P[mwx][hua];
  var S = (mwx === hua) ? 'S1' : ((st === '旺' || st === '相') ? 'S2' : 'S0');
  var T = (sc.tou.indexOf('month') >= 0 || sc.tou.indexOf('hour') >= 0) ? 'T2' : (sc.tou.indexOf('year') >= 0 ? 'T1' : 'T0');
  var D = (sc.chongHit ? 'R1' : '') + (sc.monthChong ? 'R2' : '') || '无';
  var cls = (S === 'S1' && T === 'T2' && !sc.chongHit && !sc.monthChong) ? '真化' : ((S === 'S1' || S === 'S2') ? '趋化' : '合而不化');
  return { cls: cls, S: S, T: T, D: D };
}
// M-A residual 语义（最终裁决口径）：旧侧 ×(1−originalResidual)，新侧 ×newElementEffect
function probeAdjMA(gz) {
  var sc = probeScan(gz);
  if (!sc.pairs.length) return 0;
  var r = probeRule(gz);
  var OR = r.cls === '真化' ? 0.5 : (r.cls === '趋化' ? 0.75 : 1);
  var NE = r.cls === '真化' ? 0.75 : (r.cls === '趋化' ? 0.5 : 0);
  var dg = GAN_WX_P[gz[2][0]], oldWx = ZHI_WX_P[gz[2][1]];
  var applied = {}, adj = 0;
  sc.pairs.forEach(function(h) {
    var newWx = h.hua;
    var key = oldWx + '→' + newWx;
    if (applied[key]) return; applied[key] = true;
    if (oldWx === newWx) return;
    if (oldWx === dg) adj -= 12 * (1 - OR);
    else if (SHENG_P[dg] === oldWx) adj -= 8 * (1 - OR);
    else if (KE_P[dg] === oldWx) adj += 10 * (1 - OR);
    else if (SHENG_P[oldWx] === dg) adj += 7 * (1 - OR);
    else if (KE_P[oldWx] === dg) adj += 6 * (1 - OR);
    if (newWx === dg) adj += 12 * NE;
    else if (SHENG_P[dg] === newWx) adj += 8 * NE;
    else if (KE_P[dg] === newWx) adj -= 10 * NE;
    else if (SHENG_P[newWx] === dg) adj -= 7 * NE;
    else if (KE_P[newWx] === dg) adj -= 6 * NE;
  });
  return Math.round(adj * 100) / 100;
}
var SHENG_P = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
var KE_P   = {'木':'金','火':'水','土':'木','金':'火','水':'土'};

// ========== 五、已测 M-A（1g CSV，M_A 行）==========
var TESTED_MA = {};
fs.readFileSync(path.join(ROOT, '_p2_1g_tendency_models.csv'), 'utf-8').replace(/^﻿/, '').split('\n').slice(1).forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var c = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (c[0] !== 'M_A') return;
  TESTED_MA[c[1]] = { adj: parseFloat(c[8]), score: parseFloat(c[13]) };
});
var TESTED_KEYS = Object.keys(TESTED_MA);

// ========== 六、逐盘执行 ==========
var ROWS = {};
ALL_KEYS.forEach(function(key) {
  var item = CHART_MAP[key], gz = item.gz;
  ROWS[key] = {
    key: key, gz: gz, ids: item.ids.join('+'), src: item.src.join('+'),
    BASE: runChart(ENG.BASE, 'BASE', gz),
    FORMAL: runChart(ENG.FORMAL, 'FORMAL', gz),
    PREVIEW: runChart(ENG.PREVIEW, 'PREVIEW', gz)
  };
});

// ========== 七、硬断言 ==========
var fails = [];
function A(cond, msg) { if (!cond) fails.push(msg); }

// 7.1 BASE 引擎 = HEAD（P1 冻结）行为复核：18 盘 expAdj 硬期望
CHARTS18.forEach(function(c) {
  var r = ROWS[c.gz.join(' ')];
  if (r.BASE.adj !== c.expAdj) fails.push(c.id + ' BASE(HEAD) dayBranchAdj=' + r.BASE.adj + ' ≠ 1f 冻结期望 ' + c.expAdj + '（BASE 引擎不是 P1 冻结态？）');
});

// 7.2 formal === preview（46 盘，全字段）
ALL_KEYS.forEach(function(key) {
  var r = ROWS[key], F = r.FORMAL, P = r.PREVIEW;
  ['adj','score','level','yong','xi','ji','congSig','patSig'].forEach(function(f) {
    if (F[f] !== P[f]) fails.push(key + ' formal.' + f + '=' + F[f] + ' ≠ preview.' + f + '=' + P[f]);
  });
});

// 7.3 探针镜像 vs formal（18 盘：adj + 18/18 标签）
CHARTS18.forEach(function(c) {
  var key = c.gz.join(' ');
  var r = ROWS[key];
  var pr = probeRule(c.gz);
  var pa = probeAdjMA(c.gz);
  if (pr.cls !== GPT_LABELS[c.id]) fails.push(c.id + ' 探针规则=' + pr.cls + ' ≠ GPT 冻结标签=' + GPT_LABELS[c.id]);
  if (pa !== r.FORMAL.adj) fails.push(c.id + ' 探针M-A adj=' + pa + ' ≠ formal adj=' + r.FORMAL.adj);
  if (pa !== r.PREVIEW.adj) fails.push(c.id + ' 探针M-A adj=' + pa + ' ≠ preview adj=' + r.PREVIEW.adj);
});

// 7.4 锚点契约：5 个非 P15-15 锚点全字段 = BASE；P15-15 用神/喜/忌/旺衰保持、分数=27.75（手算预演值）
SIX.forEach(function(c) {
  var r = ROWS[c.gz.join(' ')];
  var B = r.BASE, F = r.FORMAL;
  if (c.id === 'P15-15') {
    if (F.yong !== B.yong) fails.push('P15-15 用神 ' + F.yong + ' ≠ 冻结 ' + B.yong);
    if (F.xi !== B.xi) fails.push('P15-15 喜神 ' + F.xi + ' ≠ 冻结 ' + B.xi);
    if (F.ji !== B.ji) fails.push('P15-15 忌神 ' + F.ji + ' ≠ 冻结 ' + B.ji);
    if (F.level !== '极弱') fails.push('P15-15 旺衰 ' + F.level + ' ≠ 极弱');
    if (F.score !== 27.75) fails.push('P15-15 终分 ' + F.score + ' ≠ 预演值 27.75');
  } else {
    ['adj','score','level','yong','xi','ji','congSig','patSig'].forEach(function(f) {
      if (F[f] !== B[f]) fails.push(c.id + ' 锚点漂移：' + f + ' ' + B[f] + '→' + F[f]);
    });
  }
});

// 7.5 28 盘（22 基线+6 锚点）影响集恰为 {A5, P15-15}（H01≡P15-15、H11≡A5 去重别名归一）
var CANON = { 'H01': 'P15-15', 'H11': 'A5' };
var CHANGED28 = [];
ALL_KEYS.forEach(function(key) {
  var item = CHART_MAP[key];
  if (item.src.indexOf('基线') < 0 && item.src.indexOf('锚点') < 0) return;
  var r = ROWS[key], B = r.BASE, F = r.FORMAL;
  var changed = F.score !== B.score || F.yong !== B.yong || F.xi !== B.xi || F.ji !== B.ji || F.congSig !== B.congSig || F.patSig !== B.patSig;
  if (changed) CHANGED28.push(CANON[item.ids[0]] || item.ids[0]);
});
CHANGED28.sort();
if (CHANGED28.join(',') !== 'A5,P15-15') fails.push('28 盘影响集 = {' + CHANGED28.join(',') + '} ≠ 期望 {A5,P15-15}');

// 7.6 46 盘用神零翻转
ALL_KEYS.forEach(function(key) {
  var r = ROWS[key];
  if (r.FORMAL.yong !== r.BASE.yong) fails.push(key + ' 用神翻转：' + r.BASE.yong + '→' + r.FORMAL.yong);
});

// 7.7 五档翻转集 = {H03, H06, H07, H09}
var FLIPS = [];
ALL_KEYS.forEach(function(key) {
  var r = ROWS[key];
  if (r.FORMAL.level !== r.BASE.level) FLIPS.push(r.ids);
});
FLIPS.sort();
if (FLIPS.join(',') !== 'H03,H06,H07,H09') fails.push('五档翻转集 = {' + FLIPS.join(',') + '} ≠ 期望 {H03,H06,H07,H09}');

// 7.8 formal vs 已测 M-A：adj 差异集 = 趋化 9 盘；分差异集 = 12 盘（+§⑧午未 3 盘）
var ADJ_DIFF = [], SCORE_DIFF = [];
TESTED_KEYS.forEach(function(id) {
  var c18 = CHARTS18.filter(function(x) { return x.id === id; })[0];
  if (!c18 && id !== 'A5' && id !== 'P15-15') return;
  var gz = c18 ? c18.gz : (id === 'A5' ? CHARTS18.filter(function(x){ return x.id==='H11'; })[0].gz : SIX[4].gz);
  var r = ROWS[gz.join(' ')];
  var t = TESTED_MA[id];
  if (r.FORMAL.adj !== t.adj) ADJ_DIFF.push(id);
  if (r.FORMAL.score !== t.score) SCORE_DIFF.push(id);
});
ADJ_DIFF.sort(); SCORE_DIFF.sort();
var EXP_ADJ = ['A5','H04','H05','H08','H09','H11','H12','H16','H17'];
var EXP_SCORE = ['A5','H01','H04','H05','H06','H08','H09','H11','H12','H16','H17','H18','P15-15'];
if (ADJ_DIFF.join(',') !== EXP_ADJ.join(',')) fails.push('adj 差异集 = {' + ADJ_DIFF.join(',') + '} ≠ 期望 {' + EXP_ADJ.join(',') + '}');
if (SCORE_DIFF.join(',') !== EXP_SCORE.join(',')) fails.push('分差异集 = {' + SCORE_DIFF.join(',') + '} ≠ 期望 {' + EXP_SCORE.join(',') + '}');

if (fails.length) {
  console.log('✗✗✗ 实装验证断言失败 ' + fails.length + ' 条（按裁决第8条：立即停止，不现场调参）✗✗✗');
  fails.forEach(function(f) { console.log('  ✗ ' + f); });
  process.exit(1);
}
console.log('✅ 全部硬断言通过：formal===preview（46盘）、探针镜像===formal（18盘 adj + 18/18 标签）、锚点契约、影响集{A5,P15-15}、用神零翻转、翻转集{H03,H06,H07,H09}、差异集符合预演\n');

// ========== 八、输出：before/after + 与已测 M-A 差异表 ==========
function rowOf(r) { return { adj: r.adj, score: r.score, level: r.level, yong: r.yong, xi: r.xi, ji: r.ji }; }
function fmtRow(r) { return r.score + '/' + r.level + ' 用' + (r.yong || '—') + ' 喜' + (r.xi || '—') + ' 忌' + (r.ji || '—') + ' adj=' + r.adj; }

console.log('========== before/after（formal vs BASE，仅列出有变化的盘）==========');
var changedRows = [];
ALL_KEYS.forEach(function(key) {
  var r = ROWS[key], B = r.BASE, F = r.FORMAL;
  if (F.score !== B.score || F.yong !== B.yong || F.xi !== B.xi || F.ji !== B.ji || F.level !== B.level || F.congSig !== B.congSig || F.patSig !== B.patSig) {
    changedRows.push(key);
    console.log('  ' + r.ids + '  [' + r.src + ']');
    console.log('    BASE   : ' + fmtRow(B));
    console.log('    FORMAL : ' + fmtRow(F) + '  (Δ分 ' + (F.score - B.score).toFixed(2) + ')');
    if (F.congSig !== B.congSig) console.log('    ⚠ 从格判定变化：' + B.congSig.slice(0, 80) + ' → ' + F.congSig.slice(0, 80));
    if (F.patSig !== B.patSig) console.log('    ⚠ 格局变化：' + B.patSig.slice(0, 80) + ' → ' + F.patSig.slice(0, 80));
  }
});
console.log('变化盘数：' + changedRows.length + ' / ' + ALL_KEYS.length);

console.log('\n========== formal vs 已测 M-A（1g 表格）差异分解 ==========');
console.log('（已测 M-A = 退还系数语义 + §⑧ 旧午未合火表；formal = residual 语义 + §⑧ 经典午未合土表）');
var diffTable = [];
TESTED_KEYS.forEach(function(id) {
  var c18 = CHARTS18.filter(function(x) { return x.id === id; })[0];
  if (!c18 && id !== 'A5' && id !== 'P15-15') return;
  var gz = c18 ? c18.gz : (id === 'A5' ? CHARTS18.filter(function(x){ return x.id==='H11'; })[0].gz : SIX[4].gz);
  var r = ROWS[gz.join(' ')];
  var t = TESTED_MA[id];
  var src = '';
  if (r.FORMAL.adj !== t.adj) src += '趋化语义';
  if (r.FORMAL.adj === t.adj && r.FORMAL.score !== t.score) src += '§⑧午未表';
  if (!src) src = '无';
  diffTable.push({ id: id, tAdj: t.adj, fAdj: r.FORMAL.adj, tScore: t.score, fScore: r.FORMAL.score, src: src });
  if (src !== '无') {
    console.log('  ' + id + ': 已测 adj=' + t.adj + ' 分=' + t.score + ' → formal adj=' + r.FORMAL.adj + ' 分=' + r.FORMAL.score + '  [' + src + ']');
  }
});
var identical = diffTable.filter(function(d) { return d.src === '无'; }).map(function(d) { return d.id; });
console.log('与已测 M-A 完全一致：' + identical.join(' '));

// ========== 九、冻结测试 + 全量测试（不写 CSV 不覆盖产物）==========
console.log('\n========== 冻结测试 + 全量测试 ==========');
[
  ['_freeze_p15_6.js', '六盘冻结'],
  ['_freeze_22.js', '22 盘冻结'],
  ['--test tests/bazi-professional-core.test.js', '专业核心测试套件']
].forEach(function(pair) {
  var cmd = 'node ' + pair[0];
  try {
    var out = cp.execSync(cmd, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    console.log('▶ ' + pair[1] + '：' + out.trim().split('\n')[0] + ' …');
    var tail = out.trim().split('\n');
    console.log('  ' + tail[tail.length - 1].slice(0, 160));
  } catch (e) {
    var all = ((e.stdout || '') + (e.stderr || '')).trim().split('\n');
    console.log('▶ ' + pair[1] + '：exit=' + e.status);
    console.log('  ' + all.slice(0, 2).join('\n  ').slice(0, 300));
    console.log('  …' + all[all.length - 1].slice(0, 160));
  }
});

// ========== 十、CSV ==========
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
var header = ['编号','四柱','来源','BASE分','BASE旺衰','BASE用神','BASE喜','BASE忌','BASEadj','FORMAL分','FORMAL旺衰','FORMAL用神','FORMAL喜','FORMAL忌','FORMALadj','PREVIEW一致','与已测MA分差','与已测MAadj差','差异来源'];
var csv = [header.join(',')];
ALL_KEYS.forEach(function(key) {
  var item = CHART_MAP[key], r = ROWS[key];
  var B = r.BASE, F = r.FORMAL;
  var testedId = null;
  TESTED_KEYS.forEach(function(id) { if (TESTED_MA[id] && item.ids.indexOf(id) >= 0) testedId = id; });
  if (!testedId && item.ids.indexOf('H01') >= 0) testedId = 'P15-15';
  if (!testedId && item.ids.indexOf('H11') >= 0) testedId = 'A5';
  var sDiff = '', aDiff = '', srcD = '';
  if (testedId) {
    var t = TESTED_MA[testedId];
    if (F.score !== t.score) sDiff = F.score - t.score;
    if (F.adj !== t.adj) aDiff = F.adj - t.adj;
    if (F.adj !== t.adj) srcD = '趋化语义';
    else if (sDiff !== '' && sDiff !== 0) srcD = '§⑧午未表';
  }
  var pe = ['adj','score','level','yong','xi','ji','congSig','patSig'].every(function(f) { return F[f] === r.PREVIEW[f]; });
  csv.push([item.ids, key, item.src, B.score, B.level, B.yong, B.xi, B.ji, B.adj,
    F.score, F.level, F.yong, F.xi, F.ji, F.adj,
    pe ? '一致' : '不一致', sDiff, aDiff, srcD].map(csvQ).join(','));
});
fs.writeFileSync(path.join(ROOT, '_p2_1i_implementation_verify.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n已写入 _p2_1i_implementation_verify.csv（' + ALL_KEYS.length + ' 盘）');
console.log('✅ P2.1 实装验证完成：formal 引擎与内存正式预览完全一致，且与已测 M-A 的差异全部落入预演的两类来源');
