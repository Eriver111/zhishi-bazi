const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inkCss = fs.readFileSync(path.join(root, 'css', 'ink-wash.css'), 'utf8');

test('homepage keeps the agreed intro duration', () => {
  assert.match(html, /setTimeout\([\s\S]{0,300}?1800\)/);
});

test('homepage uses art-directed desktop and mobile hero backgrounds', () => {
  assert.match(html, /<source[^>]+media=["']\(max-width:\s*600px\)["'][^>]+zhishi-hero-ink-mobile-v2\.webp/);
  assert.match(html, /<source[^>]+zhishi-hero-ink-v2\.webp[^>]+image\/webp/);
  assert.match(html, /<img[^>]+zhishi-hero-ink-v2\.png/);
});

test('homepage light treatment keeps the artwork visible', () => {
  const themeCss = fs.readFileSync(path.join(root, 'css', 'theme-light-home.css'), 'utf8');
  assert.match(themeCss, /\.ink-wash-scene\s*\{[^}]*opacity:\s*\.8/);
  assert.match(themeCss, /\.ink-wash-overlay\s*\{[^}]*rgba\(246,239,223,\.2[0-9]\)/);
});

test('homepage has mobile navigation hooks and a two-column mobile feature grid', () => {
  assert.match(html, /class="zhishi-nav-links"/);
  assert.match(html, /class="mobile-nav-extra"/);
  assert.match(html, /@media\(max-width:600px\)[\s\S]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /#zhishi-nav \.nav-more \.dd-menu\{left:auto!important;right:0!important\}/);
});

test('hero description uses a stronger readable color', () => {
  assert.match(inkCss, /\.hero-desc\s*\{[^}]+rgba\(232,224,204,\.78\)/);
});
