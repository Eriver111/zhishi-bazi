const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/bazi.js'), 'utf8'), box);
const E = box.window.BaZiCalculator;
const positions = ['year', 'month', 'day', 'hour'];

function chart(text) {
  const pillars = text.split(' ');
  return E.buildFromPillars(Object.fromEntries(pillars.map((pillar, index) => [positions[index], {
    gan: pillar[0], zhi: pillar[1],
  }])), 'male');
}

function inspect(bazi) {
  const strength = E.calcDayMasterStrength(bazi, { audit: true });
  const stages = strength.audit.stages;
  return {
    strength,
    gate: stages.find(stage => stage.id === 'root-cluster-gate'),
    final: stages.find(stage => stage.id === 'root-cluster-final'),
  };
}

// Constructed mechanism cases: assertions describe the project's compensation
// boundary, not independently adjudicated traditional strength classifications.
test('食神换为有根印，比原局多8分生扶，不能因跨过补偿边界反而转弱', () => {
  const output = inspect(chart('甲午 甲申 丙辰 戊午'));
  const seal = inspect(chart('甲午 甲申 丙辰 甲午'));
  assert.equal(output.final.before, 43);
  assert.equal(seal.final.before, 51);
  assert.equal(output.final.meta.candidate, 23);
  assert.equal(seal.final.meta.candidate, 23);
  assert.equal(output.final.after, 50, '欠计补偿只到原有门控上限');
  assert.equal(seal.final.after, 51, '已经越过上限时保留原分');
  assert.ok(seal.strength.score >= output.strength.score);
  const differences = output.strength.audit.stages.filter((stage, index) =>
    stage.delta !== seal.strength.audit.stages[index].delta).map(stage => stage.id);
  assert.deepEqual(Array.from(differences), ['visible-stems', 'position-weight', 'root-cluster-final']);
});

test('相同两处强根和补偿候选：基准分上升时结算结果保持单调', () => {
  const cases = ['甲午 庚申 丙辰 甲午', '甲午 甲申 丙辰 戊午', '甲午 甲申 丙辰 甲午', '甲午 甲申 丙辰 丙午'];
  const results = cases.map(text => inspect(chart(text)));
  assert.deepEqual(results.map(row => row.final.before), [36, 43, 51, 53]);
  assert.ok(results.every(row => row.final.meta.candidate === 23));
  assert.deepEqual(results.map(row => row.final.after), [50, 50, 51, 53]);
  for (let index = 1; index < results.length; index++) {
    assert.ok(results[index].final.after >= results[index - 1].final.after);
  }
});

for (const [description, text] of [
  ['只有一处外部强根', '甲午 甲申 丙辰 戊辰'],
  ['两处午根均受子冲', '甲午 甲申 丙子 戊午'],
  ['完全没有本气同类强根', '戊戌 己丑 丙子 己丑'],
]) {
  test(`${description}：不触发多重强根补偿`, () => {
    const row = inspect(chart(text));
    assert.equal(row.gate.meta.pendingAdjustment, 0);
    assert.equal(row.final.meta.candidate, 0);
    assert.equal(row.final.delta, 0);
  });
}

test('跨50的两侧重复计算稳定，取用读取同一旺衰且只结算一次补偿', () => {
  for (const text of ['甲午 甲申 丙辰 戊午', '甲午 甲申 丙辰 甲午']) {
    const bazi = chart(text), first = inspect(bazi), second = inspect(bazi);
    assert.deepEqual(first, second);
    assert.equal(first.gate.delta, 0, '早期门控仅记录候选，不先计一次');
    assert.equal(first.strength.audit.stages.filter(row => row.id === 'root-cluster-final').length, 1);
    assert.equal(first.strength.audit.sumMatches, true);
    const yongJi = E.getYongJi(bazi);
    assert.equal(yongJi.dayMasterScore, first.strength.score);
    assert.equal(yongJi.dayMasterLevel, first.strength.level);
  }
});

test('4096个有效公历日期：根气补偿有界、只结算一次且保留未受影响盘', () => {
  let seed = 0x50502026;
  const random = max => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * max);
  };
  let applied = 0, alreadySufficient = 0, noCandidate = 0;
  for (let index = 0; index < 4096; index++) {
    const year = 1920 + random(106), month = 1 + random(12);
    const day = 1 + random(new Date(Date.UTC(year, month, 0)).getUTCDate());
    const hour = random(24), minute = random(60);
    const bazi = E.calculate(year, month, day, Math.floor((hour + 1) % 24 / 2), 'male', hour + minute / 60);
    const { strength, gate, final } = inspect(bazi);
    const label = `${year}-${month}-${day} ${hour}:${minute}`;
    assert.equal(gate.delta, 0, label);
    assert.equal(strength.audit.stages.filter(row => row.id === 'root-cluster-final').length, 1, label);
    assert.equal(strength.audit.sumMatches, true, label);
    assert.ok(final.delta >= 0 && final.delta <= final.meta.candidate, label);
    if (final.meta.candidate === 0) {
      noCandidate++;
      assert.equal(final.delta, 0, label);
    } else if (final.before >= 50) {
      alreadySufficient++;
      assert.equal(final.delta, 0, label);
      assert.equal(final.after, final.before, label);
    } else {
      applied++;
      assert.ok(final.delta > 0, label);
      assert.ok(final.after <= 50, label);
      if (final.before + final.meta.candidate < 50) {
        assert.equal(final.delta, final.meta.candidate, label);
      } else {
        assert.equal(final.after, 50, label);
      }
    }
  }
  assert.ok(applied > 0, '包含需要补偿的失令强根盘');
  assert.ok(alreadySufficient > 0, '包含已有足够基准分的强根盘');
  assert.ok(noCandidate > 0, '包含普通盘');
});
