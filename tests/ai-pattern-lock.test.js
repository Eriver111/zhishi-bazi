const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const root = path.join(__dirname, '..');
const api = require(path.join(root, 'api', 'ai-chat.js'))._test;
const { calculator: E } = require(path.join(root, 'api', '_bazi-runtime.js'));

function chartDataFor(gz) {
  const p = gz.split(' ');
  const bazi = E.buildFromPillars({
    year: { gan: p[0][0], zhi: p[0][1] },
    month: { gan: p[1][0], zhi: p[1][1] },
    day: { gan: p[2][0], zhi: p[2][1] },
    hour: { gan: p[3][0], zhi: p[3][1] }
  }, 'male', null);
  const yongJi = E.getYongJi(bazi);
  return {
    dayMasterStrength: E.calcDayMasterStrength(bazi),
    pattern: yongJi.resolvedPattern || E.getPattern(bazi),
    yongJi
  };
}

test('杂气未月透年干乙的主格、依据和口径锁完整进入 AI context', () => {
  const data = chartDataFor('乙酉 癸未 庚申 壬午');
  const ctx = api.buildChartContext(data);
  assert.equal(data.pattern.name, '正财格');
  assert.equal(data.pattern.status, '成格');
  assert.match(ctx, /命局格局：正财格/);
  assert.match(ctx, /取格依据：月支未藏乙，透于年柱 → 正财/);
  assert.match(ctx, /pattern\.name 为本站唯一主格名/);
  assert.match(ctx, /组合只可作为结构机制，不得替代主格/);
});

test('回复审计拦截明确改判格名，但允许说明其他流派差异', () => {
  const data = chartDataFor('乙酉 癸未 庚申 壬午');
  const wrong = api.runReplyValidation(data, '此命局为正印格，食伤生财只是辅助。');
  assert.ok(wrong.some(w => w.startsWith('E3-格局名漂移')));

  const correct = api.runReplyValidation(data, '本站主格为正财格。其他流派可能按未月本气称为正印格，但不替换本站裁决。');
  assert.ok(!correct.some(w => w.startsWith('E3-格局名漂移')));
});

test('食伤生财只能作为机制，不得被明确写成主格', () => {
  const data = chartDataFor('乙酉 癸未 庚申 壬午');
  const warnings = api.runReplyValidation(data, '此局以食伤生财格论，主格清晰。');
  assert.ok(warnings.some(w => w.startsWith('E3-格局名漂移')));
});
