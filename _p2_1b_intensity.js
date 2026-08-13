// P2.1-B 合化烈度反事实（2026-08-13 GPT 裁决后：资格与烈度分离，本轮只动烈度）
// 引擎事实：日支合化重构 dayBranchAdj = 旧侧退还（同五行-12/印-8/官杀+10/食伤+7/财+6）
//                              + 新侧计入（同五行+12/印+8/官杀-10/食伤-7/财-6）
// 资格条件完全不动（月支五行===化神即全重构）；只缩放两侧系数：
//   旧侧（原根退）rO × 新侧（新五行作用）rN，档位 {0, 0.5, 0.75, 1.0} 全网格 4×4=16
//   —— 对角 (0.75,0.75)/(0.5,0.5) 即 GPT 要求的「统一 ×0.75 / ×0.5」；
//   —— (1,0)/(0,1) 两角直接回答「-19 里旧侧-12 与新侧-7 哪一部分造成过度烈度」；
//   —— (0,0) 即合而不化的计分等效（与探索期 V1 38 分互为交叉验证）。
// 全部内存补丁 + CF 标记断言；引擎 js/bazi.js 零改动。
// 用法: node _p2_1b_intensity.js
// 产物: _p2_1b.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

var BLOCK_RE = /if \(oldWx!==newWx\) \{\r?\n\s*\/\/ 退还旧五行得地分，计入新五行得地分\r?\n[\s\S]*?else if \(WOKE\[dgWx\]===newWx\) dayBranchAdj-=6;\r?\n(\s*)\}/;
function makePatchB(key, rO, rN) {
  return function(src) {
    return src.replace(BLOCK_RE, function(m, ind) {
      return [
        'if (oldWx!==newWx) {',
        '        // CF-P2.1B-' + key + '：烈度探针 旧侧×' + rO + ' 新侧×' + rN + '（资格条件不变）',
        '        var _rO = ' + rO + '; var _rN = ' + rN + ';',
        '        // 退还旧五行得地分，计入新五行得地分',
        '        if (oldWx===dgWx) dayBranchAdj-=12*_rO;',
        '        else if (SHENGWO[dgWx]===oldWx) dayBranchAdj-=8*_rO;',
        '        else if (KEWO[dgWx]===oldWx) dayBranchAdj+=10*_rO;',
        '        else if (WOSHENG[dgWx]===oldWx) dayBranchAdj+=7*_rO;',
        '        else if (WOKE[dgWx]===oldWx) dayBranchAdj+=6*_rO;',
        '        if (newWx===dgWx) dayBranchAdj+=12*_rN;',
        '        else if (SHENGWO[dgWx]===newWx) dayBranchAdj+=8*_rN;',
        '        else if (KEWO[dgWx]===newWx) dayBranchAdj-=10*_rN;',
        '        else if (WOSHENG[dgWx]===newWx) dayBranchAdj-=7*_rN;',
        '        else if (WOKE[dgWx]===newWx) dayBranchAdj-=6*_rN;',
        '      }'
      ].join('\n');
    });
  };
}

var GRID = [];
[1, 0.75, 0.5, 0].forEach(function(rO) {
  [1, 0.75, 0.5, 0].forEach(function(rN) {
    var key = 'O' + Math.round(rO * 100) + 'N' + Math.round(rN * 100);
    GRID.push({ key: key, rO: rO, rN: rN });
  });
});
var PATCHES = {};
GRID.forEach(function(g) { PATCHES[g.key] = makePatchB(g.key, g.rO, g.rN); });

function loadEngine(patchKey) {
  var src = patchKey ? PATCHES[patchKey](baseCode) : baseCode;
  if (patchKey && src.indexOf('CF-P2.1B-' + patchKey) < 0) {
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

// —— 28 盘装载 ——
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

// —— BASE + BASE1(1.0,1.0) 对账 ——
var baseEng = loadEngine(null);
var baseRes = {};
charts.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });
var base1Eng = loadEngine('O100N100');
var base1Mismatch = [];
charts.forEach(function(c) {
  var r = runChart(base1Eng, c);
  if (r.score !== baseRes[c.id].score || r.level !== baseRes[c.id].level ||
      r.yong !== baseRes[c.id].yong || r.xi !== baseRes[c.id].xi || r.ji !== baseRes[c.id].ji) {
    base1Mismatch.push(c.id);
  }
});
if (base1Mismatch.length) throw new Error('O100N100 与未打补丁引擎不一致：' + base1Mismatch.join('、'));
console.log('✅ O100N100 与未打补丁引擎 28/28 逐盘一致（补丁在(1.0,1.0)下行为等价）\n');

var csv = ['变体,编号,八字,旧分,新分,Δ分,旧旺衰,新旺衰,旧用神,新用神,旧喜,新喜,旧忌,新忌'];
var allChanged = {};
console.log('========== 烈度网格波及（与 BASE 对比，|Δ|≥0.5 或喜用忌变化计入）==========');
GRID.forEach(function(g) {
  if (g.key === 'O100N100') return;
  var eng = loadEngine(g.key);
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
      csv.push([g.key, c.id, c.gz.join(' '), base.score, r.score, d, base.level, r.level,
        base.yong, r.yong, base.xi, r.xi, base.ji, r.ji].map(csvQ).join(','));
    }
  });
  allChanged[g.key] = changed;
  console.log('===== ' + g.key + ' 旧侧×' + g.rO + ' 新侧×' + g.rN + '（波及 ' + changed.length + '/28 盘）=====');
  changed.forEach(function(x) {
    var lv = x.base.level === x.r.level ? '' : '  ⚠旺衰 ' + x.base.level + '→' + x.r.level;
    var ys = x.base.yong === x.r.yong ? '' : '  ⚠用神 ' + x.base.yong + '→' + x.r.yong;
    var js = x.base.ji === x.r.ji ? '' : '  ⚠忌 ' + (x.base.ji || '空') + '→' + (x.r.ji || '空');
    console.log('  ' + x.c.id + ' ' + x.c.gz.join(' ') + '  ' + x.base.score + '→' + x.r.score +
      '（' + (x.d > 0 ? '+' : '') + x.d + '）' + lv + ys + js);
  });
  if (!changed.length) console.log('  （无）');
  console.log('  六盘锚点视图：');
  sixTable.forEach(function(s) { console.log(s); });
  console.log('');
});

// —— P15-15 专表：4×4 网格终分/旺衰/用神 + 等效 dayBranchAdj ——
console.log('========== P15-15（癸未 戊午 乙卯 丙戌）烈度网格专表 ==========');
console.log('BASE 全重构终分 = ' + baseRes['P15-15'].score + '；不重构（O0N0）等效于探索期 V1（预期 38）');
console.log('旧侧× / 新侧× 表格（终分 + 旺衰；dayBranchAdj = 新分 - 38）：');
var header = '           ';
[1, 0.75, 0.5, 0].forEach(function(rN) { header += '  新侧×' + rN; });
console.log(header);
[1, 0.75, 0.5, 0].forEach(function(rO) {
  var line = '旧侧×' + rO + '  ';
  [1, 0.75, 0.5, 0].forEach(function(rN) {
    var key = 'O' + Math.round(rO * 100) + 'N' + Math.round(rN * 100);
    var eng = (key === 'O100N100') ? baseEng : loadEngine(key);
    var r = runChart(eng, { id: 'P15-15', gz: ['癸未','戊午','乙卯','丙戌'] });
    var adj = Math.round((r.score - 38) * 100) / 100;
    line += '  ' + r.score + '/' + r.level + '(' + (adj >= 0 ? '+' : '') + adj + ')';
  });
  console.log(line);
});
console.log('（旺衰边界：<30极弱 / 30-39偏弱 / 40-59中和 / 60-79偏强 / ≥80极强；38=V1合而不化基线）');

fs.writeFileSync(path.join(ROOT, '_p2_1b.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n已写入 _p2_1b.csv（' + (csv.length - 1) + ' 行波及明细）');
