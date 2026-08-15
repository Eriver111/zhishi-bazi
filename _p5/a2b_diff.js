// P5-A2B diff（2026-08-15）：pre=P5-A1 冻结版（_p5/bazi.evid02-pre.js）vs post=工作区。
// 判定字段（分数/旺衰/用喜忌/格局·状态/type/从格/用神method/primaryReason/source）必须零变化。
// establishConditions 变化仅允许三类：
// 1) 条目新增 category 字段（值=白名单 schema，其余字段逐字相同）；
// 2) 食神生财格/伤官生财格 新增「日主能担财」条目（EVID03：原 indexOf 对两格名均不命中）；
// 3) 七杀格「无财星党杀」detail 文案变化（财党杀解释 trace，met 不变）。
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
function loadEngine(file) {
  var source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  var context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}
var PRE = loadEngine('_p5/bazi.evid02-pre.js');
var POST = loadEngine('js/bazi.js');

function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
function buildPillars(eng, gz) {
  var p = gz.split(' ');
  return eng.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

var DISKS = [];
var shaRows = parseCSV('_p3_a2_sha_ab.csv').slice(1);
shaRows.forEach(function (r) { DISKS.push({ id: r[1], gz: r[2], set: '53冻结' }); });
var BLIND50 = [];
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm;
  var m;
  while ((m = re.exec(md)) !== null) BLIND50.push({ id: m[1], gz: m[2] });
});
if (BLIND50.length !== 50) throw new Error('50 盲测解析数量异常: ' + BLIND50.length);
DISKS = DISKS.concat(BLIND50);
var BLIND20 = [
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
];
var dedup = {};
DISKS.forEach(function (d) { dedup[d.gz] = { id: d.id, gz: d.gz, set: '53冻结' }; });
var final = [];
BLIND20.forEach(function (m) {
  final.push({ id: m[0], gz: m[1], set: '20盲盘' });
  delete dedup[m[1]];
});
BLIND50.forEach(function (d) {
  if (dedup[d.gz]) { final.push({ id: d.id, gz: d.gz, set: '50盲测' }); delete dedup[d.gz]; }
});
Object.keys(dedup).forEach(function (gz) { final.push(dedup[gz]); });
DISKS = final;

// 追加 P5-A1 攻击集 120 盘
var atk1Md = fs.readFileSync(path.join(ROOT, '_p5/00-P5A1-格局攻击集.md'), 'utf8').replace(/^﻿/, '');
var atkCount = 0;
atk1Md.split(/\r?\n/).forEach(function (l) {
  if (!/^\| \d+ \|/.test(l)) return;
  var cells = l.split('|');
  if (cells.length < 6) return;
  var gz = cells[4].trim();
  if (!/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] / .test(gz + ' ')) return;
  atkCount++;
  DISKS.push({ id: 'A' + cells[1].trim(), gz: gz, set: 'P5A1攻击' });
});
if (atkCount !== 120) throw new Error('P5-A1 攻击盘解析数量异常: ' + atkCount);

// 追加 P5-A2 攻击集 120 盘
var atk2Md = fs.readFileSync(path.join(ROOT, '_p5/00-P5A2-格局成败攻击集.md'), 'utf8').replace(/^﻿/, '');
var atk2Count = 0;
atk2Md.split(/\r?\n/).forEach(function (l) {
  if (!/^\| \d+ \|/.test(l)) return;
  var cells = l.split('|');
  if (cells.length < 6) return;
  var gz = cells[4].trim();
  if (!/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] / .test(gz + ' ')) return;
  atk2Count++;
  DISKS.push({ id: 'P5A2-' + cells[1].trim(), gz: gz, set: 'P5A2攻击' });
});
if (atk2Count !== 120) throw new Error('P5-A2 攻击盘解析数量异常: ' + atk2Count);

function snap(eng, gz) {
  var b = buildPillars(eng, gz);
  var ds = eng.calcDayMasterStrength(b);
  var pt = eng.getPattern(b);
  var yj = eng.getYongJi(b);
  var cg = eng.getCongGe(b);
  return {
    score: String(ds.score), level: ds.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pt.name + '·' + pt.status, ptype: pt.type,
    cong: cg.isCong ? cg.name : '否',
    yjMethod: yj.method || '-', primaryReason: yj.primaryReason || '-',
    source: pt.source || '-',
    pname: pt.name, matchMode: pt.matchMode || '',
    conds: JSON.stringify(pt.establishConditions || null)
  };
}

function stripCat(arr) {
  return arr.map(function (c) {
    var o = {};
    Object.keys(c).forEach(function (k) { if (k !== 'category') o[k] = c[k]; });
    return o;
  });
}

var JUDGE_FIELDS = ['score', 'level', 'yong', 'xi', 'ji', 'pattern', 'ptype', 'cong', 'yjMethod', 'primaryReason', 'source'];
var CAT_SCHEMA = {
  '日主有承载格局之力': 'HARD_BREAK', '正官透干有根': 'QUALITY', '无伤官克官': 'HARD_BREAK',
  '无官杀混杂': 'HARD_BREAK', '有食神制杀或印星化杀': 'HARD_BREAK', '无财星党杀': 'QUALITY',
  '无财星破印': 'HARD_BREAK', '日主有根纳印': 'QUALITY', '无枭神夺食': 'HARD_BREAK',
  '食神有生财之路': 'QUALITY', '无正官被伤': 'HARD_BREAK', '有印星制伤或财星引化': 'QUALITY',
  '比劫不过重': 'HARD_BREAK', '日主能担财': 'HARD_BREAK', '财官透出为用': 'HARD_BREAK',
  '官杀制刃': 'HARD_BREAK', '印星不被财破': 'QUALITY', '官/杀不被食伤制死': 'QUALITY',
  '印星有力（非燥土虚浮）': 'HARD_BREAK', '印星有力': 'QUALITY', '从格成立': 'INFO'
};
var OLD_CAI_DETAIL = '财星生杀，助纣为虐';
var NEW_CAI_DETAIL = '财星生杀，助纣为虐；局有食制/印化，财党杀暂作提示不翻成破（待3×3分层裁定）';

var gainedTandanCai = [], caiTraceChanged = [], catOnly = [], evid02Legacy = [], problems = [];
DISKS.forEach(function (d) {
  var pre = snap(PRE, d.gz), post = snap(POST, d.gz);
  var jdiffs = [];
  JUDGE_FIELDS.forEach(function (k) {
    if (pre[k] !== post[k]) jdiffs.push(k + ': ' + pre[k] + ' → ' + post[k]);
  });
  if (jdiffs.length) { problems.push({ d: d, msg: '判定字段变化: ' + jdiffs.join('; ') }); return; }
  if (pre.conds === post.conds) return;
  var preA = JSON.parse(pre.conds), postA = JSON.parse(post.conds);
  var preS = stripCat(preA), postS = stripCat(postA);
  // 允许类 1：仅 category 字段新增且值合白名单
  var catOK = true;
  if (preS.length !== postS.length) catOK = false;
  else {
    for (var i = 0; i < preS.length; i++) {
      if (JSON.stringify(preS[i]) !== JSON.stringify(postS[i])) { catOK = false; break; }
    }
    if (catOK) {
      for (var j = 0; j < postA.length; j++) {
        var cat = postA[j].category;
        if (preA[j].category !== undefined) { catOK = false; break; }
        if (CAT_SCHEMA[postA[j].condition] !== cat) { catOK = false; break; }
      }
    }
  }
  if (catOK) { catOnly.push({ id: d.id, set: d.set, gz: d.gz }); return; }
  // 允许类 2：生财复合新增「日主能担财」单条目
  var gainOK = pre.pname === post.pname && (post.pname === '食神生财格' || post.pname === '伤官生财格')
    && preS.length === 0 && postS.length === 1 && postS[0].condition === '日主能担财';
  if (gainOK) { gainedTandanCai.push({ id: d.id, set: d.set, gz: d.gz, pname: post.pname, met: postS[0].met, detail: postS[0].detail }); return; }
  // 允许类 3：七杀格「无财星党杀」detail 文案变化（met 不变，其余条目相同）
  var traceOK = pre.pname === '七杀格' && preS.length === postS.length;
  var traceCount = 0;
  if (traceOK) {
    for (var t = 0; t < preS.length; t++) {
      var pc = preS[t], qc = postS[t];
      if (JSON.stringify(pc) === JSON.stringify(qc)) continue;
      if (pc.condition === '无财星党杀' && qc.condition === '无财星党杀' && pc.met === qc.met
        && pc.detail === OLD_CAI_DETAIL && qc.detail === NEW_CAI_DETAIL) { traceCount++; continue; }
      traceOK = false; break;
    }
  }
  if (traceOK && traceCount === 1) { caiTraceChanged.push({ id: d.id, set: d.set, gz: d.gz }); return; }
  // 允许类 4（EVID02 遗留）：正官格 same-element 盘「正官透干有根」met true→false + detail 更新（仅此一条）
  var evid02OK = pre.pname === '正官格' && post.pname === '正官格' && post.matchMode === 'same-element'
    && preS.length === postS.length;
  var evid02Count = 0;
  if (evid02OK) {
    for (var e = 0; e < preS.length; e++) {
      var pe = preS[e], qe = postS[e];
      if (JSON.stringify(pe) === JSON.stringify(qe)) continue;
      if (pe.condition === '正官透干有根' && qe.condition === '正官透干有根' && pe.met === true && qe.met === false) { evid02Count++; continue; }
      evid02OK = false; break;
    }
  }
  if (evid02OK && evid02Count === 1) { evid02Legacy.push({ id: d.id, set: d.set, gz: d.gz }); return; }
  problems.push({ d: d, msg: 'conditions 变化超出允许类: ' + JSON.stringify({ pre: preS, post: postS }) });
});

var lines = [];
lines.push('# P5-A2B condition schema 回归（pre=P5-A1 冻结版 vs post=A2B）');
lines.push('');
lines.push('- 总盘数：' + DISKS.length + '（53 冻结 + 20 盲盘 + 50 盲测去重 + 120 P5-A1 + 120 P5-A2）');
lines.push('- 判定字段（分数/旺衰/用喜忌/格局·状态/type/从格/用神method/primaryReason/source）：' + (problems.length ? '❌ 有变化' : '✅ 零变化'));
lines.push('- category 字段新增（其余逐字相同）：' + catOnly.length + ' 盘');
lines.push('- EVID03「日主能担财」补挂：' + gainedTandanCai.length + ' 盘');
lines.push('- 财党杀解释 trace：' + caiTraceChanged.length + ' 盘');
lines.push('- EVID02 遗留类（正官透干有根 same-element）：' + evid02Legacy.length + ' 盘');
lines.push('');
if (gainedTandanCai.length) {
  lines.push('## EVID03 补挂明细');
  lines.push('| 盘 | 类 | 四柱 | 格局 | met | detail |');
  lines.push('|---|---|---|---|---|---|');
  gainedTandanCai.forEach(function (g) {
    lines.push('| ' + g.id + ' | ' + g.set + ' | ' + g.gz + ' | ' + g.pname + ' | ' + (g.met ? '✅' : '❌') + ' | ' + g.detail + ' |');
  });
  lines.push('');
}
if (caiTraceChanged.length) {
  lines.push('## 财党杀解释 trace 明细');
  caiTraceChanged.forEach(function (c) { lines.push('- ' + c.set + ' ' + c.id + ' ' + c.gz); });
  lines.push('');
}
if (problems.length) {
  lines.push('## ❌ 传播异常——中止');
  problems.forEach(function (p) { lines.push('- ' + p.d.set + ' ' + p.d.id + ' ' + p.d.gz + ' | ' + p.msg); });
} else {
  lines.push('## ✅ 判定零漂移 + conditions 变化仅限三类白名单');
}
fs.writeFileSync(path.join(__dirname, '00-P5A2B-regression.md'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log('\n[总盘数 ' + DISKS.length + ' | category ' + catOnly.length + ' | EVID03 ' + gainedTandanCai.length + ' | trace ' + caiTraceChanged.length + ' | 异常 ' + problems.length + ']');
process.exit(problems.length ? 1 : 0);
