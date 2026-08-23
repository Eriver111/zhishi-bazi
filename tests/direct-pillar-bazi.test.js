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

function loadResult(search = '') {
  const pillarInputSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'pillar-input.js'), 'utf8');
  const resultSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'result.js'), 'utf8');
  const elements = {
    timingLimitNotice: { style: {} },
    dayun: { style: {} },
    liunian: { style: {} },
  };
  let domReady;
  const context = {
    URLSearchParams,
    window: {
      location: { search },
      BaZiCalculator: {},
    },
    document: {
      addEventListener(event, callback) {
        if (event === 'DOMContentLoaded') domReady = callback;
      },
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(selector) {
        if (selector === '.section-dayun') return elements.dayun;
        if (selector === '.section-liunian') return elements.liunian;
        return null;
      },
    },
    console,
  };
  context.window.window = context.window;
  vm.runInNewContext(pillarInputSource, context);
  vm.runInNewContext(resultSource, context);
  return { context, elements, runDOMContentLoaded: () => domReady() };
}

function buildAiChartContext(params, bazi) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'ai-chat-integration.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'window.__buildChartData = buildChartData;\n})();');
  const storage = new Map();
  const window = {
    location: { href: 'https://example.test/result', search: '' },
    open() {},
  };
  const context = {
    window,
    location: window.location,
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelector() { return null; },
    },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
    navigator: {},
    console,
    Date,
    setTimeout,
    clearTimeout,
    fetch() { throw new Error('AI context collection must not make requests'); },
    alert() {},
    prompt() {},
    _params: params,
    _bazi: bazi,
    _currentDaYunIndex: -1,
    _nativeShenSha: [],
    BaZiCalculator: {},
  };
  window.window = window;
  vm.runInNewContext(source, context);
  return JSON.parse(JSON.stringify(window.__buildChartData()));
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

test('direct result query restores all entered pillars and timing metadata', () => {
  const search = '?mode=pillars&timing=matched&gender=female'
    + '&yg=%E7%94%B2&yz=%E7%94%B3&mg=%E5%A3%AC&mz=%E7%94%B3'
    + '&dg=%E4%B9%99&dz=%E4%B8%91&hg=%E4%B8%81&hz=%E4%BA%A5'
    + '&year=2004&month=8&day=20&hour=11&clock=22';
  const { context } = loadResult(search);

  assert.deepEqual(JSON.parse(JSON.stringify(context.getUrlParams())), {
    year: 2004,
    month: 8,
    day: 20,
    hour: 11,
    gender: 'female',
    cal: '',
    prov: '',
    city: '',
    dist: '',
    geoVersion: '',
    minute: 0,
    clock: 22,
    solar: '',
    zishi: '',
    mode: 'pillars',
    timing: 'matched',
    reportClockNormalized: false,
    enteredPillars: pillars,
  });
});

test('matched direct timing never invents clock zero when the selected candidate lost its clock', () => {
  const search = '?mode=pillars&timing=matched&gender=female'
    + '&yg=%E7%94%B2&yz=%E7%94%B3&mg=%E5%A3%AC&mz=%E7%94%B3'
    + '&dg=%E4%B9%99&dz=%E4%B8%91&hg=%E4%B8%81&hz=%E4%BA%A5'
    + '&year=2004&month=8&day=20&hour=11';
  const { context } = loadResult(search);
  assert.equal(Number.isNaN(context.getUrlParams().clock), true);

  let daYunCalled = false;
  context.window.BaZiCalculator = {
    buildFromPillars(_entered, _gender, birthDate) {
      assert.equal(birthDate, null);
      return pillars;
    },
    calculateDaYun() { daYunCalled = true; return { list: [] }; },
    calculateShenSha() { return []; },
  };
  const result = context.buildResultData({
    mode: 'pillars', timing: 'matched', enteredPillars: pillars, gender: 'female',
    year: 2004, month: 8, day: 20, hour: 11, clock: NaN,
  });
  assert.equal(result.hasTiming, false);
  assert.equal(result.daYun, null);
  assert.equal(daYunCalled, false);
});

test('result entry accepts only a complete integer clock from zero through twenty-three', () => {
  for (const raw of ['', ' ', '18abc', '1.5', '-1', '24']) {
    const { context } = loadResult('?mode=pillars&timing=matched&clock=' + encodeURIComponent(raw));
    assert.equal(Number.isNaN(context.getUrlParams().clock), true, raw);
  }
  for (const raw of ['0', '18', '23']) {
    const { context } = loadResult('?mode=pillars&timing=matched&clock=' + raw);
    assert.equal(context.getUrlParams().clock, Number(raw), raw);
  }
});

test('ordinary historical report accepts a fractional restored clock and marks it normalized', () => {
  const { context } = loadResult('?year=1990&month=7&day=12&hour=9&clock=17.55&gender=male&report_clock_normalized=1');
  const params = context.getUrlParams();
  assert.equal(params.clock, 17.55);
  assert.equal(params.reportClockNormalized, true);
});

test('ordinary results keep timing when true-solar correction produces a fractional clock', () => {
  const { context } = loadResult();
  let daYunCalled = false;
  context.window.BaZiCalculator = {
    calculate() { return { month:{}, year:{} }; },
    calculateDaYun() { daYunCalled = true; return { list: [] }; },
    calculateShenSha() { return []; },
  };

  const result = context.buildResultData({
    mode: '', gender: 'male', year: 1990, month: 7, day: 12,
    hour: 9, clock: 17.55,
  });

  assert.equal(result.hasTiming, true);
  assert.equal(daYunCalled, true);
});

test('matched direct result keeps entered chart while candidate timing drives DaYun', () => {
  const { context } = loadResult();
  const calls = {};
  const directChart = {
    year: { gan: '甲', zhi: '申' },
    month: { gan: '壬', zhi: '申' },
    day: { gan: '乙', zhi: '丑' },
    hour: { gan: '丁', zhi: '亥' },
    gender: 'female',
  };
  context.window.BaZiCalculator = {
    calculate() {
      throw new Error('direct mode must not recalculate entered pillars');
    },
    buildFromPillars(entered, gender, birthDate) {
      calls.build = { entered, gender, birthDate };
      return directChart;
    },
    calculateDaYun(...args) {
      calls.daYun = args;
      return { list: [] };
    },
    calculateShenSha(chart) {
      calls.shenSha = chart;
      return ['base-analysis'];
    },
  };
  const params = {
    mode: 'pillars',
    timing: 'matched',
    enteredPillars: pillars,
    gender: 'female',
    year: 2004,
    month: 8,
    day: 20,
    hour: 11,
    clock: 22,
  };

  const result = context.buildResultData(params);

  assert.equal(result.bazi, directChart);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.build.birthDate)), {
    year: 2004, month: 8, day: 20, hour: 11, clock: 22,
  });
  assert.equal(calls.daYun[0], directChart.month);
  assert.equal(calls.daYun[1], directChart.year);
  assert.deepEqual(calls.daYun.slice(2), ['female', 2004, 8, 20, 11, 22]);
  assert.equal(calls.shenSha, directChart);
  assert.equal(result.hasTiming, true);
});

test('unknown direct timing renders base chart and hides timing-only sections', () => {
  const { context, elements } = loadResult();
  const directChart = {
    year: { gan: '甲', zhi: '申' },
    month: { gan: '壬', zhi: '申' },
    day: { gan: '乙', zhi: '丑' },
    hour: { gan: '丁', zhi: '亥' },
    gender: 'male',
    birthDate: null,
  };
  let analysisChart = null;
  context.window.BaZiCalculator = {
    calculate() {
      throw new Error('direct mode must not calculate from a date');
    },
    buildFromPillars(entered, gender, birthDate) {
      assert.equal(birthDate, null);
      return directChart;
    },
    calculateDaYun() {
      throw new Error('unknown timing must not calculate DaYun');
    },
    calculateShenSha(chart) {
      analysisChart = chart;
      return [];
    },
  };

  const result = context.buildResultData({
    mode: 'pillars',
    timing: 'unknown',
    enteredPillars: pillars,
    gender: 'male',
  });
  context.applyTimingAvailability(result.hasTiming);

  assert.equal(result.bazi, directChart);
  assert.equal(result.daYun, null);
  assert.equal(analysisChart, directChart);
  assert.equal(elements.dayun.style.display, 'none');
  assert.equal(elements.liunian.style.display, 'none');
  assert.equal(elements.timingLimitNotice.style.display, 'block');
});

test('unknown direct initialization leaves timing data absent for AI consumers', () => {
  const search = '?mode=pillars&timing=unknown&gender=male'
    + '&yg=%E7%94%B2&yz=%E7%94%B3&mg=%E5%A3%AC&mz=%E7%94%B3'
    + '&dg=%E4%B9%99&dz=%E4%B8%91&hg=%E4%B8%81&hz=%E4%BA%A5';
  const { context, runDOMContentLoaded } = loadResult(search);
  const directChart = {
    year: { gan: '甲', zhi: '申' },
    month: { gan: '壬', zhi: '申' },
    day: { gan: '乙', zhi: '丑' },
    hour: { gan: '丁', zhi: '亥' },
    gender: 'male',
    birthDate: null,
  };
  context.window.BaZiCalculator = {
    buildFromPillars() { return directChart; },
    calculateDaYun() { throw new Error('unknown timing must not calculate DaYun'); },
    calculateShenSha() { return []; },
  };
  context.render = () => {};

  runDOMContentLoaded();

  assert.equal(vm.runInNewContext('typeof _daYunData', context), 'undefined');
  assert.equal(vm.runInNewContext('_bazi', context), directChart);
});

test('live AI context omits fabricated timing only for unknown direct charts', () => {
  const bazi = {
    year: { gan: '甲', zhi: '申' },
    month: { gan: '壬', zhi: '申' },
    day: { gan: '乙', zhi: '丑' },
    hour: { gan: '丁', zhi: '亥' },
  };
  const unknown = buildAiChartContext({
    mode: 'pillars',
    timing: 'unknown',
    gender: 'male',
    year: NaN,
    month: NaN,
    day: NaN,
    hour: NaN,
    clock: 0,
  }, bazi);

  assert.deepEqual(unknown.birthInfo, {
    gender: 'male',
    mode: 'pillars',
    timing: 'unknown',
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(unknown.fourPillars).map(([key, value]) => [
      key, { gan: value.gan, zhi: value.zhi },
    ])),
    pillars,
  );

  const matched = buildAiChartContext({
    mode: 'pillars',
    timing: 'matched',
    gender: 'female',
    year: 2004,
    month: 8,
    day: 20,
    hour: 11,
    clock: 22,
  }, bazi);
  assert.deepEqual(matched.birthInfo, {
    year: 2004, month: 8, day: 20, hour: 11, gender: 'female', clock: 22,
  });

  const ordinary = buildAiChartContext({
    gender: 'male',
    year: 1990,
    month: 1,
    day: 2,
    hour: 3,
    clock: 6,
  }, bazi);
  assert.deepEqual(ordinary.birthInfo, {
    year: 1990, month: 1, day: 2, hour: 3, gender: 'male', clock: 6,
  });
});
