const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['face-reading.js', 'palm-reading.js']) {
  test(`${file} never emits an API key prefix in diagnostic logs`, () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'api', file), 'utf8');
    assert.doesNotMatch(source, /substring\(0\s*,\s*8\)/);
    assert.doesNotMatch(source, /\bkey=['"+]/);
  });
}
