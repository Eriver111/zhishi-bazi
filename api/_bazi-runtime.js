const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'bazi.js'), 'utf8');
const CountyLongitudeData = require(path.join(__dirname, '..', 'js', 'county-longitudes.js'));
const context = {
  window: {},
  CountyLongitudeData,
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  RegExp,
  Set,
  Map
};
vm.createContext(context);
vm.runInContext(
  source + '\nwindow.__FortuneCalendar = { getJieQiDates, getYearPillar, getMonthPillar, getDayPillar };',
  context,
  { filename: 'bazi.js' }
);

const calculator = context.window.BaZiCalculator;
const calendar = context.window.__FortuneCalendar;

function numberParam(params, key, fallback) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function pillarsFromParams(params) {
  return {
    year: { gan: params.get('yg'), zhi: params.get('yz') },
    month: { gan: params.get('mg'), zhi: params.get('mz') },
    day: { gan: params.get('dg'), zhi: params.get('dz') },
    hour: { gan: params.get('hg'), zhi: params.get('hz') }
  };
}

function chartFromQuery(query) {
  const params = new URLSearchParams(query || '');
  const gender = params.get('gender') || 'male';
  if (params.get('mode') === 'pillars') {
    const hasTiming = params.get('timing') === 'matched';
    const birthDate = hasTiming ? {
      year: numberParam(params, 'year', NaN),
      month: numberParam(params, 'month', NaN),
      day: numberParam(params, 'day', NaN),
      hour: numberParam(params, 'hour', NaN),
      clock: numberParam(params, 'clock', NaN)
    } : null;
    return { bazi: calculator.buildFromPillars(pillarsFromParams(params), gender, birthDate), gender };
  }

  const normalized = calculator.normalizeBirthInput({
    year: numberParam(params, 'year', NaN),
    month: numberParam(params, 'month', NaN),
    day: numberParam(params, 'day', NaN),
    hour: numberParam(params, 'hour', NaN),
    clock: numberParam(params, 'clock', 0),
    minute: numberParam(params, 'minute', 0),
    gender,
    prov: params.get('prov') || '',
    city: params.get('city') || '',
    dist: params.get('dist') || '',
    trueSolarTime: params.get('report_clock_normalized') === '1' ? false : params.get('solar') !== '0',
    ziHourNextDay: params.get('zishi') === '1'
  });
  return {
    bazi: calculator.calculate(
      normalized.year, normalized.month, normalized.day, normalized.hour,
      gender, normalized.clock, normalized.dayPillarOffset
    ),
    gender
  };
}

module.exports = { calculator, calendar, chartFromQuery };
