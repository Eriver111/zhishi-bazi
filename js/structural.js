// ============================================================================
// 知时 — 结构层生产模块（P3-A3 正式实装，2026-08-14）
// ============================================================================
// 内容来源：_p3_a2_risk_evaluator.js（00b402f，A2-final 冻结，GPT P3-A2 最终裁决 10 条全量落地）
//   relationEvents 事实层 = A1 冻结版本逐字照抄；structuralRisks 风险层 = A2-final evaluator 逐字移植。
//   本文件不含任何规则口径变更——与冻结产物 _p3_a2_risks.csv / _p3_a2_sha_ab.csv /
//   _p3_a1_relation_events.csv 逐字节对账由 tests/p3-a-structural.test.js 验证。
// 纪律（P3 全阶段）：
//   1. 不改引擎：js/bazi.js 保持部署 blob 63fafaa 字节一致；本模块只读引擎输出
//      （getYongJi/getPattern），不回写、不改 P1/P2 分数/旺衰/喜用忌/格局/从格。
//   2. 两层不污染：structuralRisks 只作为新增解释层输出，禁止把 risk 元素重新解释成忌神。
//   3. 结构显现度（STRUCTURAL_PRESENCE_RANK）只作 presenceEvidence 显序标注，禁用于旺衰比较。
// 数据契约：
//   relationEvents 事件字段：type/pillars/elements/distance/involvesMonth/involvesDay/source/target/evidence
//     ——对称关系（五合/六冲/六害/刑/六合等）的 source/target 仅为 canonical ordering，不赋因果语义；
//       天干克为不对称关系，保留真实 source→target（GAN_KE 方向）。
//   structuralRisks 风险字段（A2-final 冻结 8 字段）：type/severity/parties/why/mitigations/triggerHint/evidence/partyEvidence
//     ——severity 仅两档：存在/潜在；triggerHint 硬断言：禁"必凶"、禁"任一"、必含"若"或"可能"。
// ============================================================================
(function (global) {
  'use strict';

  // ---------- 镜像表（与引擎逐字一致，evidence 标注源码行号；同 A1/A2 冻结）----------
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

  // ---------- 十神（同 A1/A2）----------
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

  // ---------- presenceEvidence 五档 = structuralPresence（结构显现度；GPT 最终裁决第 1 条冻结）----------
  // 显序（结构显现度排序，非旺衰强弱；禁用于旺衰比较）：exposedRooted > exposedUnrooted > hiddenMainRoot > hiddenSecondaryRoot > absent
  //   exposedRooted = 透干∧(本气根∨禄位)；exposedUnrooted = 透干无根；hiddenMainRoot = 不透但本气根；
  //   hiddenSecondaryRoot = 仅中余气藏干；absent = 全无。
  // 本气根口径 = 任一地支主气（CANG[z][0]）五行 === 目标五行（12 支支五行恒等于主气五行，两支口径等价）。
  var STRUCTURAL_PRESENCE_RANK = { exposedRooted: 4, exposedUnrooted: 3, hiddenMainRoot: 2, hiddenSecondaryRoot: 1, absent: 0 }; // 仅作显序标注，v2 各检测器 severity 不使用显序比较
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

  // ---------- structuralRiskEvaluator v2（GPT 二次裁决 12 条 + GPT P3-A2 最终裁决 10 条落地）----------
  function risk(type, severity, parties, why, mitigations, triggerHint, evidence, partyEvidence) {
    return { type: type, severity: severity, parties: parties, why: why, mitigations: mitigations, triggerHint: triggerHint, evidence: evidence, partyEvidence: partyEvidence };
  }
  function evaluateStructuralRisks(b, events, wx, ab) {
    var risks = [];
    var gv = ganVisible(b);
    var has = function (shen) { return gv.filter(function (g) { return g.shen === shen; }); };
    var guan = has('正官'), sha = has('七杀'), shang = has('伤官'), shi = has('食神'), xiao = has('偏印'), zhengYin = has('正印'), cai = has('偏财').concat(has('正财'));
    var dgWx = GAN_WX[b.day.gan];
    var yongWx = wx.yongWx;
    var he = heBanMap(b, gv);
    // ④ 透干七杀坐支之根（GPT 最终裁决第 4 条）：可见七杀 ∧ 其同柱地支支五行===七杀五行；仅该同柱根，非泛化全盘杀根
    var shaWx0 = kEWO(dgWx);
    var shaSatZhis = {};
    sha.forEach(function (g) { if (ZHI_WX[b[g.pos].zhi] === shaWx0) shaSatZhis[b[g.pos].zhi] = 1; });

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
        'v2：仅双透判（裁决第 6 条）；杀被五合绊仍判混杂、合绊入 mitigation（GPT 最终裁决第 2 条冻结）；severity=双透未合且贴邻→存在，否则潜在',
        pe4.join('；')));
    }
    // ===== 5) 杀重无制 K2-final（GPT 最终裁决第 5/6/7 条直接采用；K1 仅留 _p3_a2_sha_ab.csv 历史对照）=====
    if (ab && ab.k2) {
      var pe5 = [];
      sha.forEach(function (g) { var t = POS_NAME[g.pos] + g.gan + '七杀:' + presenceEvidence(b, GAN_WX[g.gan], g.gan); if (pe5.indexOf(t) < 0) pe5.push(t); });
      risks.push(risk('杀重无制', ab.k2,
        sha.map(function (g) { return POS_NAME[g.pos] + g.gan; }).join('、'),
        '七杀透干' + sha.length + '处；证据 ' + ab.evCount + ' 项（' + ab.evDetail + '）' + (ab.shaHeDesc ? '；' + ab.shaHeDesc : ''),
        ab.shaHeDesc || '无',
        '若七杀' + sha[0].gan + '再得根增强而制化不足，杀重无制之势可能加重；出现印化杀或食伤制杀则风险可能解除。',
        'K2-final（GPT 最终裁决第 5/6/7 条）：证据≥2∧无制化∧无强合绊=存在；强合绊(d1)→潜在；证据=1→潜在；制化含中气根；K1 对照见 _p3_a2_sha_ab.csv',
        pe5.join('；')));
    }
    // ===== 6) 关键用神/格局节点受冲 v2：节点清单 v2 =====
    // 无条件：印星之根（支五行===印 或 主气===印）+ 用神节点（支五行===用神 / 用神干之禄）+ 透干七杀坐支之根（裁决第 4 条补入）。
    // 条件触发：格局核心十神之根（pat.name 含词才加；与无条件印根合并去重）。
    // 已删：日主之禄（裁决第 1 条；纯冲禄只留事实层）。
    var yinWx = shENGWO(dgWx);
    var yongGans = gv.filter(function (g) { return GAN_WX[g.gan] === yongWx; }).map(function (g) { return g.gan; });
    var coreWxs = patternCoreWx(wx.patName, dgWx).filter(function (o) { return o.wx !== yinWx; }); // 印/枭核心与无条件印根合并去重
    var addNode = function (arr, z) {
      if (ZHI_WX[z] === yinWx || GAN_WX[CANG[z][0]] === yinWx) arr.push('印星之根');
      if (ZHI_WX[z] === yongWx) arr.push('用神同五行');
      yongGans.forEach(function (g) { if (LU[g] === z) arr.push('用神干' + g + '之禄'); });
      if (shaSatZhis[z]) arr.push('透干七杀坐支之根');
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
          'v2：节点清单=印星之根+用神节点+透干七杀坐支之根（无条件）∪格局核心十神之根（条件）；已删日主之禄',
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

  // ---------- 杀重无制 K2-final（GPT 最终裁决第 3/5/6/7 条；risks.csv 直接采用，K1 仅留 sha_ab.csv 对照）----------
  // 证据（盘级、按杀五行）：e1 当令（月令五行===杀，三会改写月令按 js/bazi.js:2197 镜像；湿土调候不计——执行口径）
  //   e2 本气强根（任一地支主气===杀五行）/ e3 多现（透杀≥2 ∨ (透杀≥1∧本气根) ∨ 本气根≥2处）
  //   e4 全三合局或全三会方局五行===杀（半合半会不入 e4——最终裁决第 3 条）。
  // 有效制化（最终裁决第 5 条）：印/食伤透干 ∧ (本气根 ∨ 禄 ∨ 中气根)；
  //   中气根 = 任一地支藏干中气（CANG[z][1]）与本干同字（如庚在巳中庚），元素级中气不承认（防辛借巳中庚充根），余气不计。
  // 合绊 mitigation（最终裁决第 6 条，独立于制化）：杀被五合 d1 强→可将 存在 降 潜在；d2 中仅记录不自动降级；d3 弱不改变 severity。
  // severity：证据≥2∧无制化∧无强合绊=存在；证据≥2∧无制化∧强合绊=潜在；证据=1∧无制化=潜在；否则不输出。
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
    var evDetail = [e1 ? 'e1当令' : '', e2 ? 'e2本气强根' : '', e3 ? 'e3多现' : '', e4 ? 'e4三合三会' : ''].filter(Boolean).join('、');
    // 有效制化（中气根=藏干中气与本干同字；禄=LU；本气根=元素级主气）
    function rooted(g) {
      return hasMainRoot(b, GAN_WX[g.gan])
        || POS.some(function (p) { return b[p].zhi === LU[g.gan]; })
        || POS.some(function (p) { return CANG[b[p].zhi][1] === g.gan; });
    }
    function rootLabel(g) {
      if (POS.some(function (p) { return b[p].zhi === LU[g.gan]; })) return '·禄';
      if (hasMainRoot(b, GAN_WX[g.gan])) return '·本气根';
      return '·中气根';
    }
    var yinZhi = yinGans.filter(rooted), shiZhi = shiGans.filter(rooted);
    var zhihuaDesc = [];
    // 多根干用「、」分隔（ASCII 逗号会破坏 CSV 列）
    if (yinZhi.length) zhihuaDesc.push('印:' + yinZhi.map(function (g) { return g.gan + '(' + g.shen + rootLabel(g) + ')'; }).join('、'));
    if (shiZhi.length) zhihuaDesc.push('食伤:' + shiZhi.map(function (g) { return g.gan + '(' + g.shen + rootLabel(g) + ')'; }).join('、'));
    var zhihua = zhihuaDesc.length > 0;
    // 杀合绊（最终裁决第 6 条：五合绊与印化/食伤制分列）
    var he = heBanMap(b, gv);
    var shaHe = [];
    sha.forEach(function (g) { if (he[g.gan]) shaHe.push({ gan: g.gan, partner: he[g.gan].partner, d: he[g.gan].d }); });
    var shaHeDesc = shaHe.map(function (h) { return '七杀' + h.gan + '被' + h.partner + '合绊(d' + h.d + '，' + heStrength(h.d) + ')'; }).join('；');
    var strongMit = shaHe.some(function (h) { return h.d === 1; });
    // K1（A1 口径冻结，仅 sha_ab.csv 历史对照）
    var k1 = '';
    if (sha.length >= 2 && !shiGans.length && !yinGans.length) k1 = '存在';
    else if (sha.length === 1 && !shiGans.length && !yinGans.length) k1 = '潜在';
    // K2-final
    var k2 = '';
    if (sha.length >= 1 && !zhihua) {
      if (evCount >= 2) k2 = strongMit ? '潜在' : '存在';
      else if (evCount === 1) k2 = '潜在';
    }
    return {
      shaGans: sha.map(function (g) { return POS_NAME[g.pos] + g.gan + '(七杀)'; }).join('、'),
      k1: k1, k2: k2, e1: e1, e2: e2, e3: e3, e4: e4, evCount: evCount, evDetail: evDetail,
      zhihua: zhihua, zhihuaDesc: zhihuaDesc.join('；'),
      shaHeDesc: shaHeDesc, strongMit: strongMit,
      diff: k1 !== k2 ? (k1 || '不输出') + '→' + (k2 || '不输出') : ''
    };
  }

  // ---------- 生产入口 ----------
  // evaluate(bazi, calculator?) → { relationEvents, structuralRisks }
  //   calculator 缺省取 window.BaZiCalculator（浏览器）；取不到时 relationEvents 仍可独立输出（纯柱位枚举），
  //   structuralRisks 依赖引擎 getYongJi/getPattern → 无引擎时返回 []（事实层数据流不中断）。
  // 调用方式与页面既有流程一致：calcDayMasterStrength 等在 getYongJi/getPattern 内部被调用，本模块不直接调用，
  // 因此 P1/P2 分数、旺衰、喜用忌、格局、从格全部由引擎原样输出，本模块零干预（两层不污染）。
  function evaluate(bazi, calculator) {
    var events = relationEvents(bazi);
    var risks = [];
    var calc = calculator;
    if (!calc) {
      try {
        if (typeof window !== 'undefined' && window.BaZiCalculator) calc = window.BaZiCalculator;
      } catch (e) { calc = null; }
    }
    if (calc) {
      try {
        var yj = calc.getYongJi(bazi);
        var yongWx = yj && yj.yongShen && yj.yongShen.length ? yj.yongShen[0] : null;
        var pat = calc.getPattern(bazi);
        var patName = pat && pat.name ? pat.name : null;
        if (yongWx && patName) {
          var ab = shaAB(bazi, events);
          risks = evaluateStructuralRisks(bazi, events, { yongWx: yongWx, patName: patName }, ab);
        }
      } catch (e) { risks = []; }
    }
    return { relationEvents: events, structuralRisks: risks };
  }

  var StructuralAnalysis = {
    relationEvents: relationEvents,
    evaluateStructuralRisks: evaluateStructuralRisks,
    shaAB: shaAB,
    evaluate: evaluate
  };

  // UMD：浏览器挂 window.StructuralAnalysis；node 环境挂 module.exports（测试用）
  if (typeof module !== 'undefined' && module.exports) module.exports = StructuralAnalysis;
  if (global && typeof global === 'object') global.StructuralAnalysis = StructuralAnalysis;
})(typeof window !== 'undefined' ? window : globalThis);
