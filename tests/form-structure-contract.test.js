const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bazi input retains every calculation control and script', () => {
  const html = read('paipan.html');
  for (const id of ['sYear','sMonth','sDay','sHour','sMinute','zishiHuanri','solarEnabled','province','city','district']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  for (const script of ['js/lunar.js','js/region.js','js/main.js']) assert.ok(html.includes(script));
  assert.match(html, /name=["']gender["']/);
  assert.match(html, /<input[^>]+id=["']zishiHuanri["'][^>]+checked/, 'Zi-hour rollover must default on');
});

test('face and palm retain their file inputs and submit handlers', () => {
  for (const page of ['face.html','palm.html']) {
    const html = read(page);
    assert.match(html, /type=["']file["']/, `${page} lost its upload input`);
    assert.match(html, /<script[\s\S]*?fetch\(/, `${page} lost its analysis request`);
  }
});

test('fengshui retains dynamic photo input creation and analysis request', () => {
  const html = read('fengshui.html');
  assert.match(html, /input\.type\s*=\s*['"]file['"]/);
  assert.match(html, /fetch\(['"]\/api\/fengshui-reading['"]/);
});

test('form light theme covers selected controls, uploads, disabled states and touch targets', () => {
  const stylesheet = path.join(root, 'css/theme-light-forms.css');
  assert.ok(fs.existsSync(stylesheet), 'missing form-only light theme');

  const css = read('css/theme-light-forms.css');
  assert.match(css, /\.mode-tab\.active[\s\S]*?\.radio:has\(input:checked\)/);
  assert.match(css, /\.upload-zone[\s\S]*?\.upload-area[\s\S]*?\.upload-placeholder/);
  assert.match(css, /button\[disabled\]/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?min-height:\s*44px/);
});

test('every tool input page loads the form light theme after the shared light theme', () => {
  const pages = [
    'paipan.html', 'ziwei.html', 'liuren.html', 'hepan.html', 'liuyao.html',
    'meihua.html', 'face.html', 'palm.html', 'fengshui.html', 'fortune.html',
  ];

  for (const page of pages) {
    const html = read(page);
    const sharedTheme = html.indexOf('css/theme-light.css?v=2');
    const formTheme = html.search(/css\/theme-light-forms\.css\?v=\d+/);
    assert.ok(formTheme > sharedTheme, `${page} must load the form theme after the shared theme`);
  }
});

test('calendar preview handlers tolerate pages without the optional preview node', () => {
  const script = read('js/main.js');
  const solarHandler = script.match(/function showSolarLunarHint\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const lunarHandler = script.match(/function showLunarPreview\([^)]*\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(solarHandler, /var prev = document\.getElementById\(['"]lunarPreview['"]\);\s*if \(!prev\) return;/);
  assert.match(lunarHandler, /var prev = document\.getElementById\(['"]lunarPreview['"]\);\s*if \(!prev\) return;/);
});
