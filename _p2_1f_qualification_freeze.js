// P2.1 第四轮·资格反推冻结验证（2026-08-13，GPT 第四轮裁决第1-2节）
// 标签修正：H06 合而不化→趋化、H18 趋化→真化（均为午未合土口径下的事实裁决，不新增午未特殊规则）。
// 重跑资格反推：目标 18/18 全一致。若不一致立即抛错停止，禁止修改规则追标签。
// 18/18 通过后输出 qualification v1 规格（FROZEN），本轮以后不再调资格规则。
// 引擎 js/bazi.js 零改动；仅观测补丁暴露 dayBranchAdj 对照。
// 用法: node _p2_1f_qualification_freeze.js
// 产物: _p2_1f_qualification_freeze.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

// —— 探针侧地图（同 _p2_1d，主口径 = 经典午未合土）——
var GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var ZHIS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var HE6 = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
function buildHe(table) { var m = {}; table.forEach(function(t){ m[t[0]+t[1]]=t[2]; m[t[1]+t[0]]=t[2]; }); return m; }
var heProbe = buildHe(HE6);
var chongProbe = {}; [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']].forEach(function(p){ chongProbe[p[0]]=p[1]; chongProbe[p[1]]=p[0]; });
var haiProbe = {}; [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']].forEach(function(p){ haiProbe[p[0]]=p[1]; haiProbe[p[1]]=p[0]; });
var xing2Probe = {};
[['子','卯'],['寅','巳'],['寅','申'],['巳','申'],['丑','戌'],['丑','未'],['戌','未']].forEach(function(p){ xing2Probe[p[0]+p[1]]=1; xing2Probe[p[1]+p[0]]=1; });
var XING3_GROUPS = [['寅','巳','申'],['丑','戌','未'],['子','卯']];
var SELF_XING = ['辰','午','酉','亥'];
var SHENG = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
var KE   = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
var WXS = {
  '木': {'木':'旺','火':'相','水':'休','金':'囚','土':'死'},
  '火': {'火':'旺','土':'相','木':'休','水':'囚','金':'死'},
  '金': {'金':'旺','水':'相','土':'休','火':'囚','木':'死'},
  '水': {'水':'旺','木':'相','金':'休','土':'囚','火':'死'},
  '土': {'土':'旺','金':'相','火':'休','木':'囚','水':'死'}
};

// —— 18 盘样本（同 _p2_1c；expAdj = 旧引擎实测，仅作旧行为记录）——
var CHARTS = [
  { id:'H01', gz:['癸未','戊午','乙卯','丙戌'], expAdj:-19 },
  { id:'H02', gz:['戊辰','甲寅','丁亥','庚子'], expAdj:18 },
  { id:'H03', gz:['甲寅','戊辰','壬子','辛丑'], expAdj:-22 },
  { id:'H04', gz:['甲申','庚午','辛卯','戊戌'], expAdj:-4 },
  { id:'H05', gz:['庚子','乙酉','甲辰','甲子'], expAdj:-4 },
  { id:'H06', gz:['乙巳','壬午','丁未','戊申'], expAdj:19 },
  { id:'H07', gz:['己丑','丙寅','丁亥','甲辰'], expAdj:18 },
  { id:'H08', gz:['丁酉','丙午','丁卯','庚戌'], expAdj:4 },
  { id:'H09', gz:['甲寅','壬申','壬辰','己酉'], expAdj:18 },
  { id:'H10', gz:['癸未','丁巳','丙戌','辛卯'], expAdj:19 },
  { id:'H11', gz:['壬辰','癸卯','戊戌','丁巳'], expAdj:0 },
  { id:'H12', gz:['甲申','丁丑','壬辰','己酉'], expAdj:0 },
  { id:'H13', gz:['壬寅','丙午','丙戌','辛卯'], expAdj:19 },
  { id:'H14', gz:['乙丑','己丑','壬子','辛丑'], expAdj:-22 },
  { id:'H15', gz:['甲寅','庚午','庚辰','乙酉'], expAdj:0 },
  { id:'H16', gz:['丙辰','庚子','癸巳','庚申'], expAdj:18 },
  { id:'H17', gz:['甲子','丙子','癸亥','甲寅'], expAdj:0 },
  { id:'H18', gz:['癸卯','己未','甲午','壬申'], expAdj:0 }
];

// —— GPT 第四轮修正后资格标签（H06→趋化，H18→真化）——
var GPT_LABELS = {
  'H01':'真化','H02':'真化','H03':'真化','H07':'真化','H10':'真化','H13':'真化','H14':'真化','H18':'真化',
  'H04':'趋化','H05':'趋化','H06':'趋化','H08':'趋化','H09':'趋化','H11':'趋化','H12':'趋化','H16':'趋化','H17':'趋化',
  'H15':'合而不化'
};

// —— 合法性断言（60甲子奇偶 + 五虎遁 + 五鼠遁）——
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

// —— 事件盘点（经典口径）——
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

// —— 经典口径 dayBranchAdj 反事实复算 ——
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
function classicalAdj(gz) {
  var sc = scanChart(gz);
  return sc.collected.length ? adjKernel(gz, sc.collected) : 0;
}

// —— 引擎装载（观测补丁）——
function loadEngine(instrumented) {
  var src = baseCode;
  if (instrumented) {
    src = src.replace(/score \+= dayBranchAdj;\r?\n/,
      'score += dayBranchAdj;\n      global.__p2_1f_adj = dayBranchAdj;\n      // CF-P2.1F-INSTRUMENT：仅观测，不改变任何计分\n');
    if (src.indexOf('CF-P2.1F-INSTRUMENT') < 0) throw new Error('观测补丁未生效（replace 未匹配）');
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
var obsEng = loadEngine(true);

// —— 最小有序规则集（GPT 第三轮裁决骨架，第四轮冻结；无盘号特判）——
function rulePredict(gz) {
  var sc = scanChart(gz);
  if (!sc.hePairs.length) return { label:'合而不化', S:'无合', T:'—', D:[], sc:sc, chain:'日支无六合 → 合而不化' };
  var mwx = ZHI_WX[gz[1][1]], hua = sc.hePairs[0].hua;
  var status = WXS[mwx][hua];
  var S = (mwx === hua) ? 'S1' : ((status === '旺' || status === '相') ? 'S2' : 'S0');
  var T;
  if (sc.tou.indexOf('month') >= 0 || sc.tou.indexOf('hour') >= 0) T = 'T2';
  else if (sc.tou.indexOf('year') >= 0) T = 'T1';
  else T = 'T0';
  var D = [];
  if (sc.chongHit.length) D.push('R1');
  if (sc.monthChong.length) D.push('R2');
  var label;
  if (S === 'S1' && T === 'T2' && !D.length) label = '真化';
  else if (S === 'S1') label = '趋化';
  else if (S === 'S2') label = '趋化';
  else label = '合而不化';
  var parts = [];
  parts.push(S === 'S1' ? 'S1强(月支' + gz[1][1] + '=' + mwx + '===化神' + hua + ')' :
             S === 'S2' ? 'S2次级(化神' + hua + '在' + gz[1][1] + '月为' + status + ')' :
             'S0无(化神' + hua + '在' + gz[1][1] + '月' + status + ')');
  parts.push(T === 'T2' ? 'T2近透(' + sc.tou.join('+') + '干透' + hua + ')' :
             T === 'T1' ? 'T1远透(仅年干透)' : 'T0无透');
  if (sc.chongHit.length) parts.push('R1冲(' + sc.chongHit.join('+') + ')');
  if (sc.monthChong.length) parts.push('R2月令冲(' + sc.monthChong.join('+') + ')');
  if (sc.xing2.length) parts.push('刑' + sc.xing2.join('+') + '(仅记录)');
  if (sc.hai.length) parts.push('害' + sc.hai.join('+') + '(仅记录)');
  if (sc.hePairs.length > 1) parts.push('多合×' + sc.hePairs.length + '(仅增强证据,状态转换一次)');
  parts.push('→ ' + label);
  return { label:label, S:S, T:T, D:D, sc:sc, status:status, hua:hua, mwx:mwx, chain:parts.join(' + ') };
}

// —— 逐盘执行 ——
var rows = [];
CHARTS.forEach(function(c) {
  var gz = c.gz, sc = scanChart(gz);
  global.__p2_1f_adj = null;
  obsEng.dm(toBazi(gz));
  var engineAdj = global.__p2_1f_adj === null ? 0 : global.__p2_1f_adj;
  if (engineAdj !== c.expAdj) throw new Error(c.id + ' 引擎实测 dayBranchAdj=' + engineAdj + ' ≠ 期望=' + c.expAdj);
  var cAdj = classicalAdj(gz);
  if (c.id !== 'H06' && c.id !== 'H18' && cAdj !== engineAdj) {
    throw new Error(c.id + ' 经典口径=' + cAdj + ' ≠ 引擎口径=' + engineAdj + '（非午未盘不应发生）');
  }
  var pred = rulePredict(gz);
  var gpt = GPT_LABELS[c.id];
  if (!gpt) throw new Error(c.id + ' 缺少 GPT 标签');
  rows.push({
    id: c.id, gz: gz.join(' '),
    hua: pred.hua, mwx: pred.mwx, status: pred.status, S: pred.S,
    tou: sc.tou.length ? sc.tou.join('+') : '无', T: pred.T,
    r1: sc.chongHit.length ? sc.chongHit.join('+') : '无',
    r2: sc.monthChong.length ? sc.monthChong.join('+') : '无',
    xing: sc.xing2.length ? sc.xing2.join('+') : '无',
    hai: sc.hai.length ? sc.hai.join('+') : '无',
    heCount: sc.hePairs.length,
    engineAdj: engineAdj, classicalAdj: cAdj,
    gpt: gpt, predLabel: pred.label,
    match: gpt === pred.label, chain: pred.chain
  });
});

// —— 18/18 冻结断言（GPT 指令：若不是 18/18，停止并回报，不得修改规则追标签）——
var agree = rows.filter(function(r){ return r.match; }).length;
var conflicts = rows.filter(function(r){ return !r.match; });
if (agree !== 18) {
  throw new Error('冻结失败：一致率 ' + agree + '/18 ≠ 18/18。冲突盘：' +
    conflicts.map(function(x){ return x.id + '(GPT=' + x.gpt + '规则=' + x.predLabel + ')'; }).join('、') +
    '。按裁决停止，不修改规则追标签。');
}

console.log('========== P2.1 qualification v1 冻结验证：18/18 全一致 ✓ ==========');
console.log('GPT标签 / 规则预测 / 证据链');
rows.forEach(function(r) {
  console.log('  ' + r.id + '  ' + r.gpt + ' / ' + r.predLabel + ' ✓ / ' + r.chain);
});
var matrix = {};
['真化','趋化','合而不化'].forEach(function(a){ matrix[a] = {}; ['真化','趋化','合而不化'].forEach(function(b){ matrix[a][b] = 0; }); });
rows.forEach(function(r){ matrix[r.gpt][r.predLabel]++; });
console.log('\n混淆矩阵（行=GPT标签，列=规则预测）');
console.log('            真化  趋化  合而不化');
['真化','趋化','合而不化'].forEach(function(a) {
  var line = '  ' + a + '      ';
  ['真化','趋化','合而不化'].forEach(function(b) { line += '  ' + matrix[a][b]; });
  console.log(line);
});
console.log('\n真化集：' + rows.filter(function(r){ return r.predLabel === '真化'; }).map(function(r){ return r.id; }).join(' ') +
  '（' + rows.filter(function(r){ return r.predLabel === '真化'; }).length + ' 盘）');
console.log('趋化集：' + rows.filter(function(r){ return r.predLabel === '趋化'; }).map(function(r){ return r.id; }).join(' ') +
  '（' + rows.filter(function(r){ return r.predLabel === '趋化'; }).length + ' 盘）');
console.log('合而不化：' + rows.filter(function(r){ return r.predLabel === '合而不化'; }).map(function(r){ return r.id; }).join(' ') +
  '（' + rows.filter(function(r){ return r.predLabel === '合而不化'; }).length + ' 盘）');

console.log('\n========== qualification v1 规格（FROZEN，本轮以后不再调资格规则）==========');
console.log([
  'S1：月支五行 === 化神五行（强支持）',
  'S2：化神在月令为旺/相，且月支本身非化神（次级支持）',
  'S0：化神休/囚/死（无有效支持）',
  'T2：月干或时干透化神（近透）；T1：仅年干透（远透）；T0：无透',
  'D：合局成员遭第三支直接六冲（R1）/ 月令受冲（R2）→ 仅将「真化候选」降一级',
  '刑、害：只记录（进入 relationEvents），不参与合化资格',
  '多合事件：仅增强 qualificationStrength 证据；同一日支状态转换只执行一次（事件可多条，实体转换一次）',
  '判定：S1+T2+无D → 真化；其余 S1 → 趋化；S2 → 趋化；S0 → 合而不化',
  '（S2 下 T 档不产生资格差异——先接受，字段仅作证据保存，待更大样本再议）'
].map(function(s, i){ return '  ' + (i+1) + '. ' + s; }).join('\n'));

// —— CSV 输出 ——
function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
var header = ['编号','四柱','化神(经典口径)','月支五行','月令状态','支持档','透干位置','透干档','R1冲','R2月令冲','刑(仅记录)','害(仅记录)','六合事件数','引擎口径adj(旧行为)','经典口径adj(反事实)','GPT标签','规则预测','是否一致','证据链'];
var csv = [header.join(',')];
rows.forEach(function(r) {
  csv.push([r.id, r.gz, r.hua, r.mwx, r.status, r.S, r.tou, r.T, r.r1, r.r2, r.xing, r.hai, r.heCount,
    r.engineAdj, r.classicalAdj, r.gpt, r.predLabel, r.match ? '一致' : '不一致', r.chain].map(csvQ).join(','));
});
fs.writeFileSync(path.join(ROOT, '_p2_1f_qualification_freeze.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n已写入 _p2_1f_qualification_freeze.csv（' + rows.length + ' 行）');
console.log('✅ qualification v1 冻结验证通过：18/18，无盘号特判，无第三类隐藏冲突');
