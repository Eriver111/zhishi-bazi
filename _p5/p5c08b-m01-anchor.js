// P5-C08 补充（用户规格 2026-08-16）：三概念区分 + M01 真从锚邻近对照。
// 三概念：1.从格候选（入口=strength 极弱） 2.真从失败（realCong.pass/failReasons） 3.假从（fakeCong.checked/failReasons）。
// 用户推荐输出字段 + followType（若根气门放开该盘会落哪一真从分支）。
// M01=壬子 壬子 丁酉 辛亥（池内=S04，从杀格）真从锚；三个邻近对照各改一字：M01b 日支酉→巳 / M01c 月干壬→甲 / M01d 时支亥→卯。
// 三锚点 + D03/D04/D07/D08 翻转盘同输出。纯证据零引擎改动。
// 输出 _p5/p5c08b-m01-output.json；控制台仅 ASCII 摘要（Windows GBK 安全）。
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.join(__dirname, '..');

var WX = ['木', '火', '土', '金', '水'];
var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
var ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
var CANG_GAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'],
  酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
};

function load(src) { var ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.BaZiCalculator; }
var ENG = load(fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8'));

function build(gz, sex) {
  var p = gz.split(' ');
  return ENG.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] }, month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] }, hour: { gan: p[3][0], zhi: p[3][1] }
  }, sex || 'male', null);
}

function extendedTrace(gz, sex, id) {
  var b = build(gz, sex);
  var dm = ENG.calcDayMasterStrength(b);
  var dgWx = GAN_WX[b.day.gan];
  var di = WX.indexOf(dgWx);
  var SHENGWO = WX[(di + 4) % 5], WOSHENG = WX[(di + 1) % 5];
  var KEWO = WX[(di + 3) % 5], WOKE = WX[(di + 2) % 5];

  var powers = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  ['year', 'month', 'day', 'hour'].forEach(function (pos) {
    powers[GAN_WX[b[pos].gan]] += 2;
    powers[ZHI_WX[b[pos].zhi]] += 1;
  });
  var P = { dg: powers[dgWx], ke: powers[KEWO], cai: powers[WOKE], shi: powers[WOSHENG], yin: powers[SHENGWO] };

  var dayCG = CANG_GAN[b.day.zhi];
  var dayRoot = dayCG.some(function (g) { var w = GAN_WX[g]; return w === dgWx || w === SHENGWO; });
  var ganHelp = [b.year.gan, b.month.gan, b.hour.gan].some(function (g) {
    var w = GAN_WX[g]; return w === SHENGWO || w === dgWx;
  });
  var zhiHelp = false;
  if (!ganHelp) {
    ['year', 'month', 'day', 'hour'].forEach(function (pos) {
      var cg = CANG_GAN[b[pos].zhi];
      if (cg.length) { var w = GAN_WX[cg[0]]; if (w === SHENGWO || w === dgWx) zhiHelp = true; }
    });
  }
  var canCong = dm.level === '极弱' && !dayRoot && !ganHelp && !zhiHelp;

  // 从强（极强方向，单独记录，不混入极弱三概念链）
  var hasCangKeXie = false;
  ['year', 'month', 'day', 'hour'].forEach(function (pos) {
    CANG_GAN[b[pos].zhi].forEach(function (g) {
      var w = GAN_WX[g]; if (w === KEWO || w === WOSHENG || w === WOKE) hasCangKeXie = true;
    });
  });
  var dayZhiWx = ZHI_WX[b.day.zhi];
  var dayZhiIsKeXie = (KEWO === dayZhiWx || WOSHENG === dayZhiWx || WOKE === dayZhiWx);
  var bQiang = dm.level === '极强' && P.ke <= 1 && P.shi <= 1 && !dayZhiIsKeXie && !hasCangKeXie;

  // 真从三分支（仅 canCong 后检查）
  var bSha = canCong && P.ke >= 6 && P.ke >= P.dg * 2;
  var bCai = canCong && P.cai >= 6 && P.cai >= P.dg * 2;
  var bEr = canCong && P.shi >= 6 && P.shi >= P.dg * 2;
  var bJia = canCong && (P.ke + P.cai + P.shi) >= (P.dg + P.yin) * 2;

  // followType：若根气门放开（或已放开），势力条件命中哪一支
  var follow = bSha ? '从杀' : bCai ? '从财' : bEr ? '从儿' : bJia ? '假从势' : null;
  if (!follow) {
    if (P.ke >= 6 && P.ke >= P.dg * 2) follow = '从杀';
    else if (P.cai >= 6 && P.cai >= P.dg * 2) follow = '从财';
    else if (P.shi >= 6 && P.shi >= P.dg * 2) follow = '从儿';
    else if ((P.ke + P.cai + P.shi) >= (P.dg + P.yin) * 2) follow = '假从势';
  }

  var name = bQiang ? '从强格' : bSha ? '从杀格' : bCai ? '从财格' : bEr ? '从儿格' : bJia ? '假从势格' : null;

  // 真从失败理由（三分支逐一）
  var realFail = [];
  if (!bSha) realFail.push('从杀: ke=' + P.ke + ' (need >=6 and >=dg*2=' + (P.dg * 2) + ')');
  if (!bCai) realFail.push('从财: cai=' + P.cai + ' (need >=6 and >=dg*2=' + (P.dg * 2) + ')');
  if (!bEr) realFail.push('从儿: shi=' + P.shi + ' (need >=6 and >=dg*2=' + (P.dg * 2) + ')');

  // 假从失败理由（未检查时=阻断门）
  var fakeFail = [];
  if (!canCong) {
    if (dm.level !== '极弱') fakeFail.push('level gate: ' + dm.level + '(' + dm.score + ') not 极弱(<30)');
    if (dayRoot) fakeFail.push('dayRoot gate: day zhi ' + b.day.zhi + ' cangGan [' + dayCG.join('') + '] has ' + dgWx + '/' + SHENGWO);
    if (ganHelp) fakeFail.push('ganHelp gate: tian gan透 ' + SHENGWO + '/' + dgWx);
    if (zhiHelp) fakeFail.push('zhiHelp gate: branch main qi has ' + SHENGWO + '/' + dgWx);
  }

  var eng = ENG.getCongGe(b);
  var yj = ENG.getYongJi(b);
  var pat = ENG.getPattern(b);
  return {
    id: id || gz, gz: gz, sex: sex || 'male',
    strength: { score: dm.score, label: dm.level },
    candidate: dm.level === '极弱',
    powers: P,
    gates: { dayRoot: dayRoot, ganHelp: ganHelp, zhiHelp: zhiHelp, canCong: canCong },
    followType: follow,
    realCong: { checked: canCong, pass: bSha || bCai || bEr, name: (bSha ? '从杀格' : bCai ? '从财格' : bEr ? '从儿格' : null), failReasons: canCong ? realFail : [] },
    fakeCong: { checked: canCong, pass: bJia, failReasons: canCong ? [] : fakeFail },
    congQiang: { checked: dm.level === '极强', pass: bQiang, failReasons: bQiang ? [] : (dm.level === '极强' ? ['ke=' + P.ke + '(need<=1)', 'shi=' + P.shi + '(need<=1)', 'dayZhiIsKeXie=' + dayZhiIsKeXie, 'hasCangKeXie=' + hasCangKeXie] : []) },
    engineName: eng.isCong ? eng.name : null,
    match: eng.isCong ? (eng.name === name) : (name === null),
    final: { pattern: pat.name + '/' + pat.status, yong: yj.yongShen, xi: yj.xiShen, ji: yj.jiShen }
  };
}

var TARGETS = [
  ['M01', '壬子 壬子 丁酉 辛亥', '真从锚（池内=S04 从杀格）'],
  ['M01b', '壬子 壬子 丁巳 辛亥', 'M01 改一字：日支酉→巳（巳藏丙火劫财=dayRoot 余气根）'],
  ['M01c', '壬子 甲子 丁酉 辛亥', 'M01 改一字：月干壬→甲（甲=正印透干=ganHelp）'],
  ['M01d', '壬子 壬子 丁酉 辛卯', 'M01 改一字：时支亥→卯（卯=乙木本气印=zhiHelp）'],
  ['ANCH1', '丁亥 丙午 癸巳 己卯', 'GPT 锚点1：极弱不从'],
  ['ANCH2', '戊子 丁巳 癸亥 庚申', 'GPT 锚点2：中和/49（前提修正）'],
  ['ANCH3', '己丑 甲戌 癸巳 丙辰', 'GPT 锚点3：极弱不从'],
  ['D03', '戊戌 己未 癸巳 丙午', 'D03 余气根翻转（不从）'],
  ['D04', '戊戌 己未 癸未 丙午', 'D04 D03 对照（从杀）'],
  ['D07', '戊戌 丙午 癸卯 戊申', 'D07 本气印 zhiHelp（不从）'],
  ['D08', '戊戌 丙午 癸卯 己巳', 'D08 D07 对照（假从）']
];

var out = { meta: { title: 'P5-C08 extended trace (candidate/realCong/fakeCong) + M01 neighbor comparison', date: '2026-08-16', engine: 'js/bazi.js AFTER_P5_C07' }, traces: [] };
TARGETS.forEach(function (t) {
  var r = extendedTrace(t[1], 'male', t[0]);
  r.intent = t[2];
  out.traces.push(r);
  console.log(r.id + ' ' + r.gz + ' | dm=' + r.strength.label + '/' + r.strength.score + ' | cand=' + r.candidate + ' | gates=' + (r.gates.dayRoot ? 'D' : '-') + (r.gates.ganHelp ? 'G' : '-') + (r.gates.zhiHelp ? 'Z' : '-') + ' | real.pass=' + r.realCong.pass + ' | fake.checked=' + r.fakeCong.checked + ' fake.pass=' + r.fakeCong.pass + ' | eng=' + (r.engineName || 'NONE') + ' | yong=' + r.final.yong.join(''));
});
fs.writeFileSync(path.join(__dirname, 'p5c08b-m01-output.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('output -> _p5/p5c08b-m01-output.json');
