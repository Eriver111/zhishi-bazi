// P5-C08 假从边界审计 EVIDENCE（2026-08-16，GPT 规格）——纯证据，零引擎改动。
// 目标：拆解 getCongGe 决策链（dm level/score -> 根气三门 dayRoot/ganHelp/zhiHelp -> canCong
//   -> 从强/从杀/从财/从儿/假从势 分支 -> 最终 isCong/普通格），用独立复刻 trace 与引擎互证。
// 三锚点 + 四组攻击集（A 极弱真从 / B 极弱不从 / C 极弱假从 / D 极弱边界翻转）+ 全历史盘池扫描。
// 输出 _p5/p5c08-output.json；控制台仅 ASCII 摘要（Windows GBK 安全）。
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

// ---- 独立复刻 trace（重写 getCongGe 决策链，不与引擎共享中间态；dm 用引擎冻结基础层）----
function traceOne(gz, sex, id) {
  var b = build(gz, sex);
  var dm = ENG.calcDayMasterStrength(b); // 旺衰=冻结基础层（C08 审计对象是它之上的从格判定）
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

  // 根气三门
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

  // 从强（极强方向）分支
  var hasCangKeXie = false;
  ['year', 'month', 'day', 'hour'].forEach(function (pos) {
    CANG_GAN[b[pos].zhi].forEach(function (g) {
      var w = GAN_WX[g]; if (w === KEWO || w === WOSHENG || w === WOKE) hasCangKeXie = true;
    });
  });
  var dayZhiWx = ZHI_WX[b.day.zhi];
  var dayZhiIsKeXie = (KEWO === dayZhiWx || WOSHENG === dayZhiWx || WOKE === dayZhiWx);
  var bQiang = dm.level === '极强' && P.ke <= 1 && P.shi <= 1 && !dayZhiIsKeXie && !hasCangKeXie;

  // 极弱方向四分支
  var bSha = canCong && P.ke >= 6 && P.ke >= P.dg * 2;
  var bCai = canCong && P.cai >= 6 && P.cai >= P.dg * 2;
  var bEr = canCong && P.shi >= 6 && P.shi >= P.dg * 2;
  var bJia = canCong && (P.ke + P.cai + P.shi) >= (P.dg + P.yin) * 2;

  var name = bQiang ? '从强格' : bSha ? '从杀格' : bCai ? '从财格' : bEr ? '从儿格' : bJia ? '假从势格' : null;

  var fr = '';
  if (name) { /* 成格 */ }
  else if (dm.level === '极强') {
    fr = 'congQiang branch: ke=' + P.ke + ' shi=' + P.shi + ' dayZhiIsKeXie=' + dayZhiIsKeXie + ' hasCangKeXie=' + hasCangKeXie;
  } else if (dm.level !== '极弱') {
    fr = 'level gate: ' + dm.level + '(' + dm.score + ') not 极弱(<30)';
  } else if (dayRoot) {
    fr = 'dayRoot gate: day zhi ' + b.day.zhi + ' cangGan [' + dayCG.join('') + '] has ' + dgWx + '/' + SHENGWO;
  } else if (ganHelp) {
    fr = 'ganHelp gate: tian gan透 ' + SHENGWO + '/' + dgWx;
  } else if (zhiHelp) {
    fr = 'zhiHelp gate: branch main qi has ' + SHENGWO + '/' + dgWx;
  } else {
    fr = 'power gate: ke=' + P.ke + ' cai=' + P.cai + ' shi=' + P.shi + ' (need one>=6 & >=dg*2=' + (P.dg * 2) + '); keXieHao=' + (P.ke + P.cai + P.shi) + ' vs shengFu*2=' + ((P.dg + P.yin) * 2);
  }

  var eng = ENG.getCongGe(b);
  var engName = eng.isCong ? eng.name : null;
  var r = {
    id: id || gz, gz: gz, sex: sex || 'male',
    dm: { level: dm.level, score: dm.score },
    powers: P,
    gates: { dayRoot: dayRoot, ganHelp: ganHelp, zhiHelp: zhiHelp, canCong: canCong },
    branches: { congQiang: bQiang, congSha: bSha, congCai: bCai, congEr: bEr, jiaCong: bJia },
    traceName: name, engineName: engName,
    match: engName === name,
    failReason: fr
  };
  return r;
}

// ---- 盘集：三锚点 + 全历史池（p5c07-verify 同源，gz 去重）----
var DISKS = {};
function addDisk(id, gz, set) {
  if (!DISKS[gz]) DISKS[gz] = { id: id, gz: gz, sets: {} };
  DISKS[gz].sets[set] = true;
}
var ANCHORS = [
  ['ANCH1', '丁亥 丙午 癸巳 己卯', 'male'],   // 案例1：极弱不从（GPT 首锚点）
  ['ANCH2', '戊子 丁巳 癸亥 庚申', 'male'],   // 案例2：极端身弱需求方向/根气判定/假从边界
  ['ANCH3', '己丑 甲戌 癸巳 丙辰', 'male']    // 案例3：极弱但不一定从的反例
];
function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
parseCSV('_p3_a2_sha_ab.csv').slice(1).forEach(function (r) { addDisk(r[1], r[2], '53freeze'); });
['_blindtest_engine_results.md', '_blindtest_engine_results_40.md'].forEach(function (f) {
  var md = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /^## (\S+) (\S+ \S+ \S+ \S+)$/gm, m;
  while ((m = re.exec(md)) !== null) addDisk(m[1], m[2], '50blind');
});
[
  ['M01', '壬子 壬子 丁酉 辛亥'], ['M02', '庚申 乙酉 庚申 乙酉'], ['M03', '丁巳 乙巳 辛亥 甲午'],
  ['M04', '辛未 丁酉 丁亥 癸卯'], ['M05', '乙丑 癸未 庚辰 丙子'], ['M06', '癸亥 甲寅 戊辰 丁巳'],
  ['M07', '壬午 癸丑 庚寅 壬午'], ['M08', '壬辰 壬子 甲午 丙寅'], ['M09', '丁未 丁未 辛丑 戊子'],
  ['M10', '甲子 丁卯 己亥 庚午'], ['M11', '辛卯 丁酉 乙亥 己卯'], ['M12', '戊辰 丙辰 壬戌 庚戌'],
  ['M13', '丁亥 己酉 甲辰 庚午'], ['M14', '戊午 戊午 甲戌 庚午'], ['M15', '癸丑 乙卯 甲辰 戊辰'],
  ['M16', '丙寅 庚寅 壬午 戊申'], ['M17', '癸巳 戊午 丙戌 壬辰'], ['M18', '乙亥 己卯 癸未 丁巳'],
  ['M19', '庚辰 戊子 丙午 壬辰'], ['M20', '壬申 戊申 甲寅 丙寅']
].forEach(function (m) { addDisk(m[0], m[1], '20blind'); });
var ATTACK_SETS = { '00-P5A1-格局攻击集.md': 120, '00-P5A2-格局成败攻击集.md': 120, '00-P5A3-财党杀攻击集.md': 61 };
Object.keys(ATTACK_SETS).forEach(function (f) {
  var md = fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^﻿/, '');
  var re = /^\| (\d+) \| [^|]+ \| [^|]+ \| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]) \|/gm;
  var m, n = 0;
  while ((m = re.exec(md)) !== null) { addDisk(f.replace(/\.md$/, '') + '#' + m[1], m[2], 'attack'); n++; }
  if (n !== ATTACK_SETS[f]) throw new Error(f + ' parse count anomaly: ' + n);
});
var p4aMd = fs.readFileSync(path.join(ROOT, '_p4a', '00-定向用例.md'), 'utf8');
var p4aCount = 0;
p4aMd.split(/\r?\n/).forEach(function (l) {
  var m = l.match(/\| ([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] [甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])（/);
  if (!m) return;
  p4aCount++;
  addDisk('P4A-' + p4aCount, m[1], 'P4A');
});
if (p4aCount !== 32) throw new Error('P4A parse count anomaly: ' + p4aCount);
[require('./p5c02-output.json'), require('./p5c03-output.json'), require('./p5c04-output.json')].forEach(function (arr) {
  arr.forEach(function (r) { if (r.gz) addDisk('IMPACT', r.gz, '105impact'); });
});
JSON.parse(fs.readFileSync(path.join(__dirname, 'p5c05-output.json'), 'utf8')).forEach(function (r) {
  addDisk(r.id, r.gz, 'C05-28');
});

// ---- D 组：合成边界盘（intent 标注；实际命中值以 trace 输出为准）----
var SYNTHETIC = [
  ['D01', 'ke=5 不足从杀→应落假从', '戊午 己未 癸卯 丙寅'],
  ['D02', 'ke=6 恰好从杀', '戊戌 己未 癸卯 丙午'],
  ['D03', '日支巳余气庚印=有根→不从', '戊戌 己未 癸巳 丙午'],
  ['D04', 'D03 对照：日支未无金水根→从杀', '戊戌 己未 癸未 丙午'],
  ['D05', '一字透印（庚）破格', '戊戌 己未 癸卯 庚午'],
  ['D06', '透比（壬）破格', '戊戌 己未 癸卯 壬午'],
  ['D07', '时支申本气庚印→zhiHelp 不从', '戊戌 丙午 癸卯 戊申'],
  ['D08', 'D07 对照：时支巳本气丙财→假从', '戊戌 丙午 癸卯 己巳'],
  ['D09', '从财入口', '丙午 丁巳 癸未 丙午'],
  ['D10', '从儿入口', '甲寅 乙卯 癸未 甲寅'],
  ['D11', '假从2x边界构造尝试（预期不可达）', '戊午 甲寅 癸未 乙卯'],
  ['D12', '从强对照：极强全印比', '甲子 壬子 甲子 壬子'],
  ['D13', '极强但不从强（藏干泄耗破格）', '甲寅 乙卯 甲寅 乙卯'],
  ['D14', '从杀/从财互斥证明盘（ke6+cai6>12不可达）', '戊戌 己丑 癸未 丙午']
];

// ---- 执行 ----
var out = { meta: { title: 'P5-C08 congGe decision chain EVIDENCE', date: '2026-08-16', engine: 'js/bazi.js (AFTER_P5_C07)' }, anchors: [], pool: { summary: {}, jiRuo: [], jiQiang: [] }, synthetic: [], mismatches: [] };

ANCHORS.forEach(function (a) {
  var t = traceOne(a[1], a[2], a[0]);
  if (!t.match) out.mismatches.push(a[0] + ' trace/engine mismatch');
  var b = build(a[1], a[2]);
  var yj = ENG.getYongJi(b);
  t.yj = {
    method: yj.method, yongShen: yj.yongShen, xiShen: yj.xiShen, jiShen: yj.jiShen,
    dayMasterScore: yj.dayMasterScore, congGe: yj.congGe,
    yongQuality: (yj.yongShenQuality || {})[yj.yongShen[0]] || null
  };
  out.anchors.push(t);
});

var poolStats = { total: 0, jiRuo: 0, jiQiang: 0, groupA: 0, groupB: 0, groupC: 0, groupA2: 0, levelGateClean: 0, dgPowerGt2InCanCong: 0, mismatch: 0 };
Object.keys(DISKS).forEach(function (gz) {
  var d = DISKS[gz];
  var t = traceOne(gz, 'male', d.id);
  if (!t.match) { out.mismatches.push(gz + ' trace/engine mismatch'); poolStats.mismatch++; }
  poolStats.total++;
  if (t.dm.level === '极弱') {
    poolStats.jiRuo++;
    if (t.gates.canCong) {
      if (t.traceName === '假从势格') { poolStats.groupC++; out.pool.jiRuo.push(t); }
      else if (t.traceName) { poolStats.groupA++; out.pool.jiRuo.push(t); }
      else { out.pool.jiRuo.push(t); }
      if (t.powers.dg > 2) poolStats.dgPowerGt2InCanCong++;
    } else {
      poolStats.groupB++;
      out.pool.jiRuo.push(t);
    }
  } else if (t.dm.level === '极强') {
    poolStats.jiQiang++;
    if (t.traceName === '从强格') poolStats.groupA2++;
    out.pool.jiQiang.push(t);
  } else {
    // 偏弱/中和但根气门全清——level gate 独立生效证据
    if (!t.gates.dayRoot && !t.gates.ganHelp && !t.gates.zhiHelp) {
      poolStats.levelGateClean++;
      out.pool.jiRuo.push(t);
    }
  }
});

SYNTHETIC.forEach(function (s) {
  var t = traceOne(s[2], 'male', s[0]);
  t.intent = s[1];
  if (!t.match) out.mismatches.push(s[0] + ' trace/engine mismatch');
  out.synthetic.push(t);
});

out.pool.summary = poolStats;
fs.writeFileSync(path.join(__dirname, 'p5c08-output.json'), JSON.stringify(out, null, 1), 'utf8');

// ---- ASCII 摘要 ----
console.log('=== P5-C08 conge evidence ===');
console.log('pool total=' + poolStats.total + ' jiRuo=' + poolStats.jiRuo + ' jiQiang=' + poolStats.jiQiang);
console.log('groupA(真从)=' + poolStats.groupA + ' groupB(不从)=' + poolStats.groupB + ' groupC(假从)=' + poolStats.groupC + ' groupA2(从强)=' + poolStats.groupA2);
console.log('levelGateClean(偏弱+门全清)=' + poolStats.levelGateClean + ' dgPower>2inCanCong=' + poolStats.dgPowerGt2InCanCong + ' mismatch=' + poolStats.mismatch);
ANCHORS.forEach(function (a, i) {
  var t = out.anchors[i];
  console.log('ANCHOR' + (i + 1) + ' ' + t.gz + ' dm=' + t.dm.level + '/' + t.dm.score + ' eng=' + (t.engineName || 'none') + ' gates:' + (t.gates.dayRoot ? 'D' : '-') + (t.gates.ganHelp ? 'G' : '-') + (t.gates.zhiHelp ? 'Z' : '-') + ' fail=' + (t.failReason ? 'yes' : 'no'));
});
SYNTHETIC.forEach(function (s) {
  var t = out.synthetic.find(function (x) { return x.id === s[0]; });
  console.log(t.id + ' ' + t.gz + ' dm=' + t.dm.level + '/' + t.dm.score + ' eng=' + (t.engineName || 'NONE') + ' canCong=' + t.gates.canCong + ' fail=' + (t.failReason ? t.failReason.slice(0, 60) : 'no'));
});
console.log('output -> _p5/p5c08-output.json');
