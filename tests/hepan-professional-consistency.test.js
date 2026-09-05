const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

function loadCalculatorAndHepan() {
  const context = { window: {}, console, Date, Math, setTimeout, clearTimeout, module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'county-longitudes.js'), 'utf8'), context, { filename: 'county-longitudes.js' });
  context.module = { exports: {} };
  context.exports = {};
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bazi.js'), 'utf8'), context, { filename: 'bazi.js' });
  context.BaZiCalculator = context.window.BaZiCalculator;
  context.calculateBaZi = context.BaZiCalculator.calculate;
  context.module = { exports: {} };
  context.exports = {};
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'hepan-core.js'), 'utf8'), context, { filename: 'hepan-core.js' });
  return { calculator: context.BaZiCalculator, helpers: context.window._hepanHelpers };
}

function loadPersonBuilder() {
  const file = path.join(root, 'js', 'hepan-person.js');
  assert.ok(fs.existsSync(file), 'Hepan person builder must exist');
  delete require.cache[require.resolve(file)];
  return require(file);
}

function pillars(chart) {
  return ['year', 'month', 'day', 'hour'].map(position => chart[position].gan + chart[position].zhi);
}

test('shared birth normalization preserves true-solar cross-day semantics', () => {
  const { calculator } = loadCalculatorAndHepan();
  assert.equal(typeof calculator.calculateFromBirthInput, 'function');
  const result = calculator.calculateFromBirthInput({
    year: 2024, month: 1, day: 15, hour: 0, clock: 0, minute: 10,
    gender: 'male', location: '新疆', trueSolarTime: true, ziHourNextDay: false,
  });

  assert.deepEqual(
    { year: result.normalized.year, month: result.normalized.month, day: result.normalized.day, hour: result.normalized.hour },
    { year: 2024, month: 1, day: 14, hour: 11 },
  );
  assert.deepEqual(pillars(result.bazi), ['癸卯', '乙丑', '丁丑', '辛亥']);
});

test('Zi-hour day change affects only day/hour pillars at the shared boundary', () => {
  const { calculator } = loadCalculatorAndHepan();
  assert.equal(typeof calculator.calculateFromBirthInput, 'function');
  const base = { year: 2024, month: 1, day: 15, hour: 0, clock: 0, minute: 0, gender: 'male', trueSolarTime: false };
  const sameDay = calculator.calculateFromBirthInput({ ...base, ziHourNextDay: false });
  const earlyZi = calculator.calculateFromBirthInput({ ...base, ziHourNextDay: true });
  const nextDay = calculator.calculateFromBirthInput({ ...base, clock: 23, ziHourNextDay: true });

  assert.deepEqual(pillars(sameDay.bazi), ['癸卯', '乙丑', '戊寅', '壬子']);
  // 早子时的公历日期已经跨日，因此不再叠加第二次日柱偏移。
  assert.deepEqual(pillars(earlyZi.bazi), ['癸卯', '乙丑', '戊寅', '壬子']);
  // 晚子时（23:00-24:00）换日：仅日柱/时柱滚动
  assert.deepEqual(pillars(nextDay.bazi), ['癸卯', '乙丑', '己卯', '甲子']);
  assert.equal(nextDay.normalized.year, 2024);
  assert.equal(nextDay.normalized.month, 1);
  assert.equal(nextDay.normalized.day, 15);
});

test('Hepan parser retains every timing option used by personal charts', () => {
  const builder = loadPersonBuilder();
  const parsed = builder.parsePersonParams({
    p1y: '2024', p1m: '1', p1d: '15', p1h: '0', p1clock: '0', p1min: '10', p1g: 'male',
    p1prov: '新疆', p1city: '喀什市', p1dist: '喀什市', p1cal: 'solar', p1solar: '0', p1zishi: '1',
  }, 'p1');

  assert.deepEqual(parsed, {
    year: 2024, month: 1, day: 15, hour: 0, clock: 0, minute: 10, gender: 'male', cal: 'solar',
    prov: '新疆', city: '喀什市', dist: '喀什市', trueSolarTime: false, ziHourNextDay: true,
  });
});

test('Hepan and personal charts use the same county longitude at an hour boundary', () => {
  const { calculator } = loadCalculatorAndHepan();
  const builder = loadPersonBuilder();
  const params = {
    year: 1995, month: 11, day: 17, hour: 5, clock: 9, minute: 10,
    gender: 'male', cal: 'solar', prov: '湖北省', city: '神农架林区', dist: '神农架林区',
    trueSolarTime: true, ziHourNextDay: false,
  };
  const personal = calculator.calculateFromBirthInput({
    ...params,
    location: { province: params.prov, city: params.city, district: params.dist, allowFallback: true },
  });
  const hepan = builder.buildPerson('甲方', params, calculator);

  assert.equal(hepan._normalizedBirth.solarInfo.lng, personal.normalized.solarInfo.lng);
  assert.equal(hepan._normalizedBirth.hour, personal.normalized.hour);
  assert.deepEqual(pillars(hepan._bazi), pillars(personal.bazi));
  assert.deepEqual(pillars(hepan._bazi), ['乙亥', '丁亥', '壬子', '甲辰']);
});

test('Hepan uses the exact personal professional facts for the same chart', () => {
  const { calculator, helpers } = loadCalculatorAndHepan();
  const builder = loadPersonBuilder();
  const params = {
    year: 1988, month: 1, day: 3, hour: 0, clock: 0, minute: 0,
    gender: 'male', cal: 'solar', prov: '', city: '', dist: '', trueSolarTime: false, ziHourNextDay: false,
  };
  const person = builder.buildPerson('甲方', params, calculator);
  const personal = calculator.getProfessionalReportFacts(person._bazi, 'male');
  const hepan = helpers.analyzeXiyong(person, person).p1;

  assert.deepEqual(hepan.xiShen, personal.yongJi.xiShen);
  assert.deepEqual(hepan.yongShen, personal.yongJi.yongShen);
  assert.deepEqual(hepan.jiShen, personal.yongJi.jiShen);
  assert.deepEqual(person._professionalFacts, personal);
});

test('Hepan person carries the exact calculator DaYun instead of leaving it to AI', () => {
  const { calculator } = loadCalculatorAndHepan();
  const builder = loadPersonBuilder();
  const params = {
    year: 1996, month: 7, day: 19, hour: 6, clock: 12, minute: 20,
    gender: 'female', cal: 'solar', prov: '', city: '', dist: '', trueSolarTime: false, ziHourNextDay: true,
  };
  const person = builder.buildPerson('甲方', params, calculator);
  const normalized = person._normalizedBirth;
  const expected = calculator.calculateDaYun(
    person._bazi.month, person._bazi.year, params.gender,
    normalized.year, normalized.month, normalized.day, normalized.hour, normalized.clock
  );

  assert.ok(person._daYunData && person._daYunData.list.length === 8);
  assert.deepEqual(person._daYunData, expected);
});

test('Hepan person keeps ShenSha in the string format consumed by the analysis engine', () => {
  const { calculator } = loadCalculatorAndHepan();
  const builder = loadPersonBuilder();
  const person = builder.buildPerson('甲方', {
    year: 1990, month: 6, day: 15, hour: 5, clock: 10, minute: 30,
    gender: 'male', cal: 'solar', prov: '', city: '', dist: '', trueSolarTime: false, ziHourNextDay: false,
  }, calculator);

  assert.ok(person.shenSha.length > 0, 'fixture must contain ShenSha');
  assert.ok(person.shenSha.every(item => typeof item === 'string'));
});

test('Hepan strength copy uses the personal professional level without undefined fields', () => {
  const { calculator, helpers } = loadCalculatorAndHepan();
  const builder = loadPersonBuilder();
  const params = {
    year: 1990, month: 6, day: 15, hour: 5, clock: 10, minute: 30,
    gender: 'male', cal: 'solar', prov: '', city: '', dist: '', trueSolarTime: false, ziHourNextDay: false,
  };
  const person = builder.buildPerson('甲方', params, calculator);
  const result = helpers.analyzeDayGanStrength(person, person);

  assert.equal(result.p1Strength.label, person._professionalFacts.strength.level);
  assert.doesNotMatch(result.detail, /undefined/);
});
