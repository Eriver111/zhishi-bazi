const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inkCss = fs.readFileSync(path.join(root, 'css', 'ink-wash.css'), 'utf8');

test('homepage no longer delays first paint with an intro sequence', () => {
  assert.doesNotMatch(html, /id=["']eyeOverlay["']/);
  assert.doesNotMatch(html, /setTimeout\([\s\S]{0,300}?1800\)/);
});

test('homepage uses v3 mobile artwork while preserving the v2 desktop artwork', () => {
  assert.match(html, /<source[^>]+media=["']\(max-width:\s*600px\)["'][^>]+zhishi-hero-ink-mobile-v3\.webp/);
  assert.match(html, /<source[^>]+zhishi-hero-ink-v2\.webp[^>]+image\/webp/);
  assert.match(html, /<img[^>]+zhishi-hero-ink-v2\.png/);
  // 2026-08-10 清理（7e3a2f8）后主图仅保留 webp 格式
  assert.ok(fs.existsSync(path.join(root, 'images', 'zhishi-hero-ink-mobile-v3.webp')));
  assert.ok(fs.existsSync(path.join(root, 'images', 'zhishi-hero-ink-v2.webp')));
});

test('mobile hero fits the portrait artwork to the viewport without intrinsic-size cropping', () => {
  const themeCss = fs.readFileSync(path.join(root, 'css', 'theme-light-home.css'), 'utf8');
  assert.match(html, /theme-light-home\.css\?v=4/);
  assert.match(
    themeCss,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.ink-wash-scene\s+img\s*\{[^}]*width:\s*100%\s*!important;[^}]*height:\s*100%\s*!important;[^}]*min-width:\s*0\s*!important;[^}]*min-height:\s*0\s*!important;[^}]*object-fit:\s*cover;[^}]*object-position:\s*center\s+center;[^}]*top:\s*0;[^}]*left:\s*0;[^}]*transform:\s*none\s*!important;[^}]*animation:\s*none\s*!important;/s
  );
  assert.match(
    themeCss,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?\.ink-wash-water\s*\{[^}]*display:\s*none\s*!important;/s
  );
});

test('homepage presents the generated artwork without grey post-processing', () => {
  const themeCss = fs.readFileSync(path.join(root, 'css', 'theme-light-home.css'), 'utf8');
  assert.match(themeCss, /\.ink-wash-scene\s*\{[^}]*opacity:\s*1\s*;[^}]*filter:\s*none\s*;/s);
  assert.match(themeCss, /\.ink-wash-scene\s+img\s*\{[^}]*opacity:\s*1\s*!important\s*;[^}]*filter:\s*none\s*!important\s*;/s);
  assert.match(themeCss, /\.ink-wash-overlay\s*\{[^}]*rgba\(240,230,209,\.0[0-6]\)/s);
  assert.match(themeCss, /#mxhCanvas\s*\{[^}]*opacity:\s*0\s*!important/);
  assert.match(themeCss, /\.ink-wash-scene\s*~\s*#bgCanvas\s*\{[^}]*opacity:\s*0\s*!important/);
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
