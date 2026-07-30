const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeBaziReportParams,
  makeReportKey,
  makeBaziReportLabel
} = require('../lib/report-identity.js');

test('equivalent BaZi parameters produce one stable key', () => {
  const left = { year:'1990', month:'6', day:'15', hour:'8', minute:'5', gender:'male', prov:'广东省', city:'广州市' };
  const right = { city:'广州市', gender:'male', minute:5, hour:8, day:15, month:6, year:1990, prov:'广东省' };
  assert.equal(makeReportKey('bazi', left), makeReportKey('bazi', right));
});

test('every calculation-affecting field changes the report key', () => {
  const base = { year:1990, month:6, day:15, hour:8, minute:5, gender:'male', clock:8, prov:'广东省', city:'广州市', dist:'天河区', cal:'solar', ziHourRule:'next-day' };
  for (const [field, value] of [['minute',6], ['gender','female'], ['clock',9], ['city','深圳市'], ['ziHourRule','same-day']]) {
    assert.notEqual(makeReportKey('bazi', base), makeReportKey('bazi', { ...base, [field]:value }), field);
  }
});

test('direct-pillar reports are keyed by entered pillars and gender', () => {
  const params = normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', monthPillar:'壬午', dayPillar:'乙卯', hourPillar:'丁亥', gender:'female' });
  assert.deepEqual(params.pillars, { year:'庚午', month:'壬午', day:'乙卯', hour:'丁亥' });
  assert.match(makeBaziReportLabel(params), /坤造/);
});

test('invalid gender or incomplete pillars are rejected', () => {
  assert.throws(() => normalizeBaziReportParams({ year:1990, month:6, day:15, hour:8, gender:'unknown' }), /gender/);
  assert.throws(() => normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', gender:'male' }), /pillars/);
});
