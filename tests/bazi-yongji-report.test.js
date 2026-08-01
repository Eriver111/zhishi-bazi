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

function pillars(values) {
  const records = values.map(gz => ({ gan: gz[0], zhi: gz[1] }));
  return { year: records[0], month: records[1], day: records[2], hour: records[3] };
}

test('用神属于喜神且忌神不与喜用重叠', () => {
  const calculator = loadCalculator();
  const charts = [
    calculator.buildFromPillars(pillars(['丙辰', '辛酉', '甲寅', '戊辰']), 'male'),
    calculator.buildFromPillars(pillars(['丙戌', '甲午', '丁巳', '庚午']), 'male'),
    calculator.buildFromPillars(pillars(['甲子', '己丑', '戊寅', '甲子']), 'female'),
  ];

  charts.forEach(chart => {
    const result = calculator.getYongJi(chart);
    assert.ok(result.yongShen.length >= 1 && result.yongShen.length <= 2);
    result.yongShen.forEach(wx => assert.ok(result.xiShen.includes(wx)));
    assert.equal(result.jiShen.filter(wx => result.xiShen.includes(wx)).length, 0);
    assert.equal(new Set(result.xiShen).size, result.xiShen.length);
    assert.equal(new Set(result.yongShen).size, result.yongShen.length);
    assert.equal(new Set(result.jiShen).size, result.jiShen.length);
  });
});
