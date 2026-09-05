const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared theme disables decorative motion and smooth scrolling globally', () => {
  const css = read('css/theme-light.css');
  assert.match(css, /html\s*\{\s*scroll-behavior:\s*auto\s*!important/);
  assert.match(css, /\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*?animation:\s*none\s*!important;[\s\S]*?transition:\s*none\s*!important/);
});

test('all public themed pages request the static UI cache version', () => {
  const pages = [
    'index.html', 'paipan.html', 'result.html', 'hepan.html', 'hepan-result.html',
    'ziwei.html', 'liuren.html', 'liuyao.html', 'meihua.html', 'fortune.html',
    'fengshui.html', 'face.html', 'palm.html', 'pricing.html', 'profile.html',
    'archives.html', 'ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html'
  ];
  pages.forEach((page) => assert.match(read(page), /css\/theme-light\.css\?v=4/, page));
});

test('decorative canvas engines remain API-compatible without starting render loops', () => {
  const background = read('js/bg-animation.js');
  const ink = read('js/mo-xing-he.js');
  assert.match(background, /canvas\.hidden\s*=\s*true;\s*return;/);
  assert.match(ink, /canvas\.hidden\s*=\s*true;\s*running\s*=\s*false;\s*return;/);
  assert.match(ink, /return\s*\{\s*start:\s*init,\s*stop:\s*stop\s*\}/);
});
