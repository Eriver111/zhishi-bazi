const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const iztro = require('iztro');

const modulePath = path.join(__dirname, '..', 'js', 'ziwei-input.js');

function loadInput() {
  assert.ok(fs.existsSync(modulePath), 'Ziwei input normalization module must exist');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('rejects impossible Gregorian dates before chart generation', () => {
  const input = loadInput();
  assert.equal(input.validateSolarDate(2024, 2, 29), true);
  assert.equal(input.validateSolarDate(2024, 2, 30), false);
  assert.equal(input.validateSolarDate(2023, 4, 31), false);
});

test('maps every clock hour to the traditional two-hour branch', () => {
  const input = loadInput();
  const expected = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0];
  assert.deepEqual(Array.from({ length: 24 }, (_, hour) => input.clockHourToBranchIndex(hour)), expected);
});

test('distinguishes late Zi hour from early Zi hour for iztro', () => {
  const input = loadInput();
  const early = input.normalizeBirth({ year: 2000, month: 1, day: 1, hour: 0, minute: 30, longitude: 120, useTrueSolarTime: false });
  const late = input.normalizeBirth({ year: 2000, month: 1, day: 1, hour: 23, minute: 30, longitude: 120, useTrueSolarTime: false });

  assert.equal(early.timeIndex, 0);
  assert.equal(late.timeIndex, 12);
  assert.equal(late.solarDate, '2000-1-1');

  const earlyChart = iztro.astro.bySolar(early.solarDate, early.timeIndex, 'male', true, 'zh-CN');
  const lateChart = iztro.astro.bySolar(late.solarDate, late.timeIndex, 'male', true, 'zh-CN');
  assert.notEqual(earlyChart.chineseDate, lateChart.chineseDate);
});

test('moves the civil date when true solar time crosses midnight', () => {
  const input = loadInput();
  const normalized = input.normalizeBirth({
    year: 2000, month: 1, day: 1, hour: 1, minute: 0,
    longitude: 75.9, useTrueSolarTime: true,
  });

  assert.equal(normalized.dayOffset, -1);
  assert.equal(normalized.solarDate, '1999-12-31');
  assert.equal(normalized.timeIndex, 11);
});

test('reads current iztro soul/body fields and derives Yin-Yang gender label', () => {
  const input = loadInput();
  const chart = iztro.astro.bySolar('2004-8-14', 1, 'male', true, 'zh-CN');
  assert.deepEqual(input.getSoulBodyBranches(chart), { soul: '午', body: '申' });
  assert.equal(input.getGenderDesignation('辛巳 庚寅 甲子 甲子', 'male'), '阴男');
  assert.equal(input.getGenderDesignation('庚辰 戊寅 甲子 甲子', 'female'), '阳女');
});
