const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const allCss = ['theme-light.css','theme-light-home.css','theme-light-forms.css','theme-light-results.css','theme-light-pages.css']
  .map((file) => fs.readFileSync(path.join(root, 'css', file), 'utf8'))
  .join('\n');

test('light UI has keyboard focus, mobile touch, and intentional table scrolling', () => {
  assert.match(allCss, /:focus-visible/);
  assert.match(allCss, /min-height:\s*44px/);
  assert.match(allCss, /dayun-scroll-wrapper[\s\S]*overflow-x:\s*auto/);
  assert.match(allCss, /liunian-scroll-wrapper[\s\S]*overflow-x:\s*auto/);
});

test('decorative reduced-motion rules do not remove the intro contract', () => {
  assert.match(allCss, /prefers-reduced-motion/);
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /setTimeout\([\s\S]{0,300}?1800\)/);
});
