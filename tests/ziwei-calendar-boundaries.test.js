const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const iztro = require('iztro');
const { Lunar } = require('lunar-javascript');
const input = require('../js/ziwei-input.js');
const professional = require('../js/ziwei-professional.js');

const context = { console };
context.window = context;
context.self = context;
vm.createContext(context);
for (const file of ['bazi.js', 'iztro.min.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
}
const calculator = context.BaZiCalculator;
const browserIztro = context.iztro;
const plain = value => JSON.parse(JSON.stringify(value));

function facts(chart) {
  return plain({
    chineseDate: chart.chineseDate, lunarDate: chart.lunarDate,
    soulBranch: chart.earthlyBranchOfSoulPalace,
    bodyBranch: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul, body: chart.body, fiveElementsClass: chart.fiveElementsClass,
    palaces: chart.palaces,
  });
}

function birthForSolar(solar, hour = 23, ziHourNextDay = true) {
  return input.normalizeBirth({
    year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(),
    hour, minute: 30, calculator, useTrueSolarTime: false, ziHourNextDay,
  });
}

test('late Zi advances lunar month/year, leap-month half and full star placements', () => {
  // Ordinary month end, New Year's Eve, leap-month half and leap-month end.
  const boundaries = [
    Lunar.fromYmd(1999, 12, 29), Lunar.fromYmd(2004, 1, 29),
    Lunar.fromYmd(2012, -4, 15), Lunar.fromYmd(2020, -4, 15),
    Lunar.fromYmd(2023, 12, 30), Lunar.fromYmd(2023, -2, 15),
    Lunar.fromYmd(2023, -2, 29), Lunar.fromYmd(2025, -6, 15),
  ];
  for (const lunar of boundaries) {
    const civil = lunar.getSolar();
    const next = civil.next(1);
    const normalized = birthForSolar(civil);
    assert.equal(normalized.solarDate, `${next.getYear()}-${next.getMonth()}-${next.getDay()}`);
    assert.equal(normalized.timeIndex, 0);
    assert.equal(normalized.trueHour, 23, 'clock correction remains available separately');
    assert.equal(normalized.dayPillarOffset, 1);
    for (const gender of ['male', 'female']) {
      const actual = browserIztro.astro.bySolar(normalized.solarDate, normalized.timeIndex, gender, true, 'zh-CN');
      const expected = iztro.astro.bySolar(next.toYmd(), 0, gender, true, 'zh-CN');
      assert.deepEqual(facts(actual), facts(expected), `${civil.toYmd()} ${gender}`);
    }
  }
});

test('New Year late Zi has next year transformations and reports the effective chart date', () => {
  const source = Lunar.fromYmd(2022, 12, 30).getSolar();
  const normalized = birthForSolar(source);
  const chart = browserIztro.astro.bySolar(normalized.solarDate, normalized.timeIndex, 'male', true, 'zh-CN');
  assert.equal(normalized.solarDate, '2023-1-22');
  assert.equal(chart.chineseDate.split(' ')[0], '癸卯');
  assert.equal(chart.earthlyBranchOfSoulPalace, '寅');
  assert.equal(chart.fiveElementsClass, '水二局');
  assert.deepEqual(plain(professional.collectMutagens(chart).map(item => [item.star, item.hua])),
    [['破军', '禄'], ['巨门', '权'], ['太阴', '科'], ['贪狼', '忌']]);
  assert.equal(input.formatChartBirth(normalized), '2023年1月22日 子时');
  const data = professional.buildChatData(chart, {
    y: 2023, m: 1, d: 21, h: 23, min: 30, isMale: true, ziHourNextDay: true,
  }, normalized, null);
  assert.equal(data.birth.day, 21, 'retain the submitted civil birthday');
  assert.equal(data.birth.effectiveSolarDate, '2023-1-22');
});

test('disabled Zi rollover and early Zi do not cross a lunar month or year', () => {
  for (const lunar of [Lunar.fromYmd(2022, 12, 30), Lunar.fromYmd(2023, -2, 15)]) {
    const solar = lunar.getSolar();
    for (const [hour, nextDay] of [[0, true], [22, true], [23, false]]) {
      const normalized = birthForSolar(solar, hour, nextDay);
      assert.equal(normalized.solarDate, `${solar.getYear()}-${solar.getMonth()}-${solar.getDay()}`);
      assert.equal(normalized.dayPillarOffset, 0);
    }
  }
});

test('true-solar midnight correction and Zi rollover compose exactly once', () => {
  // 01:30 Xinjiang civil clock falls in the previous civil day's late Zi.
  const normalized = input.normalizeBirth({
    year: 2000, month: 1, day: 1, hour: 1, minute: 30,
    prov: '新疆', city: '乌鲁木齐市', dist: '天山区',
    calculator, useTrueSolarTime: true, ziHourNextDay: true,
  });
  assert.equal(normalized.dayOffset, -1);
  assert.equal(normalized.dayPillarOffset, 1);
  assert.equal(normalized.solarDate, '2000-1-1');
  assert.equal(normalized.timeIndex, 0);
  assert.equal(normalized.year, 1999, 'the corrected civil date remains separate');
  assert.deepEqual(
    facts(browserIztro.astro.bySolar(normalized.solarDate, normalized.timeIndex, 'female', true, 'zh-CN')),
    facts(iztro.astro.bySolar('2000-1-1', 0, 'female', true, 'zh-CN')),
  );
});

test('the shipped browser engine agrees with installed iztro across 72 distinct charts', () => {
  for (let month = 1; month <= 12; month += 1) {
    const date = `${1986 + month * 3}-${month}-15`;
    for (const time of [0, 5, 12]) for (const gender of ['male', 'female']) {
      const browserChart = browserIztro.astro.bySolar(date, time, gender, true, 'zh-CN');
      const packageChart = iztro.astro.bySolar(date, time, gender, true, 'zh-CN');
      assert.deepEqual(facts(browserChart), facts(packageChart), `${date} ${time} ${gender}`);
      const protectedFacts = plain({ major: browserChart.palaces.map(p => p.majorStars), minor: browserChart.palaces.map(p => p.minorStars) });
      professional.applyWenmoAuxiliaryConvention(browserChart);
      assert.deepEqual(plain({ major: browserChart.palaces.map(p => p.majorStars), minor: browserChart.palaces.map(p => p.minorStars) }), protectedFacts);
      assert.equal(professional.collectMutagens(browserChart).length, 4);
      const after = facts(browserChart);
      professional.applyWenmoAuxiliaryConvention(browserChart);
      assert.deepEqual(facts(browserChart), after, 'auxiliary convention must be idempotent');
    }
  }
});
