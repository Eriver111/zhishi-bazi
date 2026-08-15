// P4-A-EVID-01 定向验证（2026-08-15，GPT 终裁批准）：
//   1. 四生四正月 8 组合同五行异阴阳透干组合：source 必须为「本气/透干分开描述」新格式；
//   2. 全量 1940-2010 h=6 真实出生盘：pattern.source 中所有「藏X」的 X 必须 ∈ getCangGan(月支)；
//      source 含「本气」的必须匹配新格式模板且字段正确（月支/本气/日干/柱/透干/五行/格局名）。
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
var ENG = loadEngine('js/bazi.js');

var WUX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };

function buildPillars(gz) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}

var ok = true;
var md = [];
md.push('# P4-A-EVID-01 定向用例结果（2026-08-15）');
md.push('');
md.push('> 断言：所有 pattern.source 中「藏X」的 X ∈ getCangGan(月支)；「本气」格式新文案字段全部正确。');
md.push('');

// ---- 1. 四生四正月 8 组合同五行异阴阳透干（构造盘：透干均在年柱，时干避开藏干精确匹配） ----
md.push('## 1. 四生四正月 8 组合（同五行异阴阳透干，构造盘）');
md.push('');
md.push('| 组合 | 四柱 | 本气十神 | source |');
md.push('|---|---|---|---|');
var COMBOS = [
  ['寅本气甲↔透乙(丁日主)', '乙酉 戊寅 丁丑 癸卯'],
  ['申本气庚↔透辛(丙日主)', '辛巳 丙申 丙子 甲午'],
  ['巳本气丙↔透丁(壬日主)', '丁亥 乙巳 壬寅 甲辰'],
  ['亥本气壬↔透癸(戊日主)', '癸未 己亥 戊子 丙辰'],
  ['子本气癸↔透壬(戊日主)', '壬午 庚子 戊寅 乙卯'],
  ['午本气丁↔透丙(甲日主)', '丙戌 庚午 甲申 庚午'],
  ['卯本气乙↔透甲(丙日主)', '甲辰 辛卯 丙子 戊子'],
  ['酉本气辛↔透庚(丁日主)', '庚寅 乙酉 丁亥 癸卯']
];
var NEW_FMT = /^月支(.)本气(.)，为日主(.)之(.+)；(.)柱透(.)，同属(.)气，强化月令\4之势 → 取(.+)$/;
COMBOS.forEach(function (c) {
  var b = buildPillars(c[1]);
  var p = ENG.getPattern(b);
  var benQi = ENG.getCangGan(b.month.zhi)[0];
  var m = NEW_FMT.exec(p.source);
  var good = !!m && m[1] === b.month.zhi && m[2] === benQi && m[3] === b.day.gan
    && m[5] === '年' && m[6] === c[1][0][0] && m[7] === WUX[benQi] && m[8] === p.name;
  if (!good) ok = false;
  md.push('| ' + c[0] + ' | ' + c[1] + ' | ' + ENG.getShiShen(b.day.gan, benQi) + ' | ' + (good ? '✅' : '❌') + ' ' + p.source + ' |');
});
md.push('');

// ---- 2. 全量 1940-2010 h=6 真实出生盘 ----
md.push('## 2. 全量真实盘断言（1940-2010，h=6）');
md.push('');
var total = 0, cangCount = 0, benQiCount = 0, bad = [];
for (var y = 1940; y <= 2010; y++) {
  for (var mo = 1; mo <= 12; mo++) {
    for (var d = 1; d <= 31; d++) {
      var b = ENG.calculate(y, mo, d, 6, 'male', 0, 0);
      if (!b || !b.month) continue;
      total++;
      var p = ENG.getPattern(b);
      var src = p.source || '';
      var cang = ENG.getCangGan(b.month.zhi);
      // 断言 A：「藏X」的 X 必须在月支藏干中
      var re = /藏([甲乙丙丁戊己庚辛壬癸])/g, mm;
      while ((mm = re.exec(src)) !== null) {
        cangCount++;
        if (cang.indexOf(mm[1]) < 0) {
          bad.push(y + '-' + mo + '-' + d + ' 「藏' + mm[1] + '」∉ 月支藏干' + cang.join('') + ' | ' + src);
        }
      }
      // 断言 B：「本气」格式必须完全匹配新模板且字段正确
      if (src.indexOf('本气') >= 0) {
        benQiCount++;
        var m2 = NEW_FMT.exec(src);
        if (!m2 || m2[1] !== b.month.zhi || m2[2] !== cang[0] || m2[3] !== b.day.gan
          || m2[7] !== WUX[cang[0]] || m2[8] !== p.name
          || m2[6] === m2[2] || WUX[m2[6]] !== m2[7]) {
          // 透干必须是月支藏干之外的同五行干（≠本气 且 五行与本气相同）
          bad.push(y + '-' + mo + '-' + d + ' 本气格式错 | ' + src);
        }
      }
    }
  }
}
md.push('- 总盘数：' + total);
md.push('- 含「藏X」文案盘次：' + cangCount + '，全部 X ∈ 月支藏干' + (bad.length ? ' ❌' : ' ✅'));
md.push('- 含「本气」新格式盘数：' + benQiCount + '，模板匹配+字段校验全部通过' + (bad.length ? ' ❌' : ' ✅'));
md.push('');
if (bad.length) {
  ok = false;
  md.push('## ❌ 违规项');
  bad.slice(0, 20).forEach(function (s) { md.push('- ' + s); });
  if (bad.length > 20) md.push('- …共 ' + bad.length + ' 项');
} else {
  md.push('## ✅ 全部断言通过');
}
md.push('');
fs.writeFileSync(path.join(__dirname, '00-EVID01-定向用例.md'), md.join('\n'), 'utf8');
console.log(md.join('\n'));
process.exit(ok ? 0 : 1);
