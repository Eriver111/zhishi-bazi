// P2 第一批实现候选·逐项反事实（GPT 2026-08-13 总裁决：只批准 P2.1/P2.2/P2.3 进入实现候选）
// 全部内存补丁，引擎零改动；每项独立跑 28 盘 diff + 六盘锚点视图，另有三项组合预览
//   P21 合化三档：真化1.0 / 趋化0.5（未透干或合局被强冲破坏→趋化；不得月令=合而不化，现状已不重构）
//   P22 ⑤半权：囚令×8→×4、休令×4→×2（=探索期 V4）
//   P23 ⑧½印星介入分级：A贴身印+13 / B年干印有根或得生+6 / C年干印无根+3 / 无印0
// 用法: node _p2_batch1.js
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

var PATCHES = {
  P21: function(src) { // 合化三档（只动日支重构块）
    var re = /if \(oldWx!==newWx\) \{\r?\n\s*\/\/ 退还旧五行得地分，计入新五行得地分\r?\n[\s\S]*?else if \(WOKE\[dgWx\]===newWx\) dayBranchAdj-=6;\r?\n(\s*)\}/;
    return src.replace(re, function(m, ind) {
      return [
        'if (oldWx!==newWx) {',
        '        // CF-P21 合化三档：化神透干(年/月/时干)且合局无强冲破坏→真化1.0，否则趋化0.5',
        "        var _tou21 = ['year','month','hour'].some(function(_p21a){ return WU_XING[bazi[_p21a].gan] === newWx; });",
        '        var _chong21 = false;',
        "        ['year','month','day','hour'].forEach(function(_p21b) { if (chongMap[bazi[_p21b].zhi] === he.z1 || chongMap[bazi[_p21b].zhi] === he.z2) _chong21 = true; });",
        '        var _f21 = (_tou21 && !_chong21) ? 1 : 0.5;',
        '        var _pair21 = 0;',
        '        if (oldWx===dgWx) _pair21-=12;',
        '        else if (SHENGWO[dgWx]===oldWx) _pair21-=8;',
        '        else if (KEWO[dgWx]===oldWx) _pair21+=10;',
        '        else if (WOSHENG[dgWx]===oldWx) _pair21+=7;',
        '        else if (WOKE[dgWx]===oldWx) _pair21+=6;',
        '        if (newWx===dgWx) _pair21+=12;',
        '        else if (SHENGWO[dgWx]===newWx) _pair21+=8;',
        '        else if (KEWO[dgWx]===newWx) _pair21-=10;',
        '        else if (WOSHENG[dgWx]===newWx) _pair21-=7;',
        '        else if (WOKE[dgWx]===newWx) _pair21-=6;',
        '        dayBranchAdj += _pair21 * _f21;',
        '      }'
      ].join('\n');
    });
  },
  P22: function(src) { // ⑤半权（GPT P2-Q4 批准：囚×4/休×2）
    return src
      .replace('score -= (mwxCount - 1) * 8;', 'score -= (mwxCount - 1) * 4; // CF-P22')
      .replace('score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重', 'score -= (mwxCount - 1) * 2; // 休令：日主生月令泄气过重 // CF-P22');
  },
  P23: function(src) { // ⑧½印星介入分级（GPT P2-Q3 批准：A+13/B+6/C+3/0）
    return src.replace(
      /if \(_yinAdjacent && _hasCSL\) \{\r?\n\s*score \+= 13;/,
      [
        "var _yinYear23 = (SHENGWO[dgWx] === WU_XING[bazi.year.gan]);",
        "var _yinRooted23 = false;",
        "['year','month','day','hour'].forEach(function(_p23) {",
        "  if (DI_ZHI_WU_XING[bazi[_p23].zhi] === SHENGWO[dgWx]) _yinRooted23 = true;",
        "  getCangGan(bazi[_p23].zhi).forEach(function(_g23) { if (WU_XING[_g23] === SHENGWO[dgWx]) _yinRooted23 = true; });",
        "});",
        "var _yinFed23 = ['year','month','hour'].some(function(_p23b) { return WU_XING[bazi[_p23b].gan] === KEWO[dgWx]; });",
        "var _grade23 = 0;",
        "if (_yinAdjacent) _grade23 = 13;",
        "else if (_yinYear23 && (_yinRooted23 || _yinFed23)) _grade23 = 6;",
        "else if (_yinYear23) _grade23 = 3;",
        "if (_grade23 && _hasCSL) {",
        "  score += _grade23; // CF-P23"
      ].join('\n')
    );
  },
  ALL: function(src) { // 三项组合预览
    return PATCHES.P23(PATCHES.P22(PATCHES.P21(src)));
  }
};

function loadEngine(patchKey) {
  var src = patchKey ? PATCHES[patchKey](baseCode) : baseCode;
  if (patchKey && src.indexOf('CF-' + patchKey.replace('ALL', 'P21')) < 0 && patchKey !== 'ALL') {
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

// 读盘（22 基线 + P15 六盘）
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

// 六盘冻结锚点（用神/喜忌/格局须不变；终分/旺衰变化如实报告）
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

var csv = ['变体,编号,八字,旧分,新分,Δ分,旧旺衰,新旺衰,旧用神,新用神'];
var baseEng = loadEngine(null);
var baseRes = {};
charts.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });

Object.keys(PATCHES).forEach(function(key) {
  var eng = loadEngine(key);
  var changed = [];
  var sixTable = [];
  charts.forEach(function(c) {
    var r = runChart(eng, c);
    var base = baseRes[c.id];
    var d = r.score - base.score;
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
    if (Math.abs(d) >= 2 || r.yong !== base.yong) {
      changed.push({ c: c, r: r, d: d, base: base });
      csv.push([key, c.id, c.gz.join(' '), base.score, r.score, d, base.level, r.level, base.yong, r.yong]);
    }
  });
  console.log('===== ' + key + '（波及 ' + changed.length + '/28 盘）=====');
  changed.forEach(function(x) {
    var lv = x.base.level === x.r.level ? '' : '  ⚠旺衰 ' + x.base.level + '→' + x.r.level;
    var ys = x.base.yong === x.r.yong ? '' : '  ⚠用神 ' + x.base.yong + '→' + x.r.yong;
    console.log('  ' + x.c.id + ' ' + x.c.gz.join(' ') + '  ' + x.base.score + '→' + x.r.score +
      '（' + (x.d > 0 ? '+' : '') + x.d + '）' + lv + ys);
  });
  if (!changed.length) console.log('  （无）');
  var ups = changed.filter(function(x){return x.d>0;}).length;
  var lvFlips = changed.filter(function(x){return x.base.level!==x.r.level;}).length;
  var ysFlips = changed.filter(function(x){return x.base.yong!==x.r.yong;}).length;
  console.log('  小结：升 ' + ups + ' 盘 / 降 ' + (changed.length-ups) + ' 盘；旺衰标签翻转 ' + lvFlips + ' 盘；用神翻转 ' + ysFlips + ' 盘（红线：> ' + Math.floor(charts.length/3) + '/' + charts.length + ' 即触发 GPT 全局规则暂停）');
  console.log('  六盘锚点视图：');
  sixTable.forEach(function(s) { console.log(s); });
  console.log('');
});

fs.writeFileSync(path.join(ROOT, '_p2_batch1.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('已写入 _p2_batch1.csv（' + (csv.length - 1) + ' 行变化明细）');
