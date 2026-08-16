// P5-C07 EVIDENCE（2026-08-16，GPT 指定下一刀）：喜/用/忌全覆盖 + 强弱等级的阈值设计依据。
// 盘集（GPT 指定）：A03 甲申庚午甲子乙丑 + D11 戊子丁巳癸亥庚申 + 50 blind + P5-C06 差异盘（c05/impact/hist 去重）。
// 目标：统计 S_need 分布——悬空（[-3,3] 带内非用神）规模/符号、用神与喜忌的 S_need 量级、
//       为「弱喜/喜/强喜、弱忌/忌/强忌」阈值设计提供数据。EVIDENCE ONLY 零引擎改动。
// 输出：_p5/p5c07-sneed-evidence.json
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
function loadEngineSrc(src) {
  var context = { window: {} };
  vm.runInNewContext(src, context);
  return context.window.BaZiCalculator;
}
var ENG = loadEngineSrc(fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8'));
var WX = ['木', '火', '土', '金', '水'];

function buildPillars(gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

// ---- 盘集 ----
var DISKS = [];
DISKS.push({ id: 'A03', gz: '甲申 庚午 甲子 乙丑', set: '锚点' });
DISKS.push({ id: 'D11', gz: '戊子 丁巳 癸亥 庚申', set: '锚点' });
var blindCount = 0;
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm;
  var m;
  while ((m = re.exec(md)) !== null) {
    DISKS.push({ id: m[1], gz: m[2], set: '50blind' });
    blindCount++;
  }
});
if (blindCount !== 50) throw new Error('50 盲测解析数量异常: ' + blindCount);
// P5-C06 差异盘（c05/impact/hist 去重，24 盘）
var vout = JSON.parse(fs.readFileSync(path.join(ROOT, '_p5/p5c06-verify-output.json'), 'utf8'));
var seen = {};
var diffCount = 0;
['c05', 'impact', 'hist'].forEach(function (sec) {
  (vout[sec].changes || []).forEach(function (c) {
    if (seen[c.gz]) return;
    seen[c.gz] = true;
    DISKS.push({ id: sec + '-' + (++diffCount), gz: c.gz, set: 'P5-C06差异', oldCls: c.cls });
  });
});

// ---- 逐盘提取 ----
var perDisk = [];
var bandEls = [];   // [-3,3] 带内且非用神的元素
var allSNeed = [];  // 全部元素-disk 的 SNeed
var congSkip = 0, noCs = 0;
DISKS.forEach(function (d) {
  var b = buildPillars(d.gz);
  var yj = ENG.getYongJi(b);
  var cs = yj.candidateScores;
  if (!cs || !cs.length) { noCs++; return; } // 从格/穷通短路盘无候选评分，另行记账
  var byWx = {};
  cs.forEach(function (c) { byWx[c.wx] = c; });
  var yongWx = yj.yongShen && yj.yongShen[0];
  var xi = (yj.xiShen || []).slice();
  var ji = (yj.jiShen || []).slice();
  var dangling = WX.filter(function (w) { return w !== yongWx && xi.indexOf(w) < 0 && ji.indexOf(w) < 0; });
  var row = {
    id: d.id, gz: d.gz, set: d.set,
    dmLevel: yj.dayMasterLevel, dmScore: yj.dayMasterScore, cong: !!(yj.congGe && yj.congGe.name),
    yongWx: yongWx, xi: xi, ji: ji, dangling: dangling,
    el: {}
  };
  WX.forEach(function (w) {
    var c = byWx[w];
    if (!c) return;
    var sn = c.SNeed;
    row.el[w] = { SNeed: sn, L1: c.L1, L2: c.L2, L3: c.L3, L4: c.L4, rootQ: c.rootQuality, role: c.role };
    allSNeed.push({ gz: d.gz, set: d.set, w: w, sn: sn, role: c.role });
    if (w !== yongWx && sn >= -3 && sn <= 3) {
      bandEls.push({ id: d.id, gz: d.gz, set: d.set, w: w, sn: sn, role: c.role, dmLevel: yj.dayMasterLevel });
    }
  });
  perDisk.push(row);
});

// ---- 聚合 ----
function q(arr) { // 分位数（min/p25/med/p75/max）
  if (!arr.length) return null;
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var qAt = function (p) { return s[Math.min(s.length - 1, Math.round((s.length - 1) * p))]; };
  return { n: s.length, min: s[0], p25: qAt(0.25), med: qAt(0.5), p75: qAt(0.75), max: s[s.length - 1] };
}
var allVals = allSNeed.map(function (x) { return x.sn; });
var bandVals = bandEls.map(function (x) { return x.sn; });
var bandPos = bandEls.filter(function (x) { return x.sn > 0; });
var bandNeg = bandEls.filter(function (x) { return x.sn < 0; });
var bandZero = bandEls.filter(function (x) { return x.sn === 0; });

// 直方图
var bins = [[-1e9, -9], [-9, -6], [-6, -3], [-3, 0], [0, 3], [3, 6], [6, 9], [9, 1e9]];
var hist = bins.map(function (r) {
  var c = allVals.filter(function (v) { return v >= r[0] && v < r[1]; }).length;
  return { range: r[0] + '~' + r[1], n: c };
});
hist[0].range = '<-9'; hist[hist.length - 1].range = '>=9';

// 用神 / 喜 / 忌 SNeed 量级
var yongVals = [], xiVals = [], jiVals = [];
perDisk.forEach(function (d) {
  if (d.el[d.yongWx]) yongVals.push(d.el[d.yongWx].SNeed);
  d.xi.forEach(function (w) { if (d.el[w]) xiVals.push(d.el[w].SNeed); });
  d.ji.forEach(function (w) { if (d.el[w]) jiVals.push(d.el[w].SNeed); });
});

// 悬空规模
var disksWithDangling = perDisk.filter(function (d) { return d.dangling.length > 0; });
var danglingPerDisk = disksWithDangling.map(function (d) { return d.dangling.length; });

// 悬空符号分布（按盘集）
var bandBySet = {};
bandEls.forEach(function (e) {
  bandBySet[e.set] = bandBySet[e.set] || { n: 0, pos: 0, neg: 0, zero: 0 };
  bandBySet[e.set].n++;
  if (e.sn > 0) bandBySet[e.set].pos++;
  else if (e.sn < 0) bandBySet[e.set].neg++;
  else bandBySet[e.set].zero++;
});

var out = {
  meta: { date: '2026-08-16', engine: 'workspace post-C06', disks: DISKS.length,
    noCandidateScores: noCs, congSkip: congSkip },
  hist: hist,
  allSNeed: q(allVals),
  band: { n: bandEls.length, q: q(bandVals), pos: bandPos.length, neg: bandNeg.length, zero: bandZero.length },
  bandBySet: bandBySet,
  yong: q(yongVals), xi: q(xiVals), ji: q(jiVals),
  dangling: { disksWithDangling: disksWithDangling.length, totalDisks: perDisk.length,
    perDiskQ: q(danglingPerDisk),
    worst: disksWithDangling.slice().sort(function (a, b) { return b.dangling.length - a.dangling.length; }).slice(0, 8).map(function (d) {
      return { id: d.id, gz: d.gz, set: d.set, dangling: d.dangling.map(function (w) {
        return w + ':' + (d.el[w] ? d.el[w].SNeed : '?'); }).join(',') };
    }) },
  bandSamples: bandEls.map(function (e) { return { id: e.id, set: e.set, w: e.w, sn: e.sn, role: e.role, dm: e.dmLevel }; }),
  perDisk: perDisk
};
fs.writeFileSync(path.join(__dirname, 'p5c07-sneed-evidence.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('OK disks=' + DISKS.length + ' parsed=' + perDisk.length + ' noCs=' + noCs
  + ' allSNeed=' + allSNeed.length + ' band=' + bandEls.length
  + ' (pos=' + bandPos.length + ' neg=' + bandNeg.length + ' zero=' + bandZero.length + ')'
  + ' danglingDisks=' + disksWithDangling.length + '/' + perDisk.length
  + ' yongQ=' + JSON.stringify(q(yongVals)) + ' xiQ=' + JSON.stringify(q(xiVals)) + ' jiQ=' + JSON.stringify(q(jiVals)));
