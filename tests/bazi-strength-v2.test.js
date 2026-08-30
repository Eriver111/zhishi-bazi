const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// calcDayMasterStrength 旺衰评分 v2 回归（2026-08-17 提案，用户授权最小闭环）
// v2 三处改动：
//   A 得令×得地联动：失令 + 日支自坐禄/刃 + 另有比劫/印根 → 失令惩罚收缩
//   B 日支根气分级：日坐羊刃 +16 / 日坐禄 +14 / 其他同气 +12
//   C 天干贴身合绊：贴身合而不化，被合财/官/食伤 ×0.6（争合减半）
// 验证标准（用户给定）：目标盘 31 → 42–48 中和区；普通失令+单弱根盘不虚高。
// 2026-08-21 用户拍板：甲子辛未丙寅甲子 50 中和为正式锚点（改动 C 不回调）；
//   辛未己未壬子辛亥 67 偏强暂接受，留作未来「透干有根度 / 天干有效强度」模块回归样本。

function loadCalculator() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.BaZiCalculator;
}

function pillars(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

function strength(values) {
  return loadCalculator().calcDayMasterStrength(pillars(values));
}

test('目标盘 丁亥丁未壬子戊申 失令但有强根 → 中和 44（原 31 偏弱）', () => {
  const r = strength(['丁亥', '丁未', '壬子', '戊申']);
  assert.equal(r.score, 44);
  assert.equal(r.level, '中和');
});

test('目标盘用神喜忌随分数自然传导', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['丁亥', '丁未', '壬子', '戊申']),
    'female'
  );
  const result = calculator.getYongJi(chart);
  assert.equal(result.dayMasterScore, 44);
  assert.equal(result.dayMasterLevel, '中和');
  assert.equal(result.method, '扶抑为主');
});

test('护栏盘：失令+单弱根/无强根盘分数档位零漂移', () => {
  const cases = [
    { gz: ['己酉', '辛未', '癸巳', '丁巳'], score: 14, level: '极弱' },
    { gz: ['辛丑', '乙未', '丙寅', '戊戌'], score: 38, level: '偏弱' },
    { gz: ['甲子', '丁卯', '己未', '庚午'], score: 51, level: '中和' },
    { gz: ['戊午', '癸亥', '辛卯', '甲午'], score: 21, level: '极弱' },
    { gz: ['甲子', '甲子', '癸卯', '甲子'], score: 52, level: '中和' },
    { gz: ['庚申', '己丑', '癸卯', '丁巳'], score: 32, level: '偏弱' },
  ];
  for (const c of cases) {
    const r = strength(c.gz);
    assert.equal(r.score, c.score, c.gz.join(' ') + ' 分数漂移');
    assert.equal(r.level, c.level, c.gz.join(' ') + ' 档位漂移');
  }
});

test('日坐禄盘 丙寅己亥庚申庚辰：60 → 66，偏强档位不变', () => {
  const r = strength(['丙寅', '己亥', '庚申', '庚辰']);
  assert.equal(r.score, 66);
  assert.equal(r.level, '偏强');
});

test('争合盘 壬子癸亥戊子癸卯：贴身争合返还减半，仍极弱且从格不变', () => {
  const calculator = loadCalculator();
  const chart = pillars(['壬子', '癸亥', '戊子', '癸卯']);
  const r = calculator.calcDayMasterStrength(chart);
  assert.equal(r.level, '极弱');
  assert.equal(calculator.getCongGe(chart).isCong, true);
});

test('禄刃并见新盘：失令但根气成势，均落入中和或偏强', () => {
  // 新盘1 辛未己未壬子辛亥：日坐子刃+时亥禄+年时双辛印透干 → 偏强 67
  //   用户拍板（2026-08-21）：偏强无疑；67 属偏强档上沿、略高但可接受，不为它改本轮 A/B/C。
  //   后续若引入「透干有根度 / 天干有效强度」模块，该盘作为重点回归样本，
  //   允许分值向下微调，但原则上不得跌出偏强档。
  const c1 = strength(['辛未', '己未', '壬子', '辛亥']);
  assert.equal(c1.score, 67);
  assert.equal(c1.level, '偏强');

  // 新盘2 庚申甲申甲寅乙亥：甲坐寅禄+亥长生（印），申月死令 → 中和 51
  const c2 = strength(['庚申', '甲申', '甲寅', '乙亥']);
  assert.equal(c2.score, 51);
  assert.equal(c2.level, '中和');

  // 新盘3 壬子戊申丙午癸巳：丙坐午刃+巳禄，申月囚令 → 中和 50
  const c3 = strength(['壬子', '戊申', '丙午', '癸巳']);
  assert.equal(c3.score, 50);
  assert.equal(c3.level, '中和');
});

test('贴身财合边界盘 甲子辛未丙寅甲子：48→50 跨档为正式锚点（2026-08-21 用户拍板）', () => {
  // 月干辛财贴身合日丙（丙辛合而不化）→ 改动 C 返还 +2，48→50 恰跨偏弱/中和线。
  // 测试目的（用户拍板）：贴身财合可使边界盘发生跨档，但不得造成结构性大幅跳档。
  const r = strength(['甲子', '辛未', '丙寅', '甲子']);
  assert.equal(r.score, 50);
  assert.equal(r.level, '中和');
});

test('失令辛金两酉禄根并见巳酉半合，不得按普通单根判身弱', () => {
  const calculator = loadCalculator();
  const chart = calculator.buildFromPillars(
    pillars(['乙酉', '戊子', '辛巳', '丁酉']),
    'male'
  );
  const r = calculator.calcDayMasterStrength(chart);
  assert.equal(r.score, 60);
  assert.equal(r.level, '偏强');

  const yj = calculator.getYongJi(chart);
  assert.equal(yj.dayMasterLevel, '偏强');
  assert.equal(yj.yongShen.join('、'), '火');
  assert.equal(yj.xiShen.join('、'), '火、木、水');
  assert.equal(yj.jiShen.join('、'), '土、金');
});

test('单处年支强根仍由原规则裁决，不触发多重强根成势', () => {
  const r = strength(['戊寅', '壬戌', '乙未', '乙酉']);
  assert.equal(r.score, 28);
  assert.equal(r.level, '极弱');
});

test('已足够偏强的双禄根盘不重复拔高为极强', () => {
  const r = strength(['辛酉', '戊子', '辛丑', '丁酉']);
  assert.equal(r.score, 61);
  assert.equal(r.level, '偏强');
});

test('禄旺根被原局六冲时不得按完整多重强根加分', () => {
  const cases = [
    { gz: ['甲寅', '庚申', '甲午', '丙寅'], score: 13, level: '极弱' },
    { gz: ['丙午', '庚子', '丙辰', '丁巳'], score: 41, level: '中和' },
    { gz: ['壬子', '丙午', '壬辰', '癸亥'], score: 37, level: '偏弱' },
  ];
  for (const c of cases) {
    const r = strength(c.gz);
    assert.equal(r.score, c.score, c.gz.join(' ') + ' 受冲强根仍被误计');
    assert.equal(r.level, c.level, c.gz.join(' ') + ' 档位漂移');
  }
});
