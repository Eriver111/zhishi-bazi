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

const pillars = {
  year: { gan: '甲', zhi: '申' }, month: { gan: '壬', zhi: '申' },
  day: { gan: '乙', zhi: '丑' }, hour: { gan: '丁', zhi: '亥' }
};

test('buildFromPillars preserves entered pillars and derives dependent fields', () => {
  const calculator = loadCalculator();
  const bazi = calculator.buildFromPillars(
    pillars, 'female', { year: 2004, month: 8, day: 20, hour: 11 }
  );

  assert.equal(bazi.year.gan + bazi.year.zhi, '甲申');
  assert.equal(bazi.day.gan + bazi.day.zhi, '乙丑');
  assert.equal(bazi.day.shiShen.gan, '日主');
  assert.ok(Array.isArray(bazi.month.cangGan));
  assert.ok(bazi.hour.nayin);
  assert.equal(bazi.gender, 'female');
  assert.equal(bazi.wuXingCount.木, 3);
});

test('buildFromPillars keeps a null birth date for a base chart', () => {
  const calculator = loadCalculator();
  const bazi = calculator.buildFromPillars(pillars, 'male', null);

  assert.equal(bazi.birthDate, null);
  assert.ok(bazi.year.nayin);
  assert.ok(bazi.hour.shiShen.zhi);
});
