const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const runtime = require('../api/_bazi-runtime');

test('fortune calendar reuses the frozen BaZi calendar engine', () => {
  const day = runtime.calendar.getDayPillar(2026, 8, 23);
  const month = runtime.calendar.getMonthPillar(2026, 8, 23, 12, 12);
  const chart = runtime.chartFromQuery('year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0');

  assert.equal(day.gan.length, 1);
  assert.equal(day.zhi.length, 1);
  assert.equal(month.gan.length, 1);
  assert.equal(chart.bazi.day.gan, '乙');
  assert.equal(chart.bazi.day.zhi, '亥');
});

test('fortune endpoint keys personalization by complete chart parameters', () => {
  const api = fs.readFileSync(path.join(root, 'api', 'fortune.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'fortune.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'js', 'home-fortune.js'), 'utf8');

  assert.match(api, /chartFromQuery\(query\)/);
  assert.match(api, /sha256/);
  assert.match(api, /query \|\| chartLabel/);
  assert.match(page, /params: params/);
  assert.match(page, /esc\(f\.tip\)/);
  assert.match(home, /textContent = message/);
  assert.match(home, /loadPublicHuangli\(\)\.then\(start\)/);
  assert.match(home, /body: '\{\}'/);
});

test('fortune endpoint sends strength, pattern and yong-xi-ji facts to AI', async () => {
  const handler = require('../api/fortune');
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: 'deepseek-v4-flash', choices: [{ message: { content: '{"tip":"今天按计划推进即可。"}' } }] })
    };
  };
  let payload;
  const response = {
    setHeader() {},
    status(code) { assert.equal(code, 200); return this; },
    json(value) { payload = value; return value; }
  };
  try {
    await handler({ method: 'POST', body: { params: 'year=1990&month=5&day=10&hour=6&clock=11&gender=male&solar=0' } }, response);
  } finally {
    global.fetch = originalFetch;
  }
  const prompt = requestBody.messages[0].content;
  assert.match(prompt, /旺衰：/);
  assert.match(prompt, /格局：/);
  assert.match(prompt, /用神：/);
  assert.match(prompt, /喜神：/);
  assert.match(prompt, /忌神：/);
  assert.equal(payload.fortune.tip, '今天按计划推进即可。');
  assert.equal(payload.huangli.xiu, '');
});
