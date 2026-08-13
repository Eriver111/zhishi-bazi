// P2.1 专项合化测试集（2026-08-13 GPT P2.1 第二轮裁决第5点：建立12–20盘专项样本，覆盖判定边界）
// 目的：不是找能证明现规则正确的盘，而是覆盖「真化资格」的判定边界，且必须含正反方向。
// 输出仅客观信息（四柱/日主/六合对/原支关系/化神/月令支持状态/透干位置/冲/刑/害/BASE是否重构/BASE dayBranchAdj）。
// 按 GPT 要求：不贴「应该真化/应该不化」资格标签。
// 合法性：程序断言 60甲子 阴阳奇偶 + 五虎遁（月干从年干）+ 五鼠遁（时干从日干）。
// 引擎零改动：仅用观测补丁把 dayBranchAdj 暴露到 global，并与未打补丁引擎 17/17 逐盘对账。
// 用法: node _p2_1c_chart_set.js
// 产物: _p2_1c_chart_set.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

// —— 探针侧地图（与 _p2_1a 同口径，独立于引擎）——
var GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var ZHIS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
// 六合双口径表：HE6=经典(午未合土)；HE_ENGINE=引擎实际(午未合火，见 bazi.js:2416 ZHI_HE)
// 探针主用引擎口径（镜像引擎行为）；经典口径仅用于 H06/H18 对照注释与钉死断言。
var HE6 = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
var HE_ENGINE = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','火']];
function buildHe(table) { var m = {}; table.forEach(function(t){ m[t[0]+t[1]]=t[2]; m[t[1]+t[0]]=t[2]; }); return m; }
var heProbe = buildHe(HE_ENGINE);
var heProbeClassical = buildHe(HE6);
var chongProbe = {}; [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']].forEach(function(p){ chongProbe[p[0]]=p[1]; chongProbe[p[1]]=p[0]; });
var haiProbe = {}; [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']].forEach(function(p){ haiProbe[p[0]]=p[1]; haiProbe[p[1]]=p[0]; });
var xing2Probe = {};
[['子','卯'],['寅','巳'],['寅','申'],['巳','申'],['丑','戌'],['丑','未'],['戌','未']].forEach(function(p){ xing2Probe[p[0]+p[1]]=1; xing2Probe[p[1]+p[0]]=1; });
var XING3_GROUPS = [['寅','巳','申'],['丑','戌','未'],['子','卯']];
var SELF_XING = ['辰','午','酉','亥'];

// 五行关系（与引擎 SHENGWO/KEWO/WOSHENG/WOKE 一致）
var SHENG = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
var KE   = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
function relTo(e, dg) {
  if (e === dg) return '比劫';
  if (SHENG[dg] === e) return '印';
  if (KE[dg] === e) return '官杀';
  if (SHENG[e] === dg) return '食伤';
  if (KE[e] === dg) return '财';
  return '?';
}
// 旺相休囚死（按月支五行）
var WXS = {
  '木': {'木':'旺','火':'相','水':'休','金':'囚','土':'死'},
  '火': {'火':'旺','土':'相','木':'休','水':'囚','金':'死'},
  '金': {'金':'旺','水':'相','土':'休','火':'囚','木':'死'},
  '水': {'水':'旺','木':'相','金':'休','土':'囚','火':'死'},
  '土': {'土':'旺','金':'相','火':'休','木':'囚','水':'死'}
};

// —— 17 盘样本（编号/四柱/设计类别——类别是结构性描述，非资格标签）——
var CHARTS = [
  { id:'H01', gz:['癸未','戊午','乙卯','丙戌'], expAdj:-19, tag:'锚点(28盘P15-15)·真化候选·仅时干透·未戌刑(两字)' },
  { id:'H02', gz:['戊辰','甲寅','丁亥','庚子'], expAdj:18, tag:'真化候选·仅月干透·无冲刑害' },
  { id:'H03', gz:['甲寅','戊辰','壬子','辛丑'], expAdj:-22, tag:'真化候选·仅月干透·无冲刑害' },
  { id:'H04', gz:['甲申','庚午','辛卯','戊戌'], expAdj:-4, tag:'真化候选·化神完全不透·无冲刑害' },
  { id:'H05', gz:['庚子','乙酉','甲辰','甲子'], expAdj:-4, tag:'仅年干透化神·无冲刑害' },
  { id:'H06', gz:['乙巳','壬午','丁未','戊申'], expAdj:19, tag:'真化候选(引擎口径午未合火)·化神完全不透·无冲刑害' },
  { id:'H07', gz:['己丑','丙寅','丁亥','甲辰'], expAdj:18, tag:'仅时干透化神·无冲刑害' },
  { id:'H08', gz:['丁酉','丙午','丁卯','庚戌'], expAdj:4, tag:'合局成员受直接六冲(酉冲卯)·同柱酉亦害戌(冲害联动)' },
  { id:'H09', gz:['甲寅','壬申','壬辰','己酉'], expAdj:18, tag:'月令自身受冲(寅冲申月)·化神完全不透' },
  { id:'H10', gz:['癸未','丁巳','丙戌','辛卯'], expAdj:19, tag:'合局成员受刑(未刑戌)但无冲·仅月干透' },
  { id:'H11', gz:['壬辰','癸卯','戊戌','丁巳'], expAdj:0, tag:'旺相对照锚点(28盘A5)：卯月火相·月支木≠火·成员受冲(辰冲戌)+害(辰害卯)' },
  { id:'H12', gz:['甲申','丁丑','壬辰','己酉'], expAdj:0, tag:'旺相对照：丑月金相·月支土≠金·无冲刑害' },
  { id:'H13', gz:['壬寅','丙午','丙戌','辛卯'], expAdj:19, tag:'真化候选·仅月干透·无冲刑害·化神为比劫(正向)' },
  { id:'H14', gz:['乙丑','己丑','壬子','辛丑'], expAdj:-22, tag:'压力盘：月日/日时/年日三处子丑合土(引擎按水→土去重计1次)' },
  { id:'H15', gz:['甲寅','庚午','庚辰','乙酉'], expAdj:0, tag:'合而不化：午月金死·月支火≠金·月干透金' },
  { id:'H16', gz:['丙辰','庚子','癸巳','庚申'], expAdj:18, tag:'巳申合水·化神完全不透·内在巳申两字刑命中(合刑同柱)' },
  { id:'H17', gz:['甲子','丙子','癸亥','甲寅'], expAdj:0, tag:'旺相对照：子月木相·月支水≠木·无冲刑害' },
  { id:'H18', gz:['癸卯','己未','甲午','壬申'], expAdj:0, tag:'口径对照盘：经典口径午未合土(应收集→adj+1)；引擎口径午未合火(月支未土≠火→不收集→adj0)' }
];
if (CHARTS.length < 12 || CHARTS.length > 20) throw new Error('样本数 ' + CHARTS.length + ' 超出 12–20 区间');
var seen = {};
CHARTS.forEach(function(c) { if (seen[c.gz.join('')]) throw new Error('重复四柱 ' + c.id); seen[c.gz.join('')] = 1; });

// —— 合法性断言：60甲子奇偶 + 五虎遁 + 五鼠遁 ——
var GAN_IDX = {}; GANS.forEach(function(g,i){ GAN_IDX[g]=i; });
var ZHI_IDX = {}; ZHIS.forEach(function(z,i){ ZHI_IDX[z]=i; });
var HU_YEAR = {'甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚','丁':'壬','壬':'壬','戊':'甲','癸':'甲'};
var SHU_DAY  = {'甲':'甲','己':'甲','乙':'丙','庚':'丙','丙':'戊','辛':'戊','丁':'庚','壬':'庚','戊':'壬','癸':'壬'};
var MONTH_IDX = {'寅':0,'卯':1,'辰':2,'巳':3,'午':4,'未':5,'申':6,'酉':7,'戌':8,'亥':9,'子':10,'丑':11};
var HOUR_IDX  = {'子':0,'丑':1,'寅':2,'卯':3,'辰':4,'巳':5,'午':6,'未':7,'申':8,'酉':9,'戌':10,'亥':11};
CHARTS.forEach(function(c) {
  var gz = c.gz;
  [gz[0],gz[1],gz[2],gz[3]].forEach(function(p,pi) {
    var g = p[0], z = p[1];
    if (GAN_IDX[g] % 2 !== ZHI_IDX[z] % 2) throw new Error(c.id + ' 第' + (pi+1) + '柱 ' + p + ' 阴阳奇偶不符（非60甲子）');
  });
  var expM = GANS[(GAN_IDX[HU_YEAR[gz[0][0]]] + MONTH_IDX[gz[1][1]]) % 10];
  if (expM !== gz[1][0]) throw new Error(c.id + ' 月干 ' + gz[1][0] + ' ≠ 五虎遁 ' + expM);
  var expH = GANS[(GAN_IDX[SHU_DAY[gz[2][0]]] + HOUR_IDX[gz[3][1]]) % 10];
  if (expH !== gz[3][0]) throw new Error(c.id + ' 时干 ' + gz[3][0] + ' ≠ 五鼠遁 ' + expH);
});
console.log('✅ ' + CHARTS.length + ' 盘全部通过合法性断言（60甲子奇偶 + 五虎遁 + 五鼠遁）\n');

// —— 事件盘点（探针侧，口径与 _p2_1a 相同）——
var POS = ['year','month','day','hour'];
var ALL_PAIRS = [['year','month'],['month','day'],['day','hour'],['year','day'],['year','hour'],['month','hour']];
function scanChart(gz) {
  var b = { year:{gan:gz[0][0],zhi:gz[0][1]}, month:{gan:gz[1][0],zhi:gz[1][1]}, day:{gan:gz[2][0],zhi:gz[2][1]}, hour:{gan:gz[3][0],zhi:gz[3][1]} };
  var mz = gz[1][1];
  var hePairs = [], collected = [];
  ALL_PAIRS.forEach(function(pair) {
    var z1 = gz[POS.indexOf(pair[0])][1], z2 = gz[POS.indexOf(pair[1])][1];
    var hua = heProbe[z1+z2];
    if (!hua) return;
    if (pair[0] === 'day' || pair[1] === 'day') {
      var qualifies = ZHI_WX[mz] === hua;
      hePairs.push({ pair:pair, z1:z1, z2:z2, hua:hua, qualifies:qualifies });
      if (qualifies) collected.push({ z1:z1, z2:z2, hua:hua });
    }
  });
  // 透干按「日支六合化神」计（无日支合则无）
  var huaWx = hePairs.length ? hePairs[0].hua : null;
  var tou = POS.filter(function(p) { return p !== 'day' && GAN_WX[b[p].gan] === huaWx; });
  var chongHit = POS.filter(function(p) {
    if (!huaWx) return false;
    var z = gz[POS.indexOf(p)][1];
    var hit = false;
    hePairs.forEach(function(h) { if (chongProbe[z] === h.z1 || chongProbe[z] === h.z2) hit = true; });
    return hit;
  });
  var monthChong = POS.filter(function(p) { return p !== 'month' && chongProbe[gz[POS.indexOf(p)][1]] === mz; });
  var xing2 = POS.filter(function(p) {
    if (!huaWx) return false;
    var z = gz[POS.indexOf(p)][1];
    var hit = false;
    hePairs.forEach(function(h) {
      if (xing2Probe[z + h.z1] || xing2Probe[z + h.z2]) hit = true;
      if (SELF_XING.indexOf(z) >= 0 && (z === h.z1 || z === h.z2)) {
        if (POS.filter(function(q){ return gz[POS.indexOf(q)][1] === z; }).length >= 2) hit = true;
      }
    });
    return hit;
  });
  var xing3 = XING3_GROUPS.some(function(g) {
    return g.every(function(z) { return POS.some(function(p){ return gz[POS.indexOf(p)][1] === z; }); });
  });
  var hai = POS.filter(function(p) {
    if (!huaWx) return false;
    var z = gz[POS.indexOf(p)][1];
    var hit = false;
    hePairs.forEach(function(h) { if (haiProbe[z] === h.z1 || haiProbe[z] === h.z2) hit = true; });
    return hit;
  });
  return { hePairs:hePairs, collected:collected, tou:tou, chongHit:chongHit, monthChong:monthChong, xing2:xing2, xing3:xing3, hai:hai };
}

// —— 探针侧独立复算 dayBranchAdj（镜像引擎规则，供对账）——
function adjKernel(gz, collected) {
  var dg = GAN_WX[gz[2][0]], oldWx = ZHI_WX[gz[2][1]];
  var applied = {}, adj = 0;
  collected.forEach(function(h) {
    var newWx = h.hua;
    var key = oldWx + '→' + newWx;
    if (applied[key]) return; applied[key] = true;
    if (oldWx === newWx) return;
    if (oldWx === dg) adj -= 12;
    else if (SHENG[dg] === oldWx) adj -= 8;
    else if (KE[dg] === oldWx) adj += 10;
    else if (SHENG[oldWx] === dg) adj += 7;
    else if (KE[oldWx] === dg) adj += 6;
    if (newWx === dg) adj += 12;
    else if (SHENG[dg] === newWx) adj += 8;
    else if (KE[dg] === newWx) adj -= 10;
    else if (SHENG[newWx] === dg) adj -= 7;
    else if (KE[newWx] === dg) adj -= 6;
  });
  return adj;
}
function probeAdj(gz) {
  var sc = scanChart(gz);
  return sc.collected.length ? adjKernel(gz, sc.collected) : 0;
}
// 经典口径（午未合土）下的 dayBranchAdj——仅用于 H06/H18 对照注释，不参与引擎对账
function classicalAdj(gz) {
  var mz = gz[1][1], collected = [];
  ALL_PAIRS.forEach(function(pair) {
    var z1 = gz[POS.indexOf(pair[0])][1], z2 = gz[POS.indexOf(pair[1])][1];
    var hua = heProbeClassical[z1+z2];
    if (hua && (pair[0] === 'day' || pair[1] === 'day') && ZHI_WX[mz] === hua) collected.push({ z1:z1, z2:z2, hua:hua });
  });
  return collected.length ? adjKernel(gz, collected) : 0;
}
var CLASSICAL_EXP = { H06: 0, H18: 1 };

// —— 引擎装载：纯引擎 + 观测补丁（仅暴露 dayBranchAdj，不改计分）——
function loadEngine(instrumented) {
  var src = baseCode;
  if (instrumented) {
    src = src.replace(/score \+= dayBranchAdj;\r?\n/,
      'score += dayBranchAdj;\n      global.__p2_1c_adj = dayBranchAdj;\n      global.__p2_1c_heKeys = Object.keys(dayHeApplied);\n      // CF-P2.1C-INSTRUMENT：仅观测，不改变任何计分\n');
    if (src.indexOf('CF-P2.1C-INSTRUMENT') < 0) throw new Error('观测补丁未生效（replace 未匹配）');
  }
  var stitched = '';
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  return { dm: global.calcDayMasterStrength };
}
function toBazi(gz) {
  return { year:{gan:gz[0][0],zhi:gz[0][1]}, month:{gan:gz[1][0],zhi:gz[1][1]}, day:{gan:gz[2][0],zhi:gz[2][1]}, hour:{gan:gz[3][0],zhi:gz[3][1]} };
}

var plainEng = loadEngine(false);
var obsEng = loadEngine(true);
var rows = [];
CHARTS.forEach(function(c) {
  var gz = c.gz, sc = scanChart(gz), dg = GAN_WX[gz[2][0]];
  global.__p2_1c_adj = null;
  var rp = plainEng.dm(toBazi(gz));
  var ro = obsEng.dm(toBazi(gz));
  if (rp.score !== ro.score || rp.level !== ro.level) throw new Error(c.id + ' 观测补丁与纯引擎不一致');
  var engineAdj = global.__p2_1c_adj === null ? 0 : global.__p2_1c_adj;
  var pAdj = probeAdj(gz);
  if (engineAdj !== c.expAdj) throw new Error(c.id + ' 引擎实测 dayBranchAdj=' + engineAdj + ' ≠ 期望=' + c.expAdj);
  if (engineAdj !== pAdj) throw new Error(c.id + ' 探针(引擎口径)复算 dayBranchAdj=' + pAdj + ' ≠ 引擎实测=' + engineAdj);
  var cAdj = classicalAdj(gz);
  if (CLASSICAL_EXP[c.id] !== undefined) {
    if (cAdj !== CLASSICAL_EXP[c.id]) throw new Error(c.id + ' 经典口径复算=' + cAdj + ' ≠ 期望=' + CLASSICAL_EXP[c.id]);
  } else if (cAdj !== engineAdj) {
    throw new Error(c.id + ' 经典口径与引擎口径不一致（非午未盘不应发生）：classical=' + cAdj + ' engine=' + engineAdj);
  }

  var huaWx = sc.hePairs.length ? sc.hePairs[0].hua : null;
  var oldWx = ZHI_WX[gz[2][1]];
  var monthWx = ZHI_WX[gz[1][1]];
  var status = huaWx ? WXS[monthWx][huaWx] : '—';
  var statusNote = { '旺':'月支同五行', '相':'月令生之', '休':'生月令', '囚':'克月令', '死':'月令克之' }[status] || '';
  var heStr = sc.hePairs.map(function(h) {
    if (c.id === 'H06') {
      return h.pair[0] + '-' + h.pair[1] + '(' + h.z1 + h.z2 + '合) [引擎口径化火→月支午===火→收集(adj+19) / 经典口径化土→月支午≠土→不收集(adj0)]';
    }
    if (c.id === 'H18') {
      return h.pair[0] + '-' + h.pair[1] + '(' + h.z1 + h.z2 + '合) [引擎口径化火→月支未≠火→不收集(adj0) / 经典口径化土→月支未===土→收集(adj+1)]';
    }
    return h.pair[0] + '-' + h.pair[1] + '(' + h.z1 + h.z2 + '合' + h.hua + ')' + (h.qualifies ? '[月支五行===化神·收集]' : '[月支五行≠化神·不收集]');
  }).join(' + ');
  rows.push({
    id: c.id,
    gz: gz.join(' '),
    dg: dg,
    he: heStr || '无',
    rel: huaWx ? ('原支' + gz[2][1] + '=' + oldWx + '(' + relTo(oldWx, dg) + ') → ' +
        (c.id === 'H18' ? '经典口径化神土(财) adj+1 / 引擎口径化神火(不收集) adj0' :
        '化神' + huaWx + '(' + relTo(huaWx, dg) + ')')) : '—',
    hua: huaWx || '—',
    status: status + (statusNote ? '(' + statusNote + ')' : ''),
    tou: sc.tou.length ? sc.tou.join('+') : '无',
    r1: sc.chongHit.length ? sc.chongHit.join('+') : '无',
    r2: sc.monthChong.length ? sc.monthChong.join('+') : '无',
    xing: '两字:' + (sc.xing2.length ? sc.xing2.join('+') : '无') + ' / 三字全:' + (sc.xing3 ? '是' : '否'),
    hai: sc.hai.length ? sc.hai.join('+') : '无',
    reconstructed: engineAdj !== 0,
    adj: engineAdj,
    score: rp.score,
    level: rp.level,
    tag: c.tag
  });
});

// —— 输出 ——
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
var header = ['编号','四柱','日主','六合对(柱位)','原支关系','化神','月令支持状态(旺相休囚死)','化神透干位置','R1直接冲','R2月令冲','刑','害','BASE是否重构','BASE dayBranchAdj','BASE分数','BASE旺衰','设计类别(结构性)'];
console.log('========== P2.1 专项合化测试集（' + CHARTS.length + ' 盘，仅客观信息，无资格标签）==========');
rows.forEach(function(r) {
  console.log('\n【' + r.id + '】' + r.gz + '  日主=' + r.dg + '  ' + r.tag);
  console.log('  六合对: ' + r.he);
  console.log('  原支关系: ' + r.rel + '   化神: ' + r.hua + '   月令支持状态: ' + r.status);
  console.log('  透干位置: ' + r.tou + '   R1直接冲: ' + r.r1 + '   R2月令冲: ' + r.r2);
  console.log('  刑: ' + r.xing + '   害: ' + r.hai);
  console.log('  BASE: ' + (r.reconstructed ? '重构  dayBranchAdj=' + (r.adj > 0 ? '+' : '') + r.adj : '不重构  dayBranchAdj=0') + '   分数=' + r.score + '/' + r.level);
});
var csv = [header.join(',')];
rows.forEach(function(r) {
  csv.push([r.id, r.gz, r.dg, r.he, r.rel, r.hua, r.status, r.tou, r.r1, r.r2, r.xing, r.hai,
    r.reconstructed ? '重构' : '不重构', r.adj, r.score, r.level, r.tag].map(csvQ).join(','));
});
fs.writeFileSync(path.join(ROOT, '_p2_1c_chart_set.csv'), '﻿' + csv.join('\n'), 'utf-8');
var pos = rows.filter(function(r){ return r.adj > 0; });
var neg = rows.filter(function(r){ return r.adj < 0; });
var zero = rows.filter(function(r){ return r.adj === 0; });
console.log('\n已写入 _p2_1c_chart_set.csv（' + rows.length + ' 行）');
console.log('方向分布：dayBranchAdj 正向 ' + pos.length + ' 盘 / 负向 ' + neg.length + ' 盘 / 零(不重构) ' + zero.length + ' 盘');
console.log('✓ 观测补丁与纯引擎 ' + rows.length + '/' + rows.length + ' 逐盘一致；✓ 探针复算 dayBranchAdj 与引擎实测全部相等');
