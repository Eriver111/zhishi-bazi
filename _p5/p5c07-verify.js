// P5-C07 实施验证（2026-08-16，GPT 终裁门槛）——纯最终分类层改造双引擎对比。
// 旧引擎 = _p5/bazi.pre-c07.js（C06 冻结字节），新引擎 = js/bazi.js（弱档符号折叠 + elementClassification）。
// 硬门禁：
//  ① 数据守卫：candidateScores/S_need/yong/tiebreak/旺衰/格局/从格短路 逐字段一致（GPT 硬约束）
//  ② 4 invariants（扶抑盘）：五行全部且仅分类一次 / 用神∈喜 / 喜∩忌=∅ / 喜∪忌=五元素
//  ③ 预期差异唯一性：新喜=旧喜+弱喜、新忌=旧忌+弱忌；弱档增量 == 旧悬空集合；无任何跨侧移动
//  ④ 从格/穷通盘：pre/post 全字段字节级一致 + 不挂 elementClassification
//  ⑤ reasoning 差异可解释：仅 喜/忌 清单句 + 四句格局微调（月令官杀/财星/印星/食伤）
//  ⑥ sn=0 二级归类 synthetic 单元断言（GPT：实现前构造验证）
// 盘集：全历史（53冻结+50盲测+20盲盘+攻击集+P4A）+ 105影响面 + C05 28盘 + 两锚点，gz 去重。
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');
var WX = ['木', '火', '土', '金', '水'];
var WU_XING_GAN = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
var TIERS = ['用神', '喜神', '弱喜', '忌神', '弱忌'];

function load(src) {
  var context = { window: {} };
  vm.runInNewContext(src, context);
  return { eng: context.window.BaZiCalculator, ctx: context };
}
var PRE = load(fs.readFileSync(path.join(__dirname, 'bazi.pre-c07.js'), 'utf8'));
var POST = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));
function build(E, gz) {
  var p = gz.split(' ');
  return E.eng.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
var cache = {};
function compute(E, gz) {
  var k = (E === PRE ? 'P' : 'N') + '|' + gz;
  if (cache[k]) return cache[k];
  var b = build(E, gz);
  var r = { b: b, dm: E.eng.calcDayMasterStrength(b), pt: E.eng.getPattern(b), cg: E.eng.getCongGe(b) };
  r.yj = E.eng.getYongJi(b);
  cache[k] = r;
  return r;
}

// ---- 独立复刻 tier 期望（与引擎实现互证，非直接抄代码）----
function expectTier(sn, l1, dmWx, wx, isYong) {
  if (isYong) return '用神';
  if (sn > 3) return '喜神';
  if (sn < -3) return '忌神';
  if (sn === 0) {
    if (l1 > 0) return '弱喜';
    if (l1 < 0) return '弱忌';
    var SW = WX[(WX.indexOf(dmWx) + 4) % 5];
    return (wx === dmWx || wx === SW) ? '弱喜' : '弱忌';
  }
  return sn > 0 ? '弱喜' : '弱忌';
}

// ---- 盘集（p5c06-verify 同口径，gz 去重）----
var DISKS = {};
function addDisk(id, gz, set) {
  if (!DISKS[gz]) DISKS[gz] = { id: id, gz: gz, sets: {} };
  DISKS[gz].sets[set] = true;
}
addDisk('A03', '甲申 庚午 甲子 乙丑', '锚点');
addDisk('D11', '戊子 丁巳 癸亥 庚申', '锚点');
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
parseCSV('_p3_a2_sha_ab.csv').slice(1).forEach(function (r) { addDisk(r[1], r[2], '53冻结'); });
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm, m;
  while ((m = re.exec(md)) !== null) addDisk(m[1], m[2], '50盲测');
});
[
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
].forEach(function (m) { addDisk(m[0], m[1], '20盲盘'); });
var ATTACK_SETS = { '00-P5A1-格局攻击集.md': 120, '00-P5A2-格局成败攻击集.md': 120, '00-P5A3-财党杀攻击集.md': 61 };
Object.keys(ATTACK_SETS).forEach(function (f) {
  var md = fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) { addDisk(f.replace(/\.md$/, '') + '#' + m[1], m[2], '攻击集'); n++; }
  if (n !== ATTACK_SETS[f]) throw new Error(f + ' 解析数量异常: ' + n);
});
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a', '00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  addDisk('P4A-' + p4aCount, m[1], 'P4A定向');
});
if (p4aCount !== 32) throw new Error('P4-A 定向盘解析数量异常: ' + p4aCount);
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) addDisk('IMPACT', r.gz, '105影响面'); });
});
JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-output.json'), 'utf8')).forEach(function (r) {
  addDisk(r.id, r.gz, 'C05-28盘');
});
var GZ_LIST = Object.keys(DISKS);

// ---- 逐盘对比 ----
var HARD = { guard: [], invariant: [], tier: [], cross: [], cong: [], reasoning: [], other: [] };
var stats = {
  total: GZ_LIST.length, withCs: 0, noCs: 0,
  xiChanged: 0, jiChanged: 0, unchanged: 0,
  danglingResolved: 0, danglingPos: 0, danglingNeg: 0, danglingZero: 0,
  snZeroHits: 0,
  sentenceDiffDisks: 0, sentenceDiff: { 官杀: 0, 财星: 0, 印星: 0, 食伤: 0 },
  qualityGrew: 0, reasonsGrew: 0,
  tierDist: { 用神: 0, 喜神: 0, 弱喜: 0, 忌神: 0, 弱忌: 0 }
};
var records = [];
var SENTENCES = {
  官杀: ' 月令官杀当权但为忌神——"官多变鬼"，需印星转化方为上策。',
  财星: ' 月令财星当权但日主弱不担财——"富屋贫人"之象，宜先扶身再求财。',
  印星: ' 月令印星当权为喜——印来生身，贵人运佳，宜求学深造。',
  食伤: ' 月令食伤当权且为忌神——泄气太过，需印星制食伤方能平衡。'
};
function stripKnownText(s) {
  var t = String(s);
  t = t.replace(/ 月令[^。]*。/g, '');      // 四句格局微调
  t = t.replace(/ 喜：[^。]*。忌：[^。]*。/g, ''); // 喜/忌清单句
  return t;
}

function verifyOne(gz) {
  var o = compute(PRE, gz), n = compute(POST, gz);
  // —— 数据守卫（L0 层，GPT 红线）——
  if (JSON.stringify(o.b) !== JSON.stringify(n.b)) HARD.guard.push(gz + ' buildFromPillars');
  if (JSON.stringify(o.dm) !== JSON.stringify(n.dm)) HARD.guard.push(gz + ' dm(旺衰)');
  if (JSON.stringify(o.pt) !== JSON.stringify(n.pt)) HARD.guard.push(gz + ' pattern');
  if (JSON.stringify(o.cg) !== JSON.stringify(n.cg)) HARD.guard.push(gz + ' cong');
  ['dayMasterLevel', 'dayMasterScore', 'congGe', 'method', 'patternStatus', 'chainHints', 'chainAdjustments',
   'yongShen', 'evidence', 'primaryReason'].forEach(function (k) {
    if (JSON.stringify(o.yj[k]) !== JSON.stringify(n.yj[k])) HARD.guard.push(gz + ' yj.' + k);
  });
  if (JSON.stringify(o.yj.candidateScores) !== JSON.stringify(n.yj.candidateScores)) HARD.guard.push(gz + ' yj.candidateScores（含 role，应逐字段一致）');
  if (JSON.stringify(o.yj.tiebreak) !== JSON.stringify(n.yj.tiebreak)) HARD.guard.push(gz + ' yj.tiebreak');

  var hasCs = !!(n.yj.candidateScores && n.yj.candidateScores.length);
  var isCong = !!(n.cg && n.cg.isCong);
  if (!hasCs) {
    stats.noCs++;
    // —— 从格/穷通盘：全字段字节级一致 + 不挂 elementClassification ——
    if (JSON.stringify(o.yj) !== JSON.stringify(n.yj)) HARD.cong.push(gz + ' 短路盘全字段漂移');
    if (n.yj.elementClassification !== undefined) HARD.cong.push(gz + ' 短路盘挂载了 elementClassification');
    records.push({ gz: gz, set: Object.keys(DISKS[gz].sets).join('+'), kind: '短路', cong: isCong });
    return;
  }
  stats.withCs++;
  if (n.yj.elementClassification === undefined) { HARD.other.push(gz + ' 扶抑盘缺 elementClassification'); return; }

  var byWx = {};
  n.yj.candidateScores.forEach(function (c) { byWx[c.wx] = c; });
  var yongWx = n.yj.yongShen[0];
  var dmWx = WU_XING_GAN[n.b.day.gan];

  // —— invariant ①+档位正确性（独立复刻互证）——
  var keys = Object.keys(n.yj.elementClassification);
  if (keys.length !== 5 || WX.some(function (w) { return keys.indexOf(w) < 0; })) HARD.invariant.push(gz + ' classification 键集: ' + keys.join(','));
  var yongCount = 0;
  WX.forEach(function (wx) {
    var want = expectTier(byWx[wx].SNeed, byWx[wx].L1, dmWx, wx, wx === yongWx);
    if (n.yj.elementClassification[wx] !== want) HARD.tier.push(gz + ' ' + wx + ' 档位=' + n.yj.elementClassification[wx] + ' 期望=' + want + '（SNeed=' + byWx[wx].SNeed + ' L1=' + byWx[wx].L1 + '）');
    if (!TIERS.some(function (t) { return t === n.yj.elementClassification[wx]; })) HARD.tier.push(gz + ' ' + wx + ' 非法档位');
    if (n.yj.elementClassification[wx] === '用神') yongCount++;
    stats.tierDist[n.yj.elementClassification[wx]]++;
  });
  if (yongCount !== 1 || n.yj.elementClassification[yongWx] !== '用神') HARD.invariant.push(gz + ' 用神档位异常: count=' + yongCount);

  // —— invariants ②③④ + 预期差异唯一性 ——
  var oXi = o.yj.xiShen, oJi = o.yj.jiShen, nXi = n.yj.xiShen, nJi = n.yj.jiShen;
  if (nXi.indexOf(yongWx) < 0) HARD.invariant.push(gz + ' 用神不在喜侧');
  var xiSet = {}, jiSet = {};
  nXi.forEach(function (w) { xiSet[w] = true; });
  nJi.forEach(function (w) { jiSet[w] = true; });
  var overlap = nXi.filter(function (w) { return jiSet[w]; });
  if (overlap.length) HARD.invariant.push(gz + ' 喜∩忌非空: ' + overlap.join(','));
  var union = Object.keys(xiSet);
  Object.keys(jiSet).forEach(function (w) { if (union.indexOf(w) < 0) union.push(w); });
  if (union.length !== 5) HARD.invariant.push(gz + ' 喜∪忌=' + union.length + ' 元素: ' + union.join(','));
  // 旧⊆新（无跨侧移动、无成员丢失）
  if (oXi.some(function (w) { return nXi.indexOf(w) < 0; })) HARD.cross.push(gz + ' 旧喜成员丢失');
  if (oJi.some(function (w) { return nJi.indexOf(w) < 0; })) HARD.cross.push(gz + ' 旧忌成员丢失');
  // 前缀 = 旧列表（正式档排序不变）
  if (JSON.stringify(nXi.slice(0, oXi.length)) !== JSON.stringify(oXi)) HARD.cross.push(gz + ' 新喜前缀≠旧喜');
  if (JSON.stringify(nJi.slice(0, oJi.length)) !== JSON.stringify(oJi)) HARD.cross.push(gz + ' 新忌前缀≠旧忌');
  // 弱档增量 == 旧悬空集合
  var oldUnion = oXi.concat(oJi.filter(function (w) { return oXi.indexOf(w) < 0; }));
  var added = nXi.concat(nJi).filter(function (w) { return oldUnion.indexOf(w) < 0; });
  var dangling = WX.filter(function (w) { return oldUnion.indexOf(w) < 0; });
  if (JSON.stringify(added.slice().sort()) !== JSON.stringify(dangling.slice().sort())) {
    HARD.cross.push(gz + ' 弱档增量≠旧悬空: 新增=' + added.join(',') + ' 悬空=' + dangling.join(','));
  }
  // 弱档排序（后缀按 SNeed 降/升）
  var weakXi = nXi.slice(oXi.length), weakJi = nJi.slice(oJi.length);
  for (var i = 1; i < weakXi.length; i++) if (byWx[weakXi[i - 1]].SNeed < byWx[weakXi[i]].SNeed) HARD.other.push(gz + ' 弱喜排序异常');
  for (var j = 1; j < weakJi.length; j++) if (byWx[weakJi[j - 1]].SNeed > byWx[weakJi[j]].SNeed) HARD.other.push(gz + ' 弱忌排序异常');
  if (dangling.length > 0) {
    stats.xiChanged++; stats.jiChanged++;
    stats.danglingResolved += dangling.length;
    dangling.forEach(function (w) {
      var sn = byWx[w].SNeed;
      if (sn === 0) { stats.danglingZero++; stats.snZeroHits++; }
      else if (sn > 0) { stats.danglingPos++; if (n.yj.elementClassification[w] !== '弱喜') HARD.tier.push(gz + ' ' + w + ' 悬空正应弱喜'); }
      else { stats.danglingNeg++; if (n.yj.elementClassification[w] !== '弱忌') HARD.tier.push(gz + ' ' + w + ' 悬空负应弱忌'); }
    });
  }
  // 全样本 sn=0 命中统计（GPT 要求构造 synthetic 验证的实盘对应面）
  WX.forEach(function (w) { if (w !== yongWx && byWx[w].SNeed === 0) stats.snZeroHits++; });

  // —— yongShenQuality / elementReasons：旧键同值 + 新键仅弱档增量 ——
  ['yongShenQuality', 'elementReasons'].forEach(function (field) {
    var oo = o.yj[field] || {}, nn = n.yj[field] || {};
    Object.keys(oo).forEach(function (k) {
      if (JSON.stringify(oo[k]) !== JSON.stringify(nn[k])) HARD.guard.push(gz + ' yj.' + field + '.' + k + ' 旧键值漂移');
    });
    Object.keys(nn).forEach(function (k) {
      if (!oo[k]) {
        if (added.indexOf(k) < 0) HARD.guard.push(gz + ' yj.' + field + ' 新键 ' + k + ' 非弱档增量');
        if (field === 'yongShenQuality') stats.qualityGrew++;
        else stats.reasonsGrew++;
      }
    });
  });

  // —— reasoning 差异可解释性 ——
  if (o.yj.reasoning !== n.yj.reasoning) {
    var ro = stripKnownText(o.yj.reasoning), rn = stripKnownText(n.yj.reasoning);
    if (ro !== rn) HARD.reasoning.push(gz + ' reasoning 剥离后仍不同: [' + ro + '] vs [' + rn + ']');
    else {
      var senDiff = [];
      Object.keys(SENTENCES).forEach(function (k) {
        var oHas = o.yj.reasoning.indexOf(SENTENCES[k]) >= 0;
        var nHas = n.yj.reasoning.indexOf(SENTENCES[k]) >= 0;
        if (oHas !== nHas) senDiff.push(k);
      });
      if (senDiff.length) { stats.sentenceDiffDisks++; senDiff.forEach(function (k) { stats.sentenceDiff[k]++; }); }
    }
  }

  records.push({ gz: gz, set: Object.keys(DISKS[gz].sets).join('+'), kind: '扶抑', cong: isCong,
    dangling: dangling, tier: n.yj.elementClassification });
}

GZ_LIST.forEach(function (gz) {
  try { verifyOne(gz); }
  catch (e) { HARD.other.push(gz + ' 异常: ' + e.message); }
});

// ---- synthetic sn=0 单元断言（GPT：实现前构造验证）----
var tierFn = POST.ctx.c07ElementTier, zeroFn = POST.ctx.c07ZeroTier;
var unitFails = [];
function ut(cond, msg) { if (!cond) unitFails.push(msg); }
ut(tierFn('火', 0, 5, '木', false) === '弱喜', 'sn=0 L1>0 应弱喜');
ut(tierFn('火', 0, -5, '木', false) === '弱忌', 'sn=0 L1<0 应弱忌');
ut(tierFn('木', 1, 0, '木', true) === '用神', '用神恒标用神（低分用神不受强弱档影响）');
ut(tierFn('火', 3, 1, '木', false) === '弱喜', 'sn=3 边界应弱喜（>3 才正式喜）');
ut(tierFn('火', -3, -1, '木', false) === '弱忌', 'sn=-3 边界应弱忌（<-3 才正式忌）');
ut(tierFn('火', 3.1, 1, '木', false) === '喜神', 'sn>3 应正式喜');
ut(tierFn('火', -3.1, -1, '木', false) === '忌神', 'sn<-3 应正式忌');
ut(tierFn('火', 2, 1, '木', false) === '弱喜', '0<sn<=3 应弱喜');
ut(tierFn('火', -2, -1, '木', false) === '弱忌', '-3<=sn<0 应弱忌');
ut(tierFn('水', 0, 0, '木', false) === '弱喜', 'sn=0 L1=0 印（水）应弱喜（生扶组）');
ut(tierFn('木', 0, 0, '木', false) === '弱喜', 'sn=0 L1=0 比劫（木）应弱喜（生扶组）');
ut(tierFn('金', 0, 0, '木', false) === '弱忌', 'sn=0 L1=0 官杀（金）应弱忌（克泄耗组）');
ut(tierFn('土', 0, 0, '木', false) === '弱忌', 'sn=0 L1=0 财（土）应弱忌');
ut(tierFn('火', 0, 0, '木', false) === '弱忌', 'sn=0 L1=0 食伤（火）应弱忌');
// c07ZeroTier 直接断言（日主金：生扶=金、土）
ut(zeroFn('金', '金') === '弱喜' && zeroFn('金', '土') === '弱喜', '金日主：比劫金/印土应弱喜');
ut(zeroFn('金', '水') === '弱忌' && zeroFn('金', '木') === '弱忌' && zeroFn('金', '火') === '弱忌', '金日主：食伤水/财木/官杀火应弱忌');
ut(zeroFn('水', '水') === '弱喜' && zeroFn('水', '金') === '弱喜', '水日主：比劫水/印金应弱喜');
if (unitFails.length) HARD.other = HARD.other.concat(unitFails.map(function (x) { return 'UNIT ' + x; }));

// ---- 输出 ----
var hardTotal = 0;
Object.keys(HARD).forEach(function (k) { hardTotal += HARD[k].length; });
fs.writeFileSync(path.join(__dirname, 'p5c07-verify-output.json'), JSON.stringify({
  meta: { date: '2026-08-16', pre: '_p5/bazi.pre-c07.js', post: 'js/bazi.js', disks: GZ_LIST.length },
  stats: stats,
  hard: HARD,
  unit: { fails: unitFails.length, detail: unitFails },
  danglingBySet: (function () {
    var by = {};
    records.forEach(function (r) {
      if (r.kind !== '扶抑' || !r.dangling.length) return;
      var k = r.set;
      by[k] = by[k] || { disks: 0, elements: 0 };
      by[k].disks++; by[k].elements += r.dangling.length;
    });
    return by;
  })(),
  sample: records.filter(function (r) { return r.kind === '扶抑' && r.dangling.length > 0; }).slice(0, 30)
}, null, 1));
Object.keys(HARD).forEach(function (k) {
  if (HARD[k].length) console.log('HARD.' + k + ': ' + HARD[k].length);
});
console.log('disks=' + GZ_LIST.length + ' withCs=' + stats.withCs + ' noCs=' + stats.noCs
  + ' xiChanged=' + stats.xiChanged + ' danglingResolved=' + stats.danglingResolved
  + ' (pos=' + stats.danglingPos + ' neg=' + stats.danglingNeg + ' zero=' + stats.danglingZero + ')'
  + ' snZeroHits=' + stats.snZeroHits
  + ' sentenceDiffDisks=' + stats.sentenceDiffDisks
  + ' unitFails=' + unitFails.length
  + ' hardTotal=' + hardTotal);
process.exit(hardTotal === 0 ? 0 : 1);
