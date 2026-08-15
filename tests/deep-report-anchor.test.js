const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const Anchor = require(path.join(root, 'js', 'deep-report-anchor.js'));

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test('explicit paid report year wins over the local snapshot and current year', () => {
  assert.equal(Anchor.resolve({
    reportYear: 2026,
    localYear: 2027,
    now: new Date('2030-01-01T00:00:00+08:00')
  }), 2026);
});

test('new guest stores the first China year and reuses it', () => {
  const storage = memoryStorage();
  const options = { chartKey: '甲子乙丑丙寅丁卯', storage };
  assert.equal(Anchor.resolve({ ...options, now: new Date('2026-12-31T20:00:00+08:00') }), 2026);
  assert.equal(Anchor.resolve({ ...options, now: new Date('2028-01-01T00:00:00+08:00') }), 2026);
});

test('invalid explicit and stored years fall back to the China year', () => {
  const storage = memoryStorage();
  storage.setItem('deep_report_anchor_v1:chart', '1899');
  assert.equal(Anchor.resolve({
    reportYear: 2201,
    chartKey: 'chart',
    storage,
    now: new Date('2025-12-31T16:00:00Z')
  }), 2026);
});

test('report_year is not part of paywall source or report identity params', () => {
  const paywallSource = fs.readFileSync(path.join(root, 'js', 'paywall.js'), 'utf8');
  const resultSource = fs.readFileSync(path.join(root, 'js', 'result.js'), 'utf8');
  assert.doesNotMatch(paywallSource, /report_year/);
  assert.match(resultSource, /reportYear/);
  assert.match(resultSource, /delete\s+_params\.reportYear/);
});

test('paid report href carries only the read-only purchase year', () => {
  const href = Anchor.paidReportHref({
    report_params: { year: 1990, month: 6, day: 15, hour: 8, gender: 'female' },
    paid_at: '2026-07-30T12:00:00.000Z'
  });
  const url = new URL(`https://example.test/${href.replace(/^\/?/, '')}`);
  assert.equal(url.searchParams.get('year'), '1990');
  assert.equal(url.searchParams.get('report_year'), '2026');
});

test('paid_at year follows China time at the UTC year boundary', () => {
  assert.equal(Anchor.paidAtYear('2026-12-31T18:00:00.000Z'), 2027);
});
