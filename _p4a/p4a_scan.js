// P4-A 定向用例扫描 v4（2026-08-14，GPT 必测清单）：
//   A1：帝旺月 + 本气比劫透干。v3 实测发现 matchedSS 循环遍历四柱所有天干（不限于月干）——
//       本气透年干/时干同样置位 matchedSS=比劫 → pre 同五行兜底=建禄格 → 补丁后帝旺特判=羊刃格。
//       即 A1 触发面 = 8 组合全部（甲@卯/乙@寅/丙@午/丁@巳/庚@酉/辛@申/壬@子/癸@亥），
//       五虎遁只决定本气透在哪个柱（午/子月干∈{庚壬甲丙戊}、巳/亥月干∈{己辛癸乙丁}）。
//       断言：pre 建禄格 → post 羊刃格，且 旺衰/用神/喜神/忌神 零漂移。
//   A2：①从杀+复合 ②从势+伤官生财 ③从财+复合财格 ③b从财+普通财格（pre 正常路径已覆盖为从格名，零回归锚点）。
// 时柱参数 h = 时支序号 0-11（子=0…午=6），已由 v1 输出反推验证。
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
var PRE = loadEngine('_p4a/bazi.pre.js');
var POST = loadEngine('js/bazi.js');

var GAN = '甲乙丙丁戊己庚辛壬癸';
var ZHI = '子丑寅卯辰巳午未申酉戌亥';
function gz(b) { return [b.year, b.month, b.day, b.hour].map(function (p) { return p.gan + p.zhi; }).join(' '); }
function calc(y, m, d, h) { return POST.calculate(y, m, d, h, 'male', 0, 0); }
function calcFromDate(birth, h) {
  var p = birth.split('-').map(Number);
  return calc(p[0], p[1], p[2], h);
}

// ---- 1. 引擎十二长生表 dump ----
var tableLines = [];
GAN.split('').forEach(function (g) {
  var stages = ZHI.split('').map(function (z) {
    var s = PRE.getChangSheng(g)[z];
    return z + ':' + (s && s.stage || '?');
  }).join(' ');
  tableLines.push('- ' + g + '：' + stages);
});

// ---- 2. A1 组合枚举（五虎遁只影响本气透在哪个柱，不影响触发） ----
// 月干 = f(年干idx%5)：月干idx = (年idx%5)*2 + 2 + ((月支idx-2+12)%12) mod 10
function possibleMonthGans(zhi) {
  var zIdx = ZHI.indexOf(zhi);
  var set = {};
  for (var r = 0; r < 5; r++) {
    var gIdx = (r * 2 + 2 + ((zIdx - 2 + 12) % 12)) % 10;
    set[GAN[gIdx]] = true;
  }
  return set;
}
var A1_COMBOS = [];
GAN.split('').forEach(function (g) {
  ZHI.split('').forEach(function (z) {
    var st = PRE.getChangSheng(g)[z];
    if (!st || st.stage !== '帝旺') return;
    var benQi = PRE.getCangGan(z)[0];
    var ss = PRE.getShiShen(g, benQi);
    if (ss === '比肩' || ss === '劫财') {
      A1_COMBOS.push({
        dayGan: g, monthZhi: z, benQi: benQi, ss: ss,
        monthGanPossible: possibleMonthGans(z).hasOwnProperty(benQi) // 本气能否出现在月干（五虎遁）
      });
    }
  });
});
var a1Found = {};
A1_COMBOS.forEach(function (c) { a1Found[c.dayGan + c.monthZhi] = []; });
function a1NeedsMore(k) { return a1Found[k].length < 3; }
function tryCollectA1(b, h, combo, y, m, d) {
  var bq = PRE.getCangGan(b.month.zhi)[0];
  var gans = [b.year.gan, b.month.gan, b.hour.gan];
  if (gans.indexOf(bq) < 0) return;                 // 本气未透干
  var st = PRE.getChangSheng(b.day.gan)[b.month.zhi];
  if (!st || st.stage !== '帝旺') return;
  var k = b.day.gan + b.month.zhi;
  if (!a1NeedsMore(k)) return;
  var seen = a1Found[k].map(function (f) { return f.gz; });
  var g = gz(b);
  if (seen.indexOf(g) < 0) {
    var where = [];
    if (b.year.gan === bq) where.push('年干');
    if (b.month.gan === bq) where.push('月干');
    if (b.hour.gan === bq) where.push('时干');
    a1Found[k].push({ gz: g, birth: y + '-' + m + '-' + d, hour: h, where: where.join('+') });
  }
}
// 第一遍 hour=6（午时）
for (var y = 1940; y <= 2010; y++) {
  for (var m = 1; m <= 12; m++) {
    for (var d = 1; d <= 31; d++) {
      var b1 = calc(y, m, d, 6);
      for (var ci = 0; ci < A1_COMBOS.length; ci++) {
        var c = A1_COMBOS[ci];
        if (b1.day.gan !== c.dayGan || b1.month.zhi !== c.monthZhi) continue;
        tryCollectA1(b1, 6, c, y, m, d);
      }
    }
  }
}
// 第二遍：缺口组合全 12 时柱
for (var ci2 = 0; ci2 < A1_COMBOS.length; ci2++) {
  var c2 = A1_COMBOS[ci2];
  var k2 = c2.dayGan + c2.monthZhi;
  if (!a1NeedsMore(k2)) continue;
  doneA1:
  for (var y2 = 1940; y2 <= 2010; y2++) {
    for (var m2 = 1; m2 <= 12; m2++) {
      for (var d2 = 1; d2 <= 31; d2++) {
        var probe = calc(y2, m2, d2, 6);
        if (probe.month.zhi !== c2.monthZhi || probe.day.gan !== c2.dayGan) continue;
        for (var h2 = 0; h2 <= 11; h2++) {
          if (h2 === 6) continue;
          tryCollectA1(calc(y2, m2, d2, h2), h2, c2, y2, m2, d2);
          if (!a1NeedsMore(k2)) break doneA1;
        }
      }
    }
  }
}

// ---- 3. A2 扫描 ----
var a2Kill = { class1: [], class2: [], class3: [] };
var a2Ordinary = [];
function tryCollectA2(b, h, y, m, d) {
  var prePt = PRE.getPattern(b);
  var preCg = PRE.getCongGe(b);
  if (!preCg.isCong) return;
  if (prePt.type === '同柱复合') {
    if (preCg.name.indexOf('杀') >= 0 && a2Kill.class1.length < 2) a2Kill.class1.push({ gz: gz(b), birth: y + '-' + m + '-' + d, hour: h, cong: preCg.name, compound: prePt.name });
    if (preCg.name.indexOf('势') >= 0 && prePt.name.indexOf('伤官生财') >= 0 && a2Kill.class2.length < 2) a2Kill.class2.push({ gz: gz(b), birth: y + '-' + m + '-' + d, hour: h, cong: preCg.name, compound: prePt.name });
    if (preCg.name.indexOf('财') >= 0 && prePt.name.indexOf('财') >= 0 && a2Kill.class3.length < 2) a2Kill.class3.push({ gz: gz(b), birth: y + '-' + m + '-' + d, hour: h, cong: preCg.name, compound: prePt.name });
  } else if (preCg.name.indexOf('财') >= 0 && a2Ordinary.length < 2) {
    // ③b 从财+普通财格：非复合路径 + pre.basePattern 为月令正/偏财格（pre 已覆盖为从财格名）
    var bp = (prePt.basePattern || '').split('·')[0];
    if (bp === '正财格' || bp === '偏财格') {
      a2Ordinary.push({ gz: gz(b), birth: y + '-' + m + '-' + d, hour: h, cong: preCg.name, basePattern: prePt.basePattern });
    }
  }
}
for (var y3 = 1940; y3 <= 2010; y3++) {
  for (var m3 = 1; m3 <= 12; m3++) {
    for (var d3 = 1; d3 <= 31; d3++) tryCollectA2(calc(y3, m3, d3, 6), 6, y3, m3, d3);
  }
}
var needA2More = function () { return a2Kill.class1.length < 2 || a2Kill.class2.length < 2 || a2Kill.class3.length < 2 || a2Ordinary.length < 2; };
if (needA2More()) {
  outer2:
  for (var y4 = 1940; y4 <= 2010; y4++) {
    for (var m4 = 1; m4 <= 12; m4++) {
      for (var d4 = 1; d4 <= 31; d4++) {
        for (var h4 = 0; h4 <= 11; h4++) {
          if (h4 === 6) continue;
          tryCollectA2(calc(y4, m4, d4, h4), h4, y4, m4, d4);
          if (!needA2More()) break outer2;
        }
      }
    }
  }
}

// ---- 4. 验证输出 ----
function snap(eng, b) {
  var pt = eng.getPattern(b);
  var yj = eng.getYongJi(b);
  var dm = eng.calcDayMasterStrength(b);
  return {
    score: String(dm.score), level: dm.level,
    yong: yj.yongShen.join('、'), xi: yj.xiShen.join('、'), ji: yj.jiShen.join('、'),
    pattern: pt.name, status: pt.status, ptype: pt.type, basePattern: pt.basePattern || '-',
    congGe: !!pt.congGe, yjMethod: yj.method || '-'
  };
}
function patternOf(f) {
  var b = calcFromDate(f.birth, f.hour);
  return { pre: snap(PRE, b), post: snap(POST, b) };
}
var md = [];
md.push('# P4-A 定向用例扫描结果 v4（1940-2010 真实出生）');
md.push('');
md.push('> 组合枚举来自引擎长生表本身（getPattern 4271 行直接查 getChangSheng(dayGan)[月支]）。');
md.push('> **v3 实测修正**：matchedSS 循环遍历四柱所有天干（不限于月干）——本气透年干/时干同样置位 matchedSS=比劫，');
md.push('> pre 同五行兜底=建禄格 → 补丁后帝旺特判=羊刃格。即 A1 触发面 = 8 组合全部（4 阳干 + 4 阴干），');
md.push('> 五虎遁只决定本气透在哪个柱：午/子月干∈{庚壬甲丙戊}、巳/亥月干∈{己辛癸乙丁} → 丙@午/丁@巳/壬@子/癸@亥 只能透年/时干。');
md.push('');
md.push('## 引擎十二长生表（PRE.getChangSheng dump）');
md.push(tableLines.join('\n'));
md.push('');
md.push('## A1 组合（帝旺月 + 本气比劫透干）pre→post 验证（含旺衰/用喜忌零漂移）');
md.push('');
md.push('| 组合 | 本气十神 | 本气可透月干 | 示例盘（出生+时） | 透干位置 | pre 格局 | post 格局 | 状态 | 五行漂移 |');
md.push('|---|---|---|---|---|---|---|---|---|');
A1_COMBOS.forEach(function (c) {
  var found = a1Found[c.dayGan + c.monthZhi];
  found.forEach(function (f) {
    var r = patternOf(f);
    var leak = ['score', 'level', 'yong', 'xi', 'ji'].some(function (k) { return r.pre[k] !== r.post[k]; });
    md.push('| ' + c.dayGan + '@' + c.monthZhi + ' 本气' + c.benQi + '(' + c.ss + ') | ' + c.ss + ' | ' + (c.monthGanPossible ? '✅' : '❌') + ' | ' + f.gz + '（' + f.birth + ' ' + ZHI[f.hour] + '时） | ' + f.where + ' | ' + r.pre.pattern + ' | ' + r.post.pattern + ' | ' + r.post.status + ' | ' + (leak ? '❌漂移' : '✓零') + ' |');
  });
  if (!found.length) md.push('| ' + c.dayGan + '@' + c.monthZhi + ' | ' + c.ss + ' | ' + (c.monthGanPossible ? '✅' : '❌') + ' | ❌ 未找到 | — | — | — | — | — |');
});
md.push('');
md.push('## A2 从格+复合/财格 验证（pre 复合名 → post 从格名）');
md.push('');
md.push('| 类 | 四柱（出生+时） | 从格 | pre 格局 | post 格局 | basePattern |');
md.push('|---|---|---|---|---|---|');
function a2Row(f, label) {
  var r = patternOf(f);
  return '| ' + label + ' | ' + f.gz + '（' + f.birth + ' ' + ZHI[f.hour] + '时） | ' + f.cong + ' | ' + r.pre.pattern + '·' + r.pre.status + ' | ' + r.post.pattern + '·' + r.post.status + ' | ' + r.post.basePattern + ' |';
}
a2Kill.class1.forEach(function (f) { md.push(a2Row(f, '①从杀+复合')); });
if (!a2Kill.class1.length) md.push('| ①从杀+复合 | ❌ 未找到 | — | — | — | — |');
a2Kill.class2.forEach(function (f) { md.push(a2Row(f, '②从势+伤官生财')); });
if (!a2Kill.class2.length) md.push('| ②从势+伤官生财 | ❌ 未找到 | — | — | — | — |');
a2Kill.class3.forEach(function (f) { md.push(a2Row(f, '③从财+复合财格')); });
if (!a2Kill.class3.length) md.push('| ③从财+复合财格 | ❌ 未找到（1940-2010） | — | — | — | — |');
a2Ordinary.forEach(function (f) { md.push(a2Row(f, '③b从财+普通财格(零回归)')); });
if (!a2Ordinary.length) md.push('| ③b从财+普通财格 | ❌ 未找到（1940-2010） | — | — | — | — |');
md.push('');
md.push('## 断言');
var ok = true;
A1_COMBOS.forEach(function (c) {
  a1Found[c.dayGan + c.monthZhi].forEach(function (f) {
    var r = patternOf(f);
    if (!(r.pre.pattern === '建禄格' && r.post.pattern === '羊刃格')) {
      ok = false; md.push('- ❌ A1 ' + f.gz + ': ' + r.pre.pattern + '→' + r.post.pattern + '（期望 建禄格→羊刃格）');
    }
    ['score', 'level', 'yong', 'xi', 'ji'].forEach(function (k) {
      if (r.pre[k] !== r.post[k]) { ok = false; md.push('- ❌ A1漂移 ' + f.gz + ' ' + k + ': ' + r.pre[k] + '→' + r.post[k]); }
    });
  });
});
a2Kill.class1.concat(a2Kill.class2, a2Kill.class3).forEach(function (f) {
  var r = patternOf(f);
  var bad = r.post.pattern !== f.cong || !r.post.congGe || (r.post.basePattern || '').indexOf(r.pre.pattern) !== 0;
  if (bad) { ok = false; md.push('- ❌ A2 ' + f.gz + ': post=' + r.post.pattern + ' congGe=' + r.post.congGe + ' basePattern=' + r.post.basePattern + '（期望 ' + f.cong + ' 覆盖 ' + r.pre.pattern + '）'); }
});
a2Ordinary.forEach(function (f) {
  var r = patternOf(f);
  if (r.pre.pattern !== r.post.pattern || r.post.pattern !== f.cong || r.post.basePattern !== f.basePattern) { ok = false; md.push('- ❌ A2③b ' + f.gz + ': ' + r.pre.pattern + '→' + r.post.pattern + ' basePattern ' + f.basePattern + '→' + r.post.basePattern + '（期望零变化）'); }
});
md.push(ok ? '✅ 全部定向用例通过' : '❌ 有失败项');
fs.writeFileSync(path.join(__dirname, '00-定向用例.md'), md.join('\n'), 'utf8');
console.log(md.join('\n'));
process.exit(ok ? 0 : 1);
