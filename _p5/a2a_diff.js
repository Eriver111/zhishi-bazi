// P5-A2A diff（2026-08-15）：pre=A2B 冻结版（_p5/bazi.a2b-post.js，=HEAD 286130e 字节一致）vs post=工作区（A2A 制杀有效性）。
// 目标变化仅允许制杀格（食神制杀格/伤官制杀格）：
//   ① status 成→破（新增 ineffective 理由）；② breakReasons 增补制杀理由；
//   ③ establishConditions 由空数组新增单条「制神有效制杀」；④ 用神/喜/忌/yjMethod 级联（仅当 status 翻转时允许）；
// 其余所有字段（分数/旺衰/格名/type/从格/source/matchMode）以及非制杀格盘的全部字段必须逐字节一致。
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
var PRE = loadEngine('_p5/bazi.a2b-post.js');
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
var atk1Count = 0;
atk1Md.split(/\r?\n/).forEach(function (l) {
  if (!/^\| \d+ \|/.test(l)) return;
  var cells = l.split('|');
  if (cells.length < 6) return;
  var gz = cells[4].trim();
  if (!/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] / .test(gz + ' ')) return;
  atk1Count++;
  DISKS.push({ id: 'A' + cells[1].trim(), gz: gz, set: 'P5A1攻击' });
});
if (atk1Count !== 120) throw new Error('P5-A1 攻击盘解析数量异常: ' + atk1Count);

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

// 追加 P4-A targeted 32 盘（A1 24 + A2 8，均为建禄/羊刃/从格/财格——纯零漂移校验）
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a/00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  DISKS.push({ id: 'P4A-' + p4aCount, gz: m[1], set: 'P4A定向' });
});
if (p4aCount !== 32) throw new Error('P4-A 定向盘解析数量异常: ' + p4aCount);

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
    status: pt.status,
    breakReasons: JSON.stringify(pt.breakReasons || null),
    conds: JSON.stringify(pt.establishConditions || null)
  };
}

var SHA_ZHI = ['食神制杀格', '伤官制杀格'];
var NEW_BREAK_WHITELIST = ['食神虚透，制杀无力', '伤官虚透，制杀无力', '制神受枭夺，制杀链中断'];
var HARD_FIELDS = ['score', 'level', 'ptype', 'cong', 'source', 'matchMode', 'pname'];

var targetRows = [], violations = [], cascadeRows = [];
DISKS.forEach(function (d) {
  var pre = snap(PRE, d.gz), post = snap(POST, d.gz);
  if (SHA_ZHI.indexOf(pre.pname) < 0) {
    // 非制杀格：全部字段逐字节一致
    var keys = HARD_FIELDS.concat(['yong', 'xi', 'ji', 'pattern', 'yjMethod', 'primaryReason', 'status', 'breakReasons', 'conds']);
    var diffs = [];
    keys.forEach(function (k) {
      if (pre[k] !== post[k]) diffs.push(k + ': ' + pre[k] + ' → ' + post[k]);
    });
    if (diffs.length) violations.push({ d: d, msg: '非制杀格盘字段漂移: ' + diffs.join('; ') });
    return;
  }
  // 制杀格：硬字段零漂移 + 允许集校验
  var row = { d: d, pre: pre, post: post, bad: [], notes: [] };
  HARD_FIELDS.forEach(function (k) {
    if (pre[k] !== post[k]) row.bad.push('硬字段漂移 ' + k + ': ' + pre[k] + ' → ' + post[k]);
  });
  // breakReasons：增补白名单理由 = 合法（成→破=翻转；破→破=已破盘增补）；其余任何变化 = 异常
  var preB = JSON.parse(pre.breakReasons), postB = JSON.parse(post.breakReasons);
  var reasonChanged = pre.breakReasons !== post.breakReasons;
  var added = postB.filter(function (r) { return preB.indexOf(r) < 0; });
  var kept = preB.every(function (r) { return postB.indexOf(r) >= 0; });
  var okAdd = added.length > 0 && added.every(function (r) { return NEW_BREAK_WHITELIST.indexOf(r) >= 0; });
  var flipped = pre.status === '成格' && post.status === '破格';
  if (flipped && !(reasonChanged && okAdd && kept)) {
    row.bad.push('成→破但 breakReasons 增补不合规: ' + pre.breakReasons + ' → ' + post.breakReasons);
  } else if (flipped && added.length === 0) {
    row.bad.push('成→破但无新增理由');
  }
  if (!flipped && reasonChanged) {
    if (okAdd && kept) row.notes.push('已破盘增补理由: ' + added.join('+'));
    else row.bad.push('breakReasons 异常变化: ' + pre.breakReasons + ' → ' + post.breakReasons);
  }
  // pattern 状态与文案：破→成/未翻转文案漂移 = 异常
  if (pre.status !== post.status) {
    if (!flipped) row.bad.push('意外状态变化 ' + pre.status + '→' + post.status);
  } else if (pre.pattern !== post.pattern) row.bad.push('pattern 文案漂移（status 未变）');
  // conds：pre 必空、post 必单条「制神有效制杀」
  var preC = JSON.parse(pre.conds), postC = JSON.parse(post.conds);
  if (preC.length !== 0) row.bad.push('pre conditions 非空（预期空数组）');
  if (!(postC.length === 1 && postC[0].condition === '制神有效制杀')) row.bad.push('post conditions 非单条制杀条目: ' + post.conds);
  else row.notes.push('制杀条目 met=' + postC[0].met + '｜' + postC[0].detail);
  // 用神级联：仅翻转盘允许变化并记录；未翻转必须零漂移
  ['yong', 'xi', 'ji', 'yjMethod', 'primaryReason'].forEach(function (k) {
    if (pre[k] !== post[k]) {
      if (flipped) {
        row.notes.push(k + ' 级联: ' + pre[k] + ' → ' + post[k]);
        cascadeRows.push({ d: d, field: k, pre: pre[k], post: post[k] });
      } else row.bad.push(k + ' 漂移（status 未翻转）: ' + pre[k] + ' → ' + post[k]);
    }
  });
  targetRows.push(row);
});

var flippedRows = targetRows.filter(function (r) { return r.pre.status !== r.post.status; });
var brokenAugmented = targetRows.filter(function (r) { return r.pre.status === '破格' && /已破盘增补理由/.test(r.notes.join('')); });
var hardViol = targetRows.filter(function (r) { return r.bad.length; });

var lines = [];
lines.push('# P5-A2A 制杀有效性回归（pre=A2B 冻结 286130e vs post=工作区 A2A）');
lines.push('');
lines.push('- 总盘数：' + DISKS.length + '（53 冻结 + 20 盲盘 + 50 盲测去重 + 120 P5-A1 + 120 P5-A2 + 32 P4-A 定向）');
lines.push('- 制杀格盘数：' + targetRows.length + '｜status 翻转（成→破）：' + flippedRows.length + '｜已破盘增补理由：' + brokenAugmented.length + '｜用神级联条目：' + cascadeRows.length);
lines.push('- 非制杀格零漂移：' + (violations.length ? '❌ ' + violations.length + ' 盘异常' : '✅ 全部一致（含 32 盘 P4-A 定向）'));
lines.push('- 制杀格硬字段/意外变化：' + (hardViol.length ? '❌ ' + hardViol.length + ' 盘异常' : '✅ 零（分数/旺衰/格名/type/从格/source/matchMode 全等）'));
lines.push('');
lines.push('## 制杀格逐盘 before/after');
lines.push('| 盘 | 类 | 四柱 | status | 增补/变化 | 制杀条目 | 异常 |');
lines.push('|---|---|---|---|---|---|---|');
targetRows.forEach(function (r) {
  var cascadeNotes = r.notes.filter(function (n) { return /级联/.test(n); });
  var otherNotes = r.notes.filter(function (n) { return !/级联/.test(n); });
  var badStr = r.bad.length ? '⚠️' + r.bad.join('；') : '';
  lines.push('| ' + r.d.id + ' | ' + r.d.set + ' | ' + r.d.gz + ' | ' + r.pre.status + '→' + r.post.status + ' | ' + (otherNotes.join('；') || '—') + ' | ' + (r.notes.filter(function (n) { return /制杀条目/.test(n); })[0] || '—') + ' | ' + (cascadeNotes.length ? '级联：' + cascadeNotes.join('；') : badStr) + ' |');
});
lines.push('');
if (flippedRows.length) {
  lines.push('## status 翻转明细（成→破）');
  flippedRows.forEach(function (r) {
    lines.push('- ' + r.d.set + ' ' + r.d.id + ' ' + r.d.gz + '：' + r.pre.breakReasons + ' → ' + r.post.breakReasons);
  });
  lines.push('');
}
if (brokenAugmented.length) {
  lines.push('## 已破盘增补理由明细（status 不变，多因并列）');
  brokenAugmented.forEach(function (r) {
    lines.push('- ' + r.d.set + ' ' + r.d.id + ' ' + r.d.gz + '：' + r.pre.breakReasons + ' → ' + r.post.breakReasons);
  });
  lines.push('');
}
if (cascadeRows.length) {
  lines.push('## 用神级联明细（交 GPT 确认传播面）');
  cascadeRows.forEach(function (c) {
    lines.push('- ' + c.d.set + ' ' + c.d.id + ' ' + c.d.gz + ' ' + c.field + ': ' + c.pre + ' → ' + c.post);
  });
  lines.push('');
}
if (violations.length || hardViol.length) {
  lines.push('## ❌ 异常——中止');
  violations.forEach(function (v) { lines.push('- ' + v.d.set + ' ' + v.d.id + ' ' + v.d.gz + ' | ' + v.msg); });
  hardViol.forEach(function (r) { lines.push('- ' + r.d.set + ' ' + r.d.id + ' ' + r.d.gz + ' | ' + r.bad.join('; ')); });
} else {
  lines.push('## ✅ 目标变化仅限制杀格白名单 + 非目标零漂移');
}
fs.writeFileSync(path.join(__dirname, '00-P5A2A-regression.md'), lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log('\n[总盘 ' + DISKS.length + ' | 制杀格 ' + targetRows.length + ' | 翻转 ' + flippedRows.length + ' | 已破增补 ' + brokenAugmented.length + ' | 级联条目 ' + cascadeRows.length + ' | 非制杀异常 ' + violations.length + ' | 制杀硬异常 ' + hardViol.length + ']');
process.exit((violations.length || hardViol.length) ? 1 : 0);
