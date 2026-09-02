const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile paipan loads the dedicated bottom-sheet interaction after the base flow', () => {
  const html = read('paipan.html');
  assert.match(html, /css\/mobile-paipan-sheet\.css\?v=3/);
  assert.match(html, /js\/input-flow\.js\?v=7[\s\S]*js\/mobile-paipan-sheet\.js\?v=2/);
});

test('mobile paipan summarizes the main form and moves editors into an accessible sheet', () => {
  const source = read('js/mobile-paipan-sheet.js');
  for (const kind of ['time', 'location', 'settings']) {
    assert.match(source, new RegExp(`data-birth-sheet-open=\\"${kind}\\"`));
  }
  assert.match(source, /setAttribute\('role','dialog'\)/);
  assert.match(source, /setAttribute\('aria-modal','true'\)/);
  assert.match(source, /document\.createComment\('mobile-birth-sheet-anchor'\)/);
  assert.match(source, /function restoreMounted\(\)/);
  assert.match(source, /data-sheet-mode=\"solar\"[\s\S]*data-sheet-mode=\"lunar\"[\s\S]*data-sheet-mode=\"pillars\"/);
  assert.match(source, /window\.ZhishiBirthSheet=\{open:open,close:close,refresh:refresh\}/);
});

test('the sheet uses a dimmed overlay, a sliding white drawer and circular five-element pillar controls', () => {
  const css = read('css/mobile-paipan-sheet.css');
  assert.match(css, /@media \(max-width:720px\)/);
  assert.match(css, /\.mobile-birth-sheet-overlay\{position:fixed;inset:0/);
  assert.match(css, /\.mobile-birth-sheet\{position:fixed;left:0;right:0;bottom:0/);
  assert.match(css, /transform:translateY\(105%\)/);
  assert.match(css, /\.mobile-birth-sheet\.is-open\{transform:translateY\(0\)\}/);
  assert.match(css, /#pillarsPanel select\{[^}]*border-radius:50%/);
  for (const element of ['wood','fire','earth','metal','water']) {
    assert.match(css, new RegExp(`data-five-element=\\"${element}\\"`));
  }
  assert.match(css, /body\.mobile-page-paipan \.mobile-submit-dock\{position:static!important/);
  assert.match(css, /\.mobile-birth-summary-row\[hidden\]\{display:none!important\}/);
});

test('direct-pillar matching reopens the sheet so candidate dates remain visible', () => {
  const main = read('js/main.js');
  assert.match(main, /renderPillarCandidates[\s\S]*ZhishiBirthSheet\.open\('time', btn\)/);
});
