const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const publicPages = [
  'index.html', 'paipan.html', 'result.html', 'ziwei.html', 'liuren.html',
  'hepan.html', 'hepan-result.html', 'liuyao.html', 'meihua.html',
  'face.html', 'palm.html', 'fengshui.html', 'fortune.html', 'pricing.html',
  'profile.html', 'ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html',
];

test('every public page loads the light theme after existing styles', () => {
  for (const page of publicPages) {
    const html = read(page);
    const themeAt = html.lastIndexOf('css/theme-light.css');
    assert.ok(themeAt > -1, `${page} is missing theme-light.css`);
    assert.ok(themeAt > html.lastIndexOf('</style>'), `${page} loads theme before inline styles`);
  }
});

test('light theme defines the approved palette and light color scheme', () => {
  const css = read('css/theme-light.css');
  for (const token of ['#f6efdf', '#eee3cd', '#2d261f', '#796d61', '#84362f', '#365d50', '#a47b42']) {
    assert.match(css.toLowerCase(), new RegExp(token.replace('#', '#')));
  }
  assert.match(css, /color-scheme:\s*light/);
});

test('homepage exposes ten uniform tools and no standalone AI consultation CTA', () => {
  const html = read('index.html');
  const featureLinks = [...html.matchAll(/<a[^>]+class="feat-card"/g)];
  assert.equal(featureLinks.length, 10);
  assert.match(html, /鐭ュぉ鏃禱s*[路锛?]?\s*瑙佽嚜宸?/);
  assert.doesNotMatch(html, />\s*AI 鍛界悊鍜ㄨ\s*</);
});
