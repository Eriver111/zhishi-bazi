const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('solar submit retains the original parameter names', () => {
  const source = read('js/main.js');
  assert.match(source, /new URLSearchParams\(\{\s*year:year,\s*month:month,\s*day:day,\s*hour:hour,\s*gender:gender\s*\}\)/);
  for (const key of ['clock', 'minute', 'prov', 'city', 'dist', 'geo_v', 'zishi', 'solar']) {
    assert.ok(source.includes(`params.set('${key}'`) || source.includes(`params.set(\"${key}\"`), key);
  }
});

test('new calendar submissions require exact county matching only when location is supplied', () => {
  const source = read('js/main.js');
  assert.match(source, /hasAnyLocation[\s\S]*hasCompleteLocation/);
  assert.match(source, /resolveLocation\([\s\S]*allowFallback:false/);
  assert.match(source, /县级经度未匹配，请重新选择出生地/);
  assert.match(source, /params\.set\('geo_v', CountyLongitudeData\.VERSION\)/);
});

test('ordinary result initialization still uses calculate then calculateDaYun', () => {
  const source = read('js/result.js');
  assert.match(source, /BaZiCalculator\.calculate\([\s\S]*?BaZiCalculator\.calculateDaYun\(/);
});

test('result keeps the full birthplace tuple and discloses county versus fallback accuracy', () => {
  const source = read('js/result.js');
  assert.match(source, /district:_params\.dist/);
  assert.match(source, /\(_params\.prov \|\| _params\.city \|\| _params\.dist\) \? \{/);
  assert.match(source, /resolution\.level === 'county'/);
  assert.match(source, /'按' \+ \(_params\.dist \|\| '所选县区'\) \+ '的县级行政中心经度/);
  assert.doesNotMatch(source, /\+ '县级行政中心经度/);
  assert.match(source, /县级经度未匹配，当前按/);
  assert.match(source, /未选择出生地，当前未使用县级经度/);
  assert.doesNotMatch(source, /经度已校正[^）<]*\)/);
});
