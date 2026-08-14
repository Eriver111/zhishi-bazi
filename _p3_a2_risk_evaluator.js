// P3-A2（2026-08-14）：structuralRiskEvaluator 收敛版 —— 依据 GPT 二次裁决 12 条 + 交接规格（p3-a2-handoff-2026-08-14）。
// 相对 A1 原型（_p3_a1_relation_events.js，f23eb1b 冻结、本脚本不动 A1 文件）的变更：
//   ① 节点清单 v2：删"日主之禄"；无条件 = 印星之根 + 用神节点（同五行/用神干之禄）；
//     条件触发 = 格局核心十神之根（从 pat.name 解析十神词→五行，去重；与无条件印根合并去重）。
//   ② presenceEvidence 五档：exposedRooted/exposedUnrooted/hiddenMainRoot/hiddenSecondaryRoot/absent
//     （强弱序按 GPT 二次裁决列序执行——exposedUnrooted 强于 hiddenMainRoot，定序理由 GPT 未给，执行口径待复核）。
//   ③ 伤官见官/财破印/枭夺食 全 pair 枚举后聚合成一条 risk；合绊 mitigation 按合绊对柱位距离 1强/2中/3弱（文案带 d 值）。
//   ④ 官杀混杂仅双透判；杀被五合绊仍判混杂、合绊入 mitigation（与伤官见官一致，执行口径待 GPT 复核）；
//     severity：双透未合且贴邻→存在，否则潜在（执行口径）。
//   ⑤ 杀重无制 A/B：risks.csv 保留 K1（A1 口径冻结）；K2 证据式另出 _p3_a2_sha_ab.csv 对账，不参数搜索。
//   ⑥ triggerHints v2：十神角色具体化；硬断言 禁"必凶"、禁"任一"、必含"若"或"可能"。
// 纪律：不改 P1/P2 分数、不改引擎、不 push；relationEvents 事实层照抄 A1 冻结版本（逐字）。
var fs = require('fs'), cp = require('child_process'), path = require('path');
var ROOT = __dirname;
global.window = global; global.document = {};

// ---------- 引擎源码（断言工作区 === 部署 blob 63fafaa，P3 不改引擎）----------
var curSrc = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8').replace(/\r\n/g, '\n');
var deployed = cp.execSync('git show 63fafaa:js/bazi.js', { cwd: ROOT }).toString('utf8');
if (curSrc !== deployed) { console.error('❌ 工作区 js/bazi.js(LF归一化后) !== 63fafaa 部署 blob，P3 原型禁止在改动过的引擎上跑'); process.exit(1); }
console.log('✅ 原型运行在线上部署引擎（63fafaa 字节一致），P1/P2 分数不受任何影响');

var STITCH = "'getYongJi','calcDayMasterStrength','getCongGe','getPattern','calcCandidateScores'".slice(1, -1).split("','").map(function (n) {
  return 'if(typeof ' + n + '!=="undefined")global.' + n + '=' + n + ';';
}).join('\n');
eval(curSrc.replace('window.BaZiCalculator = {', STITCH + '\nwindow.BaZiCalculator = {'));

// ---------- 镜像表（与引擎逐字一致，evidence 标注源码行号；同 A1 冻结）----------
var GAN_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
var ZHI_WX = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };
var SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
var KE = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
var CANG = { '子': ['癸'], '丑': ['己', '癸', '辛'], '寅': ['甲', '丙', '戊'], '卯': ['乙'], '辰': ['戊', '乙', '癸'], '巳': ['丙', '庚', '戊'], '午': ['丁', '己'], '未': ['己', '丁', '乙'], '申': ['庚', '壬', '戊'], '酉': ['辛'], '戌': ['戊', '辛', '丁'], '亥': ['壬', '甲'] };
var LU = { '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳', '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子' };
var POS = ['year', 'month', 'day', 'hour'];
var POS_NAME = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
function kEWO(dg) { for (var k in KE) if (KE[k] === dg) return k; }
function shENGWO(dg) { for (var k in SHENG) if (SHENG[k] === dg) return k; }
var GAN_HE = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
var GAN_HE_RES = { '甲己': '土', '己甲': '土', '乙庚': '金', '庚乙': '金', '丙辛': '水', '辛丙': '水', '丁壬': '木', '壬丁': '木', '戊癸': '火', '癸戊': '火' };
var GAN_KE = { '甲': '戊', '乙': '己', '丙': '庚', '丁': '辛', '戊': '壬', '己': '癸', '庚': '甲', '辛': '乙', '壬': '丙', '癸': '丁' };
var CHONG = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
var HAI = { '子': '未', '未': '子', '丑': '午', '午': '丑', '寅': '巳', '巳': '寅', '卯': '辰', '辰': '卯', '申': '亥', '亥': '申', '酉': '戌', '戌': '酉' };
var XING = { '子卯': 1, '卯子': 1, '寅巳': 1, '巳寅': 1, '巳申': 1, '申巳': 1, '申寅': 1, '寅申': 1, '丑戌': 1, '戌丑': 1, '戌未': 1, '未戌': 1, '未丑': 1, '丑未': 1 };
var ZHI_HE = { '子丑': '土', '丑子': '土', '寅亥': '木', '亥寅': '木', '卯戌': '火', '戌卯': '火', '辰酉': '金', '酉辰': '金', '巳申': '水', '申巳': '水', '午未': '土', '未午': '土' };
var SAN_HE = [['寅', '午', '戌', '火'], ['亥', '卯', '未', '木'], ['申', '子', '辰', '水'], ['巳', '酉', '丑', '金']];
var HUI_JU = [['寅', '卯', '辰', '木'], ['巳', '午', '未', '火'], ['申', '酉', '戌', '金'], ['亥', '子', '丑', '水']];

// ---------- relationEvents 事实层（照抄 A1 冻结版本，逐字）----------
function toBazi(gz) {
  return { year: { gan: gz[0][0], zhi: gz[0][1] }, month: { gan: gz[1][0], zhi: gz[1][1] }, day: { gan: gz[2][0], zhi: gz[2][1] }, hour: { gan: gz[3][0], zhi: gz[3][1] } };
}
function ev(type, posArr, elements, srcPos, tgtPos, evidence) {
  var iMin = 9, iMax = -1;
  posArr.forEach(function (p) { var i = POS.indexOf(p); if (i < iMin) iMin = i; if (i > iMax) iMax = i; });
  return {
    type: type, pillars: posArr, elements: elements, distance: iMax - iMin,
    involvesMonth: posArr.indexOf('month') >= 0, involvesDay: posArr.indexOf('day') >= 0,
    source: srcPos, target: tgtPos, evidence: evidence
  };
}
function relationEvents(b) {
  var events = [];
  var pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  pairs.forEach(function (p) {
    var a = POS[p[0]], c = POS[p[1]];
    var ga = b[a].gan, gc = b[c].gan, za = b[a].zhi, zc = b[c].zhi;
    if (GAN_HE[ga] === gc) events.push(ev('天干五合', [a, c], [GAN_WX[ga] + '、' + GAN_WX[gc], '化' + GAN_HE_RES[ga + gc]], POS_NAME[a] + ga, POS_NAME[c] + gc, 'js/bazi.js:2382 GAN_HE'));
    if (GAN_KE[ga] === gc) events.push(ev('天干克', [a, c], [GAN_WX[ga] + '克' + GAN_WX[gc]], POS_NAME[a] + ga, POS_NAME[c] + gc, '经典十对（同性相克力重）'));
    else if (GAN_KE[gc] === ga) events.push(ev('天干克', [a, c], [GAN_WX[gc] + '克' + GAN_WX[ga]], POS_NAME[c] + gc, POS_NAME[a] + ga, '经典十对（同性相克力重）'));
    if (CHONG[za] === zc) events.push(ev('六冲', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2406 CHONG'));
    if (HAI[za] === zc) events.push(ev('六害', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2409 HAI'));
    if (XING[za + zc]) events.push(ev('刑', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2412 XING'));
    if (ZHI_HE[za + zc]) events.push(ev('六合', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc], '化' + ZHI_HE[za + zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2416 ZHI_HE（午未合土）'));
  });
  var zhis = POS.map(function (p) { return b[p].zhi; });
  SAN_HE.forEach(function (tri) {
    var wx = tri[3];
    var has = tri.slice(0, 3).map(function (z) { return zhis.indexOf(z) >= 0; });
    var cnt = has.filter(Boolean).length;
    if (cnt === 3) {
      var pos3 = tri.slice(0, 3).map(function (z) { return POS[zhis.indexOf(z)]; });
      events.push(ev('三合局', pos3, [tri.slice(0, 3).join(''), '合' + wx], POS_NAME[pos3[0]] + tri[0], POS_NAME[pos3[2]] + tri[2], 'js/bazi.js:2421 SAN_HE（三字俱全）'));
    } else if (cnt === 2 && has[1]) {
      var other2 = has[0] ? tri[0] : tri[2];
      var pos2 = [POS[zhis.indexOf(tri[1])], POS[zhis.indexOf(other2)]];
      events.push(ev('半合', pos2, [tri[1] + other2, '合' + wx], POS_NAME[pos2[0]] + tri[1], POS_NAME[pos2[1]] + other2, 'js/bazi.js:2472 半合须含中神' + tri[1] + '；生墓两支只称拱局不记'));
    }
  });
  HUI_JU.forEach(function (hj) {
    var wx = hj[3];
    var has = hj.slice(0, 3).map(function (z) { return zhis.indexOf(z) >= 0; });
    var cnt = has.filter(Boolean).length;
    if (cnt === 3) {
      var pos3 = hj.slice(0, 3).map(function (z) { return POS[zhis.indexOf(z)]; });
      events.push(ev('三会方', pos3, [hj.slice(0, 3).join(''), '会' + wx], POS_NAME[pos3[0]] + hj[0], POS_NAME[pos3[2]] + hj[2], 'js/bazi.js:2518 HUI_JU（三字俱全）'));
    } else if (cnt === 2 && ((has[0] && has[1]) || (has[1] && has[2]))) {
      var zA = has[0] && has[1] ? hj[0] : hj[1], zB = has[0] && has[1] ? hj[1] : hj[2];
      var pos2 = [POS[zhis.indexOf(zA)], POS[zhis.indexOf(zB)]];
      events.push(ev('半会', pos2, [zA + zB, '会' + wx], POS_NAME[pos2[0]] + zA, POS_NAME[pos2[1]] + zB, 'js/bazi.js:2536 半会=方局相邻两字'));
    }
  });
  return events;
}

// ---------- 十神（同 A1）----------
var YANG = { '甲': 1, '丙': 1, '戊': 1, '庚': 1, '壬': 1 };
function shiShen(dayGan, otherGan) {
  var d = GAN_WX[dayGan], o = GAN_WX[otherGan];
  var same = !!YANG[dayGan] === !!YANG[otherGan];
  if (o === d) return same ? '比肩' : '劫财';
  if (SHENG[o] === d) return same ? '偏印' : '正印';
  if (SHENG[d] === o) return same ? '食神' : '伤官';
  if (KE[o] === d) return same ? '七杀' : '正官';
  if (KE[d] === o) return same ? '偏财' : '正财';
}
function ganVisible(b) {
  var out = [];
  POS.forEach(function (p) { out.push({ gan: b[p].gan, shen: shiShen(b.day.gan, b[p].gan), pos: p }); });
  return out;
}

// ---------- 月令三会改写镜像（js/bazi.js:2197-2210 HUI_MONTH_OVERRIDE，v5.4）----------
// 三会方三字俱全（任意柱位）且月支参与 → 月令五行按会局重算；引擎原逻辑逐字镜像。
function huiMonthOverride(b) {
  var allZhi = [b.year.zhi, b.month.zhi, b.day.zhi, b.hour.zhi];
  var res = null;
  HUI_JU.forEach(function (hj) {
    if (hj.slice(0, 3).every(function (z) { return allZhi.indexOf(z) >= 0; }) && hj.slice(0, 3).indexOf(b.month.zhi) >= 0) res = hj[3];
  });
  return res;
}
function monthWx(b) { return huiMonthOverride(b) || ZHI_WX[b.month.zhi]; } // 得令判定用本气/三会改写，不用司令分野（js/bazi.js:2228 司令仅参考不参与）

// ---------- presenceEvidence 五档（GPT 二次裁决第 2 条）----------
// 强弱序（执行口径，按 GPT 列序）：exposedRooted > exposedUnrooted > hiddenMainRoot > hiddenSecondaryRoot > absent
//   exposedRooted = 透干∧(本气根∨禄位)；exposedUnrooted = 透干无根；hiddenMainRoot = 不透但本气根；
//   hiddenSecondaryRoot = 仅中余气藏干；absent = 全无。
// 本气根口径 = 任一地支主气（CANG[z][0]）五行 === 目标五行（12 支支五行恒等于主气五行，两支口径等价）。
var PRESENCE_RANK = { exposedRooted: 4, exposedUnrooted: 3, hiddenMainRoot: 2, hiddenSecondaryRoot: 1, absent: 0 };
function hasMainRoot(b, wxTarget) {
  return POS.some(function (p) { return GAN_WX[CANG[b[p].zhi][0]] === wxTarget; });
}
function presenceEvidence(b, wxTarget, gan) {
  var gv = ganVisible(b);
  var exposed = gv.some(function (g) { return gan ? g.gan === gan : GAN_WX[g.gan] === wxTarget; });
  var mainRoot = hasMainRoot(b, wxTarget);
  var lu = gan ? POS.some(function (p) { return b[p].zhi === LU[gan]; }) : false;
  var secRoot = !mainRoot && POS.some(function (p) {
    return CANG[b[p].zhi].slice(1).some(function (h) { return GAN_WX[h] === wxTarget; });
  });
  if (exposed && (mainRoot || lu)) return 'exposedRooted';
  if (exposed) return 'exposedUnrooted';
  if (mainRoot) return 'hiddenMainRoot';
  if (secRoot) return 'hiddenSecondaryRoot';
  return 'absent';
}
// 地支方 evidence：按该支主气干/五行查 presence
function zhiEvidence(b, z) {
  var main = CANG[z][0];
  return presenceEvidence(b, GAN_WX[main], main);
}
// 地支十神描述（triggerHints v2 用）：如 子 → "癸水·偏财"
function zhiRole(b, z) {
  var main = CANG[z][0];
  return main + GAN_WX[main] + '·' + shiShen(b.day.gan, main);
}

// ---------- 格局核心十神解析（节点清单 v2 条件触发）----------
// 十神词→五行：官/杀/煞→kEWO(dgWx)（克我）；印/枭→shENGWO(dgWx)（生我）；食/伤→SHENG[dgWx]（我生）；
// 财→KE[dgWx]（我克）；禄/刃/比/劫→dgWx（同我）。按五行去重。
// 执行口径：复合词"伤官"先整体匹配（防"官"字误扫）；返回 [{word, wx}]。
function patternCoreWx(patName, dgWx) {
  var name = patName || '';
  var out = [];
  function add(word, wx) { if (!out.some(function (o) { return o.wx === wx; })) out.push({ word: word, wx: wx }); }
  if (name.indexOf('伤官') >= 0) { add('伤官', SHENG[dgWx]); name = name.replace(/伤官/g, ''); }
  if (name.indexOf('杀') >= 0 || name.indexOf('煞') >= 0) add('杀', kEWO(dgWx));
  if (name.indexOf('官') >= 0) add('官', kEWO(dgWx));
  if (name.indexOf('印') >= 0 || name.indexOf('枭') >= 0) add('印', shENGWO(dgWx));
  if (name.indexOf('食') >= 0 || name.indexOf('伤') >= 0) add('食伤', SHENG[dgWx]);
  if (name.indexOf('财') >= 0) add('财', KE[dgWx]);
  if (name.indexOf('禄') >= 0 || name.indexOf('刃') >= 0 || name.indexOf('比') >= 0 || name.indexOf('劫') >= 0) add('比劫', dgWx);
  return out;
}

// ---------- 合绊（五合，裁决第 9 条：合绊按合绊对柱位距离降权 1强/2中/3弱）----------
// 合绊对柱位距离 = 被绊干与其五合伙伴干所在柱位之差的绝对值；伙伴取最近者（执行口径）。
function heStrength(d) { return d === 1 ? '强' : (d === 2 ? '中' : '弱'); }
function heBanMap(b, gv) {
  var map = {}; // gan -> {partner, d}
  gv.forEach(function (g) {
    if (map[g.gan]) return;
    var partner = GAN_HE[g.gan]; if (!partner) return;
    var mates = gv.filter(function (x) { return x.gan === partner; });
    var selfs = gv.filter(function (x) { return x.gan === g.gan; });
    var best = null;
    selfs.forEach(function (s) {
      mates.forEach(function (m) {
        var d = Math.abs(POS.indexOf(s.pos) - POS.indexOf(m.pos));
        if (!best || d < best.d) best = { partner: partner, d: d };
      });
    });
    if (best) map[g.gan] = best;
  });
  return map;
}

// ---------- structuralRiskEvaluator v2（GPT 二次裁决 12 条落地）----------
function risk(type, severity, parties, why, mitigations, triggerHint, evidence, partyEvidence) {
  return { type: type, severity: severity, parties: parties, why: why, mitigations: mitigations, triggerHint: triggerHint, evidence: evidence, partyEvidence: partyEvidence };
}
function evaluateStructuralRisks(b, events, wx) {
  var risks = [];
  var gv = ganVisible(b);
  var has = function (shen) { return gv.filter(function (g) { return g.shen === shen; }); };
  var guan = has('正官'), sha = has('七杀'), shang = has('伤官'), shi = has('食神'), xiao = has('偏印'), zhengYin = has('正印'), cai = has('偏财').concat(has('正财'));
  var dgWx = GAN_WX[b.day.gan];
  var yongWx = wx.yongWx;
  var he = heBanMap(b, gv);

  // ===== 1) 伤官见官 v2：全 pair 枚举聚合成一条（裁决第 8 条）=====
  if (shang.length && guan.length) {
    var pairs1 = [];
    shang.forEach(function (s) { guan.forEach(function (g) { pairs1.push({ s: s, g: g, dist: Math.abs(POS.indexOf(s.pos) - POS.indexOf(g.pos)) }); }); });
    var miti1 = [], seenMiti1 = {};
    pairs1.forEach(function (p) {
      if (he[p.s.gan] && !seenMiti1['s' + p.s.gan]) { seenMiti1['s' + p.s.gan] = 1; miti1.push('伤官' + p.s.gan + '被' + he[p.s.gan].partner + '合制(d' + he[p.s.gan].d + '，' + heStrength(he[p.s.gan].d) + ')'); }
      if (he[p.g.gan] && !seenMiti1['g' + p.g.gan]) { seenMiti1['g' + p.g.gan] = 1; miti1.push('正官' + p.g.gan + '被' + he[p.g.gan].partner + '合绊(d' + he[p.g.gan].d + '，' + heStrength(he[p.g.gan].d) + ')'); }
    });
    if (cai.length) miti1.push('有财星透出可论通关（伤生财→财生官）');
    var tie1 = pairs1.some(function (p) { return p.dist === 1; });
    if (!tie1) miti1.push('伤官与正官远隔（不直接对贴）');
    var strongHe = function (p) { return (he[p.s.gan] && he[p.s.gan].d === 1) || (he[p.g.gan] && he[p.g.gan].d === 1); };
    var sev1 = pairs1.some(function (p) { return p.dist === 1 && !strongHe(p); }) ? '存在' : '潜在';
    var pairNames1 = pairs1.map(function (p) { return POS_NAME[p.s.pos] + p.s.gan + '伤官 ↔ ' + POS_NAME[p.g.pos] + p.g.gan + '正官'; }).join('；');
    var pe1 = [];
    pairs1.forEach(function (p) {
      var peS = POS_NAME[p.s.pos] + p.s.gan + '伤官:' + presenceEvidence(b, GAN_WX[p.s.gan], p.s.gan);
      var peG = POS_NAME[p.g.pos] + p.g.gan + '正官:' + presenceEvidence(b, GAN_WX[p.g.gan], p.g.gan);
      if (pe1.indexOf(peS) < 0) pe1.push(peS);
      if (pe1.indexOf(peG) < 0) pe1.push(peG);
    });
    var gHeDesc1 = miti1.filter(function (m) { return m.indexOf('正官') === 0; })[0] || '';
    risks.push(risk('伤官见官', sev1,
      pairNames1,
      '天干同透伤官与正官，全 pair 枚举 ' + pairs1.length + ' 对（贴身 ' + pairs1.filter(function (p) { return p.dist === 1; }).length + ' 对）',
      miti1.length ? miti1.join('；') : '无',
      '若伤官' + shang[0].gan + '（' + GAN_WX[shang[0].gan] + '）得根行旺或正官' + guan[0].gan + '失其制化，伤官见官之势可能显化；当前' + (gHeDesc1 || '官星无合绊') + (tie1 ? '、存在贴身对贴' : '、全对远隔') + '。',
      'v2：全 pair 枚举；合绊按合绊对柱位距离 1强/2中/3弱；severity=任一 pair 贴身∧无强合绊→存在，否则潜在',
      pe1.join('；')));
  }
  // ===== 2) 财破印 v2：全 pair 枚举（与伤官见官一致处理）=====
  var yin = zhengYin.concat(xiao);
  if (cai.length && yin.length) {
    var pairs2 = [];
    cai.forEach(function (c) { yin.forEach(function (y) { if (KE[GAN_WX[c.gan]] === GAN_WX[y.gan]) pairs2.push({ c: c, y: y, dist: Math.abs(POS.indexOf(c.pos) - POS.indexOf(y.pos)) }); }); });
    if (pairs2.length) {
      var miti2 = [], seenMiti2 = {};
      pairs2.forEach(function (p) {
        if (he[p.c.gan] && !seenMiti2[p.c.gan]) { seenMiti2[p.c.gan] = 1; miti2.push('财星' + p.c.gan + '被' + he[p.c.gan].partner + '合绊(d' + he[p.c.gan].d + '，' + heStrength(he[p.c.gan].d) + ')'); }
      });
      var sev2 = pairs2.some(function (p) { return p.dist === 1 && !(he[p.c.gan] && he[p.c.gan].d === 1); }) ? '存在' : '潜在';
      var pairNames2 = pairs2.map(function (p) { return POS_NAME[p.c.pos] + p.c.gan + '（财）克 ' + POS_NAME[p.y.pos] + p.y.gan + '（印）'; }).join('；');
      var pe2 = [];
      pairs2.forEach(function (p) {
        var peC = POS_NAME[p.c.pos] + p.c.gan + '财:' + presenceEvidence(b, GAN_WX[p.c.gan], p.c.gan);
        var peY = POS_NAME[p.y.pos] + p.y.gan + '印:' + presenceEvidence(b, GAN_WX[p.y.gan], p.y.gan);
        if (pe2.indexOf(peC) < 0) pe2.push(peC);
        if (pe2.indexOf(peY) < 0) pe2.push(peY);
      });
      risks.push(risk('财破印', sev2,
        pairNames2,
        '财干元素克印干（全 pair 枚举 ' + pairs2.length + ' 对）',
        miti2.length ? miti2.join('；') : '无',
        '若财星' + pairs2[0].c.gan + '进一步增强而印星' + pairs2[0].y.gan + '根基不稳，财破印可能加重，印所代表的学业/庇护/格局转化力可能受损。',
        'v2：全 pair 枚举；severity=任一 pair 贴身∧财无强合绊→存在，否则潜在',
        pe2.join('；')));
    }
  }
  // ===== 3) 枭夺食 v2：全 pair 枚举（与伤官见官一致处理）=====
  if (xiao.length && shi.length) {
    var pairs3 = [];
    xiao.forEach(function (x) { shi.forEach(function (sh) { if (KE[GAN_WX[x.gan]] === GAN_WX[sh.gan]) pairs3.push({ x: x, sh: sh, dist: Math.abs(POS.indexOf(x.pos) - POS.indexOf(sh.pos)) }); }); });
    if (pairs3.length) {
      var sev3 = pairs3.some(function (p) { return p.dist === 1; }) ? '存在' : '潜在';
      var pairNames3 = pairs3.map(function (p) { return POS_NAME[p.x.pos] + p.x.gan + '（枭）克 ' + POS_NAME[p.sh.pos] + p.sh.gan + '（食）'; }).join('；');
      var pe3 = [];
      pairs3.forEach(function (p) {
        var peX = POS_NAME[p.x.pos] + p.x.gan + '枭:' + presenceEvidence(b, GAN_WX[p.x.gan], p.x.gan);
        var peS = POS_NAME[p.sh.pos] + p.sh.gan + '食:' + presenceEvidence(b, GAN_WX[p.sh.gan], p.sh.gan);
        if (pe3.indexOf(peX) < 0) pe3.push(peX);
        if (pe3.indexOf(peS) < 0) pe3.push(peS);
      });
      risks.push(risk('枭夺食', sev3,
        pairNames3,
        '偏印元素克食神元素（全 pair 枚举 ' + pairs3.length + ' 对）',
        '无',
        '若偏印' + pairs3[0].x.gan + '进一步增强，枭夺食可能显化，食神所代表的才华/口福/表达可能受抑。',
        'v2：全 pair 枚举；severity=任一 pair 贴身→存在，否则潜在（不查合绊，沿用 A1）',
        pe3.join('；')));
    }
  }
  // ===== 4) 官杀混杂 v2：仅双透判；杀被合→mitigation；未合且贴邻→存在否则潜在（执行口径）=====
  if (guan.length && sha.length) {
    var miti4 = [];
    var shaHeAll = [];
    sha.forEach(function (g) {
      if (he[g.gan]) { shaHeAll.push(POS_NAME[g.pos] + g.gan); miti4.push('七杀' + g.gan + '被' + he[g.gan].partner + '合绊(d' + he[g.gan].d + '，' + heStrength(he[g.gan].d) + ')'); }
    });
    var tie4 = false;
    sha.forEach(function (s) { guan.forEach(function (g) { if (Math.abs(POS.indexOf(s.pos) - POS.indexOf(g.pos)) === 1) tie4 = true; }); });
    var sev4 = (!shaHeAll.length && tie4) ? '存在' : '潜在';
    var pe4 = [];
    guan.forEach(function (g) { var t = POS_NAME[g.pos] + g.gan + '正官:' + presenceEvidence(b, GAN_WX[g.gan], g.gan); if (pe4.indexOf(t) < 0) pe4.push(t); });
    sha.forEach(function (g) { var t = POS_NAME[g.pos] + g.gan + '七杀:' + presenceEvidence(b, GAN_WX[g.gan], g.gan); if (pe4.indexOf(t) < 0) pe4.push(t); });
    risks.push(risk('官杀混杂', sev4,
      guan.map(function (g) { return POS_NAME[g.pos] + g.gan + '正官'; }).join('、') + '；' + sha.map(function (g) { return POS_NAME[g.pos] + g.gan + '七杀'; }).join('、'),
      '天干同透正官与七杀（双透口径；藏干不透不判混杂）',
      miti4.length ? miti4.join('；') : '无',
      '若正官' + guan[0].gan + '或七杀' + sha[0].gan + '进一步增强而制化不足，官杀混杂的反复/压力感可能加重。',
      'v2：仅双透判（裁决第 6 条）；杀被五合绊仍判混杂、合绊入 mitigation（执行口径待 GPT 复核）；severity=双透未合且贴邻→存在，否则潜在',
      pe4.join('；')));
  }
  // ===== 5) 杀重无制 K1（A1 口径冻结；K2 证据式见 shaAB，仅出 _p3_a2_sha_ab.csv 对账）=====
  if (sha.length >= 2 && !shang.length && !shi.length && !zhengYin.length && !xiao.length) {
    var pe5 = [];
    sha.forEach(function (g) { var t = POS_NAME[g.pos] + g.gan + '七杀:' + presenceEvidence(b, GAN_WX[g.gan], g.gan); if (pe5.indexOf(t) < 0) pe5.push(t); });
    risks.push(risk('杀重无制', '存在',
      sha.map(function (g) { return POS_NAME[g.pos] + g.gan; }).join('、'),
      '七杀透干' + sha.length + '处且天干无食伤制杀、无印化杀', '无',
      '若七杀' + sha[0].gan + '再得根增强而天干无食伤制杀、无印化杀，杀重无制之势可能加重；出现印化杀或食伤制杀则风险可能解除。',
      'K1（A1 口径冻结）：杀透≥2 ∧ 无食伤∧无印透；K2 证据式对照见 _p3_a2_sha_ab.csv',
      pe5.join('；')));
  } else if (sha.length === 1 && !shang.length && !shi.length && !zhengYin.length && !xiao.length) {
    var pe5b = [POS_NAME[sha[0].pos] + sha[0].gan + '七杀:' + presenceEvidence(b, GAN_WX[sha[0].gan], sha[0].gan)];
    risks.push(risk('杀重无制', '潜在',
      POS_NAME[sha[0].pos] + sha[0].gan,
      '七杀透干一处且无制化（单杀不判重，仅记潜在）', '无',
      '若七杀' + sha[0].gan + '再得根增强而无制化，杀势可能加重。',
      'K1（A1 口径冻结）：单杀无制仅记潜在',
      pe5b.join('；')));
  }
  // ===== 6) 关键用神/格局节点受冲 v2：节点清单 v2 =====
  // 无条件：印星之根（支五行===印 或 主气===印）+ 用神节点（支五行===用神 / 用神干之禄）。
  // 条件触发：格局核心十神之根（pat.name 含词才加；与无条件印根合并去重）。
  // 已删：日主之禄（裁决第 1 条；纯冲禄只留事实层）。
  var yinWx = shENGWO(dgWx);
  var yongGans = gv.filter(function (g) { return GAN_WX[g.gan] === yongWx; }).map(function (g) { return g.gan; });
  var coreWxs = patternCoreWx(wx.patName, dgWx).filter(function (o) { return o.wx !== yinWx; }); // 印/枭核心与无条件印根合并去重
  var addNode = function (arr, z) {
    if (ZHI_WX[z] === yinWx || GAN_WX[CANG[z][0]] === yinWx) arr.push('印星之根');
    if (ZHI_WX[z] === yongWx) arr.push('用神同五行');
    yongGans.forEach(function (g) { if (LU[g] === z) arr.push('用神干' + g + '之禄'); });
    coreWxs.forEach(function (o) {
      if (ZHI_WX[z] === o.wx || GAN_WX[CANG[z][0]] === o.wx) arr.push('格局核心' + o.word + '之根');
    });
  };
  events.filter(function (e) { return e.type === '六冲'; }).forEach(function (e) {
    var zA = e.pillars[0], zB = e.pillars[1];
    var za = b[zA].zhi, zb = b[zB].zhi;
    var nodeA = [], nodeB = [];
    addNode(nodeA, za); addNode(nodeB, zb);
    var hitA = nodeA.length ? POS_NAME[zA] + za + '（' + nodeA.join('；') + '）' : '';
    var hitB = nodeB.length ? POS_NAME[zB] + zb + '（' + nodeB.join('；') + '）' : '';
    if (hitA || hitB) {
      var d6 = e.distance;
      var pe6 = [POS_NAME[zA] + zA + '（' + zhiRole(b, za) + '）:' + zhiEvidence(b, za), POS_NAME[zB] + zB + '（' + zhiRole(b, zb) + '）:' + zhiEvidence(b, zb)];
      // 冲方增强 → 对被冲节点侧冲击；节点侧为空则该向不写（示例：若年柱子（癸水·偏财）得运助增，对时柱午（印星之根）的冲击可能加重）
      var clauses6 = [];
      if (hitA) clauses6.push('若' + POS_NAME[zB] + zb + '（' + zhiRole(b, zb) + '）得运助增，对' + hitA + '的冲击可能加重');
      if (hitB) clauses6.push('若' + POS_NAME[zA] + za + '（' + zhiRole(b, za) + '）得运助增，对' + hitB + '的冲击可能加重');
      var hint6 = clauses6.join('；') + '，相关格局节点根基可能动摇。';
      risks.push(risk('关键用神/格局节点受冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        (hitA || POS_NAME[zA] + za) + ' ↔ ' + (hitB || POS_NAME[zB] + zb),
        '六冲' + za + zb + '命中' + (hitA ? hitA : '') + (hitB ? '；' + hitB : '') + '，位距' + d6 + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        hint6,
        'v2：节点清单=印星之根+用神节点（无条件）∪格局核心十神之根（条件）；已删日主之禄',
        pe6.join('；')));
    }
  });
  // ===== 7) 财印冲 / 官印冲 v2：主气口径不变（裁决第 7 条），补 partyEvidence =====
  events.filter(function (e) { return e.type === '六冲'; }).forEach(function (e) {
    var za = b[e.pillars[0]].zhi, zb = b[e.pillars[1]].zhi;
    var wa = GAN_WX[CANG[za][0]], wb = GAN_WX[CANG[zb][0]];
    var caiWx = KE[dgWx]; // 我克者 = 财
    var shaWx2 = kEWO(dgWx);
    var isCaiYin = (wa === caiWx && wb === yinWx) || (wa === yinWx && wb === caiWx);
    var isGuanYin = (wa === shaWx2 && wb === yinWx) || (wa === yinWx && wb === shaWx2);
    var pe7 = [POS_NAME[e.pillars[0]] + za + '（' + zhiRole(b, za) + '）:' + zhiEvidence(b, za), POS_NAME[e.pillars[1]] + zb + '（' + zhiRole(b, zb) + '）:' + zhiEvidence(b, zb)];
    if (isCaiYin) {
      var caiSide = wa === caiWx ? { pos: e.pillars[0], zhi: za } : { pos: e.pillars[1], zhi: zb };
      risks.push(risk('财印冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        POS_NAME[e.pillars[0]] + za + '（' + CANG[za][0] + wa + '） ↔ ' + POS_NAME[e.pillars[1]] + zb + '（' + CANG[zb][0] + wb + '）',
        '冲对主气一财一印，位距' + e.distance + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        '若财方' + POS_NAME[caiSide.pos] + caiSide.zhi + '（' + zhiRole(b, caiSide.zhi) + '）进一步增强，财印相冲可能加重，印星根基可能进一步受扰。',
        'v2：主气口径不变（中余气不独立触发）；补 partyEvidence',
        pe7.join('；')));
    } else if (isGuanYin) {
      var guanSide = wa === shaWx2 ? { pos: e.pillars[0], zhi: za } : { pos: e.pillars[1], zhi: zb };
      risks.push(risk('官印冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        POS_NAME[e.pillars[0]] + za + '（' + CANG[za][0] + wa + '） ↔ ' + POS_NAME[e.pillars[1]] + zb + '（' + CANG[zb][0] + wb + '）',
        '冲对主气一官杀一印，位距' + e.distance + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        '若官杀方' + POS_NAME[guanSide.pos] + guanSide.zhi + '（' + zhiRole(b, guanSide.zhi) + '）进一步增强，官印相冲可能加重，印化杀的转化通道可能受扰。',
        'v2：主气口径不变（中余气不独立触发）；补 partyEvidence',
        pe7.join('；')));
    }
  });
  return risks;
}

// ---------- 杀重无制 K2（证据式，裁决第 10 条；仅对账，不进 risks.csv）----------
// 证据（盘级、按杀五行）：e1 当令（月令五行===杀，三会改写月令按 js/bazi.js:2197 镜像；湿土调候不计——执行口径）
//   e2 本气强根（任一地支主气===杀五行）/ e3 多现（透杀≥2 ∨ (透杀≥1∧本气根) ∨ 本气根≥2处）
//   e4 三合或三会（relationEvents 全三合局/全三会方局五行===杀五行；半合半会不计——执行口径）
// 有效制化（落地口径）：印透干∧(印本气根∨印干之禄) 或 食伤透干∧(食伤本气根∨食伤干之禄)。
// 判定：透杀≥1∧证据≥2∧无有效制化=存在；证据=1∧无有效制化=潜在；否则不输出。
function shaAB(b, events) {
  var gv = ganVisible(b);
  var dgWx = GAN_WX[b.day.gan];
  var shaWx = kEWO(dgWx);
  var sha = gv.filter(function (g) { return g.shen === '七杀'; });
  var shiGans = gv.filter(function (g) { return g.shen === '食神' || g.shen === '伤官'; });
  var yinGans = gv.filter(function (g) { return g.shen === '正印' || g.shen === '偏印'; });
  // e1 当令
  var e1 = monthWx(b) === shaWx ? 1 : 0;
  // e2 本气强根（任一支主气===杀）
  var mainRootCnt = POS.filter(function (p) { return GAN_WX[CANG[b[p].zhi][0]] === shaWx; }).length;
  var e2 = mainRootCnt >= 1 ? 1 : 0;
  // e3 多现
  var e3 = (sha.length >= 2 || (sha.length >= 1 && mainRootCnt >= 1) || mainRootCnt >= 2) ? 1 : 0;
  // e4 三合/三会（全）局五行===杀
  var e4 = events.some(function (e) {
    return (e.type === '三合局' && e.elements[1] === '合' + shaWx) || (e.type === '三会方' && e.elements[1] === '会' + shaWx);
  }) ? 1 : 0;
  var evCount = e1 + e2 + e3 + e4;
  // 有效制化
  function rooted(g) { return hasMainRoot(b, GAN_WX[g.gan]) || POS.some(function (p) { return b[p].zhi === LU[g.gan]; }); }
  var yinZhi = yinGans.filter(rooted), shiZhi = shiGans.filter(rooted);
  var zhihuaDesc = [];
  if (yinZhi.length) zhihuaDesc.push('印:' + yinZhi.map(function (g) { return g.gan + '(' + g.shen + (POS.some(function (p) { return b[p].zhi === LU[g.gan]; }) ? '·禄' : '·本气根') + ')'; }).join(','));
  if (shiZhi.length) zhihuaDesc.push('食伤:' + shiZhi.map(function (g) { return g.gan + '(' + g.shen + (POS.some(function (p) { return b[p].zhi === LU[g.gan]; }) ? '·禄' : '·本气根') + ')'; }).join(','));
  var zhihua = zhihuaDesc.length > 0;
  // K1（A1 口径冻结）
  var k1 = '';
  if (sha.length >= 2 && !shiGans.length && !yinGans.length) k1 = '存在';
  else if (sha.length === 1 && !shiGans.length && !yinGans.length) k1 = '潜在';
  // K2
  var k2 = '';
  if (sha.length >= 1 && !zhihua && evCount >= 2) k2 = '存在';
  else if (sha.length >= 1 && !zhihua && evCount === 1) k2 = '潜在';
  return {
    shaGans: sha.map(function (g) { return POS_NAME[g.pos] + g.gan + '(七杀)'; }).join('、'),
    k1: k1, k2: k2, e1: e1, e2: e2, e3: e3, e4: e4, evCount: evCount,
    zhihua: zhihua, zhihuaDesc: zhihuaDesc.join('；'),
    diff: k1 !== k2 ? (k1 || '不输出') + '→' + (k2 || '不输出') : ''
  };
}

// ---------- 样本（同 A1 冻结：22基线+Round2去重+6锚点+18专项+2附加+4合成+wetearth = 53）----------
function csvCols(line) { return line.split(','); }
var ALL = [];
var C22 = fs.readFileSync(path.join(ROOT, '_baseline_22.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
C22.forEach(function (line) { var m = line.match(/^"([^"]+)","([^"]+)"/); ALL.push({ set: '22基线', id: m[1], gz: m[2].split(' ') }); });
var C6 = [
  { set: '六盘锚点', id: 'P15-03', gz: ['乙丑', '戊寅', '己巳', '庚午'] },
  { set: '六盘锚点', id: 'P15-09', gz: ['丁丑', '癸卯', '庚申', '丙戌'] },
  { set: '六盘锚点', id: 'P15-12', gz: ['戊子', '甲寅', '庚申', '丁亥'] },
  { set: '六盘锚点', id: 'P15-14', gz: ['丙寅', '庚寅', '戊辰', '癸亥'] },
  { set: '六盘锚点', id: 'P15-15', gz: ['癸未', '戊午', '乙卯', '丙戌'] },
  { set: '六盘锚点', id: 'P15-16', gz: ['丁卯', '壬寅', '壬午', '庚子'] }
];
var C18 = [
  { id: 'H01', gz: ['癸未', '戊午', '乙卯', '丙戌'] }, { id: 'H02', gz: ['戊辰', '甲寅', '丁亥', '庚子'] },
  { id: 'H03', gz: ['甲寅', '戊辰', '壬子', '辛丑'] }, { id: 'H04', gz: ['甲申', '庚午', '辛卯', '戊戌'] },
  { id: 'H05', gz: ['庚子', '乙酉', '甲辰', '甲子'] }, { id: 'H06', gz: ['乙巳', '壬午', '丁未', '戊申'] },
  { id: 'H07', gz: ['己丑', '丙寅', '丁亥', '甲辰'] }, { id: 'H08', gz: ['丁酉', '丙午', '丁卯', '庚戌'] },
  { id: 'H09', gz: ['甲寅', '壬申', '壬辰', '己酉'] }, { id: 'H10', gz: ['癸未', '丁巳', '丙戌', '辛卯'] },
  { id: 'H11', gz: ['壬辰', '癸卯', '戊戌', '丁巳'] }, { id: 'H12', gz: ['甲申', '丁丑', '壬辰', '己酉'] },
  { id: 'H13', gz: ['壬寅', '丙午', '丙戌', '辛卯'] }, { id: 'H14', gz: ['乙丑', '己丑', '壬子', '辛丑'] },
  { id: 'H15', gz: ['甲寅', '庚午', '庚辰', '乙酉'] }, { id: 'H16', gz: ['丙辰', '庚子', '癸巳', '庚申'] },
  { id: 'H17', gz: ['甲子', '丙子', '癸亥', '甲寅'] }, { id: 'H18', gz: ['癸卯', '己未', '甲午', '壬申'] }
].map(function (c) { c.set = '18专项'; return c; });
var COBS = [
  { set: '附加观察', id: 'P15-19', gz: ['己亥', '丙子', '辛酉', '戊子'] },
  { set: '附加观察', id: 'P15-20', gz: ['壬午', '癸卯', '戊寅', '乙卯'] }
];
var SYN = [
  { set: '合成观察', id: 'SY1', gz: ['壬子', '壬子', '戊午', '戊午'] },
  { set: '合成观察', id: 'SY2', gz: ['壬子', '壬子', '戊戌', '丁巳'] },
  { set: '合成观察', id: 'SY3', gz: ['甲子', '壬申', '乙卯', '丁亥'] },
  { set: '合成观察', id: 'SY4', gz: ['壬寅', '戊申', '乙卯', '壬午'] }
];
var ROUND2 = fs.readFileSync(path.join(ROOT, '_round2_results.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
ROUND2.forEach(function (line) {
  var f = csvCols(line);
  var dup = ALL.some(function (c) { return c.id === f[0]; });
  if (!dup) ALL.push({ set: 'Round2', id: f[0], gz: f[1].split(' ') });
});
ALL = ALL.concat(C6, C18, COBS, SYN);
ALL.push({ set: '测试盘', id: 'wetearth', gz: ['庚申', '己丑', '癸卯', '丁巳'] });
var byGz = {};
ALL.forEach(function (c) { var k = c.gz.join(''); if (!byGz[k]) byGz[k] = []; byGz[k].push(c.id); });
ALL.forEach(function (c) { c.alias = byGz[c.gz.join('')].filter(function (x) { return x !== c.id; }).join(','); });
if (ALL.length !== 53) { console.error('❌ 样本数 !== 53（实际 ' + ALL.length + '），A2 与 A1 样本口径不一致，中止'); process.exit(1); }
console.log('✅ 样本共 ' + ALL.length + ' 盘（22基线+6锚点+18专项+2附加+4合成+wetearth，Round2 id 去重）');

// ---------- 五行层（同 A1；patName 单独保留供格局核心解析）----------
function wuxingLayer(b) {
  var dm = calcDayMasterStrength(b);
  var yj = getYongJi(b), pat = getPattern(b);
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen, xi: yj.xiShen, ji: yj.jiShen,
    yongWx: yj.yongShen[0], pattern: pat.name + '·' + pat.status, patName: pat.name
  };
}
var riskRows = [], shaRows = [];
var riskTypeCount = {};
ALL.forEach(function (c) {
  var b = toBazi(c.gz);
  var events = relationEvents(b);
  var wx = wuxingLayer(b);
  var risks = evaluateStructuralRisks(b, events, wx);
  var ab = shaAB(b, events);
  risks.forEach(function (r) {
    riskTypeCount[r.type] = (riskTypeCount[r.type] || 0) + 1;
    riskRows.push([c.set, c.id, c.gz.join(' '), wx.score, wx.level, wx.yong.join('、'), wx.xi.join('、'), wx.ji.join('、'), wx.pattern, r.type, r.severity, r.parties, r.why, r.mitigations, r.triggerHint, r.evidence, r.partyEvidence]);
    // 纪律断言（裁决第 11 条）：禁"必凶"、禁"任一"、必含"若"或"可能"
    if (r.triggerHint.indexOf('必凶') >= 0) { console.error('❌ triggerHint 含禁用语"必凶": ' + c.id + ' ' + r.type); process.exit(1); }
    if (r.triggerHint.indexOf('任一') >= 0) { console.error('❌ triggerHint 含禁用语"任一": ' + c.id + ' ' + r.type + ' → ' + r.triggerHint); process.exit(1); }
    if (r.triggerHint.indexOf('可能') < 0 && r.triggerHint.indexOf('若') < 0) { console.error('❌ triggerHint 非条件语言: ' + c.id + ' ' + r.type + ' → ' + r.triggerHint); process.exit(1); }
    if (!r.partyEvidence) { console.error('❌ partyEvidence 缺失: ' + c.id + ' ' + r.type); process.exit(1); }
  });
  shaRows.push([c.set, c.id, c.gz.join(' '), ab.shaGans, ab.k1, ab.k2, ab.e1, ab.e2, ab.e3, ab.e4, ab.evCount, ab.zhihua ? '有' : '无', ab.zhihuaDesc, ab.diff]);
});
fs.writeFileSync(path.join(ROOT, '_p3_a2_risks.csv'), [['set', 'id', 'gz', 'score', 'level', 'yong', 'xi', 'ji', 'pattern', 'riskType', 'severity', 'parties', 'why', 'mitigations', 'triggerHint', 'evidence', 'partyEvidence'].join(',')].concat(riskRows.map(function (r) { return r.join(','); })).join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, '_p3_a2_sha_ab.csv'), [['set', 'id', 'gz', 'shaGans', 'K1', 'K2', 'e1当令', 'e2本气强根', 'e3多现', 'e4三合三会', '证据数', '有效制化', '制化明细', 'K1K2差异'].join(',')].concat(shaRows.map(function (r) { return r.join(','); })).join('\n'), 'utf8');
console.log('✅ _p3_a2_risks.csv（' + riskRows.length + ' 风险行）/ _p3_a2_sha_ab.csv（' + shaRows.length + ' 盘行）已写');

// ---------- 覆盖统计 ----------
console.log('\n===== structuralRiskEvaluator v2 全样本覆盖（53 盘）=====');
Object.keys(riskTypeCount).sort().forEach(function (t) { console.log('  ' + t + ': ' + riskTypeCount[t]); });

// ---------- K1/K2 对账（裁决第 10 条：只看差异与明显漏报误报，不参数搜索）----------
console.log('\n===== 杀重无制 K1/K2 A/B 对账 =====');
var cnt = { k1c: 0, k2c: 0, k1only: 0, k2only: 0, both: 0, k1q_k2c: 0, k1c_k2q: 0 };
var leak = [], falsePos = [], k1cRows = [], k2cRows = [];
shaRows.forEach(function (r) {
  var k1 = r[4], k2 = r[5];
  if (k1 === '存在') { cnt.k1c++; k1cRows.push(r); }
  if (k2 === '存在') { cnt.k2c++; k2cRows.push(r); }
  if (k1 === '存在' && k2 === '存在') cnt.both++;
  else if (k1 === '存在') { cnt.k1only++; falsePos.push(r); }
  else if (k2 === '存在') { cnt.k2only++; leak.push(r); }
  if (k1 === '潜在' && k2 === '存在') cnt.k1q_k2c++;
  if (k1 === '存在' && k2 === '潜在') cnt.k1c_k2q++;
});
console.log('  K1=存在: ' + cnt.k1c + ' | K2=存在: ' + cnt.k2c + ' | 双方存在: ' + cnt.both);
console.log('  K1=存在∧K2≠存在（双杀虚浮被K1误报候选）: ' + cnt.k1only);
falsePos.forEach(function (r) { console.log('    → ' + r[1] + ' ' + r[2] + ' | K1存在 K2=' + (r[5] || '不输出') + ' | e=' + r[6] + r[7] + r[8] + r[9] + ' | 制化=' + r[11] + ' ' + r[12]); });
console.log('  K2=存在∧K1≠存在（单杀极旺被K1漏报候选）: ' + cnt.k2only);
leak.forEach(function (r) { console.log('    → ' + r[1] + ' ' + r[2] + ' | K1=' + (r[4] || '不输出') + ' K2存在 | 杀=' + r[3] + ' | e=' + r[6] + r[7] + r[8] + r[9] + ' | 制化=' + r[11] + ' ' + r[12]); });
console.log('  K1潜在→K2存在（K1低估）: ' + cnt.k1q_k2c + ' | K1存在→K2潜在（K1高估）: ' + cnt.k1c_k2q);

// ---------- #9 黄金样本 v2 断言（裁决第 5/8 条 + 交接规格）----------
console.log('\n===== #9 黄金样本 v2 甲子 丁卯 己未 庚午 =====');
var b9 = toBazi(['甲子', '丁卯', '己未', '庚午']);
var wx9 = wuxingLayer(b9);
var ev9 = relationEvents(b9);
var risk9 = evaluateStructuralRisks(b9, ev9, wx9);
var ab9 = shaAB(b9, ev9);

var fail = 0;
function assert(cond, msg) { if (!cond) { fail++; console.error('  ❌ ' + msg); } else { console.log('  ✅ ' + msg); } }
// A. 五行层权威值（锁定，P3 不改 P1/P2）
assert(wx9.score === 51, '五行层分数 51 不变');
assert(wx9.level === '中和', '五行层旺衰 中和');
assert(wx9.yong.join('') === '木', '五行层用神 木');
assert(wx9.xi.join('') === '木', '五行层喜神 木（权威值锁定，旧 CSV 木金水作废）');
assert(wx9.ji.length === 0, '五行层忌神 空');
assert(wx9.pattern === '杀印相生格·成格', '五行层格局 杀印相生格·成格（引擎原值）');
// B. relationEvents 事实层回归（照抄冻结，仅抽查核心）
function hasEv(type, pair) {
  return ev9.some(function (e) { return e.type === type && e.pillars.slice().sort().join('') === pair.split(',').sort().join(''); });
}
assert(ev9.length === 8, '事实层事件恰 8 条（A1 冻结口径不变）');
assert(ev9.filter(function (e) { return e.type === '六冲'; }).length === 1 && hasEv('六冲', 'year,hour'), '六冲恰 1 条：年子-时午');
// C. structuralRisks v2：3 风险不变（类型名沿用 A1 冻结字符串）
var t9 = risk9.map(function (r) { return r.type; });
assert(risk9.length === 3, '结构层风险恰 3 条（无增无减）');
assert(t9.join('|') === '伤官见官|关键用神/格局节点受冲|财印冲', '3 风险类型与 A1 一致：' + t9.join('、'));
// C1. 伤官见官 v2
var rSG = risk9[0];
assert(rSG.severity === '潜在', '伤官见官 severity=潜在（位距3无贴身）');
assert(rSG.mitigations.indexOf('正官甲被己合绊(d2，中)') >= 0, '伤官见官 mitigation 含"正官甲被己合绊(d2，中)"（合绊对年-日 d2）');
assert(rSG.partyEvidence.indexOf('年柱甲正官:exposedRooted') >= 0 && rSG.partyEvidence.indexOf('时柱庚伤官:exposedUnrooted') >= 0, '伤官见官 partyEvidence 五档：甲 exposedRooted / 庚 exposedUnrooted');
// C2. 关键用神/格局节点受冲 v2（节点清单 v2）
var rNode = risk9[1];
assert(rNode.severity === '潜在', '节点受冲 severity=潜在（年-时 d3）');
assert(rNode.why.indexOf('印星之根') >= 0, '子午冲节点 why 含"印星之根"（午主气丁火=印）');
assert(rNode.why.indexOf('日主之禄') < 0, '子午冲节点 why 不含"日主之禄"（节点清单 v2 已删）');
assert(rNode.triggerHint.indexOf('若年柱子（癸水·偏财）得运助增，对时柱午（印星之根）的冲击可能加重') >= 0, '节点受冲 triggerHint 与规格示例一致（冲方十神角色具体化）');
assert(rNode.triggerHint.indexOf('任一') < 0 && rNode.triggerHint.indexOf('必凶') < 0, '节点受冲 triggerHint v2 禁"任一"/"必凶"');
// C3. 财印冲 v2
var rCY = risk9[2];
assert(rCY.severity === '潜在', '财印冲 severity=潜在');
assert(rCY.partyEvidence.indexOf('hiddenMainRoot') >= 0 && rCY.partyEvidence.indexOf('exposedRooted') >= 0, '财印冲 partyEvidence 五档：子癸 hiddenMainRoot / 午丁 exposedRooted');
// C4. 不触发项
assert(t9.indexOf('官杀混杂') < 0 && t9.indexOf('杀重无制') < 0 && t9.indexOf('枭夺食') < 0 && t9.indexOf('财破印') < 0, '官杀混杂/杀重无制/枭夺食/财破印 不触发（无乙杀/无辛食/无财透）');
risk9.forEach(function (r) { assert(r.severity === '存在' || r.severity === '潜在', '风险分级合法: ' + r.type + '=' + r.severity); });
// C5. #9 K1/K2 对账（无杀透 → 双方不输出）
assert(ab9.k1 === '' && ab9.k2 === '', '#9 杀重无制 K1/K2 均不输出（无七杀透干）');
// D. 两层不污染
var wx9After = wuxingLayer(b9);
assert(JSON.stringify(wx9) === JSON.stringify(wx9After), '关系/结构层评价后五行层输出逐字节一致（不污染）');
assert(wx9.ji.join('') === '', '结构风险未写入忌神（忌神仍为空）');
// E. 引擎零改动
var curSrc2 = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8').replace(/\r\n/g, '\n');
assert(curSrc2 === deployed, 'js/bazi.js 全程未被改动（仍是 63fafaa）');

console.log(fail === 0 ? '\n🎉 #9 v2 黄金样本验证全部通过（两层不污染，3 新挑点口径已按交接执行）' : '\n💥 失败断言 ' + fail + ' 条');
process.exit(fail === 0 ? 0 : 1);
