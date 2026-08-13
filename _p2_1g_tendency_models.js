// P2.1 第四轮·完整模型对比实验 M-A / M-B / M-C（2026-08-13，GPT 第四轮裁决第4节）
// qualification v1 已冻结（_p2_1f 18/18 通过）；口径统一经典午未合土；分层烈度：
//   真化 O=0.5/N=0.75（三模型相同）；趋化 A:O=.75/N=.50  B:O=.75/N=.375  C:O=.875/N=.50；不化 O=1/N=0（不变换）
// 每个完整模型回归：18盘专项集 / 22盘基线 / 六盘冻结锚点 / 旺衰五档翻转 / P1用神喜忌翻转 / 正负向对称 / 30/40/60/70阈值附近变化
// 特别单列：P15-15、H03、H07、午未 H06/H18
// 纪律：引擎 js/bazi.js 零改动、不 push；全部为内存补丁 + CF 标记断言；不做跨线优化。
// 用法: node _p2_1g_tendency_models.js
// 产物: _p2_1g_tendency_models.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

// —— 完整模型补丁：整体替换「日支被合化」块（引擎口径午未合火 → 补丁口径经典午未合土 + qualification v1 + 分层系数）——
var BLOCK_RE = /  \/\/ 日支被合化 → 得地根基重构（如辰酉合金→辰土变金印）\r?\n[\s\S]*?  score \+= dayBranchAdj;\r?\n/;

function makeModelPatch(key, tO, tN) {
  return function(src) {
    var hit = false;
    var out = src.replace(BLOCK_RE, function() {
      hit = true;
      var L = [];
      L.push('  // 日支被合化 → 得地根基重构（如辰酉合金→辰土变金印）');
      L.push('  // CF-P2.1G-' + key + '：完整模型探针（qualification v1 冻结 + 经典午未合土口径 + 真化O=0.5/N=0.75 + 趋化O=' + tO + '/N=' + tN + ' + 不化O=1/N=0）');
      L.push('  var dayBranchAdj = 0;');
      L.push('  (function() {');
      L.push("    var _HE6 = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];");
      L.push('    var _heMap = {}; _HE6.forEach(function(t){ _heMap[t[0]+t[1]]=t[2]; _heMap[t[1]+t[0]]=t[2]; });');
      L.push("    var _gw = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};");
      L.push('    var _wxs = {');
      L.push("      '木':{'木':'旺','火':'相','水':'休','金':'囚','土':'死'},");
      L.push("      '火':{'火':'旺','土':'相','木':'休','水':'囚','金':'死'},");
      L.push("      '金':{'金':'旺','水':'相','土':'休','火':'囚','木':'死'},");
      L.push("      '水':{'水':'旺','木':'相','金':'休','土':'囚','火':'死'},");
      L.push("      '土':{'土':'旺','金':'相','火':'休','木':'囚','水':'死'}");
      L.push('    };');
      L.push("    var _CHONG = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];");
      L.push('    var _chong = {}; _CHONG.forEach(function(p){ _chong[p[0]]=p[1]; _chong[p[1]]=p[0]; });');
      L.push('    var _mwx = DI_ZHI_WU_XING[bazi.month.zhi];');
      L.push('    var _pairs = [];');
      L.push("    [['year','month'],['month','day'],['day','hour']].forEach(function(pair) {");
      L.push('      var z1 = bazi[pair[0]].zhi, z2 = bazi[pair[1]].zhi;');
      L.push('      if (_heMap[z1+z2]) _pairs.push({z1:z1, z2:z2, wx:_heMap[z1+z2], p1:pair[0], p2:pair[1]});');
      L.push('    });');
      L.push('    for (var _xa=0; _xa<allPositions.length; _xa++) {');
      L.push('      for (var _xb=_xa+1; _xb<allPositions.length; _xb++) {');
      L.push('        if (Math.abs(_xa-_xb)===1) continue;');
      L.push('        var _zx1=bazi[allPositions[_xa]].zhi, _zx2=bazi[allPositions[_xb]].zhi;');
      L.push('        if (_heMap[_zx1+_zx2]) _pairs.push({z1:_zx1, z2:_zx2, wx:_heMap[_zx1+_zx2], p1:allPositions[_xa], p2:allPositions[_xb]});');
      L.push('      }');
      L.push('    }');
      L.push('    var _dayPairs = _pairs.filter(function(h){ return h.p1==="day"||h.p2==="day"; });');
      L.push('    if (!_dayPairs.length) return;');
      L.push('    var _hua = _dayPairs[0].wx;');
      L.push('    var _tou = [];');
      L.push("    ['year','month','hour'].forEach(function(p){ if (_gw[bazi[p].gan]===_hua) _tou.push(p); });");
      L.push('    var T = (_tou.indexOf("month")>=0 || _tou.indexOf("hour")>=0) ? 2 : (_tou.indexOf("year")>=0 ? 1 : 0);');
      L.push('    var R1 = false, R2 = false;');
      L.push('    var _zhis = allPositions.map(function(p){ return bazi[p].zhi; });');
      L.push('    _dayPairs.forEach(function(h) {');
      L.push('      _zhis.forEach(function(z) {');
      L.push('        if (_chong[z]===h.z1 || _chong[z]===h.z2) R1 = true;');
      L.push('        if (_chong[z]===bazi.month.zhi) R2 = true;');
      L.push('      });');
      L.push('    });');
      L.push('    var _st = _wxs[_mwx][_hua];');
      L.push('    var S = (_mwx===_hua) ? 1 : ((_st==="旺"||_st==="相") ? 2 : 0);');
      L.push('    var _cls = (S===1 && T===2 && !R1 && !R2) ? "真化" : ((S===1||S===2) ? "趋化" : "合而不化");');
      L.push('    var _co = (_cls==="真化") ? [0.5,0.75] : (_cls==="趋化" ? [' + tO + ',' + tN + '] : [1,0]);');
      L.push('    var _rO = _co[0], _rN = _co[1];');
      L.push('    var _Dstr = (R1?"R1":"") + (R2?"R2":"");');
      L.push('    if (_cls==="合而不化") { global.__p2_1g = {cls:_cls, S:S, T:T, D:_Dstr, rO:_rO, rN:_rN, adj:0, hua:_hua, oldWx:DI_ZHI_WU_XING[bazi.day.zhi], pairs:_dayPairs.length}; return; }');
      L.push('    var _applied = {};');
      L.push('    var _adj = 0;');
      L.push('    _dayPairs.forEach(function(he) {');
      L.push('      var oldWx = DI_ZHI_WU_XING[bazi.day.zhi], newWx = he.wx;');
      L.push('      var heKey = oldWx + "→" + newWx;');
      L.push('      if (_applied[heKey]) return; _applied[heKey] = true;');
      L.push('      if (oldWx === newWx) return;');
      L.push('      if (oldWx===dgWx) _adj -= 12*_rO;');
      L.push('      else if (SHENGWO[dgWx]===oldWx) _adj -= 8*_rO;');
      L.push('      else if (KEWO[dgWx]===oldWx) _adj += 10*_rO;');
      L.push('      else if (WOSHENG[dgWx]===oldWx) _adj += 7*_rO;');
      L.push('      else if (WOKE[dgWx]===oldWx) _adj += 6*_rO;');
      L.push('      if (newWx===dgWx) _adj += 12*_rN;');
      L.push('      else if (SHENGWO[dgWx]===newWx) _adj += 8*_rN;');
      L.push('      else if (KEWO[dgWx]===newWx) _adj -= 10*_rN;');
      L.push('      else if (WOSHENG[dgWx]===newWx) _adj -= 7*_rN;');
      L.push('      else if (WOKE[dgWx]===newWx) _adj -= 6*_rN;');
      L.push('    });');
      L.push('    dayBranchAdj = _adj;');
      L.push('    global.__p2_1g = {cls:_cls, S:S, T:T, D:_Dstr, rO:_rO, rN:_rN, adj:Math.round(_adj*100)/100, hua:_hua, oldWx:DI_ZHI_WU_XING[bazi.day.zhi], pairs:_dayPairs.length};');
      L.push('  })();');
      L.push('  score += dayBranchAdj;');
      return L.join('\n') + '\n';
    });
    if (!hit) throw new Error('模型补丁 ' + key + ' 未匹配到「日支被合化」块（BLOCK_RE 失效）');
    return out;
  };
}

var MODELS = {
  'M_A': { tO: 0.75, tN: 0.5, desc: '趋化 O=0.75 / N=0.50' },
  'M_B': { tO: 0.75, tN: 0.375, desc: '趋化 O=0.75 / N=0.375' },
  'M_C': { tO: 0.875, tN: 0.5, desc: '趋化 O=0.875 / N=0.50' }
};
var PATCHES = {};
Object.keys(MODELS).forEach(function(k) {
  PATCHES[k] = makeModelPatch(k, MODELS[k].tO, MODELS[k].tN);
});

function loadEngine(key) {
  var src = key ? PATCHES[key](baseCode) : baseCode;
  var stitched = '';
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  return { dm: global.calcDayMasterStrength, yj: global.getYongJi };
}

// —— 18 盘专项集（GPT 第四轮修正后标签，与 _p2_1f 一致）——
var CHARTS = [
  { id:'H01', gz:['癸未','戊午','乙卯','丙戌'], label:'真化' },
  { id:'H02', gz:['戊辰','甲寅','丁亥','庚子'], label:'真化' },
  { id:'H03', gz:['甲寅','戊辰','壬子','辛丑'], label:'真化' },
  { id:'H04', gz:['甲申','庚午','辛卯','戊戌'], label:'趋化' },
  { id:'H05', gz:['庚子','乙酉','甲辰','甲子'], label:'趋化' },
  { id:'H06', gz:['乙巳','壬午','丁未','戊申'], label:'趋化' },
  { id:'H07', gz:['己丑','丙寅','丁亥','甲辰'], label:'真化' },
  { id:'H08', gz:['丁酉','丙午','丁卯','庚戌'], label:'趋化' },
  { id:'H09', gz:['甲寅','壬申','壬辰','己酉'], label:'趋化' },
  { id:'H10', gz:['癸未','丁巳','丙戌','辛卯'], label:'真化' },
  { id:'H11', gz:['壬辰','癸卯','戊戌','丁巳'], label:'趋化' },
  { id:'H12', gz:['甲申','丁丑','壬辰','己酉'], label:'趋化' },
  { id:'H13', gz:['壬寅','丙午','丙戌','辛卯'], label:'真化' },
  { id:'H14', gz:['乙丑','己丑','壬子','辛丑'], label:'真化' },
  { id:'H15', gz:['甲寅','庚午','庚辰','乙酉'], label:'合而不化' },
  { id:'H16', gz:['丙辰','庚子','癸巳','庚申'], label:'趋化' },
  { id:'H17', gz:['甲子','丙子','癸亥','甲寅'], label:'趋化' },
  { id:'H18', gz:['癸卯','己未','甲午','壬申'], label:'真化' }
];

// —— 28 盘（22基线 + 六盘冻结锚点），同 1b/1e 装载 ——
var charts28 = [];
fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').split('\n').slice(1).forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var cells = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (cells.length < 2 || !cells[1]) return;
  var gz = cells[1].split(/\s+/);
  if (gz.length === 4) charts28.push({ id: cells[0], gz: gz });
});
var SIX_IDS = ['P15-03','P15-09','P15-12','P15-14','P15-15','P15-16'];
fs.readFileSync(path.join(ROOT, '_p15_charts.txt'), 'utf-8').split('\n').forEach(function(line) {
  line = line.trim();
  if (!line || line[0] === '#') return;
  var parts = line.split(/\s+/);
  if (parts.length === 5 && SIX_IDS.indexOf(parts[0]) >= 0) charts28.push({ id: parts[0], gz: parts.slice(1) });
});
if (charts28.length !== 28) throw new Error('样本数异常：' + charts28.length + '≠28');

var SIX = {
  'P15-03': { yong: '火', xi: '火、水', ji: '' },
  'P15-09': { yong: '土', xi: '土', ji: '' },
  'P15-12': { yong: '土', xi: '土、金', ji: '木、火、水' },
  'P15-14': { yong: '土', xi: '土、火', ji: '木、水、金' },
  'P15-15': { yong: '木', xi: '木、水', ji: '金、火、土' },
  'P15-16': { yong: '水', xi: '水、金', ji: '木、土、火' }
};

// —— 探针侧独立分类镜像（qualification v1，经典午未合土；与引擎暴露值对账）——
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var HE6 = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
var heProbe = {}; HE6.forEach(function(t){ heProbe[t[0]+t[1]]=t[2]; heProbe[t[1]+t[0]]=t[2]; });
var chongProbe = {}; [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']].forEach(function(p){ chongProbe[p[0]]=p[1]; chongProbe[p[1]]=p[0]; });
var WXS = {
  '木': {'木':'旺','火':'相','水':'休','金':'囚','土':'死'},
  '火': {'火':'旺','土':'相','木':'休','水':'囚','金':'死'},
  '金': {'金':'旺','水':'相','土':'休','火':'囚','木':'死'},
  '水': {'水':'旺','木':'相','金':'休','土':'囚','火':'死'},
  '土': {'土':'旺','金':'相','火':'休','木':'囚','水':'死'}
};
var POS = ['year','month','day','hour'];
var ALL_PAIRS = [['year','month'],['month','day'],['day','hour'],['year','day'],['year','hour'],['month','hour']];
var SHENG = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
var KE   = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
function probeClassify(gz) {
  var dayPairs = [];
  ALL_PAIRS.forEach(function(pair) {
    var z1 = gz[POS.indexOf(pair[0])][1], z2 = gz[POS.indexOf(pair[1])][1];
    var hua = heProbe[z1+z2];
    if (!hua) return;
    if (pair[0] === 'day' || pair[1] === 'day') dayPairs.push({ z1:z1, z2:z2, hua:hua });
  });
  if (!dayPairs.length) return { cls: '无合', hua: null };
  var mwx = ZHI_WX[gz[1][1]], hua = dayPairs[0].hua;
  var st = WXS[mwx][hua];
  var S = (mwx === hua) ? 1 : ((st === '旺' || st === '相') ? 2 : 0);
  var tou = POS.filter(function(p) { return p !== 'day' && GAN_WX[gz[POS.indexOf(p)][0]] === hua; });
  var T = (tou.indexOf('month') >= 0 || tou.indexOf('hour') >= 0) ? 2 : (tou.indexOf('year') >= 0 ? 1 : 0);
  var R1 = false, R2 = false;
  var zhis = gz.map(function(p) { return p[1]; });
  dayPairs.forEach(function(h) {
    zhis.forEach(function(z) {
      if (chongProbe[z] === h.z1 || chongProbe[z] === h.z2) R1 = true;
      if (chongProbe[z] === gz[1][1]) R2 = true;
    });
  });
  var cls = (S === 1 && T === 2 && !R1 && !R2) ? '真化' : ((S === 1 || S === 2) ? '趋化' : '合而不化');
  return { cls: cls, hua: hua, S: S, T: T, D: (R1 ? 'R1' : '') + (R2 ? 'R2' : '') };
}
// 全口径（rO=1,rN=1）反事实 adj，用于方向对称性
function fullAdj(gz) {
  var applied = {}, adj = 0;
  var dg = GAN_WX[gz[2][0]], oldWx = ZHI_WX[gz[2][1]];
  ALL_PAIRS.forEach(function(pair) {
    if (pair[0] !== 'day' && pair[1] !== 'day') return;
    var z1 = gz[POS.indexOf(pair[0])][1], z2 = gz[POS.indexOf(pair[1])][1];
    var hua = heProbe[z1+z2];
    if (!hua) return;
    var key = oldWx + '→' + hua;
    if (applied[key]) return; applied[key] = true;
    if (oldWx === hua) return;
    if (oldWx === dg) adj -= 12;
    else if (SHENG[dg] === oldWx) adj -= 8;
    else if (KE[dg] === oldWx) adj += 10;
    else if (SHENG[oldWx] === dg) adj += 7;
    else if (KE[oldWx] === dg) adj += 6;
    if (hua === dg) adj += 12;
    else if (SHENG[dg] === hua) adj += 8;
    else if (KE[dg] === hua) adj -= 10;
    else if (SHENG[hua] === dg) adj -= 7;
    else if (KE[hua] === dg) adj -= 6;
  });
  return adj;
}

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}
function runChart(eng, c) {
  var b = toBazi(c.gz);
  global.__p2_1g = null;
  var dm = eng.dm(b);
  var exposed = global.__p2_1g;
  var yj = eng.yj(b);
  return {
    id: c.id, gz: c.gz.join(' '),
    score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    exposed: exposed
  };
}
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

var ALL = CHARTS.concat(charts28); // 46 盘
var baseEng = loadEngine(null);
var baseRes = {};
ALL.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });

console.log('========== 完整模型实验 M-A / M-B / M-C（qualification v1 已冻结，18/18） ==========');
console.log('真化 O=0.5/N=0.75（三模型相同）；不化 O=1/N=0（不变换）');
Object.keys(MODELS).forEach(function(k) { console.log('  ' + k + '：' + MODELS[k].desc); });
console.log('');

var csv = ['模型,盘,类别,四柱,模型资格,S,T,D,模型adj,全口径adj,方向一致,BASE分,BASE旺衰,模型分,模型旺衰,Δ分,五档翻转,用神翻转,BASE用神,模型用神,BASE喜,模型喜,BASE忌,模型忌'];
var SUMMARY = {};
var THRESH = [30, 40, 60, 70];

Object.keys(MODELS).forEach(function(k) {
  var eng = loadEngine(k);
  var res = {};
  ALL.forEach(function(c) { res[c.id] = runChart(eng, c); });

  // —— 资格对账：引擎暴露 vs 探针镜像（18盘）——
  CHARTS.forEach(function(c) {
    var pc = probeClassify(c.gz);
    var ex = res[c.id].exposed;
    if (!ex) throw new Error(k + ' ' + c.id + ' 引擎未暴露 __p2_1g（预期日支有合）');
    if (ex.cls !== pc.cls) throw new Error(k + ' ' + c.id + ' 引擎资格 ' + ex.cls + ' ≠ 探针镜像 ' + pc.cls);
    if (ex.cls !== c.label) throw new Error(k + ' ' + c.id + ' 资格 ' + ex.cls + ' ≠ GPT冻结标签 ' + c.label);
    if (ex.hua !== pc.hua) throw new Error(k + ' ' + c.id + ' 化神 ' + ex.hua + ' ≠ 探针 ' + pc.hua);
  });
  console.log('✅ ' + k + '：18盘资格与 GPT 冻结标签 + 探针镜像三方一致（S/T/D/cls/hua）\n');

  // —— 28盘基线隔离 + 六盘冻结锚点 ——
  var affected = [], anchorBreaks = [];
  charts28.forEach(function(c) {
    var b = baseRes[c.id], r = res[c.id];
    var d = Math.round((r.score - b.score) * 100) / 100;
    var chg = Math.abs(d) >= 0.5 || r.level !== b.level || r.yong !== b.yong || r.xi !== b.xi || r.ji !== b.ji;
    if (chg) affected.push({ id: c.id, d: d, b: b, r: r });
    if (SIX[c.id]) {
      var breaks = [];
      if (r.yong !== SIX[c.id].yong) breaks.push('用神' + r.yong + '≠' + SIX[c.id].yong);
      if (r.xi !== SIX[c.id].xi) breaks.push('喜神' + r.xi + '≠' + SIX[c.id].xi);
      if (r.ji !== SIX[c.id].ji) breaks.push('忌神' + r.ji + '≠' + SIX[c.id].ji);
      if (breaks.length) anchorBreaks.push(c.id + ' ' + breaks.join('；'));
    }
  });
  var affIds = affected.map(function(a){ return a.id; }).sort();
  if (affIds.join(',') !== 'A5,P15-15') {
    throw new Error(k + ' 28盘受影响集合 = {' + affIds.join(',') + '} ≠ 预期 {A5,P15-15}');
  }
  if (anchorBreaks.length) throw new Error(k + ' 六盘冻结锚点破坏：' + anchorBreaks.join('；'));
  console.log('✅ ' + k + '：28盘受影响集合恰为 {A5, P15-15}；5个非P15-15锚点零变化；P15-15 用神/喜/忌与冻结表一致\n');

  // —— 五档翻转 / 用神翻转 ——
  var levelFlips = [], yxjFlips = [], signFlips = [], nearThresh = [];
  CHARTS.forEach(function(c) {
    var b = baseRes[c.id], r = res[c.id];
    var d = Math.round((r.score - b.score) * 100) / 100;
    if (r.level !== b.level) levelFlips.push(c.id + ' ' + b.level + '→' + r.level + '（' + b.score + '→' + r.score + '）');
    var yx = [];
    if (r.yong !== b.yong) yx.push('用神' + b.yong + '→' + r.yong);
    if (r.xi !== b.xi) yx.push('喜' + b.xi + '→' + r.xi);
    if (r.ji !== b.ji) yx.push('忌' + b.ji + '→' + r.ji);
    if (yx.length) yxjFlips.push(c.id + ' ' + yx.join('，'));
  });
  charts28.forEach(function(c) {
    var b = baseRes[c.id], r = res[c.id];
    var d = Math.round((r.score - b.score) * 100) / 100;
    if (Math.abs(d) < 0.5 && r.level === b.level) return;
    if (r.level !== b.level) levelFlips.push(c.id + ' ' + b.level + '→' + r.level + '（' + b.score + '→' + r.score + '）');
    var yx = [];
    if (r.yong !== b.yong) yx.push('用神' + b.yong + '→' + r.yong);
    if (r.xi !== b.xi) yx.push('喜' + b.xi + '→' + r.xi);
    if (r.ji !== b.ji) yx.push('忌' + b.ji + '→' + r.ji);
    if (yx.length) yxjFlips.push(c.id + ' ' + yx.join('，'));
  });
  // 正负向对称（18盘发生变换者：模型 adj 方向 === 全口径 adj 方向；全口径=0 时模型亦须=0）
  CHARTS.forEach(function(c) {
    var ex = res[c.id].exposed;
    if (ex.cls === '合而不化' || ex.cls === '无合') return;
    var fa = fullAdj(c.gz);
    var ma = ex.adj;
    if (fa > 0 && ma <= 0) signFlips.push(c.id + ' 全口径+' + fa + ' → 模型' + ma);
    else if (fa < 0 && ma >= 0) signFlips.push(c.id + ' 全口径' + fa + ' → 模型' + ma);
    else if (fa === 0 && ma !== 0) signFlips.push(c.id + ' 全口径0 → 模型' + ma);
  });
  // 30/40/60/70 阈值附近盘
  ALL.forEach(function(c) {
    var b = baseRes[c.id], r = res[c.id];
    var d = Math.round((r.score - b.score) * 100) / 100;
    var near = THRESH.some(function(t) { return Math.abs(b.score - t) <= 5 || Math.abs(r.score - t) <= 5; });
    var crossed = THRESH.some(function(t) { return (b.score - t) * (r.score - t) < 0; });
    if (near && (Math.abs(d) >= 0.5 || crossed)) {
      nearThresh.push(c.id + ' ' + b.score + '→' + r.score + '（Δ' + (d > 0 ? '+' : '') + d + (crossed ? '，跨线' : '，贴线') + '）');
    }
  });

  SUMMARY[k] = { levelFlips: levelFlips, yxjFlips: yxjFlips, signFlips: signFlips, nearThresh: nearThresh, affected: affected };

  console.log('===== ' + k + ' 指标 =====');
  console.log('  五档翻转（' + levelFlips.length + '）：' + (levelFlips.length ? levelFlips.join('；') : '无'));
  console.log('  P1用神/喜/忌翻转（' + yxjFlips.length + '）：' + (yxjFlips.length ? yxjFlips.join('；') : '无'));
  console.log('  正负向方向对称（异常 ' + signFlips.length + '）：' + (signFlips.length ? signFlips.join('；') : '全部一致 ✓'));
  console.log('  30/40/60/70 阈值附近（' + nearThresh.length + '）：' + (nearThresh.length ? nearThresh.join('；') : '无'));
  console.log('');

  // —— CSV 行：18盘全量 + 28盘受影响 ——
  CHARTS.forEach(function(c) {
    var b = baseRes[c.id], r = res[c.id], ex = r.exposed;
    var d = Math.round((r.score - b.score) * 100) / 100;
    var fa = (ex.cls === '合而不化' || ex.cls === '无合') ? 0 : fullAdj(c.gz);
    var dir = '—';
    if (ex.cls === '真化' || ex.cls === '趋化') dir = (fa > 0 && ex.adj > 0) || (fa < 0 && ex.adj < 0) || (fa === 0 && ex.adj === 0) ? '一致' : '翻转';
    csv.push([k, c.id, '专项', c.gz.join(' '), ex.cls, 'S' + ex.S, 'T' + ex.T, ex.D || '无',
      ex.adj, fa, dir, b.score, b.level, r.score, r.level, d,
      r.level !== b.level ? '翻转' : '无', (r.yong !== b.yong || r.xi !== b.xi || r.ji !== b.ji) ? '翻转' : '无',
      b.yong, r.yong, b.xi, r.xi, b.ji, r.ji].map(csvQ).join(','));
  });
  affected.forEach(function(a) {
    var b = a.b, r = a.r, ex = r.exposed;
    var fa = (ex.cls === '合而不化' || ex.cls === '无合') ? 0 : fullAdj(charts28.filter(function(x){ return x.id === a.id; })[0].gz);
    var dir = '—';
    if (ex.cls === '真化' || ex.cls === '趋化') dir = (fa > 0 && ex.adj > 0) || (fa < 0 && ex.adj < 0) || (fa === 0 && ex.adj === 0) ? '一致' : '翻转';
    csv.push([k, a.id, SIX[a.id] ? '锚点' : '基线', a.r.gz, ex.cls, 'S' + ex.S, 'T' + ex.T, ex.D || '无',
      ex.adj, fa, dir, b.score, b.level, a.r.score, a.r.level, a.d,
      a.r.level !== b.level ? '翻转' : '无', (a.r.yong !== b.yong || a.r.xi !== b.xi || a.r.ji !== b.ji) ? '翻转' : '无',
      b.yong, a.r.yong, b.xi, a.r.xi, b.ji, a.r.ji].map(csvQ).join(','));
  });
});

// —— 特别单列：P15-15、H03、H07、午未 H06/H18 ——
console.log('========== 特别单列（P15-15 / H03 / H07 / H06 / H18） ==========');
['P15-15','H03','H07','H06','H18'].forEach(function(id) {
  var c = ALL.filter(function(x){ return x.id === id; })[0];
  var b = baseRes[id];
  console.log('\n【' + id + '】' + c.gz.join(' ') + '  BASE=' + b.score + '/' + b.level + ' 用神=' + b.yong + ' 喜=' + b.xi + ' 忌=' + b.ji);
  Object.keys(MODELS).forEach(function(k) {
    var eng = loadEngine(k);
    var r = runChart(eng, c);
    var d = Math.round((r.score - b.score) * 100) / 100;
    var fa = (r.exposed.cls === '合而不化' || r.exposed.cls === '无合') ? 0 : fullAdj(c.gz);
    console.log('  ' + k + '（趋化' + MODELS[k].desc.split('趋化 ')[1] + '）：资格=' + r.exposed.cls +
      '  adj=' + r.exposed.adj + '（全口径=' + fa + '）  ' + b.score + '→' + r.score + '/' + r.level +
      '（Δ' + (d > 0 ? '+' : '') + d + '） 用神=' + r.yong + ' 喜=' + r.xi + ' 忌=' + r.ji);
  });
});

// —— 模型间差异小结 ——
console.log('\n========== 三模型差异小结 ==========');
['levelFlips','yxjFlips','signFlips'].forEach(function(m) {
  Object.keys(MODELS).forEach(function(k) {
    console.log('  ' + k + ' ' + m + '：' + (SUMMARY[k][m].length ? SUMMARY[k][m].join('；') : '无'));
  });
});
console.log('  系数简洁性：M-A（.75/.5，公分母 2）< M-C（.875/.5）≈ M-B（.75/.375）');

fs.writeFileSync(path.join(ROOT, '_p2_1g_tendency_models.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n已写入 _p2_1g_tendency_models.csv（' + (csv.length - 1) + ' 行）');
console.log('引擎 js/bazi.js 零改动、未 push、未提交。');
