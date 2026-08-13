// P2 设计阶段·反事实回归实验（引擎零改动——所有变体均为内存补丁 eval）
// 28 盘 = 22 盘基线（_baseline_22.csv）+ P1.5 六盘（_p15_charts.txt）
// 变体（初值权重仅用于测波及面，非定案）：
//   V1 日支合化重构禁用（合而不化）
//   V2 ②得地扩展：月/时支通根半权（同五行+6/印+4/官杀-4/财-3/食伤-3）
//   V3 ⑧½分级：年干印 +6（月/时干印、日支藏印仍 +13）
//   V4 ⑤半权：囚令反耗×8→×4，休令泄气×4→×2
//   V5 ⑧段叠加封顶：该段合计罚分不超过 -10
//   V6 日支合化半权（合而趋化折中）
//   V7 ⑤官杀成势半权罚：-(count-1)×4 试探
//   V8 非对称得地扩展（方案草案初值）：月/时支只计生扶侧（同五行+6、印+4）
// 另：BASE 每盘 ⑧ 段合计罚分（冲/合/半会/日支重构叠加观察）
// 用法: node _p2_counterfactual.js
global.window = global;
global.document = {};

var fs = require('fs'), path = require('path'), ROOT = __dirname;
var baseCode = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf-8');

var VARIANT_PATCHES = {
  V1: function(src) { // 合而不化：禁用日支合化重构
    return src.replace('score += dayBranchAdj;', 'score += 0; // CF-V1');
  },
  V2: function(src) { // 得地扩展：月/时支半权
    return src.replace(
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）",
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）\n" +
      "  // CF-V2: 月/时支通根半权\n" +
      "  ['month','hour'].forEach(function(_p2) {\n" +
      "    var _zw2 = DI_ZHI_WU_XING[bazi[_p2].zhi];\n" +
      "    if (_zw2 === dgWx) score += 6;\n" +
      "    else if (SHENGWO[dgWx] === _zw2) score += 4;\n" +
      "    else if (KEWO[dgWx] === _zw2) score -= 4;\n" +
      "    else if (WOKE[dgWx] === _zw2) score -= 3;\n" +
      "    else if (WOSHENG[dgWx] === _zw2) score -= 3;\n" +
      "  });"
    );
  },
  V3: function(src) { // ⑧½分级：年干印半权（bazi.js 为 CRLF，必须用 \r?\n 匹配）
    return src.replace(
      /if \(_yinAdjacent && _hasCSL\) \{\r?\n\s*score \+= 13;/,
      "var _yinGrade = _yinAdjacent ? 13 : (SHENGWO[dgWx] === WU_XING[bazi.year.gan] ? 6 : 0); // CF-V3\n    if (_yinGrade && _hasCSL) {\n      score += _yinGrade;"
    );
  },
  V4: function(src) { // ⑤半权（囚令×8→×4、休令×4→×2；第二处须带注释原文，否则会误命中已被改写的囚令行）
    return src
      .replace('score -= (mwxCount - 1) * 8;', 'score -= (mwxCount - 1) * 4; // CF-V4')
      .replace('score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重', 'score -= (mwxCount - 1) * 2; // 休令：日主生月令泄气过重 // CF-V4');
  },
  V6: function(src) { // 日支合化半权
    return src.replace('score += dayBranchAdj;', 'score += dayBranchAdj / 2; // CF-V6');
  },
  V5: function(src) { // ⑧段叠加封顶：该段合计罚分不超过 -10（测关系叠加无上限问题）
    var m8 = '// ---------- ⑧ 地支合冲刑害修正';
    var m8h = '// ---------- ⑧½ 杀印相生结构修正';
    src = src.replace(m8, m8 + '\n  global.__cfv5seg = score; // CF-V5');
    src = src.replace(m8h, 'if (global.__cfv5seg !== undefined && score < global.__cfv5seg - 10) score = global.__cfv5seg - 10; // CF-V5\n  ' + m8h);
    return src;
  },
  V7: function(src) { // ⑤官杀成势罚（半权试探：-(count-1)×4，与休令同档）
    return src.replace(
      'else if (WOSHENG[dgWx] === mwx) score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重',
      'else if (WOSHENG[dgWx] === mwx) score -= (mwxCount - 1) * 4; // 休令：日主生月令泄气过重\n    else if (KEWO[dgWx] === mwx) score -= (mwxCount - 1) * 4; // CF-V7 试探：官杀成势半权罚（初值，非定案）'
    );
  },
  V8: function(src) { // 非对称得地扩展（方案草案初值）：月/时支只计生扶侧（同五行+6、印+4），克泄耗不计
    return src.replace(
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）",
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）\n" +
      "  // CF-V8: 非对称得地扩展——月/时支只计生扶侧，克泄耗侧维持现状（④藏干）\n" +
      "  ['month','hour'].forEach(function(_p8) {\n" +
      "    var _zw8 = DI_ZHI_WU_XING[bazi[_p8].zhi];\n" +
      "    if (_zw8 === dgWx) score += 6;\n" +
      "    else if (SHENGWO[dgWx] === _zw8) score += 4;\n" +
      "  });"
    );
  },
  V9: function(src) { // 强根档选择性扩展：月/时支仅当为日主禄/长生/帝旺位时 +6
    return src.replace(
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）",
      "else if (WOSHENG[dgWx] === dayZhiWx) score -= 7;  // 日主生日支（我生为泄，泄气）\n" +
      "  // CF-V9: 强根档选择性扩展——月/时支仅禄/长生/帝旺位 +6\n" +
      "  var _LU9 = {'甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子'};\n" +
      "  var _CS9 = {'甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯'};\n" +
      "  var _DW9 = {'甲':'卯','乙':'寅','丙':'午','丁':'巳','戊':'午','己':'巳','庚':'酉','辛':'申','壬':'子','癸':'亥'};\n" +
      "  ['month','hour'].forEach(function(_p9) {\n" +
      "    var _z9 = bazi[_p9].zhi;\n" +
      "    if (_z9 === _LU9[dg] || _z9 === _CS9[dg] || _z9 === _DW9[dg]) score += 6;\n" +
      "  });"
    );
  }
};

function loadEngine(patchKey) {
  var src = patchKey ? VARIANT_PATCHES[patchKey](baseCode) : baseCode;
  if (patchKey && src.indexOf('CF-' + patchKey) < 0) {
    throw new Error('变体 ' + patchKey + ' 的补丁未生效（replace 未匹配源码，可能行尾/空白不符）');
  }
  var stitched = '';
  ['getYongJi','calcDayMasterStrength','getCongGe','getPattern'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  return { dm: global.calcDayMasterStrength, yj: global.getYongJi, cong: global.getCongGe, pat: global.getPattern };
}

// 读 22 盘基线（CSV 第1列编号、第2列八字）
var charts = [];
fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf-8').split('\n').slice(1).forEach(function(line) {
  line = line.trim();
  if (!line) return;
  var cells = line.split(',').map(function(s) { return s.replace(/^"|"$/g, ''); });
  if (cells.length < 2 || !cells[1]) return;
  var gz = cells[1].split(/\s+/);
  if (gz.length === 4) charts.push({ id: cells[0], gz: gz });
});
// 只取 P1.5 六盘永久回归样本（注意：_p15_charts.txt 含 20 盘，不能全载）
var SIX_IDS = ['P15-03','P15-09','P15-12','P15-14','P15-15','P15-16'];
fs.readFileSync(path.join(ROOT, '_p15_charts.txt'), 'utf-8').split('\n').forEach(function(line) {
  line = line.trim();
  if (!line || line[0] === '#') return;
  var parts = line.split(/\s+/);
  if (parts.length === 5 && SIX_IDS.indexOf(parts[0]) >= 0) charts.push({ id: parts[0], gz: parts.slice(1) });
});
if (charts.length !== 28) throw new Error('样本数异常：' + charts.length + '≠28（预期22基线+六盘）');

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

// BASE ⑧段合计（冲/合/半会/日支重构叠加观察）
(function() {
  var src = baseCode;
  var m8 = '// ---------- ⑧ 地支合冲刑害修正';
  var m8h = '// ---------- ⑧½ 杀印相生结构修正';
  if (src.indexOf(m8) < 0 || src.indexOf(m8h) < 0) throw new Error('⑧ marker not found');
  var i8 = src.indexOf(m8), i8h = src.indexOf(m8h);
  src = src.slice(0, i8) + "global.__T8=[score];\n  " + src.slice(i8, i8h) + "global.__T8.push(score);\n  " + src.slice(i8h);
  src = src.replace('var score = 50;', 'var score = 50;\n  global.__T8 = [];');
  var stitched = '';
  ['calcDayMasterStrength'].forEach(function(name) {
    stitched += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
  });
  src = src.replace('window.BaZiCalculator = {', stitched + '\nwindow.BaZiCalculator = {');
  eval(src);
  var t8rows = charts.map(function(c) {
    var b = toBazi(c.gz);
    global.__T8 = [];
    global.calcDayMasterStrength(b);
    return { id: c.id, t8: global.__T8.length >= 2 ? global.__T8[1] - global.__T8[0] : null };
  });
  console.log('—— BASE ⑧段合计罚分分布（' + charts.length + '盘）——');
  t8rows.filter(function(r) { return r.t8 !== null && r.t8 < 0; }).sort(function(a,b){return a.t8-b.t8;})
    .forEach(function(r) { console.log('  ' + r.id + ' ' + r.t8); });
  console.log('  —— ⑧段合计为正（合化利好）：');
  t8rows.filter(function(r){return r.t8!==null && r.t8>0;}).sort(function(a,b){return b.t8-a.t8;})
    .forEach(function(r){ console.log('  ' + r.id + ' +' + r.t8); });
  console.log('  ⑧段合计为正盘数: ' + t8rows.filter(function(r){return r.t8>0;}).length + '，为0盘数: ' + t8rows.filter(function(r){return r.t8===0;}).length);
  console.log('');
})();

// 变体跑
var csv = ['变体,编号,八字,旧分,新分,Δ分,旧旺衰,新旺衰,旧用神,新用神'];
var baseEng = loadEngine(null);
var baseRes = {};
charts.forEach(function(c) { baseRes[c.id] = runChart(baseEng, c); });

Object.keys(VARIANT_PATCHES).forEach(function(key) {
  var eng = loadEngine(key);
  var changed = [];
  charts.forEach(function(c) {
    var r = runChart(eng, c);
    var base = baseRes[c.id];
    var d = r.score - base.score;
    if (Math.abs(d) >= 2 || r.yong !== base.yong) {
      changed.push({ c: c, r: r, d: d, base: base });
      csv.push([key, c.id, c.gz.join(' '), base.score, r.score, d, base.level, r.level, base.yong, r.yong]);
    }
  });
  console.log('===== ' + key + '（波及 ' + changed.length + '/' + charts.length + ' 盘）=====');
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
  console.log('  小结：升 ' + ups + ' 盘 / 降 ' + (changed.length-ups) + ' 盘；旺衰标签翻转 ' + lvFlips + ' 盘；用神翻转 ' + ysFlips + ' 盘');
  console.log('');
});

fs.writeFileSync(path.join(ROOT, '_p2_counterfactual.csv'), '﻿' + csv.join('\n'), 'utf-8');
console.log('已写入 _p2_counterfactual.csv（' + (csv.length - 1) + ' 行变化明细）');
