// P2.1 第三轮·真化烈度网格（2026-08-13，GPT 第三轮裁决第4节）
// 资格侧先行：真化集由 GPT 标签圈定 = H01 H02 H03 H07 H10 H13 H14（7盘，与 H06/H18 归属无关）。
// originalResidual r = 原支贡献保留比例 ∈ {0, 0.25, 0.5, 0.75}
//   ≡ 旧侧退还系数 rO = 1 - r ∈ {1, 0.75, 0.5, 0.25}
// newEffect e = 新化神作用比例 ∈ {0.5, 0.75, 1.0}
// 独立网格 4×3 = 12 单元；rO=1,e=1 为恒等单元，与未打补丁引擎 28+7 盘逐盘对账。
// 评价指标：旺衰分变化 / 五档翻转 / P1用神翻转 / 22盘基线影响 / 六盘冻结锚点 / 正负向对称。
// 纪律：只报告，不推荐任何单元；不以任何单盘跨 30/40/60/70 线为优化目标。
// 全部内存补丁 + CF 标记断言；引擎 js/bazi.js 零改动。
// 用法: node _p2_1e_intensity_grid.js
// 产物: _p2_1e.csv
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

// —— 烈度补丁（同 1b 技术：替换 dayBranchAdj 计算块，旧侧×rO、新侧×rN）——
var BLOCK_RE = /if \(oldWx!==newWx\) \{\r?\n\s*\/\/ 退还旧五行得地分，计入新五行得地分\r?\n[\s\S]*?else if \(WOKE\[dgWx\]===newWx\) dayBranchAdj-=6;\r?\n(\s*)\}/;
function makePatchE(key, rO, rN) {
  return function(src) {
    return src.replace(BLOCK_RE, function(m, ind) {
      return [
        'if (oldWx!==newWx) {',
        '        // CF-P2.1E-' + key + '：烈度探针 旧侧退还×' + rO + '(originalResidual=' + (1 - rO) + ') 新侧计入×' + rN + '（资格条件不变）',
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

// —— 网格：originalResidual r ∈ {0,0.25,0.5,0.75} × newEffect e ∈ {0.5,0.75,1.0} ——
var GRID = [];
[1, 0.75, 0.5, 0.25].forEach(function(rO) {            // rO = 1 - originalResidual
  [1, 0.75, 0.5].forEach(function(rN) {                // newEffect
    var r = 1 - rO;
    var key = 'R' + Math.round(r * 100) + 'E' + Math.round(rN * 100);
    GRID.push({ key: key, rO: rO, rN: rN, residual: r, effect: rN });
  });
});
var PATCHES = {};
GRID.forEach(function(g) { PATCHES[g.key] = makePatchE(g.key, g.rO, g.rN); });

function loadEngine(patchKey) {
  var src = patchKey ? PATCHES[patchKey](baseCode) : baseCode;
  if (patchKey && src.indexOf('CF-P2.1E-' + patchKey) < 0) {
    throw new Error('变体 ' + patchKey + ' 的补丁未生效（replace 未匹配源码）');
  }
  var stitched = '';
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  return { dm: global.calcDayMasterStrength, yj: global.getYongJi };
}

// —— 28 盘（22基线 + 六盘冻结锚点）装载，同 1b ——
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

// —— GPT 真化 7 盘（第三轮裁决标签；均不涉及午未，引擎口径===经典口径；adj=1c 钉死的 BASE dayBranchAdj）——
var TRUE7 = [
  { id: 'H01', gz: ['癸未','戊午','乙卯','丙戌'], adj: -19 },
  { id: 'H02', gz: ['戊辰','甲寅','丁亥','庚子'], adj: 18 },
  { id: 'H03', gz: ['甲寅','戊辰','壬子','辛丑'], adj: -22 },
  { id: 'H07', gz: ['己丑','丙寅','丁亥','甲辰'], adj: 18 },
  { id: 'H10', gz: ['癸未','丁巳','丙戌','辛卯'], adj: 19 },
  { id: 'H13', gz: ['壬寅','丙午','丙戌','辛卯'], adj: 19 },
  { id: 'H14', gz: ['乙丑','己丑','壬子','辛丑'], adj: -22 }
];
var ALL = charts28.concat(TRUE7); // 35 盘

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

// —— BASE 与恒等单元对账 ——
var baseEng = loadEngine(null);
var baseRes = {};
ALL.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });
var idEng = loadEngine('R0E100');
var idMismatch = [];
ALL.forEach(function(c) {
  var r = runChart(idEng, c);
  if (r.score !== baseRes[c.id].score || r.level !== baseRes[c.id].level ||
      r.yong !== baseRes[c.id].yong || r.xi !== baseRes[c.id].xi || r.ji !== baseRes[c.id].ji) {
    idMismatch.push(c.id);
  }
});
if (idMismatch.length) throw new Error('R0E100 与未打补丁引擎不一致：' + idMismatch.join('、'));
console.log('✅ 恒等单元 R0E100(rO=1,e=1) 与未打补丁引擎 35/35 逐盘一致\n');

// 真化 7 盘 BASE 概况（含未重构基线分）
var base7 = {};
TRUE7.forEach(function(c) { base7[c.id] = baseRes[c.id]; });
// 参考补丁 rO=0,rN=0（adj=0）：实测未重构基线分（注意 BASE 分可能被 100/1 钳位，不能用 BASE-adj 反推）
PATCHES['ZERO'] = makePatchE('ZERO', 0, 0);
var zeroEng = loadEngine('ZERO');
var UNREC = {};
ALL.forEach(function(c) { UNREC[c.id] = runChart(zeroEng, c).score; });
console.log('========== 真化 7 盘 BASE 概况（现行引擎 = originalResidual 0 / newEffect 1.0）==========');
TRUE7.forEach(function(c) {
  var b = base7[c.id];
  console.log('  ' + c.id + ' ' + b.gz + '  BASE=' + b.score + '/' + b.level + '（含重构）');
});

var csv = ['变体,originalResidual,newEffect,盘,八字,BASE分,新分,Δ分,未重构基线分,BASE旺衰,新旺衰,BASE用神,新用神,BASE喜,新喜,BASE忌,新忌'];
var gridChanged = {};
console.log('\n========== 各变体波及（35盘：22基线+6锚点+真化7盘）==========');
GRID.forEach(function(g) {
  if (g.key === 'R0E100') return;
  var eng = loadEngine(g.key);
  var changed = [], sixReport = [];
  ALL.forEach(function(c) {
    var r = runChart(eng, c);
    var b = baseRes[c.id];
    var d = Math.round((r.score - b.score) * 100) / 100;
    var yxjChange = r.yong !== b.yong || r.xi !== b.xi || r.ji !== b.ji;
    if (SIX[c.id]) {
      var a = SIX[c.id];
      var breaks = [];
      if (r.yong !== a.yong) breaks.push('用神' + r.yong + '≠' + a.yong);
      if (r.xi !== a.xi) breaks.push('喜神' + r.xi + '≠' + a.xi);
      if (r.ji !== a.ji) breaks.push('忌神' + r.ji + '≠' + a.ji);
      sixReport.push('  ' + c.id + ' ' + b.score + '→' + r.score + '（' + (d > 0 ? '+' : '') + d + '）' +
        (breaks.length ? '  ⚠' + breaks.join('；') : ' 锚点✓'));
    }
    if (Math.abs(d) >= 0.5 || yxjChange) {
      changed.push({ c: c, r: r, d: d, b: b });
      var t7 = TRUE7.filter(function(t){ return t.id === c.id; })[0];
      csv.push([g.key, g.residual, g.effect, c.id, c.gz.join(' '), b.score, r.score, d,
        t7 ? UNREC[c.id] : '', b.level, r.level,
        b.yong, r.yong, b.xi, r.xi, b.ji, r.ji].map(csvQ).join(','));
    }
  });
  gridChanged[g.key] = changed;
  console.log('===== ' + g.key + '（originalResidual=' + g.residual + ' newEffect=' + g.effect + '，波及 ' + changed.length + '/35 盘）=====');
  changed.forEach(function(x) {
    var lv = x.b.level === x.r.level ? '' : '  ⚠旺衰 ' + x.b.level + '→' + x.r.level;
    var ys = x.b.yong === x.r.yong ? '' : '  ⚠用神 ' + x.b.yong + '→' + x.r.yong;
    console.log('  ' + x.c.id + ' ' + x.c.gz.join(' ') + '  ' + x.b.score + '→' + x.r.score +
      '（' + (x.d > 0 ? '+' : '') + x.d + '）' + lv + ys);
  });
  console.log('  六盘锚点视图：');
  sixReport.forEach(function(s) { console.log(s); });
  console.log('');
});

// —— 硬断言：28 盘内仅 P15-15 受影响；5 个非 P15-15 锚点零变化 ——
GRID.forEach(function(g) {
  if (g.key === 'R0E100') return;
  gridChanged[g.key].forEach(function(x) {
    var is28 = charts28.filter(function(c){ return c.id === x.c.id; }).length > 0;
    if (is28 && x.c.id !== 'P15-15') {
      throw new Error('变体 ' + g.key + ' 波及 28 盘内非 P15-15 盘：' + x.c.id + '（违反基线隔离预期）');
    }
  });
  var p1515 = gridChanged[g.key].filter(function(x){ return x.c.id === 'P15-15'; })[0];
  if (!p1515) throw new Error('变体 ' + g.key + ' 未波及 P15-15（预期唯一受影响基线盘）');
});
console.log('✅ 硬断言通过：全部变体在 28 盘内仅 P15-15 受影响；其余 5 个冻结锚点零变化\n');

// —— 真化 7 盘专表：4×3 网格 ——
console.log('========== 真化 7 盘 烈度网格（每单元：Δ分/新旺衰；未重构基线分在首列）==========');
TRUE7.forEach(function(t) {
  var b = base7[t.id];
  console.log('\n【' + t.id + '】' + b.gz + '  BASE=' + b.score + '/' + b.level +
    '（未重构基线实测=' + UNREC[t.id] + (b.score - t.adj !== UNREC[t.id] ? '；BASE 分受钳位，非 adj 反推' : '）'));
  var header = '            ';
  [1, 0.75, 0.5].forEach(function(rN) { header += '   newEffect×' + rN; });
  console.log(header);
  [1, 0.75, 0.5, 0.25].forEach(function(rO) {
    var line = 'residual=' + (1 - rO) + '  ';
    [1, 0.75, 0.5].forEach(function(rN) {
      var key = 'R' + Math.round((1 - rO) * 100) + 'E' + Math.round(rN * 100);
      if (key === 'R0E100') { line += '  BASE/' + b.level; return; }
      var eng = loadEngine(key);
      var r = runChart(eng, t);
      var d = Math.round((r.score - b.score) * 100) / 100;
      line += '  ' + (d > 0 ? '+' : '') + d + '/' + r.level;
    });
    console.log(line);
  });
});

// —— 正负向对称性 ——
console.log('\n========== 正负向对称性（正向盘 Δ 恒≤0，负向盘 Δ 恒≥0；朝未重构基线回归）==========');
var POS_IDS = ['H02','H07','H10','H13'], NEG_IDS = ['H01','H03','H14'];
GRID.forEach(function(g) {
  if (g.key === 'R0E100') return;
  var posSum = 0, negSum = 0, bad = [];
  gridChanged[g.key].forEach(function(x) {
    if (POS_IDS.indexOf(x.c.id) >= 0) { posSum += x.d; if (x.d > 0) bad.push(x.c.id + 'Δ' + x.d); }
    if (NEG_IDS.indexOf(x.c.id) >= 0) { negSum += x.d; if (x.d < 0) bad.push(x.c.id + 'Δ' + x.d); }
  });
  console.log('  ' + g.key + '（r=' + g.residual + ' e=' + g.effect + '）：正向4盘ΣΔ=' + Math.round(posSum * 100) / 100 +
    '，负向3盘ΣΔ=+' + Math.round(negSum * 100) / 100 +
    (bad.length ? '  ⚠方向异常:' + bad.join(',') : '  ✓方向一致'));
});

fs.writeFileSync(path.join(ROOT, '_p2_1e.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('\n已写入 _p2_1e.csv（' + (csv.length - 1) + ' 行波及明细）');
