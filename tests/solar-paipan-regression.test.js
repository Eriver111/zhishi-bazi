const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('solar submit retains the original parameter names', () => {
  const source = read('js/main.js');
  assert.match(source, /new URLSearchParams\(\{\s*year:year,\s*month:month,\s*day:day,\s*hour:hour,\s*gender:gender\s*\}\)/);
  for (const key of ['clock', 'minute', 'prov', 'city', 'dist', 'zishi', 'solar']) {
    assert.ok(source.includes(`params.set('${key}'`) || source.includes(`params.set(\"${key}\"`), key);
  }
});

test('ordinary result initialization still uses calculate then calculateDaYun', () => {
  const source = read('js/result.js');
  assert.match(source, /BaZiCalculator\.calculate\([\s\S]*?BaZiCalculator\.calculateDaYun\(/);
});
