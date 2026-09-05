const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('desktop paipan uses a two-column workspace without entering the mobile breakpoint', () => {
  const html = read('paipan.html');
  const css = read('css/theme-light-forms.css');
  assert.match(html, /theme-light-forms\.css\?v=5/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)[\s\S]*?#birthForm\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.birth-flow-panel\.active[\s\S]*?\.birth-basic-panel/);
  assert.match(css, /\.mobile-submit-dock[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
});

test('desktop result exposes the three report destinations and removes the dark canvas', () => {
  const html = read('result.html');
  const css = read('css/theme-light-results.css');
  assert.match(html, /theme-light-results\.css\?v=5/);
  assert.match(html, /class="desktop-report-nav"[\s\S]*?href="#dayunSection">基础排盘<[\s\S]*?href="#proSection">专业解读<[\s\S]*?href="#characterSection">白话详参</);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)[\s\S]*?#mxhCanvas\s*\{\s*opacity:\s*0\s*!important/);
  assert.match(css, /\.desktop-report-nav\s*\{[\s\S]*?position:\s*sticky[\s\S]*?grid-template-columns:\s*repeat\(3/);
});

test('wide result view exposes a functional three-column workbench', () => {
  const html = read('result.html');
  const css = read('css/theme-light-results.css');
  const script = read('js/desktop-result-workspace.js');
  assert.match(html, /desktop-workbench--left[\s\S]*?id="desktopRecentCharts"/);
  assert.match(html, /desktop-workbench--right[\s\S]*?id="desktopAiEntry"/);
  assert.match(html, /desktop-result-workspace\.js\?v=1/);
  assert.match(css, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.desktop-workbench\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(script, /Auth\.getData\('saved_charts'\)/);
  assert.match(script, /document\.getElementById\('aiFab'\)/);
  assert.doesNotMatch(script, /innerHTML\s*=\s*chart/);
  assert.match(read('css/mobile-app-shell.css'), /\.mobile-result-tabs\s*\{\s*display:\s*none/);
});

test('desktop changes remain outside mobile widths', () => {
  for (const file of ['css/theme-light-forms.css', 'css/theme-light-results.css']) {
    const css = read(file);
    const desktop = css.indexOf('@media (min-width: 1024px)');
    assert.ok(desktop >= 0, `${file} is missing its desktop boundary`);
    assert.match(css.slice(Math.max(0, desktop - 180), desktop), /Desktop/, `${file} should document its desktop-only intent`);
  }
});
