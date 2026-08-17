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

test('county data versions refresh calculation caches without changing paid entitlement', () => {
  const base = { year:1990, month:6, day:15, hour:8, minute:5, gender:'male', clock:8, prov:'广东省', city:'广州市', dist:'天河区' };
  assert.equal(
    makeReportKey('bazi', base),
    makeReportKey('bazi', { ...base, geo_v:'county-centroid-v2', solarDataVersion:'county-centroid-v2' })
  );
});

test('every calculation-affecting field changes the report key', () => {
  const base = { year:1990, month:6, day:15, hour:8, minute:5, gender:'male', clock:8, prov:'广东省', city:'广州市', dist:'天河区', cal:'solar', ziHourRule:'next-day' };
  for (const [field, value] of [['minute',6], ['gender','female'], ['clock',9], ['city','深圳市'], ['ziHourRule','same-day']]) {
    assert.notEqual(makeReportKey('bazi', base), makeReportKey('bazi', { ...base, [field]:value }), field);
  }
});

test('legacy zishi and solar URL parameters map to calculation settings and change the report key', () => {
  const base = { year:1990, month:6, day:15, hour:0, minute:5, gender:'male', clock:0, prov:'广东省', city:'广州市', dist:'天河区', cal:'solar' };
  const zishi = normalizeBaziReportParams({ ...base, zishi:'1' });
  const solar = normalizeBaziReportParams({ ...base, solar:'0' });

  assert.equal(zishi.ziHourRule, 'next-day');
  assert.equal(solar.trueSolarTime, 'disabled');
  assert.notEqual(makeReportKey('bazi', base), makeReportKey('bazi', { ...base, zishi:'1' }));
  assert.notEqual(makeReportKey('bazi', base), makeReportKey('bazi', { ...base, solar:'0' }));
});

test('a normalized lunar report keeps its key when normalized again', () => {
  const raw = { year:1990, month:6, day:15, hour:0, minute:5, gender:'female', clock:0, cal:'lunar', zishi:'1', solar:'0' };
  const normalized = normalizeBaziReportParams(raw);

  assert.equal(normalized.mode, 'lunar');
  assert.equal(makeReportKey('bazi', normalized), makeReportKey('bazi', raw));
});

test('direct-pillar reports are keyed by entered pillars and gender', () => {
  const params = normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', monthPillar:'壬午', dayPillar:'乙卯', hourPillar:'丁亥', gender:'female' });
  assert.deepEqual(params.pillars, { year:'庚午', month:'壬午', day:'乙卯', hour:'丁亥' });
  assert.match(makeBaziReportLabel(params), /坤造/);
});

test('direct-pillar report keys ignore timing metadata, including matched time changes', () => {
  const pillars = { mode:'pillars', yearPillar:'庚午', monthPillar:'壬午', dayPillar:'乙卯', hourPillar:'丁亥', gender:'female' };
  const unknown = normalizeBaziReportParams({ ...pillars, timing:'unknown' });
  const matched = normalizeBaziReportParams({ ...pillars, timing:'matched', year:1990, month:6, day:15, hour:8, clock:8 });
  const changedMatched = { ...pillars, timing:'matched', year:1991, month:7, day:16, hour:9, clock:9 };

  assert.equal(unknown.timing, 'unknown');
  assert.equal(matched.timing, 'matched');
  assert.equal(makeReportKey('bazi', unknown), makeReportKey('bazi', matched));
  assert.equal(makeReportKey('bazi', matched), makeReportKey('bazi', changedMatched));
});

test('invalid gender or incomplete pillars are rejected', () => {
  assert.throws(() => normalizeBaziReportParams({ year:1990, month:6, day:15, hour:8, gender:'unknown' }), /gender/);
  assert.throws(() => normalizeBaziReportParams({ mode:'pillars', yearPillar:'庚午', gender:'male' }), /pillars/);
});
