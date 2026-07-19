const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('professional analysis waits while chart data is null', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'pro-analysis.js'), 'utf8');
  let retryScheduled = false;
  const document = {
    readyState: 'complete',
    querySelectorAll: () => [],
    querySelector: () => ({ classList: { add() {} }, innerHTML: '' }),
    getElementById: () => ({}),
  };

  assert.doesNotThrow(() => vm.runInNewContext(source, {
    _bazi: null,
    document,
    console,
    setTimeout() { retryScheduled = true; },
  }));
  assert.equal(retryScheduled, true);
});
