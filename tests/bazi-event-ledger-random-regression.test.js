const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadEngines() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi-chain.js'), 'utf8'), context);
  return { calculator: context.window.BaZiCalculator, chain: context.window.BaZiChain };
}

const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const jiaZi = Array.from({ length: 60 }, (_, index) => stems[index % 10] + branches[index % 12]);

function build(calculator, values) {
  const pillars = values.map(value => ({ gan: value[0], zhi: value[1] }));
  return calculator.buildFromPillars({
    year: pillars[0], month: pillars[1], day: pillars[2], hour: pillars[3]
  }, 'male');
}

function syntheticCharts(count) {
  let state = 0x5eed1234;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % 60;
  };
  const unique = new Set();
  const result = [];
  while (result.length < count) {
    const values = [jiaZi[next()], jiaZi[next()], jiaZi[next()], jiaZi[next()]];
    const key = values.join(' ');
    if (!unique.has(key)) {
      unique.add(key);
      result.push(values);
    }
  }
  return result;
}

test('240个全新合成盘的旺衰、格局、喜用和事件账本全部闭合', () => {
  const { calculator, chain } = loadEngines();
  const seen = new Set();

  syntheticCharts(240).forEach(values => {
    const label = values.join(' ');
    const chart = build(calculator, values);
    const audit = calculator.auditDayMasterStrength(chart);
    const yongJi = calculator.getYongJi(chart);
    const settlement = calculator.buildEvidenceSettlement(chart);
    const chainResult = chain.analyze(chart);

    assert.equal(seen.has(label), false, label + ' 重复');
    seen.add(label);
    assert.equal(audit.eventLedger.audit.scoreClosureMatches, true, label + ' 账本未闭合');
    assert.equal(audit.eventLedger.audit.unresolvedDuplicateCount, 0, label + ' 存在未解决重复消费');
    assert.equal(audit.warnings.filter(item => item.severity === 'error').length, 0, label + ' 存在内部契约错误');
    assert.equal(yongJi.dayMasterScore, audit.result.score, label + ' 喜用旺衰不一致');
    assert.equal(yongJi.dayMasterLevel, audit.result.level, label + ' 喜用档位不一致');
    assert.equal(chainResult.factGraph.evidenceSettlementVersion, settlement.version, label + ' 生克链未读取统一结算');
    Array.from(chainResult.factGraph.nodes)
      .filter(node => node.settlementRootId)
      .forEach(node => {
        const root = Array.from(settlement.roots).find(item => item.id === node.settlementRootId);
        assert.ok(root, label + ' 生克链引用了不存在的根');
        assert.equal(node.effectiveCoefficient, root.effectiveCoefficient, label + ' 生克链根气系数漂移');
      });

    const yong = Array.from(yongJi.yongShen || []);
    const xi = Array.from(yongJi.xiShen || []);
    const ji = Array.from(yongJi.jiShen || []);
    assert.equal(yong.length, 1, label + ' 核心用神不唯一');
    assert.ok(xi.includes(yong[0]), label + ' 用神未进入喜侧');
    assert.equal(xi.some(element => ji.includes(element)), false, label + ' 喜忌重叠');

    Array.from(settlement.roots).forEach(root => {
      assert.ok(root.effectiveCoefficient >= 0 && root.effectiveCoefficient <= 1, label + ' 根气系数越界');
      assert.equal(root.effectivePower, Number((root.basePower * root.effectiveCoefficient).toFixed(3)), label + ' 根气结算重复');
      const diversions = Array.from(root.adjustments).filter(item => item.type === 'diversion');
      assert.ok(diversions.length <= 1, label + ' 同一根被多个合会重复牵引');
    });
    Array.from(settlement.visibleStems).forEach(stem => {
      assert.equal(new Set(Array.from(stem.rootIds)).size, stem.rootIds.length, label + ' 透干重复引用同一根');
      const power = Array.from(settlement.roots)
        .filter(root => stem.rootIds.includes(root.id))
        .reduce((sum, root) => sum + root.effectivePower, 0);
      assert.equal(stem.effectivePower, Number((stem.basePower + power).toFixed(3)), label + ' 透干有根度未闭合');
    });
  });

  assert.equal(seen.size, 240);
});
