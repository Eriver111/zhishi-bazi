// 旺衰回归测试：丁亥 癸丑 戊申 壬戌（男）—— 传统断身弱，引擎曾误判极强86分
// 修复：① 土日主生土月按季节折算（丑月-8）② ③ 日干不自加+6
// 引擎分数 vs 逐步复算对账 + 期望值断言
global.window = global;
global.document = {};

var fs = require('fs');
var code = fs.readFileSync(__dirname + '/js/bazi.js', 'utf-8');

var exportsToGlobal = [
  'calculateBaZi','normalizeBirthInput','calculateFromBirthInput',
  'getPattern','calcDayMasterStrength','getYongJi','getCangGan',
  'DI_ZHI_WU_XING','WU_XING','getRenYuanSiLing','getDaysFromJieQi'
];

var stitch = '';
exportsToGlobal.forEach(function(name) {
  stitch += 'if(typeof ' + name + '!=="undefined")global.' + name + '=' + name + ';\n';
});
code = code.replace('window.BaZiCalculator = {', stitch + '\nwindow.BaZiCalculator = {');
eval(code);

// ── 构造八字对象（直接给定四柱，不经过排盘）──
var bazi = {
  year: { gan:'丁', zhi:'亥' },
  month:{ gan:'癸', zhi:'丑' },
  day:  { gan:'戊', zhi:'申' },
  hour: { gan:'壬', zhi:'戌' }
};

var WX = WU_XING;
var DIW = DI_ZHI_WU_XING;
var dg = bazi.day.gan, dgWx = WX[dg];

console.log('═══════════════════════════════════════════════');
console.log(' 丁亥 癸丑 戊申 壬戌（男） 旺衰回归测试');
console.log('═══════════════════════════════════════════════');
console.log('');

// ── 引擎实际结果 ──
var engine = calcDayMasterStrength(bazi);
console.log('┌─ 引擎实际结果 ─────────────────────────────');
console.log('│ 旺衰得分: ' + engine.score + ' 分 → ' + engine.level + '（' + engine.label + '）');
var yj = getYongJi(bazi);
console.log('│ 喜神: ' + yj.xiShen.join('、'));
console.log('│ 用神: ' + yj.yongShen.join('、'));
console.log('│ 忌神: ' + yj.jiShen.join('、'));
console.log('│ 判定方式: ' + yj.method);
console.log('└────────────────────────────────────────────');
console.log('');

// ── 逐步复算（严格照抄 bazi.js calcDayMasterStrength 的规则）──
console.log('┌─ 逐步复算 ─────────────────────────────────');
var score = 50;
function mark(note, delta) {
  score += delta;
  var sign = delta >= 0 ? '+' : '';
  console.log('│ ' + String(score - delta).padStart(3) + sign + (delta===0?' ':delta) + ' = ' + String(score).padStart(3) + '   ' + note);
}
console.log('│  50   基准分');
mark('① 得令: 丑月本气土=日主土，土生丑月=囚 → -8（季节折算）', -8);

mark('② 得地: 日支申(金) = 我生(食伤) → -7', -7);

// ③ 得势：年月时天干（不含日干自身——基准50已代表日主）
var relMap = { '土':[6,'比劫'], '火':[4,'印'], '木':[-4,'官杀'], '金':[-3,'食伤'], '水':[-5,'财'] };
['year','month','hour'].forEach(function(pos) {
  var gwx = WX[bazi[pos].gan];
  var d = relMap[gwx][0];
  mark('③ 得势: ' + pos + '干' + bazi[pos].gan + '(' + gwx + ') ' + relMap[gwx][1] + ' ' + (d>=0?'+':'') + d, d);
});

// ④ 藏干本气
[['year','亥'],['month','丑'],['day','申'],['hour','戌']].forEach(function(p) {
  var cg = getCangGan(bazi[p[0]].zhi);
  var g = cg[0], gwx = WX[g], d = 0, note = p[0] + '支' + p[1] + ' 本气' + g;
  if (gwx === dgWx) { d = 3; note += ' 比劫 +3'; }
  else if (gwx === '火') { d = 2; note += ' 印 +2'; }
  else if (gwx === '木') { d = -2; note += ' 官杀 -2'; }
  else if (gwx === '金') { d = -1; note += ' 食伤 -1'; }
  else if (gwx === '水') { d = -2; note += ' 财 -2'; }
  mark('④ 藏干: ' + note, d);
});

// ⑤ 五行过耗：月令五行=土，count=戊干+丑支+戌支=3，但月令=日主非囚休令 → 不触发
mark('⑤ 过耗: 月令土=日主，非囚/休令，不触发', 0);

// ⑥ 调候：丑月=冬，日主土≠火
mark('⑥ 调候: 冬季有火(丁)暖局 +5', 5);
mark('⑥ 调候: 土日主丑月，火暖则土活 +5', 5);

// ⑦ 天干合化：癸戊合(火)，月令丑(土)不司火 → 不化，0
mark('⑦ 五合: 癸戊合但月令不司火，不化', 0);

// ⑧ 相邻地支：亥丑/丑申/申戌 无冲害刑合
mark('⑧ 相邻地支: 无冲害刑合', 0);
// 六害/六刑只查相邻柱——申亥害(年日)、丑戌刑(月时)为跨柱，引擎不检（已知局限）
mark('⑧ 跨柱害刑: 申亥害/丑戌刑为跨柱，当前引擎不检', 0);
// 三合局：申子辰缺子、亥卯未缺卯未、寅午戌缺寅午、巳酉丑缺巳酉 → 无
mark('⑧ 三合局: 无', 0);
// 三会局：亥子丑缺子 → 无；申酉戌缺酉 → 无
mark('⑧ 三会局: 无', 0);
// 跨柱六冲：无
mark('⑧ 跨柱六冲: 无', 0);
// 日支合化：申不在任何合 → 无
mark('⑧ 日支合化: 无', 0);

// ⑧½ 杀印相生：月令土≠官杀(木) → 不触发
mark('⑧½ 杀印相生: 月令非官杀，不触发', 0);

// ⑧¾ 宫位远近：月干癸=财、时干壬=财、年干丁=印 → 规则均不命中
mark('⑧¾ 宫位远近: 不命中', 0);

console.log('│ ────────────────────────────────');
console.log('│ 复算总分: ' + score + '（引擎: ' + engine.score + '）' + (score === engine.score ? ' ✓ 对账一致' : ' ✗ 有偏差，需查复算误差'));
console.log('└────────────────────────────────────────────');
console.log('');

// ── 断言 ──
var failures = [];
function check(name, cond, detail) {
  var ok = cond ? '✓' : '✗';
  console.log(' ' + ok + ' ' + name + (detail ? '（' + detail + '）' : ''));
  if (!cond) failures.push(name);
}
console.log('┌─ 断言 ─────────────────────────────────────');
check('复算与引擎对账一致', score === engine.score, 'trace=' + score + ' engine=' + engine.score);
check('不再判身强（旧值86极强）', engine.score < 60, engine.score + '分');
check('级别为中和（修复后42分）', engine.level === '中和', engine.level);
check('喜用忌方向正确：喜火土', yj.xiShen.indexOf('火') >= 0 && yj.xiShen.indexOf('土') >= 0, yj.xiShen.join('、'));
check('忌神含水（忌财）', yj.jiShen.indexOf('水') >= 0, yj.jiShen.join('、'));
check('无喜忌冲突（火不在忌神）', yj.jiShen.indexOf('火') < 0, yj.jiShen.join('、'));
console.log('└────────────────────────────────────────────');
console.log('');
if (failures.length > 0) {
  console.log('❌ 测试失败: ' + failures.join('; '));
  process.exit(1);
} else {
  console.log('✅ 全部断言通过');
}
