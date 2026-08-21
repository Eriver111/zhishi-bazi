// P1 候选五行评分引擎测试（2026-08-13 GPT 裁决修订版）
// 设计：S_base = L1方向基准 + L2结构需求×门控g1 + L3格局修正(方向门控) + L4调候
// 用神 = argmax S_base（近似并列按 F11 链决胜）；喜忌归属看 S_need=S_base+L4（±3 中性带）
// 根气不进入主评分（F7）——只作质量报告与并列 tiebreak
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function chartFromPillars(gz) {
  return {
    year: { gan: gz[0][0], zhi: gz[0][1] },
    month: { gan: gz[1][0], zhi: gz[1][1] },
    day: { gan: gz[2][0], zhi: gz[2][1] },
    hour: { gan: gz[3][0], zhi: gz[3][1] },
  };
}

function yjOf(gz) {
  const calculator = loadCalculator();
  return calculator.getYongJi(chartFromPillars(gz));
}

// —— GPT F12 收敛锚点：变化盘（红）——
test('#6 候选评分后水成为用神——木不再因根气强而机械第一', () => {
  // 甲辰 丙寅 戊午 丁巳：62分偏强，印火成势(4) → 财水+10×g1 反超官杀木
  const yj = yjOf(['甲辰', '丙寅', '戊午', '丁巳']);
  assert.equal(yj.yongShen[0], '水');
});

test('#9 杀印相生成格身强侧不给印加分——火不升第一', () => {
  // 甲子 丁卯 己未 庚午：51分中和，杀印相生格成格但 d>0 → 印火不加分
  const yj = yjOf(['甲子', '丁卯', '己未', '庚午']);
  assert.notEqual(yj.yongShen[0], '火');
});

test('A3 机械第一被消除——用神不再是无理由的官杀木', () => {
  // 丙申 庚寅 戊辰 丁巳：56分中和，食神制杀破格+寅申冲→通关水+6 推水至第一
  const yj = yjOf(['丙申', '庚寅', '戊辰', '丁巳']);
  assert.notEqual(yj.yongShen[0], '木');
});

test('B2 财成势身弱——比劫帮身分财进入第一（L2 结构需求）', () => {
  // 壬申 丁未 甲辰 乙丑：19分极弱，财土成势(3) → 比劫木+10 反超印水
  const yj = yjOf(['壬申', '丁未', '甲辰', '乙丑']);
  assert.equal(yj.yongShen[0], '木');
});

test('#9 ±3 弱档——中和盘保留方向但不冒充强喜强忌', () => {
  // 51分中和：五元素 S_need 全在 ±3 内 → 除用神外按符号进入弱喜/弱忌
  const yj = yjOf(['甲子', '丁卯', '己未', '庚午']);
  assert.deepEqual(Array.from(yj.xiShen), ['木', '金', '水']);
  assert.deepEqual(Array.from(yj.jiShen), ['火', '土']);
  assert.deepEqual(JSON.parse(JSON.stringify(yj.elementClassification)), {
    木: '用神', 火: '弱忌', 土: '弱忌', 金: '弱喜', 水: '弱喜',
  });
});

test('candidateScores 输出五元素 L1/L2/L3/L4/S_need/根气质量/最终角色', () => {
  const yj = yjOf(['甲辰', '丙寅', '戊午', '丁巳']);
  assert.ok(Array.isArray(yj.candidateScores), 'candidateScores 应为数组');
  assert.equal(yj.candidateScores.length, 5);
  const byWx = {};
  yj.candidateScores.forEach((c) => { byWx[c.wx] = c; });
  ['木', '火', '土', '金', '水'].forEach((wx) => {
    const c = byWx[wx];
    assert.ok(c, '缺' + wx + '候选');
    ['L1', 'L2', 'L3', 'L4', 'SNeed', 'rootScore', 'rootQuality', 'role'].forEach((k) => {
      assert.ok(k in c, wx + ' 缺字段 ' + k);
    });
  });
  assert.equal(byWx['水'].role, '用神');
  assert.equal(byWx['水'].SNeed, Math.max(...yj.candidateScores.map((c) => c.SNeed)));
});

// —— GPT F12 收敛锚点：保真盘（绿，防回归）——
test('#1 极旺甲木保真——用神仍为金', () => {
  const yj = yjOf(['甲寅', '丙寅', '甲寅', '甲子']);
  assert.equal(yj.yongShen[0], '金');
});

test('#3 原局无水但用神仍为水——需求决定谁是用神，根气只定质量', () => {
  const yj = yjOf(['戊午', '丁巳', '丙午', '甲午']);
  assert.equal(yj.yongShen[0], '水');
});

test('B5 v2 联动升 51 后扶抑反向、用神转土（原水锚点随 v2 重冻更新）', () => {
  // 乙木申月死令但日坐卯禄+双子水印根：v2 改动 A（死令 −25→−18，+7）+ B（日坐禄 +2）→ 42→51
  // 分数跨 50 后 d 符号反转，扶抑方向由帮身（水/木）转为克泄耗（土/火/金），用神 水→土
  // 【阈值敏感锚点】距 50 线 +1（2026-08-21 用户裁定：接受并重冻，留待下一阶段 50 线迟滞机制）
  const yj = yjOf(['庚子', '甲申', '乙卯', '丙子']);
  assert.equal(yj.yongShen[0], '土');
});

test('B6 冬火调候不顶替结构用神（F8 封顶铁律）', () => {
  // 丙申 己亥 丁卯 壬寅：34分极弱，印木/比劫火并列——调候火不得借 L4 顶替木印
  const yj = yjOf(['丙申', '己亥', '丁卯', '壬寅']);
  assert.equal(yj.yongShen[0], '木');
});

// —— 输出契约不变 ——
test('P1 后输出契约不变：用神恒1、用神∈喜神、喜忌不重叠', () => {
  const charts = [
    ['甲辰', '丙寅', '戊午', '丁巳'],
    ['甲子', '丁卯', '己未', '庚午'],
    ['丙申', '庚寅', '戊辰', '丁巳'],
    ['壬申', '丁未', '甲辰', '乙丑'],
    ['甲寅', '丙寅', '甲寅', '甲子'],
    ['戊午', '丁巳', '丙午', '甲午'],
    ['庚子', '甲申', '乙卯', '丙子'],
    ['丙申', '己亥', '丁卯', '壬寅'],
  ];
  charts.forEach((gz) => {
    const yj = yjOf(gz);
    assert.equal(yj.yongShen.length, 1, gz.join(' ') + ' 用神应恒1');
    assert.ok(yj.xiShen.indexOf(yj.yongShen[0]) >= 0, gz.join(' ') + ' 用神应在喜神中');
    yj.jiShen.forEach((wx) => {
      assert.ok(yj.xiShen.indexOf(wx) < 0, gz.join(' ') + ' 忌神 ' + wx + ' 不应在喜神中');
    });
  });
});
