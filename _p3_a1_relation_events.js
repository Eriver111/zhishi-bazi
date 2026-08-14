// P3-A 第一阶段（2026-08-14，GPT 总复盘最终裁决第 5-9 条）：
//   relationEvents 事实层原型（客观记录，不直接判风险）+ structuralRisks 原型（条件性结构风险）。
// 纪律：不改 P1/P2 分数、不改引擎、不 push；喜用忌 = 五行总体需求 / structuralRisks = 条件性结构风险，两层不得互相污染。
// 镜像表格全部标注引擎源码行号（js/bazi.js）；天干克采用经典十对（同性相克力重），异性相克对克力弱不单列（其中五合对另记于天干五合）。
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
// 引擎暴露：calcDayMasterStrength(bazi) / getYongJi(bazi) / getCongGe(bazi) / getPattern(bazi)

// ---------- 镜像表（与引擎逐字一致，evidence 标注源码行号）----------
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

// 天干五合（js/bazi.js:2382-2383）
var GAN_HE = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };
var GAN_HE_RES = { '甲己': '土', '己甲': '土', '乙庚': '金', '庚乙': '金', '丙辛': '水', '辛丙': '水', '丁壬': '木', '壬丁': '木', '戊癸': '火', '癸戊': '火' };
// 天干相克：经典十对（同性相克力重）。异性相克（如乙戊）克力弱、古典多不论；其中甲己/乙庚/丙辛/丁壬/戊癸为五合对，另记。
var GAN_KE = { '甲': '戊', '乙': '己', '丙': '庚', '丁': '辛', '戊': '壬', '己': '癸', '庚': '甲', '辛': '乙', '壬': '丙', '癸': '丁' };
// 六冲（js/bazi.js:2406）/ 六害（2409）/ 刑（2412，七对含寅巳申、丑戌未两组三刑与子卯）
var CHONG = { '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅', '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳' };
var HAI = { '子': '未', '未': '子', '丑': '午', '午': '丑', '寅': '巳', '巳': '寅', '卯': '辰', '辰': '卯', '申': '亥', '亥': '申', '酉': '戌', '戌': '酉' };
var XING = { '子卯': 1, '卯子': 1, '寅巳': 1, '巳寅': 1, '巳申': 1, '申巳': 1, '申寅': 1, '寅申': 1, '丑戌': 1, '戌丑': 1, '戌未': 1, '未戌': 1, '未丑': 1, '丑未': 1 };
// 六合（js/bazi.js:2416，P2.1 午未合土经典口径）
var ZHI_HE = { '子丑': '土', '丑子': '土', '寅亥': '木', '亥寅': '木', '卯戌': '火', '戌卯': '火', '辰酉': '金', '酉辰': '金', '巳申': '水', '申巳': '水', '午未': '土', '未午': '土' };
// 三合局（js/bazi.js:2421）；半合须含中神（2472-2473：生墓两支只称拱局，不作化局，不记）
var SAN_HE = [['寅', '午', '戌', '火'], ['亥', '卯', '未', '木'], ['申', '子', '辰', '水'], ['巳', '酉', '丑', '金']];
// 三会方（js/bazi.js:2518-2523）；半会=相邻两字（2536：(has0∧has1)∨(has1∧has2)）
var HUI_JU = [['寅', '卯', '辰', '木'], ['巳', '午', '未', '火'], ['申', '酉', '戌', '金'], ['亥', '子', '丑', '水']];

// ---------- relationEvents 事实层 ----------
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
// 返回全柱关系事件数组（客观记录，不判风险）。source/target：天干克为 克者→被克者；对称关系（冲合刑害）仅表柱位先后。
function relationEvents(b) {
  var events = [];
  var pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  pairs.forEach(function (p) {
    var a = POS[p[0]], c = POS[p[1]];
    var ga = b[a].gan, gc = b[c].gan, za = b[a].zhi, zc = b[c].zhi;
    // 天干五合
    if (GAN_HE[ga] === gc) events.push(ev('天干五合', [a, c], [GAN_WX[ga] + '、' + GAN_WX[gc], '化' + GAN_HE_RES[ga + gc]], POS_NAME[a] + ga, POS_NAME[c] + gc, 'js/bazi.js:2382 GAN_HE'));
    // 天干克（同性十对）
    if (GAN_KE[ga] === gc) events.push(ev('天干克', [a, c], [GAN_WX[ga] + '克' + GAN_WX[gc]], POS_NAME[a] + ga, POS_NAME[c] + gc, '经典十对（同性相克力重）'));
    else if (GAN_KE[gc] === ga) events.push(ev('天干克', [a, c], [GAN_WX[gc] + '克' + GAN_WX[ga]], POS_NAME[c] + gc, POS_NAME[a] + ga, '经典十对（同性相克力重）'));
    // 六冲 / 六害 / 刑 / 六合
    if (CHONG[za] === zc) events.push(ev('六冲', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2406 CHONG'));
    if (HAI[za] === zc) events.push(ev('六害', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2409 HAI'));
    if (XING[za + zc]) events.push(ev('刑', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2412 XING'));
    if (ZHI_HE[za + zc]) events.push(ev('六合', [a, c], [ZHI_WX[za] + '、' + ZHI_WX[zc], '化' + ZHI_HE[za + zc]], POS_NAME[a] + za, POS_NAME[c] + zc, 'js/bazi.js:2416 ZHI_HE（午未合土）'));
  });
  // 三合局（全）/ 半合（两支含中神）
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
  // 三会方（全）/ 半会（相邻两字）
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

// ---------- 十神（用于 structuralRisks 原型）----------
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
function ganShen(b, name) { return shiShen(b.day.gan, name); } // 天干十神（相对日主）
// 天干透出表：{gan: 十神, pos}
function ganVisible(b) {
  var out = [];
  POS.forEach(function (p) { out.push({ gan: b[p].gan, shen: shiShen(b.day.gan, b[p].gan), pos: p }); });
  return out;
}

// ---------- structuralRisks 原型（裁决第 6 条：高价值类型先行）----------
// 原则：「存在关系」≠「一定是风险」。必须结合：是否直接作用关键目标 / 位置距离 / 强弱 / 是否有合制化 / 是否只是潜在触发。
// triggerHints 一律条件语言（"进一步增强时可能…"），禁止"某运必凶"。
function risk(type, severity, parties, why, mitigations, triggerHint, evidence) {
  return { type: type, severity: severity, parties: parties, why: why, mitigations: mitigations, triggerHint: triggerHint, evidence: evidence };
}
function evaluateStructuralRisks(b, events, wx) {
  var risks = [];
  var gv = ganVisible(b);
  var has = function (shen) { return gv.filter(function (g) { return g.shen === shen; }); };
  var guan = has('正官'), sha = has('七杀'), shang = has('伤官'), shi = has('食神'), xiao = has('偏印'), zhengYin = has('正印'), cai = has('偏财').concat(has('正财'));
  var dgWx = GAN_WX[b.day.gan];

  // 1) 伤官见官：天干同透伤官与正官
  if (shang.length && guan.length) {
    var s = shang[0], g = guan[0];
    var dist = Math.abs(POS.indexOf(s.pos) - POS.indexOf(g.pos));
    var miti = [];
    var gHeDesc = '', sHeDesc = '';
    var visGans = gv.map(function (x) { return x.gan; });
    [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']].forEach(function (h) {
      if (h[0] === g.gan && visGans.indexOf(h[1]) >= 0) gHeDesc = '正官' + g.gan + '被' + h[1] + '合绊';
      if (h[1] === g.gan && visGans.indexOf(h[0]) >= 0) gHeDesc = '正官' + g.gan + '被' + h[0] + '合绊';
      if (h[0] === s.gan && visGans.indexOf(h[1]) >= 0) sHeDesc = '伤官' + s.gan + '被' + h[1] + '合制';
      if (h[1] === s.gan && visGans.indexOf(h[0]) >= 0) sHeDesc = '伤官' + s.gan + '被' + h[0] + '合制';
    });
    if (gHeDesc) miti.push(gHeDesc); if (sHeDesc) miti.push(sHeDesc);
    if (cai.length) miti.push('有财星透出可论通关（伤生财→财生官）');
    if (dist >= 2) miti.push('伤官与正官远隔（不直接对贴）');
    var sev = (dist === 1 && !gHeDesc && !sHeDesc) ? '存在' : '潜在';
    risks.push(risk('伤官见官', sev,
      POS_NAME[s.pos] + s.gan + '伤官 ↔ ' + POS_NAME[g.pos] + g.gan + '正官',
      '天干同透伤官与正官，位距' + dist,
      miti.length ? miti.join('；') : '无',
      '若伤官' + s.gan + '（' + GAN_WX[s.gan] + '）得根行旺或正官' + g.gan + '失其制化，伤官见官之势可能显化；当前' + (gHeDesc || '官星无合绊') + '、位距' + dist + (dist >= 2 ? '（远隔）' : '（贴身）') + '，属潜在而非必发。',
      '原型规则：天干同透伤官+正官；制化检查=五合绊/财印通关/位距'));
  }
  // 2) 财破印：财干克印干（元素相克）
  if (cai.length && (zhengYin.length || xiao.length)) {
    var c = cai[0], y = (zhengYin.concat(xiao))[0];
    if (KE[GAN_WX[c.gan]] === GAN_WX[y.gan]) {
      var dist2 = Math.abs(POS.indexOf(c.pos) - POS.indexOf(y.pos));
      var cHe = '';
      [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']].forEach(function (h) {
        if ((h[0] === c.gan || h[1] === c.gan) && gv.some(function (x) { return x.gan === (h[0] === c.gan ? h[1] : h[0]); })) cHe = '财星' + c.gan + '被合绊';
      });
      risks.push(risk('财破印', dist2 === 1 && !cHe ? '存在' : '潜在',
        POS_NAME[c.pos] + c.gan + '（财）克 ' + POS_NAME[y.pos] + y.gan + '（印）',
        '财干元素克印干，位距' + dist2,
        cHe || '无',
        '若财星' + c.gan + '进一步增强而印星' + y.gan + '根基不稳，财破印可能加重，印所代表的学业/庇护/格局转化力可能受损。',
        '原型规则：天干财元素克印元素'));
    }
  }
  // 3) 枭夺食：偏印克食神
  if (xiao.length && shi.length) {
    var x = xiao[0], sh = shi[0];
    if (KE[GAN_WX[x.gan]] === GAN_WX[sh.gan]) {
      var dist3 = Math.abs(POS.indexOf(x.pos) - POS.indexOf(sh.pos));
      risks.push(risk('枭夺食', dist3 === 1 ? '存在' : '潜在',
        POS_NAME[x.pos] + x.gan + '（枭）克 ' + POS_NAME[sh.pos] + sh.gan + '（食）',
        '偏印元素克食神元素，位距' + dist3,
        '无',
        '若偏印' + x.gan + '进一步增强，枭夺食可能显化，食神所代表的才华/口福/表达可能受抑。',
        '原型规则：天干偏印元素克食神元素'));
    }
  }
  // 4) 官杀混杂：正官与七杀同透
  if (guan.length && sha.length) {
    risks.push(risk('官杀混杂', '存在',
      guan.map(function (g) { return POS_NAME[g.pos] + g.gan + '正官'; }).join('、') + '；' + sha.map(function (g) { return POS_NAME[g.pos] + g.gan + '七杀'; }).join('、'),
      '天干同透正官与七杀（透干口径；藏干不透不判混杂）', '无',
      '若官杀任一进一步增强而制化不足，官杀混杂的反复/压力感可能加重。',
      '原型规则：透干口径'));
  }
  // 5) 杀重无制：七杀透干≥2 且无食伤/印透通关
  if (sha.length >= 2 && !shang.length && !shi.length && !zhengYin.length && !xiao.length) {
    risks.push(risk('杀重无制', '存在',
      sha.map(function (g) { return POS_NAME[g.pos] + g.gan; }).join('、'),
      '七杀透干' + sha.length + '处且天干无食伤制杀、无印化杀', '无',
      '若七杀再得根增强而无制化出现，杀重无制之势可能加重；出现印化杀或食伤制杀则风险可能解除。',
      '原型规则：杀透≥2 ∧ 无食伤∧无印透'));
  } else if (sha.length === 1 && !shang.length && !shi.length && !zhengYin.length && !xiao.length) {
    risks.push(risk('杀重无制', '潜在',
      POS_NAME[sha[0].pos] + sha[0].gan,
      '七杀透干一处且无制化（单杀不判重，仅记潜在）', '无',
      '若七杀' + sha[0].gan + '再得根增强而无制化，杀势可能加重。',
      '原型规则：单杀无制仅记潜在'));
  }
  // 6) 关键用神/格局节点受冲：冲对任一支命中节点（用神同五行/用神干之禄/日主禄/印星之根/七杀之根）
  var yongWx = wx.yongWx;
  events.filter(function (e) { return e.type === '六冲'; }).forEach(function (e) {
    var zA = e.pillars[0], zB = e.pillars[1];
    var za = b[zA].zhi, zb = b[zB].zhi;
    var yinWx = shENGWO(dgWx), shaWx = kEWO(dgWx);
    var yongGans = gv.filter(function (g) { return GAN_WX[g.gan] === yongWx; }).map(function (g) { return g.gan; });
    var addNode = function (arr, z) {
      if (ZHI_WX[z] === yongWx) arr.push('用神同五行');
      yongGans.forEach(function (g) { if (LU[g] === z) arr.push('用神干' + g + '之禄'); });
      if (LU[b.day.gan] === z) arr.push('日主之禄');
      var main = CANG[z][0];
      if (ZHI_WX[z] === yinWx || GAN_WX[main] === yinWx) arr.push('印星之根');
      if (ZHI_WX[z] === shaWx || GAN_WX[main] === shaWx) arr.push('七杀之根');
    };
    var nodeA = [], nodeB = [];
    addNode(nodeA, za); addNode(nodeB, zb);
    var hitA = nodeA.length ? POS_NAME[zA] + za + '（' + nodeA.join('；') + '）' : '';
    var hitB = nodeB.length ? POS_NAME[zB] + zb + '（' + nodeB.join('；') + '）' : '';
    if (hitA || hitB) {
      var d6 = e.distance;
      risks.push(risk('关键用神/格局节点受冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        (hitA || POS_NAME[zA] + za) + ' ↔ ' + (hitB || POS_NAME[zB] + zb),
        '六冲' + za + zb + '命中' + (hitA ? hitA : '') + (hitB ? '；' + hitB : '') + '，位距' + d6 + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        '若冲方（' + ZHI_WX[za] + '/' + ZHI_WX[zb] + '）任一进一步增强，对' + ((nodeA.length ? nodeA.join('、') : '') + (nodeB.length ? nodeB.join('、') : '')) + '的冲击可能加重，相关格局节点根基可能动摇。',
        '原型规则：冲对命中用神节点（同五行/用神干之禄/日主禄）或印杀之根'));
    }
  });
  // 7) 财印冲 / 官印冲：冲对双方主气一为财一为印（或一为官杀一为印）
  events.filter(function (e) { return e.type === '六冲'; }).forEach(function (e) {
    var za = b[e.pillars[0]].zhi, zb = b[e.pillars[1]].zhi;
    var wa = GAN_WX[CANG[za][0]], wb = GAN_WX[CANG[zb][0]];
    var yinWx = shENGWO(dgWx);
    var caiWx = KE[dgWx]; // 我克者 = 财
    var shaWx2 = kEWO(dgWx);
    var isCaiYin = (wa === caiWx && wb === yinWx) || (wa === yinWx && wb === caiWx);
    var isGuanYin = (wa === shaWx2 && wb === yinWx) || (wa === yinWx && wb === shaWx2);
    if (isCaiYin) {
      risks.push(risk('财印冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        POS_NAME[e.pillars[0]] + za + '（' + CANG[za][0] + wa + '） ↔ ' + POS_NAME[e.pillars[1]] + zb + '（' + CANG[zb][0] + wb + '）',
        '冲对主气一财一印，位距' + e.distance + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        '若财方' + (wa === caiWx ? wa : wb) + '进一步增强，财印相冲可能加重，印星根基可能进一步受扰。',
        '原型规则：六冲对主气一财一印'));
    } else if (isGuanYin) {
      risks.push(risk('官印冲', (e.involvesMonth || e.involvesDay) ? '存在' : '潜在',
        POS_NAME[e.pillars[0]] + za + '（' + CANG[za][0] + wa + '） ↔ ' + POS_NAME[e.pillars[1]] + zb + '（' + CANG[zb][0] + wb + '）',
        '冲对主气一官杀一印，位距' + e.distance + (e.involvesMonth ? '、涉月令' : '') + (e.involvesDay ? '、涉日支' : ''),
        '无',
        '若官杀方' + (wa === shaWx2 ? wa : wb) + '进一步增强，官印相冲可能加重，印化杀的转化通道可能受扰。',
        '原型规则：六冲对主气一官杀一印'));
    }
  });
  return risks;
}

// ---------- 样本 ----------
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
console.log('样本共 ' + ALL.length + ' 盘（含 Round2 12 盘 + wetearth）');

// ---------- 逐盘：relationEvents + structuralRisks ----------
function wuxingLayer(b) {
  var dm = calcDayMasterStrength(b);
  var yj = getYongJi(b), pat = getPattern(b);
  return {
    score: dm.score, level: dm.level,
    yong: yj.yongShen, xi: yj.xiShen, ji: yj.jiShen,
    yongWx: yj.yongShen[0], pattern: pat.name + '·' + pat.status
  };
}
var evRows = [], riskRows = [];
var typeCount = {}, riskTypeCount = {}, zeroEvPans = [];
ALL.forEach(function (c) {
  var b = toBazi(c.gz);
  var events = relationEvents(b);
  var wx = wuxingLayer(b);
  var risks = evaluateStructuralRisks(b, events, wx);
  events.forEach(function (e) {
    typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    evRows.push([c.set, c.id, c.gz.join(' '), e.type, e.pillars.join('+'), e.elements.join('|'), e.distance, e.involvesMonth ? 1 : 0, e.involvesDay ? 1 : 0, e.source, e.target, e.evidence]);
  });
  if (!events.length) zeroEvPans.push(c.id);
  risks.forEach(function (r) {
    riskTypeCount[r.type] = (riskTypeCount[r.type] || 0) + 1;
    riskRows.push([c.set, c.id, c.gz.join(' '), wx.score, wx.level, wx.yong.join('、'), wx.xi.join('、'), wx.ji.join('、'), wx.pattern, r.type, r.severity, r.parties, r.why, r.mitigations, r.triggerHint, r.evidence]);
  });
  // 纪律断言：triggerHints 条件语言，禁"必凶"
  risks.forEach(function (r) {
    if (r.triggerHint.indexOf('必凶') >= 0) { console.error('❌ triggerHint 含禁用语"必凶": ' + c.id + ' ' + r.type); process.exit(1); }
    if (r.triggerHint.indexOf('可能') < 0 && r.triggerHint.indexOf('若') < 0) { console.error('❌ triggerHint 非条件语言: ' + c.id + ' ' + r.type + ' → ' + r.triggerHint); process.exit(1); }
  });
});
fs.writeFileSync(path.join(ROOT, '_p3_a1_relation_events.csv'), [['set', 'id', 'gz', 'type', 'pillars', 'elements', 'distance', 'involvesMonth', 'involvesDay', 'source', 'target', 'evidence'].join(',')].concat(evRows.map(function (r) { return r.join(','); })).join('\n'), 'utf8');
fs.writeFileSync(path.join(ROOT, '_p3_a1_risks.csv'), [['set', 'id', 'gz', 'score', 'level', 'yong', 'xi', 'ji', 'pattern', 'riskType', 'severity', 'parties', 'why', 'mitigations', 'triggerHint', 'evidence'].join(',')].concat(riskRows.map(function (r) { return r.join(','); })).join('\n'), 'utf8');
console.log('✅ _p3_a1_relation_events.csv（' + evRows.length + ' 事件行）/ _p3_a1_risks.csv（' + riskRows.length + ' 风险行）已写');

// ---------- 覆盖统计 ----------
console.log('\n===== relationEvents 全样本覆盖（' + ALL.length + ' 盘）=====');
Object.keys(typeCount).sort().forEach(function (t) { console.log('  ' + t + ': ' + typeCount[t]); });
console.log('  零关系盘: ' + (zeroEvPans.length ? zeroEvPans.join(',') : '无'));
console.log('\n===== structuralRisks 全样本覆盖 =====');
Object.keys(riskTypeCount).sort().forEach(function (t) { console.log('  ' + t + ': ' + riskTypeCount[t]); });

// ---------- #9 黄金样本验证（裁决第 8 条：两层不得互相污染）----------
console.log('\n===== #9 黄金样本 甲子 丁卯 己未 庚午 =====');
var b9 = toBazi(['甲子', '丁卯', '己未', '庚午']);
var wx9 = wuxingLayer(b9);
var ev9 = relationEvents(b9);
var risk9 = evaluateStructuralRisks(b9, ev9, wx9);

var fail = 0;
function assert(cond, msg) { if (!cond) { fail++; console.error('  ❌ ' + msg); } else { console.log('  ✅ ' + msg); } }
// A. 五行层现状（P1/P2 分数未被 P3 触碰）
assert(wx9.score === 51, '五行层分数 51 不变（P3 不改 P1/P2 分数）');
assert(wx9.level === '中和', '五行层旺衰 中和');
assert(wx9.yong.join('') === '木', '五行层用神 木');
assert(wx9.pattern === '杀印相生格·成格', '五行层格局 杀印相生格·成格（引擎原值，含格后缀）');
assert(wx9.ji.length === 0, '五行层无明显忌神（jiShen 为空）——两层不污染前提');
// B. relationEvents 事实层：逐类型精确断言
function hasEv(type, pair) {
  return ev9.some(function (e) { return e.type === type && e.pillars.slice().sort().join('') === pair.split(',').sort().join(''); });
}
assert(ev9.filter(function (e) { return e.type === '六冲'; }).length === 1 && hasEv('六冲', 'year,hour'), '六冲恰 1 条：年子-时午（子午冲，d3）');
assert(ev9.filter(function (e) { return e.type === '六害'; }).length === 1 && hasEv('六害', 'year,day'), '六害恰 1 条：年子-日未（子未害，d2）');
assert(ev9.filter(function (e) { return e.type === '六合'; }).length === 1 && hasEv('六合', 'day,hour'), '六合恰 1 条：日未-时午（午未合土，d1）');
assert(ev9.filter(function (e) { return e.type === '半合'; }).length === 1 && hasEv('半合', 'month,day'), '半合恰 1 条：月卯-日未（亥卯未局半合木，d1）');
assert(ev9.filter(function (e) { return e.type === '半会'; }).length === 1 && hasEv('半会', 'day,hour'), '半会恰 1 条：日未-时午（巳午未方半会火，d1）');
assert(ev9.filter(function (e) { return e.type === '刑'; }).length === 1 && hasEv('刑', 'year,month'), '刑恰 1 条：年子-月卯（子卯刑，d1）');
assert(ev9.filter(function (e) { return e.type === '天干五合'; }).length === 1 && hasEv('天干五合', 'year,day'), '天干五合恰 1 条：年甲-日己（甲己合化土，d2）');
assert(ev9.filter(function (e) { return e.type === '天干克'; }).length === 1 && hasEv('天干克', 'year,hour'), '天干克恰 1 条：时庚克年甲（同性十对，d3）');
assert(ev9.filter(function (e) { return e.type === '三合局' || e.type === '三会方'; }).length === 0, '无三合全/三会全（事实层不虚构）');
assert(ev9.length === 8, '事件总数恰 8 条（无遗漏、无虚增）');
ev9.forEach(function (e) {
  assert(['type', 'pillars', 'elements', 'distance', 'involvesMonth', 'involvesDay', 'target', 'source', 'evidence'].every(function (k) { return e[k] !== undefined; }), '字段完整: ' + e.type + ' ' + e.pillars.join('+'));
});
// C. structuralRisks 原型：裁决预期"伤官见官、子午冲等风险"
var t9 = risk9.map(function (r) { return r.type; });
assert(t9.indexOf('伤官见官') >= 0, '结构层含 伤官见官（时庚伤官 ↔ 年甲正官）');
assert(t9.indexOf('关键用神/格局节点受冲') >= 0, '结构层含 关键用神/格局节点受冲（子午冲命中印星丁之禄/日主己之禄）');
assert(t9.indexOf('财印冲') >= 0, '结构层含 财印冲（子主气癸偏财 ↔ 午主气丁偏印）');
assert(t9.indexOf('枭夺食') < 0 && t9.indexOf('官杀混杂') < 0 && t9.indexOf('杀重无制') < 0, '枭夺食/官杀混杂/杀重无制 不触发（无辛食神/无乙杀透干）');
risk9.forEach(function (r) { assert(r.severity === '存在' || r.severity === '潜在', '风险分级合法: ' + r.type + '=' + r.severity); });
// D. 两层不污染：评价前后五行层输出完全一致
var wx9After = wuxingLayer(b9);
assert(JSON.stringify(wx9) === JSON.stringify(wx9After), '关系/结构层评价后五行层输出逐字节一致（不污染）');
assert(wx9.ji.join('') === '', '结构风险未写入忌神（忌神仍为空）');
// E. 引擎零改动
var curSrc2 = fs.readFileSync(path.join(ROOT, 'js/bazi.js'), 'utf8').replace(/\r\n/g, '\n');
assert(curSrc2 === deployed, 'js/bazi.js 全程未被改动（仍是 63fafaa）');

console.log(fail === 0 ? '\n🎉 #9 黄金样本验证全部通过（两层不污染）' : '\n💥 失败断言 ' + fail + ' 条');
process.exit(fail === 0 ? 0 : 1);
