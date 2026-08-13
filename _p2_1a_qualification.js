// P2.1-A 合化资格反事实（2026-08-13 GPT 裁决后：资格与烈度分离，本轮只动资格）
// 引擎事实：日支合化重构的唯一资格条件是「月支五行 === 化神五行」（bazi.js ⑧段）
//   —— 无透干检查、无受破检查；满足即全重构（烈度 1.0）。
// 本实验保持烈度不变（旧侧×1.0 / 新侧×1.0），只改资格因子 _fA：
//   BASE1  资格恒1（与未打补丁引擎逐盘对账，防补丁失真）
//   T1 透干宽口径：年/月/时任干透化神→1.0；无透→0.5
//   T2 透干距离口径：月干/时干透=强透→1.0；仅年干透或无透→0.5
//   T3 透干月令口径：月干透→1.0；时干/年干透或无透→0.5
//   R1 直接六冲：合局成员被第三支六冲→0.5
//   R2 月令受冲：月支被冲→0.5
//   R3a 合局成员受刑(探针口径：三刑任意两字+子卯+自刑)→0.5
//   R3b 同口径刑→0.75（仅降可信）
//   R3c 同口径刑不影响资格（仅记录事件）
//   R4 害→仅记录事件，本轮无一票否决权
// 全部内存补丁 + CF 标记断言；引擎 js/bazi.js 零改动。
// 用法: node _p2_1a_qualification.js
// 产物: _p2_1a.csv（变体波及明细）+ _p2_1a_events.csv（28盘日支六合事件盘点）
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

// —— 探针侧地图（独立于引擎，事件盘点用）——
var GAN_WX = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var ZHI_WX = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var HE6 = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
var heProbe = {}; HE6.forEach(function(t){ heProbe[t[0]+t[1]]=t[2]; heProbe[t[1]+t[0]]=t[2]; });
var chongProbe = {}; [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']].forEach(function(p){ chongProbe[p[0]]=p[1]; chongProbe[p[1]]=p[0]; });
var haiProbe = {}; [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']].forEach(function(p){ haiProbe[p[0]]=p[1]; haiProbe[p[1]]=p[0]; });
// 刑（探针口径）：子卯相刑；寅巳申/丑戌未 任意两字相见即算；辰午酉亥自刑（全盘同支≥2）
var xing2Probe = {};
[['子','卯'],['寅','巳'],['寅','申'],['巳','申'],['丑','戌'],['丑','未'],['戌','未']].forEach(function(p){ xing2Probe[p[0]+p[1]]=1; xing2Probe[p[1]+p[0]]=1; });
var XING3_GROUPS = [['寅','巳','申'],['丑','戌','未'],['子','卯']];
var SELF_XING = ['辰','午','酉','亥'];

// —— 资格因子补丁模板：替换日支合化重构块，烈度系数恒 1.0 ——
var BLOCK_RE = /if \(oldWx!==newWx\) \{\r?\n\s*\/\/ 退还旧五行得地分，计入新五行得地分\r?\n[\s\S]*?else if \(WOKE\[dgWx\]===newWx\) dayBranchAdj-=6;\r?\n(\s*)\}/;
function makePatchA(key, factorLines, note) {
  return function(src) {
    return src.replace(BLOCK_RE, function(m, ind) {
      return [
        'if (oldWx!==newWx) {',
        '        // ' + key + '：' + note + '（烈度系数恒1.0，仅资格因子 _fA 变化）',
        factorLines,
        '        // 退还旧五行得地分，计入新五行得地分',
        '        if (oldWx===dgWx) dayBranchAdj-=12*_fA;',
        '        else if (SHENGWO[dgWx]===oldWx) dayBranchAdj-=8*_fA;',
        '        else if (KEWO[dgWx]===oldWx) dayBranchAdj+=10*_fA;',
        '        else if (WOSHENG[dgWx]===oldWx) dayBranchAdj+=7*_fA;',
        '        else if (WOKE[dgWx]===oldWx) dayBranchAdj+=6*_fA;',
        '        if (newWx===dgWx) dayBranchAdj+=12*_fA;',
        '        else if (SHENGWO[dgWx]===newWx) dayBranchAdj+=8*_fA;',
        '        else if (KEWO[dgWx]===newWx) dayBranchAdj-=10*_fA;',
        '        else if (WOSHENG[dgWx]===newWx) dayBranchAdj-=7*_fA;',
        '        else if (WOKE[dgWx]===newWx) dayBranchAdj-=6*_fA;',
        '      }'
      ].join('\n');
    });
  };
}

// 刑探针代码段（引擎无刑检测；正式口径待 GPT 形式化，本表仅供实验区分）
var XING_PROBE = [
  "        var _XA2 = {'子':'卯','卯':'子','寅':'巳','巳':'寅','寅':'申','申':'寅','巳':'申','申':'巳','丑':'戌','戌':'丑','丑':'未','未':'丑','戌':'未','未':'戌'};",
  "        var _xingR3 = false;",
  "        ['year','month','day','hour'].forEach(function(_pr) {",
  "          var _z = bazi[_pr].zhi;",
  "          if (_XA2[_z] === he.z1 || _XA2[_z] === he.z2) _xingR3 = true;",
  "          if (_z === '辰' || _z === '午' || _z === '酉' || _z === '亥') {",
  "            if (_z === he.z1 || _z === he.z2) {",
  "              var _cnt3 = ['year','month','day','hour'].filter(function(_p2){ return bazi[_p2].zhi === _z; }).length;",
  "              if (_cnt3 >= 2) _xingR3 = true;",
  "            }",
  "          }",
  "        });"
].join('\n');

var PATCHES = {
  BASE1: makePatchA('CF-P2.1A-BASE1', 'var _fA = 1;', '资格恒1（与未打补丁引擎逐盘对账）'),
  T1: makePatchA('CF-P2.1A-T1', [
    "        var _touA1 = ['year','month','hour'].some(function(_pa){ return WU_XING[bazi[_pa].gan] === newWx; });",
    '        var _fA = _touA1 ? 1 : 0.5;'
  ].join('\n'), '透干宽口径：年/月/时任干透化神→1.0；无透→0.5'),
  T2: makePatchA('CF-P2.1A-T2', [
    '        var _touA2m = WU_XING[bazi.month.gan] === newWx;',
    '        var _touA2h = WU_XING[bazi.hour.gan] === newWx;',
    '        var _fA = (_touA2m || _touA2h) ? 1 : 0.5;'
  ].join('\n'), '透干距离口径：月干/时干透=强透→1.0；仅年干透或无透→0.5'),
  T3: makePatchA('CF-P2.1A-T3', [
    '        var _fA = (WU_XING[bazi.month.gan] === newWx) ? 1 : 0.5;'
  ].join('\n'), '透干月令口径：月干透→1.0；时干/年干透或无透→0.5'),
  R1: makePatchA('CF-P2.1A-R1', [
    "        var _chongR1 = ['year','month','day','hour'].some(function(_pr){ return chongMap[bazi[_pr].zhi] === he.z1 || chongMap[bazi[_pr].zhi] === he.z2; });",
    '        var _fA = _chongR1 ? 0.5 : 1;'
  ].join('\n'), '直接六冲：合局成员被第三支六冲→0.5'),
  R2: makePatchA('CF-P2.1A-R2', [
    "        var _chongR2 = ['year','day','hour'].some(function(_pr){ return chongMap[bazi[_pr].zhi] === bazi.month.zhi; });",
    '        var _fA = _chongR2 ? 0.5 : 1;'
  ].join('\n'), '月令受冲：月支被冲→0.5'),
  R3a: makePatchA('CF-P2.1A-R3a', [XING_PROBE, '        var _fA = _xingR3 ? 0.5 : 1;'].join('\n'), '合局成员受刑（探针口径）→0.5'),
  R3b: makePatchA('CF-P2.1A-R3b', [XING_PROBE, '        var _fA = _xingR3 ? 0.75 : 1;'].join('\n'), '合局成员受刑（探针口径）→0.75（仅降可信）'),
  R3c: makePatchA('CF-P2.1A-R3c', [XING_PROBE, '        var _fA = 1;'].join('\n'), '合局成员受刑（探针口径）不影响资格，仅记录事件'),
  R4: makePatchA('CF-P2.1A-R4', [
    "        var _haiR4 = ['year','month','day','hour'].some(function(_pr){ var _z=bazi[_pr].zhi; return haiMap[_z]===he.z1 || haiMap[_z]===he.z2; });",
    '        var _fA = 1;'
  ].join('\n'), '害：仅记录事件，本轮无一票否决权')
};

function loadEngine(patchKey) {
  var src = patchKey ? PATCHES[patchKey](baseCode) : baseCode;
  if (patchKey && src.indexOf('CF-P2.1A-' + patchKey) < 0) {
    throw new Error('变体 ' + patchKey + ' 的补丁未生效（replace 未匹配源码）');
  }
  var stitched = '';
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  return { dm: global.calcDayMasterStrength, yj: global.getYongJi, cong: global.getCongGe, pat: global.getPattern };
}

// —— 28 盘装载（22 基线 + P1.5 六盘，样本数断言）——
var charts = [];
fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').split('\n').slice(1).forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var cells = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (cells.length < 2 || !cells[1]) return;
  var gz = cells[1].split(/\s+/);
  if (gz.length === 4) charts.push({ id: cells[0], gz: gz });
});
var SIX_IDS = ['P15-03','P15-09','P15-12','P15-14','P15-15','P15-16'];
fs.readFileSync(path.join(ROOT, '_p15_charts.txt'), 'utf-8').split('\n').forEach(function(line) {
  line = line.trim();
  if (!line || line[0] === '#') return;
  var parts = line.split(/\s+/);
  if (parts.length === 5 && SIX_IDS.indexOf(parts[0]) >= 0) charts.push({ id: parts[0], gz: parts.slice(1) });
});
if (charts.length !== 28) throw new Error('样本数异常：' + charts.length + '≠28（预期22基线+六盘）');

var SIX = {
  'P15-03': { yong: '火', xi: '火、水', ji: '' },
  'P15-09': { yong: '土', xi: '土', ji: '' },
  'P15-12': { yong: '土', xi: '土、金', ji: '木、火、水' },
  'P15-14': { yong: '土', xi: '土、火', ji: '木、水、金' },
  'P15-15': { yong: '木', xi: '木、水', ji: '金、火、土' },
  'P15-16': { yong: '水', xi: '水、金', ji: '木、土、火' }
};

function toBazi(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month:{ gan: gz[1][0], zhi: gz[1][1] },
    day:  { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] }
  };
}

// —— 事件盘点（探针侧）：日支参与的六合、资格、透干/冲/刑/害 ——
var POS = ['year','month','day','hour'];
var ADJ = [['year','month'],['month','day'],['day','hour']];
var CROSS = [['year','day'],['year','hour'],['month','hour']];
function scanEvents(gz) {
  var evs = [];
  ADJ.concat(CROSS).forEach(function(pair) {
    if (pair.indexOf('day') < 0) return;
    var z1 = gz[POS.indexOf(pair[0])][1], z2 = gz[POS.indexOf(pair[1])][1];
    var hua = heProbe[z1 + z2];
    if (!hua) return;
    var mz = gz[1][1];
    var qualifies = ZHI_WX[mz] === hua;  // 引擎唯一资格条件：月支五行===化神
    var tou = POS.filter(function(p) { return p !== 'day' && GAN_WX[gz[POS.indexOf(p)][0]] === hua; });
    var chongHit = POS.filter(function(p) { var z = gz[POS.indexOf(p)][1]; return chongProbe[z] === z1 || chongProbe[z] === z2; });
    var monthChong = POS.filter(function(p) { return p !== 'month' && chongProbe[gz[POS.indexOf(p)][1]] === mz; });
    var xing2 = POS.filter(function(p) {
      var z = gz[POS.indexOf(p)][1];
      if (xing2Probe[z + z1] || xing2Probe[z + z2]) return true;
      if (SELF_XING.indexOf(z) >= 0 && (z === z1 || z === z2)) {
        return POS.filter(function(q){ return gz[POS.indexOf(q)][1] === z; }).length >= 2;
      }
      return false;
    });
    var xing3 = XING3_GROUPS.some(function(g) {
      return g.every(function(z) { return POS.some(function(p){ return gz[POS.indexOf(p)][1] === z; }); });
    });
    var hai = POS.filter(function(p) { var z = gz[POS.indexOf(p)][1]; return haiProbe[z] === z1 || haiProbe[z] === z2; });
    evs.push({
      pair: pair.join('-') + '(' + z1 + z2 + '合' + hua + ')',
      z1: z1, z2: z2, hua: hua,
      qualifies: qualifies,
      tou: tou, chongHit: chongHit, monthChong: monthChong,
      xing2: xing2, xing3: xing3, hai: hai
    });
  });
  return evs;
}

function runChart(eng, c) {
  var b = toBazi(c.gz);
  var dm = eng.dm(b);
  var yj = eng.yj(b);
  return {
    id: c.id, gz: c.gz.join(' '), score: dm.score, level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、')
  };
}

function csvQ(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// —— BASE 引擎 + BASE1 对账（防补丁失真）——
var baseEng = loadEngine(null);
var baseRes = {};
charts.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });
var base1Eng = loadEngine('BASE1');
var base1Mismatch = [];
charts.forEach(function(c) {
  var r = runChart(base1Eng, c);
  if (r.score !== baseRes[c.id].score || r.level !== baseRes[c.id].level ||
      r.yong !== baseRes[c.id].yong || r.xi !== baseRes[c.id].xi || r.ji !== baseRes[c.id].ji) {
    base1Mismatch.push(c.id);
  }
});
if (base1Mismatch.length) throw new Error('BASE1 与未打补丁引擎不一致：' + base1Mismatch.join('、'));
console.log('✅ BASE1 与未打补丁引擎 28/28 逐盘一致（补丁在恒1因子下行为等价）\n');

// —— 事件盘点输出 ——
console.log('========== 28 盘日支六合事件盘点（探针侧）==========');
var eventRows = [];
var qualifiedCharts = [];
charts.forEach(function(c) {
  var evs = scanEvents(c.gz);
  if (!evs.length) return;
  evs.forEach(function(ev) {
    console.log('【' + c.id + '】' + c.gz.join(' ') + '  ' + ev.pair +
      '  月支五行=' + ZHI_WX[c.gz[1][1]] + (ev.qualifies ? ' === 化神→[引擎资格通过，全重构]' : ' ≠ 化神→[引擎不重构]') +
      '  透干柱=' + (ev.tou.length ? ev.tou.join('/') : '无') +
      '  R1直接冲=' + (ev.chongHit.length ? ev.chongHit.join('/') : '无') +
      '  R2月令冲=' + (ev.monthChong.length ? ev.monthChong.join('/') : '无') +
      '  R3刑(两字口径)=' + (ev.xing2.length ? ev.xing2.join('/') : '无') +
      '  R3刑(三字全)=' + (ev.xing3 ? '是' : '否') +
      '  R4害=' + (ev.hai.length ? ev.hai.join('/') : '无'));
    eventRows.push([c.id, c.gz.join(' '), ev.pair, ZHI_WX[c.gz[1][1]], ev.qualifies ? '资格通过' : '不重构',
      ev.tou.join('/') || '无', ev.chongHit.join('/') || '无', ev.monthChong.join('/') || '无',
      ev.xing2.join('/') || '无', ev.xing3 ? '是' : '否', ev.hai.join('/') || '无']);
    if (ev.qualifies) qualifiedCharts.push(c.id);
  });
});
console.log('\n28 盘中：日支参与六合 ' + eventRows.length + ' 条；引擎资格通过（月支五行===化神）' +
  (qualifiedCharts.length ? qualifiedCharts.join('、') : '无') + '\n');

// —— 变体跑盘 ——
var csv = ['变体,编号,八字,旧分,新分,Δ分,旧旺衰,新旺衰,旧用神,新用神,旧喜,新喜,旧忌,新忌'];
console.log('========== 变体波及（与 BASE 对比，|Δ|≥0.5 或喜用忌变化计入）==========');
Object.keys(PATCHES).forEach(function(key) {
  if (key === 'BASE1') return;
  var eng = loadEngine(key);
  var changed = [];
  var sixTable = [];
  charts.forEach(function(c) {
    var r = runChart(eng, c);
    var base = baseRes[c.id];
    var d = Math.round((r.score - base.score) * 100) / 100;
    var yxjChange = r.yong !== base.yong || r.xi !== base.xi || r.ji !== base.ji;
    if (SIX[c.id]) {
      var a = SIX[c.id];
      var breaks = [];
      if (r.yong !== a.yong) breaks.push('用神' + r.yong + '≠' + a.yong);
      if (r.xi !== a.xi) breaks.push('喜神' + r.xi + '≠' + a.xi);
      if (r.ji !== a.ji) breaks.push('忌神' + r.ji + '≠' + a.ji);
      sixTable.push('  ' + c.id + ' ' + base.score + '→' + r.score + '（' + (d > 0 ? '+' : '') + d + '）' +
        (base.level !== r.level ? ' 旺衰' + base.level + '→' + r.level : '') +
        (breaks.length ? '  ⚠' + breaks.join('；') : ' 锚点✓'));
    }
    if (Math.abs(d) >= 0.5 || yxjChange) {
      changed.push({ c: c, r: r, d: d, base: base });
      csv.push([key, c.id, c.gz.join(' '), base.score, r.score, d, base.level, r.level,
        base.yong, r.yong, base.xi, r.xi, base.ji, r.ji].map(csvQ).join(','));
    }
  });
  console.log('===== ' + key + '（波及 ' + changed.length + '/28 盘）=====');
  changed.forEach(function(x) {
    var lv = x.base.level === x.r.level ? '' : '  ⚠旺衰 ' + x.base.level + '→' + x.r.level;
    var ys = x.base.yong === x.r.yong ? '' : '  ⚠用神 ' + x.base.yong + '→' + x.r.yong;
    var js = x.base.ji === x.r.ji ? '' : '  ⚠忌 ' + (x.base.ji || '空') + '→' + (x.r.ji || '空');
    console.log('  ' + x.c.id + ' ' + x.c.gz.join(' ') + '  ' + x.base.score + '→' + x.r.score +
      '（' + (x.d > 0 ? '+' : '') + x.d + '）' + lv + ys + js);
  });
  if (!changed.length) console.log('  （无）');
  var lvFlips = changed.filter(function(x){return x.base.level!==x.r.level;}).length;
  var ysFlips = changed.filter(function(x){return x.base.yong!==x.r.yong;}).length;
  console.log('  小结：旺衰标签翻转 ' + lvFlips + ' 盘；用神翻转 ' + ysFlips + ' 盘');
  console.log('  六盘锚点视图：');
  sixTable.forEach(function(s) { console.log(s); });
  console.log('');
});

fs.writeFileSync(path.join(ROOT, '_p2_1a.csv'), '﻿' + csv.join('\n'), 'utf-8');
var evCsv = ['编号,八字,六合对(柱位),月支五行,引擎资格,透干柱,R1直接冲,R2月令冲,R3刑两字口径,R3刑三字全,R4害'];
eventRows.forEach(function(row) { evCsv.push(row.map(csvQ).join(',')); });
fs.writeFileSync(path.join(ROOT, '_p2_1a_events.csv'), '﻿' + evCsv.join('\n'), 'utf-8');
console.log('已写入 _p2_1a.csv（' + (csv.length - 1) + ' 行波及明细）+ _p2_1a_events.csv（' + eventRows.length + ' 行事件盘点）');
