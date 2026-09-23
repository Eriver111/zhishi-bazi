const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/bazi.js'), 'utf8'), box);
const E = box.window.BaZiCalculator;
function chart(text) {
  const p = text.split(' ').map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return E.buildFromPillars({ year:p[0], month:p[1], day:p[2], hour:p[3] }, 'male');
}
function stage(bazi, id) {
  return E.calcDayMasterStrength(bazi, { audit:true }).audit.stages.find(row => row.id === id);
}

// These are constructed mechanism cases, not external expert judgements.
for (const [text, reason] of [
  ['甲子 己丑 乙卯 壬子', '甲己化土遇木阻化'],
  ['乙丑 庚申 丙子 壬子', '乙庚化金遇火阻化'],
  ['丙子 辛亥 戊辰 壬子', '丙辛化水遇土阻化'],
  ['丁卯 壬寅 庚子 癸亥', '丁壬化木遇金阻化'],
  ['戊子 癸巳 壬子 甲寅', '戊癸化火遇水阻化'],
  ['丙子 辛亥 丙寅 壬辰', '丙辛得令仍争合'],
]) {
  test(`${reason}：未化事实不能进入旺衰合化计分`, () => {
    const bazi = chart(text);
    const relations = E.getGanHe(bazi).filter(row => row.isAdjacent);
    assert.ok(relations.length);
    assert.ok(relations.every(row => !row.isTransformed));
    assert.equal(stage(bazi, 'stem-transform').delta, 0);
  });
}

test('丙辛得令无阻无争时保留原有合化分，不能全局关闭合化', () => {
  const bazi = chart('丙子 辛亥 庚申 壬子');
  assert.equal(E.getGanHe(bazi)[0].isTransformed, true);
  assert.equal(stage(bazi, 'stem-transform').delta, -1);
});

test('得令但争合的贴身财星按合绊返还，不能与合化同时计分', () => {
  const bazi = chart('丙子 辛亥 丙寅 壬辰');
  assert.equal(stage(bazi, 'stem-transform').delta, 0);
  assert.equal(stage(bazi, 'stem-binding').delta, 1, '年丙争合月辛，贴身财合的返还减半');
});

for (const [text, relation, penalty] of [
  ['甲子 庚午 丙子 壬辰', 'clash', 1],
  ['甲子 辛未 丙子 壬辰', 'harm', 1],
  ['甲子 丁卯 丙子 壬辰', 'punishment', 1],
]) {
  test(`${text}：年月${relation}不因日支重字冒充涉日关系`, () => {
    const row = stage(chart(text), 'branch-interactions').meta.settlements.find(r => r.source === 'year' && r.target === 'month');
    assert.equal(row.involvesDay, false);
    assert.equal(row.raw[relation], penalty);
  });
}

test('真实月日冲仍按涉日强度处理，根气归属另行记录', () => {
  const rows = stage(chart('甲子 庚午 丙子 壬辰'), 'branch-interactions').meta.settlements;
  const row = rows.find(r => r.source === 'month' && r.target === 'day');
  assert.equal(row.involvesDay, true);
  assert.equal(row.raw.clash, 3);
});

for (const [text, mode] of [
  ['甲申 辛未 丙午 戊子', 'earth-tendency'],
  ['甲午 丁巳 丙午 乙未', 'full-fire'],
  ['甲午 甲戌 丙午 乙未', 'fire-tendency'],
  ['戊寅 壬戌 丙午 乙未', 'binding'],
]) {
  test(`午未${mode}：日支转换也遵守统一结算，不再另算午火化土`, () => {
    const interaction = stage(chart(text), 'branch-interactions');
    assert.equal(interaction.meta.wuWeiResolution.mode, mode);
    assert.equal(interaction.meta.dayBranchTransformation.adjustment, 0);
    assert.equal(interaction.meta.dayBranchTransformation.pairs.length, 0);
  });
}

test('辰酉日支转换保留，午未修复不关闭其他六合', () => {
  const interaction = stage(chart('甲寅 辛酉 丙辰 壬子'), 'branch-interactions');
  assert.equal(interaction.meta.dayBranchTransformation.pairs.length, 1);
  assert.notEqual(interaction.meta.dayBranchTransformation.adjustment, 0);
});

test('真实历法生成的512个固定种子日期：关系、旺衰、取用与最终格局同源', () => {
  let seed = 0x512926;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const elements = ['木', '火', '土', '金', '水'];
  for (let i = 0; i < 512; i++) {
    const year = 1920 + random(106), month = 1 + random(12);
    const day = 1 + random(new Date(Date.UTC(year, month, 0)).getUTCDate());
    const hour = random(24), minute = random(60);
    const bazi = E.calculate(year, month, day, Math.floor((hour + 1) % 24 / 2), i % 2 ? 'female' : 'male', hour + minute / 60);
    const strength = E.calcDayMasterStrength(bazi, { audit:true });
    const yongJi = E.getYongJi(bazi), following = E.getCongGe(bazi);
    const trace = Object.fromEntries(strength.audit.stages.map(row => [row.id, row]));
    const dayElement = E.WU_XING[bazi.day.gan], di = elements.indexOf(dayElement);
    // Compare the independently exposed relation facts with the scoring consumer.
    const transformed = E.getGanHe(bazi).filter(row => row.isAdjacent && row.isTransformed);
    const expected = transformed.reduce((sum, row) => sum + (row.huaWx === dayElement ? 2 : row.huaWx === elements[(di + 4) % 5] ? 1 : -1), 0);
    assert.equal(trace['stem-transform'].delta, expected);
    for (const relation of trace['branch-interactions'].meta.settlements) {
      assert.equal(relation.involvesDay, relation.source === 'day' || relation.target === 'day');
    }
    assert.ok(trace['branch-interactions'].meta.dayBranchTransformation.pairs.every(pair => !['午未', '未午'].includes(pair.z1 + pair.z2)));
    assert.equal(strength.audit.sumMatches, true);
    assert.equal(yongJi.dayMasterLevel, strength.level);
    assert.equal(yongJi.dayMasterScore, strength.score);
    assert.ok(!yongJi.xiShen.some(element => yongJi.jiShen.includes(element)));
    assert.ok(!(following.isCong && following.isCandidate));
    if (following.isCandidate) assert.notEqual(yongJi.method, '从格顺势');
    const facts = E.getProfessionalReportFacts(bazi, 'male');
    assert.equal(facts.pattern.name, yongJi.resolvedPattern.name);
    assert.equal(facts.pattern.status, yongJi.resolvedPattern.status);
  }
});
