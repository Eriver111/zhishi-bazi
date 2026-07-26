const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadPillarInput() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'pillar-input.js'), 'utf8');
  const context = { window: {}, URLSearchParams };
  vm.runInNewContext(source, context);
  return context.window.PillarInput;
}

test('normalizes four legal sexagenary pairs from strings and objects', () => {
  const PillarInput = loadPillarInput();
  const result = PillarInput.normalize({
    year: '甲申', month: { gan: '壬', zhi: '申' }, day: '乙丑', hour: '丁亥'
  });

  assert.equal(result.ok, true);
  assert.deepEqual({ ...result.pillars.year }, { gan: '甲', zhi: '申' });
  assert.deepEqual({ ...result.pillars.month }, { gan: '壬', zhi: '申' });
});

test('rejects an impossible yin-yang pair by pillar position', () => {
  const PillarInput = loadPillarInput();
  const result = PillarInput.normalize({
    year: '甲丑', month: '壬申', day: '乙丑', hour: '丁亥'
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.year, '年柱干支阴阳不匹配');
});

test('serializes and restores only the shared direct-pillar query keys', () => {
  const PillarInput = loadPillarInput();
  const pillars = {
    year: { gan: '甲', zhi: '申' }, month: { gan: '壬', zhi: '申' },
    day: { gan: '乙', zhi: '丑' }, hour: { gan: '丁', zhi: '亥' }
  };
  const params = PillarInput.toSearchParams(pillars);

  assert.deepEqual(
    Object.fromEntries(params),
    { yg: '甲', yz: '申', mg: '壬', mz: '申', dg: '乙', dz: '丑', hg: '丁', hz: '亥' }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(PillarInput.fromSearchParams(params))),
    pillars
  );
  assert.equal(PillarInput.fromSearchParams(new URLSearchParams('yg=甲&yz=丑')), null);
});
