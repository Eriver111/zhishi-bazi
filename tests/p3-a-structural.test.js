// P3-A3 正式实装/回归：四层 A/B 验证（2026-08-14，验收前不 push）
//   2026-08-21 v2 旺衰评分重冻（用户授权）：A 层 22 盘锚点更新 + 6 盘旗标陈旧修正 + sha 重钉 c6c323fc。
//   2026-08-21 用户复核六处结构性翻转（照单重冻）——阈值敏感锚点注册表（详见 _v2_threshold_sensitive_anchors.md）：
//     跨 50 用神反转：B5 庚子甲申乙卯丙子 42→51（A死+7/B禄+2）；P15-09 丁丑癸卯庚申丙戌 47→52（A囚+3/B禄+2）；
//       P15-19 己亥丙子辛酉戊子 49→51（B禄+2）
//     跨 30 格局级联：P15-15/H01 癸未戊午乙卯丙戌 29.75→31.75 食神生财格成格（B禄+2，距线+1.75）；
//       H12 甲申丁丑壬辰己酉 28.5→30.5 正官格成格（C丁壬合绊+2，距线+0.5，最高优先级）
//     处理：全部接受、照单重冻、A/B/C 本轮不回调；留待下一阶段「格局承载连续化/置信度」与「50 线迟滞」。
//     本轮原则（用户裁定）：允许有命理上可解释的边界翻转；不为了保持旧标签而反向污染上游评分。
//   2026-09-02 食伤泄身取用重冻：6 个重复锚点改为印星优先、比劫慎用；P15-16 不再把劫财根当用神节点，风险 59→58。
//   2026-09-03 得令双根透印承载修正：加入日支藏根通关、浮透有根度与稳定根架内刑害去重；53 盘锚点零漂移。
//   2026-09-03 命理事件账本观察层：为原局证据建立稳定编号与消费轨迹；只审计不结算，53 盘锚点零漂移。
//   A 层：引擎字节冻结 + 53 盘五行层对 P2 冻结锚点核验（仅允许已审计批准的显式差异）
//   B 层：正式实现与 A1/A2-final 冻结产物逐项一致（relationEvents→_p3_a1_relation_events.csv；
//         structuralRisks→_p3_a2_risks.csv 17 列；shaAB→_p3_a2_sha_ab.csv 15 列）
//   C 层：#9 黄金样本（甲子 丁卯 己未 庚午）权威值 + 两层零污染
//   D 层：K2-final 四盘（A6/P15-03/H05/H13）+ #8/B1 透干七杀坐支之根节点恢复
//   九 层：口径断言（对称/非对称 source-target、全 pair 聚合、官杀混杂双透、triggerHint 禁确定性语言、八类事件覆盖）
// 纪律：本测试只读冻结产物与引擎输出；失败即停、逐条归因；不修改任何冻结文件。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const SA = require('../js/structural.js');

const ROOT = path.join(__dirname, '..');

function loadCalculator() {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}
const calculator = loadCalculator();

function parseCSV(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^﻿/, '')
    .split(/\r?\n/).filter(Boolean).map(function (l) { return l.split(','); });
}
// 冻结产物（只读，不写回）
const shaRows = parseCSV('_p3_a2_sha_ab.csv').slice(1);        // 53 盘 × 15 列：set,id,gz,shaGans,K1,K2,e1,e2,e3,e4,evCount,zhihua,zhihuaDesc,diff,shaHeDesc
const riskRows = parseCSV('_p3_a2_risks.csv').slice(1);        // 58 行 × 17 列：set,id,gz,score,level,yong,xi,ji,pattern,riskType,severity,parties,why,mitigations,triggerHint,evidence,partyEvidence
const evRows = parseCSV('_p3_a1_relation_events.csv').slice(1); // 271 行 × 12 列：set,id,gz,type,pillars,elements,distance,involvesMonth,involvesDay,source,target,evidence
const replayRows = parseCSV('_p2_4a_replay.csv').slice(1);     // 53 盘：set,id,alias,gz,sC,lC,yC,xiC,jiC,pC,congC,...

// 2026-08-17 裁决：月令格神未透干恢复为硬破格。仅这些已冻结样本允许
// 用当前引擎的破格状态替代旧 replay/risk 文本，其他字段仍逐项锁定。
const APPROVED_PATTERN_STATUS = new Set(['#10', 'A5', 'H11', 'P15-09', 'H15', 'SY2']);
function approvedPatternStatus(id, value) {
  return APPROVED_PATTERN_STATUS.has(id) && /格·成格$/.test(value)
    ? value.replace(/格·成格$/, '格·破格')
    : value;
}

const chartList = shaRows.map(function (r) { return { set: r[0], id: r[1], gz: r[2] }; });
assert.equal(chartList.length, 53, 'sha_ab 冻结产物必须恰 53 盘');
assert.equal(riskRows.length, 58, 'risks 冻结产物必须恰 58 风险行');
assert.equal(evRows.length, 271, 'events 冻结产物必须恰 271 事件行');

function buildFromPillars(c) {
  const p = c.gz.split(' ');
  return calculator.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
}
function chartOf(id) {
  for (let i = 0; i < chartList.length; i++) if (chartList[i].id === id) return chartList[i];
  return null;
}
// 每盘计算一次并缓存（引擎调用较重的折中）
const computed = {};
function dataOf(c) {
  const k = c.set + '|' + c.id;
  if (!computed[k]) {
    const b = buildFromPillars(c);
    const events = SA.relationEvents(b);
    const dm = calculator.calcDayMasterStrength(b);
    const yj = calculator.getYongJi(b);
    const pat = calculator.getPattern(b);
    const cong = calculator.getCongGe(b);
    const ab = SA.shaAB(b, events);
    const risks = SA.evaluate(b, calculator).structuralRisks;
    computed[k] = { b: b, events: events, dm: dm, yj: yj, pat: pat, cong: cong, ab: ab, risks: risks };
  }
  return computed[k];
}

// ============================================================
// A 层：引擎字节冻结 + 53 盘五行层（分数/旺衰/喜用忌/格局/从格）零漂移
// ============================================================
test('A层：js/bazi.js 与部署 blob 逐字节一致（sha256 + git show 双重断言）', function () {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'bazi.js'));
  assert.equal(
    crypto.createHash('sha256').update(src).digest('hex'),
    'b421a21dbb0e855bd8bd56280fa45ec49bc6f2952fba779d0206ff38d8257141',
    'js/bazi.js sha256 与命理事件账本观察版的仓库标准 LF blob 一致'
  );
  const lf = src.toString('utf8').replace(/\r\n/g, '\n');
  const deployed = execSync('git show HEAD:js/bazi.js', { cwd: ROOT }).toString('utf8');
  assert.equal(lf, deployed, 'js/bazi.js（LF 归一化）=== HEAD 部署 blob');
});

test('A层：53 盘五行层仅含已批准的复合格状态修正', function () {
  const replayById = {};
  replayRows.forEach(function (r) { replayById[r[0] + '|' + r[1]] = r; });
  assert.equal(Object.keys(replayById).length, 53, 'replay 冻结锚点必须覆盖 53 盘');
  chartList.forEach(function (c) {
    const key = c.set + '|' + c.id;
    assert.ok(replayById[key], c.id + ' 缺 replay 锚点');
    const r = replayById[key];
    const d = dataOf(c);
    assert.equal(String(d.dm.score), r[4], c.id + ' 分数');
    assert.equal(d.dm.level, r[5], c.id + ' 旺衰');
    assert.equal(d.yj.yongShen.join('、'), r[6], c.id + ' 用神');
    assert.equal(d.yj.xiShen.join('、'), r[7], c.id + ' 喜神');
    assert.equal(d.yj.jiShen.join('、'), r[8], c.id + ' 忌神');
    assert.equal(d.pat.name + '·' + d.pat.status, approvedPatternStatus(c.id, r[9]), c.id + ' 格局');
    assert.equal(d.cong.isCong ? d.cong.name : '否', r[10], c.id + ' 从格');
  });
});

test('A层：53 盘内部旺衰追踪均能闭合且与喜用忌一致', function () {
  chartList.forEach(function(c) {
    const audit = calculator.auditDayMasterStrength(dataOf(c).b);
    assert.equal(audit.result.score, dataOf(c).dm.score, c.id + ' 审计分数');
    assert.equal(audit.result.level, dataOf(c).dm.level, c.id + ' 审计档位');
    assert.equal(50 + audit.scoreTrace.reduce(function(sum, stage) { return sum + stage.delta; }, 0), audit.result.rawScore, c.id + ' 分差闭合');
    assert.equal(audit.warnings.filter(function(item) { return item.severity === 'error'; }).length, 0, c.id + ' 存在内部契约错误');
  });
});

// ============================================================
// B 层：正式实现与冻结产物逐项一致
// ============================================================
test('B1：relationEvents 53 盘与 _p3_a1_relation_events.csv 逐项一致（含 271 事件总数与类型分布）', function () {
  const evByChart = {};
  const frozenTypes = {};
  evRows.forEach(function (r) {
    const k = r[0] + '|' + r[1];
    (evByChart[k] = evByChart[k] || []).push(r);
    frozenTypes[r[3]] = (frozenTypes[r[3]] || 0) + 1;
  });
  let freshTotal = 0;
  const freshTypes = {};
  chartList.forEach(function (c) {
    const d = dataOf(c);
    freshTotal += d.events.length;
    d.events.forEach(function (e) { freshTypes[e.type] = (freshTypes[e.type] || 0) + 1; });
    const keyOf = function (e) {
      return [e.type, e.pillars.join('+'), e.elements.join('|'), String(e.distance),
        e.involvesMonth ? '1' : '0', e.involvesDay ? '1' : '0', e.source, e.target, e.evidence].join('|');
    };
    const fresh = d.events.map(keyOf).sort();
    const frozen = (evByChart[c.set + '|' + c.id] || []).map(function (r) {
      return [r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]].join('|');
    }).sort();
    assert.deepEqual(fresh, frozen, c.id + ' 事件层逐项一致');
  });
  assert.equal(freshTotal, 271, '53 盘事件总数 === 冻结 271');
  assert.deepEqual(freshTypes, frozenTypes, '事件类型分布与冻结一致（八类 + 半合/半会全枚举）');
});

test('B2：structuralRisks 53 盘与 _p3_a2_risks.csv 逐项一致（17 列全等）', function () {
  const riskByChart = {};
  riskRows.forEach(function (r) {
    const k = r[0] + '|' + r[1];
    (riskByChart[k] = riskByChart[k] || []).push(r);
  });
  chartList.forEach(function (c) {
    const d = dataOf(c);
    const fresh = d.risks.map(function (r) {
      return [c.set, c.id, c.gz, String(d.dm.score), d.dm.level,
        d.yj.yongShen.join('、'), d.yj.xiShen.join('、'), d.yj.jiShen.join('、'),
        d.pat.name + '·' + d.pat.status,
        r.type, r.severity, r.parties, r.why, r.mitigations, r.triggerHint, r.evidence, r.partyEvidence
      ].join('');
    }).sort();
    const frozen = (riskByChart[c.set + '|' + c.id] || []).map(function (r) {
      const copy = r.slice();
      copy[8] = approvedPatternStatus(c.id, copy[8]);
      return copy.join('');
    }).sort();
    assert.equal(fresh.length, frozen.length, c.id + ' 风险行数与冻结一致');
    assert.deepEqual(fresh, frozen, c.id + ' 风险 17 列逐项一致');
  });
});

test('B3：shaAB（K1/K2/证据/制化/合绊）53 盘与 _p3_a2_sha_ab.csv 逐项一致（15 列全等）', function () {
  const shaByChart = {};
  shaRows.forEach(function (r) { shaByChart[r[0] + '|' + r[1]] = r; });
  chartList.forEach(function (c) {
    const d = dataOf(c);
    const ab = d.ab;
    const fresh = [c.set, c.id, c.gz, ab.shaGans, ab.k1, ab.k2,
      String(ab.e1), String(ab.e2), String(ab.e3), String(ab.e4), String(ab.evCount),
      ab.zhihua ? '有' : '无', ab.zhihuaDesc, ab.diff, ab.shaHeDesc];
    assert.deepEqual(fresh, shaByChart[c.set + '|' + c.id], c.id + ' shaAB 15 列逐项一致');
  });
});

// ============================================================
// C 层：#9 黄金样本（甲子 丁卯 己未 庚午）——权威值 + 两层零污染
// ============================================================
test('C：#9 黄金样本权威值 + 事实层/风险层口径 + 两层零污染', function () {
  const c9 = chartOf('#9');
  const b9 = buildFromPillars(c9); // 全新对象：污染检查用
  // 污染检查基线：结构层不得改写 bazi 对象（两层不污染）。
  // 注：evaluate 内部经 getYongJi 调用引擎 calcDayMasterStrength，引擎会按自身惯例写入 _siLing 缓存——
  // 这与页面既有流程（result.js 直接调用同一引擎函数）行为完全一致，非结构层所写。
  const baziBefore = JSON.stringify(b9);
  const out9 = SA.evaluate(b9, calculator);
  const ev9 = out9.relationEvents;
  const risk9 = out9.structuralRisks;
  const b9After = JSON.parse(JSON.stringify(b9));
  assert.equal(typeof b9After._siLing, 'object', '引擎自行写入 _siLing 缓存（既有引擎行为）');
  delete b9After._siLing;
  assert.equal(JSON.stringify(b9After), baziBefore, '除引擎 _siLing 缓存外，bazi 对象逐字节不变（结构层不写排盘对象）');

  // A. 五行层权威值（锁定，P3 不改 P1/P2）
  const dm9 = calculator.calcDayMasterStrength(b9);
  const yj9 = calculator.getYongJi(b9);
  const pat9 = calculator.getPattern(b9);
  assert.equal(dm9.score, 51, '#9 分数 51');
  assert.equal(dm9.level, '中和', '#9 旺衰 中和');
  assert.equal(yj9.yongShen.join(''), '木', '#9 用神 木');
  assert.equal(yj9.xiShen.join(''), '木金水', '#9 方向集合含用神木与弱喜金水');
  assert.equal(yj9.jiShen.join(''), '火土', '#9 方向集合含弱忌火土');
  assert.deepEqual(JSON.parse(JSON.stringify(yj9.elementClassification)), {
    木: '用神', 火: '弱忌', 土: '弱忌', 金: '弱喜', 水: '弱喜',
  }, '#9 强弱语义由 elementClassification 明确承载');
  assert.equal(pat9.name + '·' + pat9.status, '杀印相生格·成格', '#9 伤官制杀与印化杀并见，不套用伤官克官硬破');

  // B. relationEvents 事实层回归（A1 冻结口径）
  function hasEv(type, pair) {
    return ev9.some(function (e) { return e.type === type && e.pillars.slice().sort().join('') === pair.split(',').sort().join(''); });
  }
  assert.equal(ev9.length, 8, '#9 事实层事件恰 8 条');
  assert.equal(ev9.filter(function (e) { return e.type === '六冲'; }).length, 1, '#9 六冲恰 1 条');
  assert.ok(hasEv('六冲', 'year,hour'), '#9 六冲 = 年子-时午');

  // C. structuralRisks：3 风险不变
  const t9 = risk9.map(function (r) { return r.type; });
  assert.equal(risk9.length, 3, '#9 结构层风险恰 3 条（无增无减）');
  assert.equal(t9.join('|'), '伤官见官|关键用神/格局节点受冲|财印冲', '#9 3 风险类型：' + t9.join('、'));

  // C1. 伤官见官 v2（全 pair 聚合）
  const rSG = risk9[0];
  assert.equal(rSG.severity, '潜在', '#9 伤官见官 severity=潜在（位距3无贴身）');
  assert.ok(rSG.why.indexOf('全 pair 枚举 1 对') >= 0, '#9 伤官见官全 pair 枚举 1 对聚合成一条');
  assert.ok(rSG.mitigations.indexOf('正官甲被己合绊(d2，中)') >= 0, '#9 伤官见官 mitigation 含"正官甲被己合绊(d2，中)"');
  assert.ok(rSG.partyEvidence.indexOf('年柱甲正官:exposedRooted') >= 0 && rSG.partyEvidence.indexOf('时柱庚伤官:exposedUnrooted') >= 0,
    '#9 伤官见官 partyEvidence 五档：甲 exposedRooted / 庚 exposedUnrooted');

  // C2. 关键用神/格局节点受冲 v2（节点清单 v2）
  const rNode = risk9[1];
  assert.equal(rNode.severity, '潜在', '#9 节点受冲 severity=潜在（年-时 d3）');
  assert.ok(rNode.why.indexOf('印星之根') >= 0, '#9 子午冲节点 why 含"印星之根"（午主气丁火=印）');
  assert.ok(rNode.why.indexOf('日主之禄') < 0, '#9 子午冲节点 why 不含"日主之禄"（节点清单 v2 已删）');
  assert.ok(rNode.triggerHint.indexOf('若年柱子（癸水·偏财）得运助增，对时柱午（印星之根）的冲击可能加重') >= 0,
    '#9 节点受冲 triggerHint 与规格示例一致（冲方十神角色具体化）');
  assert.ok(rNode.triggerHint.indexOf('任一') < 0 && rNode.triggerHint.indexOf('必凶') < 0, '#9 节点受冲 triggerHint 禁"任一"/"必凶"');

  // C3. 财印冲 v2
  const rCY = risk9[2];
  assert.equal(rCY.severity, '潜在', '#9 财印冲 severity=潜在');
  assert.ok(rCY.partyEvidence.indexOf('hiddenMainRoot') >= 0 && rCY.partyEvidence.indexOf('exposedRooted') >= 0,
    '#9 财印冲 partyEvidence 五档：子癸 hiddenMainRoot / 午丁 exposedRooted');

  // C4. 不触发项
  assert.ok(t9.indexOf('官杀混杂') < 0 && t9.indexOf('杀重无制') < 0 && t9.indexOf('枭夺食') < 0 && t9.indexOf('财破印') < 0,
    '#9 官杀混杂/杀重无制/枭夺食/财破印 均不触发');

  // C5. K2-final：#9 无杀透 → 不输出
  const ab9 = SA.shaAB(b9, ev9);
  assert.equal(ab9.k1, '', '#9 K1 不输出');
  assert.equal(ab9.k2, '', '#9 K2-final 不输出（无七杀透干）');

  // D. 两层不污染：结构层评价前后五行层逐字节一致；风险元素未写入忌神
  const wxAfter = {
    score: calculator.calcDayMasterStrength(b9).score,
    level: calculator.calcDayMasterStrength(b9).level,
    yong: calculator.getYongJi(b9).yongShen.join(''),
    xi: calculator.getYongJi(b9).xiShen.join(''),
    ji: calculator.getYongJi(b9).jiShen.join(''),
    pattern: calculator.getPattern(b9).name + '·' + calculator.getPattern(b9).status
  };
  assert.deepEqual(wxAfter, { score: 51, level: '中和', yong: '木', xi: '木金水', ji: '火土', pattern: '杀印相生格·成格' },
    '#9 结构层评价后五行层输出不变（两层不污染）');
});

// ============================================================
// D 层：K2-final 四盘预期（GPT 最终裁决第 7 条）+ #8/B1 节点恢复（裁决第 4 条）
// ============================================================
test('D：K2-final 四盘预期全中 + #8/B1 透干七杀坐支之根节点恢复', function () {
  function shaOf(id) { const c = chartOf(id); return dataOf(c).ab; }
  const aA6 = shaOf('A6'), aP15 = shaOf('P15-03'), aH05 = shaOf('H05'), aH13 = shaOf('H13');
  assert.equal(aA6.k2, '存在', 'A6 K2-final=存在');
  assert.ok(aA6.evCount >= 2 && !aA6.zhihua && !aA6.strongMit, 'A6 单杀当令+本气根，无制化无合绊');
  assert.equal(aP15.k2, '', 'P15-03 K2-final=不输出');
  assert.ok(aP15.zhihua, 'P15-03 庚伤官中气根在巳计入有效制化（裁决第 5 条）');
  assert.equal(aH05.k2, '潜在', 'H05 K2-final=潜在');
  assert.ok(aH05.strongMit, 'H05 杀庚被乙合绊 d1 强降级（裁决第 6 条）');
  assert.equal(aH13.k2, '', 'H13 K2-final=不输出');
  assert.equal(aH13.evCount, 0, 'H13 壬杀无根 e=0000');

  ['#8', 'B1'].forEach(function (id) {
    const c = chartOf(id);
    const rows = dataOf(c).risks.filter(function (r) { return r.type === '关键用神/格局节点受冲'; });
    assert.ok(rows.length >= 1, id + ' 有节点受冲风险');
    assert.ok(rows.some(function (r) { return r.why.indexOf('透干七杀坐支之根') >= 0; }),
      id + ' 申寅冲节点风险恢复（why 含"透干七杀坐支之根"——裁决第 4 条）');
  });
});

// ============================================================
// 九 层：口径断言（全 53 盘动态验证，不依赖单盘特例）
// ============================================================
test('九：对称关系 source/target 仅规范排序、天干克保留真实方向（全 53 盘）', function () {
  const WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
  const KE = { '木': '土', '火': '金', '土': '水', '金': '木', '水': '火' };
  const POS_NAME = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
  let keCount = 0, symCount = 0;
  chartList.forEach(function (c) {
    const d = dataOf(c);
    d.events.forEach(function (e) {
      if (e.type === '天干克') {
        keCount++;
        const sGan = e.source.slice(-1), tGan = e.target.slice(-1);
        assert.equal(KE[WX[sGan]], WX[tGan], c.id + ' 天干克 source 必须是真实克方（' + e.source + '→' + e.target + '）');
      } else if (['天干五合', '六冲', '六害', '刑', '六合'].indexOf(e.type) >= 0) {
        symCount++;
        const a = e.pillars[0], c2 = e.pillars[1];
        const isZhi = e.type !== '天干五合';
        assert.equal(e.source, POS_NAME[a] + (isZhi ? d.b[a].zhi : d.b[a].gan), c.id + ' ' + e.type + ' source=规范排序（柱位升序）');
        assert.equal(e.target, POS_NAME[c2] + (isZhi ? d.b[c2].zhi : d.b[c2].gan), c.id + ' ' + e.type + ' target=规范排序（柱位升序）');
      }
    });
  });
  assert.ok(keCount > 0 && symCount > 0, '全 53 盘覆盖天干克与对称关系断言（克 ' + keCount + '/对称 ' + symCount + '）');
});

test('九：全 53 盘 triggerHint 禁确定性语言、severity 仅两档、partyEvidence 非空', function () {
  let riskTotal = 0;
  chartList.forEach(function (c) {
    dataOf(c).risks.forEach(function (r) {
      riskTotal++;
      assert.equal(r.triggerHint.indexOf('必凶'), -1, c.id + ' ' + r.type + ' triggerHint 禁"必凶"');
      assert.equal(r.triggerHint.indexOf('任一'), -1, c.id + ' ' + r.type + ' triggerHint 禁"任一"');
      assert.ok(r.triggerHint.indexOf('若') >= 0 || r.triggerHint.indexOf('可能') >= 0,
        c.id + ' ' + r.type + ' triggerHint 必含"若"或"可能"（条件语言）');
      assert.ok(r.severity === '存在' || r.severity === '潜在', c.id + ' ' + r.type + ' severity 仅两档：' + r.severity);
      assert.ok(r.partyEvidence, c.id + ' ' + r.type + ' partyEvidence 非空');
    });
  });
  assert.equal(riskTotal, 58, '全 53 盘风险总数 === 冻结 58');
});

test('九：官杀混杂双透口径（冻结样本逐条核对）', function () {
  let found = 0;
  riskRows.forEach(function (r) {
    if (r[9] !== '官杀混杂') return;
    found++;
    const d = dataOf({ set: r[0], id: r[1], gz: r[2] });
    const fresh = d.risks.filter(function (x) { return x.type === '官杀混杂'; });
    assert.equal(fresh.length, 1, r[1] + ' 官杀混杂恰 1 条');
    assert.ok(fresh[0].parties.indexOf('正官') >= 0 && fresh[0].parties.indexOf('七杀') >= 0, r[1] + ' 双透方均入 parties');
    assert.ok(fresh[0].evidence.indexOf('仅双透判') >= 0, r[1] + ' evidence 标注双透口径（藏干不透不判）');
  });
  assert.ok(found > 0, '冻结样本中存在官杀混杂样本');
});
