const crypto = require('crypto');

const LOCATION_FIELDS = ['prov', 'city', 'dist'];

function int(value, name, fallback) {
  if ((value === '' || value === null || value === undefined) && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error('invalid ' + name);
  return parsed;
}

function text(value) {
  return String(value || '').trim();
}

function normalizeBaziReportParams(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const gender = text(raw.gender);
  if (gender !== 'male' && gender !== 'female') throw new Error('invalid gender');
  const mode = text(raw.mode || raw.cal) === 'pillars' ? 'pillars' : text(raw.cal || 'solar');

  if (mode === 'pillars') {
    const source = raw.enteredPillars || raw.pillars || {};
    const pair = (position, ganKey, zhiKey) => {
      const value = source[position];
      if (typeof value === 'string') return value;
      if (value && value.gan && value.zhi) return text(value.gan) + text(value.zhi);
      const named = text(raw[position + 'Pillar']);
      return named || text(raw[ganKey]) + text(raw[zhiKey]);
    };
    const pillars = {
      year: pair('year', 'yg', 'yz'),
      month: pair('month', 'mg', 'mz'),
      day: pair('day', 'dg', 'dz'),
      hour: pair('hour', 'hg', 'hz')
    };
    if (Object.values(pillars).some(value => !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(value))) {
      throw new Error('invalid pillars');
    }
    const result = { mode, gender, pillars, timing:text(raw.timing || 'unknown') };
    if (result.timing === 'matched') {
      result.year = int(raw.year, 'year');
      result.month = int(raw.month, 'month');
      result.day = int(raw.day, 'day');
      result.hour = int(raw.hour, 'hour');
      result.clock = int(raw.clock, 'clock', result.hour);
    }
    return result;
  }

  const result = {
    mode,
    year: int(raw.year, 'year'),
    month: int(raw.month, 'month'),
    day: int(raw.day, 'day'),
    hour: int(raw.hour, 'hour'),
    minute: int(raw.minute, 'minute', 0),
    clock: int(raw.clock, 'clock', int(raw.hour, 'hour')),
    gender,
    ziHourRule: text(raw.ziHourRule || raw.zi_hour_rule || 'same-day')
  };
  LOCATION_FIELDS.forEach(field => { result[field] = text(raw[field]); });
  return result;
}

function makeReportKey(type, raw) {
  if (type !== 'bazi') throw new Error('unsupported report type');
  const normalized = normalizeBaziReportParams(raw);
  const identity = normalized.mode === 'pillars'
    ? { mode:normalized.mode, gender:normalized.gender, pillars:normalized.pillars }
    : normalized;
  return crypto.createHash('sha256').update(type + '\n' + JSON.stringify(identity)).digest('hex');
}

function makeBaziReportLabel(params) {
  const prefix = params.gender === 'male' ? '乾造' : '坤造';
  if (params.mode === 'pillars') return prefix + ' · ' + Object.values(params.pillars).join(' ');
  return prefix + ' · ' + params.year + '年' + params.month + '月' + params.day + '日';
}

module.exports = { normalizeBaziReportParams, makeReportKey, makeBaziReportLabel };
