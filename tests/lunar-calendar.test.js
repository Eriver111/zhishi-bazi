const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCalendar() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'lunar.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source, context);
  return context.LunarCalendar;
}

test('2013 lunar new year converts back to 2013-02-10', () => {
  const calendar = loadCalendar();
  assert.deepEqual(
    { ...calendar.lunarToSolar(2013, 1, 1, false) },
    { year: 2013, month: 2, day: 10 }
  );
});

test('rejects a leap-month flag when that year has no matching leap month', () => {
  const calendar = loadCalendar();
  assert.throws(() => calendar.lunarToSolar(2013, 1, 1, true), /闰月/);
});

test('rejects a lunar day beyond that month length', () => {
  const calendar = loadCalendar();
  assert.throws(() => calendar.lunarToSolar(2013, 1, 31, false), /日期/);
});

test('reports the day count for the selected ordinary or leap lunar month', () => {
  const calendar = loadCalendar();
  assert.equal(calendar.lunarMonthDays(2017, 6, false), 29);
  assert.equal(calendar.lunarMonthDays(2017, 6, true), 30);
  assert.equal(calendar.lunarMonthDays(2023, 2, false), 30);
  assert.equal(calendar.lunarMonthDays(2023, 2, true), 29);
});

test('rejects non-numeric lunar date fields', () => {
  const calendar = loadCalendar();
  assert.throws(
    () => calendar.lunarToSolar('2013', 1, 1, false),
    error => error && error.name === 'TypeError'
  );
});

test('every supported solar day round-trips through lunar conversion', () => {
  const calendar = loadCalendar();
  for (let time = Date.UTC(1900, 0, 31); time <= Date.UTC(2100, 11, 31); time += 86400000) {
    const date = new Date(time);
    const lunar = calendar.solarToLunar(
      date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()
    );
    const solar = calendar.lunarToSolar(
      lunar.lYear, lunar.lMonth, lunar.lDay, lunar.isLeap
    );
    assert.deepEqual(
      { ...solar },
      { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
    );
  }
});

test('known historical and future correction dates match authoritative lunar dates', () => {
  const calendar = loadCalendar();
  const cases = [
    [[1933, 7, 22], { lYear: 1933, lMonth: 5, lDay: 30, isLeap: true }],
    [[1996, 7, 15], { lYear: 1996, lMonth: 5, lDay: 30, isLeap: false }],
    [[1996, 9, 12], { lYear: 1996, lMonth: 7, lDay: 30, isLeap: false }],
    [[2060, 4, 30], { lYear: 2060, lMonth: 4, lDay: 1, isLeap: false }],
    [[2097, 8, 7], { lYear: 2097, lMonth: 7, lDay: 1, isLeap: false }],
  ];

  for (const [solar, expected] of cases) {
    const actual = calendar.solarToLunar(...solar);
    assert.deepEqual(
      {
        lYear: actual.lYear,
        lMonth: actual.lMonth,
        lDay: actual.lDay,
        isLeap: actual.isLeap,
      },
      expected,
      solar.join('-')
    );
  }
});
