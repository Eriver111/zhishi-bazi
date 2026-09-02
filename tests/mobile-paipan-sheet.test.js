const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile paipan loads the dedicated bottom-sheet interaction after the base flow', () => {
  const html = read('paipan.html');
  assert.match(html, /css\/mobile-paipan-sheet\.css\?v=6/);
  assert.match(html, /js\/input-flow\.js\?v=7[\s\S]*js\/mobile-paipan-sheet\.js\?v=6/);
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

test('the sheet uses a dimmed overlay, a sliding white drawer, wheel dates and stepped pillar controls', () => {
  const css = read('css/mobile-paipan-sheet.css');
  assert.match(css, /@media \(max-width:720px\)/);
  assert.match(css, /\.mobile-birth-sheet-overlay\{position:fixed;inset:0/);
  assert.match(css, /\.mobile-birth-sheet\{position:fixed;left:0;right:0;bottom:0/);
  assert.match(css, /transform:translateY\(105%\)/);
  assert.match(css, /\.mobile-birth-sheet\.is-open\{transform:translateY\(0\)\}/);
  assert.match(css, /\.mobile-wheel-grid\{/);
  assert.match(css, /scroll-snap-type:y mandatory/);
  assert.match(css, /\.mobile-pillar-preview\{/);
  assert.match(css, /\.mobile-pillar-choice-grid\{/);
  for (const element of ['wood','fire','earth','metal','water']) {
    assert.match(css, new RegExp(`data-five-element=\\"${element}\\"`));
  }
  assert.match(css, /body\.mobile-page-paipan \.mobile-submit-dock\{position:static!important/);
  assert.match(css, /\.mobile-birth-summary-row\[hidden\]\{display:none!important\}/);
});

test('calendar and pillar drawers synchronize dedicated mobile controls with the original form fields', () => {
  const source = read('js/mobile-paipan-sheet.js');
  assert.match(source, /function buildCalendarPicker\(mode\)/);
  assert.match(source, /function ensureCalendarDefaults\(mode\)/);
  assert.match(source, /defaultValue\('sYear',1990\)/);
  assert.match(source, /function buildWheel\(target,label,customOptions\)/);
  assert.match(source, /function buildPillarPicker\(activeId\)/);
  assert.match(source, /var stems=\['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'\]/);
  assert.match(source, /target\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
  assert.match(source, /rail\._userScrolling/);
  assert.match(source, /function refreshDependentDay\(target\)/);
  assert.doesNotMatch(source, /maybeRebuildCalendar/);
});

test('completed pillars automatically replace the choice grid with matching birth-time candidates', () => {
  const source = read('js/mobile-paipan-sheet.js');
  const css = read('css/mobile-paipan-sheet.css');
  assert.match(source, /function allPillarFieldsComplete\(\)/);
  assert.match(source, /function requestPillarCandidates\(\)/);
  assert.match(source, /form\.requestSubmit\(\)/);
  assert.match(source, /wrap\.classList\.toggle\('has-candidates',hasCandidates\)/);
  assert.match(source, /wrap\.appendChild\(candidates\)/);
  assert.match(css, /\.mobile-pillar-picker\.has-candidates/);
});

test('direct-pillar matching reopens the sheet so candidate dates remain visible', () => {
  const main = read('js/main.js');
  assert.match(main, /renderPillarCandidates[\s\S]*ZhishiBirthSheet\.open\('time', btn\)/);
});
