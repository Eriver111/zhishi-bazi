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
  const context = {
    URLSearchParams,
    window: {
      location: { search },
      BaZiCalculator: {},
    },
    document: {
      addEventListener() {},
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
  return { context, elements };
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
    prov: '',
    minute: 0,
    clock: 22,
    solar: '',
    zishi: '',
    mode: 'pillars',
    timing: 'matched',
    enteredPillars: pillars,
  });
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
    year: 2004, month: 8, day: 20, hour: 11,
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
