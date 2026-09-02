const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bazi input retains every calculation control and script', () => {
  const html = read('paipan.html');
  const main = read('js/main.js');
  for (const id of ['sYear','sMonth','sDay','sHour','sMinute','zishiHuanri','solarEnabled','province','city','district']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  for (const script of ['js/lunar.js','js/region.js','js/county-longitudes.js','js/main.js']) assert.ok(html.includes(script));
  assert.ok(html.indexOf('js/county-longitudes.js') < html.indexOf('js/bazi.js'));
  assert.match(html, /name=["']gender["']/);
  const ziHourInput = html.match(/<input[^>]+id=["']zishiHuanri["'][^>]*>/)?.[0] || '';
  assert.match(ziHourInput, /\bchecked\b/, 'Zi-hour rollover must default on');
  assert.match(main, /ziHourRollover\.checked\s*=\s*true/, 'script must override stale browser-restored Zi-hour state');
  assert.match(main, /addEventListener\('pageshow'/, 'back-forward restoration must clear the loading state');
  assert.match(main, /resetSubmitButton\(document\.querySelector\('\.submit'\)\)/);
});

test('Hepan gives both people the same default Zi-hour rollover rule as personal charts', () => {
  const html = read('hepan.html');
  for (const id of ['zishiHuanri-p1', 'zishiHuanri-p2']) {
    const input = html.match(new RegExp(`<input[^>]+id=["']${id}["'][^>]*>`))?.[0] || '';
    assert.match(input, /\bchecked\b/, `${id} must default on`);
  }
});

test('mobile birth forms keep advanced settings available while shortening the main flow', () => {
  const paipan = read('paipan.html');
  const hepan = read('hepan.html');
  const css = read('css/input-flow.css');
  const flow = read('js/input-flow.js');

  assert.match(paipan, /<details class="birth-advanced calendar-only-fields">/);
  assert.match(hepan, /data-archive-pick="p1"/);
  assert.match(hepan, /data-archive-pick="p2"/);
  assert.equal((hepan.match(/<details class="birth-advanced">/g) || []).length, 2);
  assert.match(css, /\.mobile-submit-dock\{position:fixed/);
  assert.match(flow, /真太阳时/);
  assert.match(paipan, /js\/input-flow\.js\?v=7/);
  assert.match(hepan, /js\/hepan-archive-picker\.js\?v=1/);
});

test('Hepan mobile flow presents one person at a time with persistent completion summaries', () => {
  const html = read('hepan.html');
  const flow = read('js/input-flow.js');
  const css = read('css/input-flow.css');

  assert.match(html, /data-person-toggle="p1"/);
  assert.match(html, /data-person-toggle="p2"/);
  assert.match(html, /data-person-next="p2"/);
  assert.match(html, /data-person-next="p1"/);
  assert.doesNotMatch(html, /id="name-p2"[\s\S]{0,180}<\/details>/);
  assert.match(flow, /setPersonOpen\('p2',false,false\)/);
  assert.match(flow, /refreshPersonProgress\('p1'\)/);
  assert.match(flow, /modeP1==='lunar'/);
  assert.match(css, /\.person-section\.is-collapsed/);
  assert.match(css, /\.person-step-action\{display:block/);
});

test('third-generation personal input groups date, identity and location without changing field ids', () => {
  const html = read('paipan.html');
  const css = read('css/input-flow.css');

  assert.match(html, /class="[^"]*birth-flow-panel[^"]*" id="solarPanel"/);
  assert.match(html, /class="[^"]*birth-flow-panel[^"]*" id="lunarPanel"/);
  assert.match(html, /class="[^"]*birth-flow-panel[^"]*" id="pillarsPanel"/);
  assert.match(html, /class="birth-basic-panel"/);
  assert.match(html, /class="birth-location-fields calendar-only-fields"/);
  assert.match(html, /出生日期与时间/);
  assert.match(html, /用于真太阳时校正/);
  for (const id of ['province','city','district']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(css, /#birthForm \.birth-flow-panel\.active/);
  assert.match(html, /css\/input-flow\.css\?v=7/);
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
    const sharedTheme = html.search(/css\/theme-light\.css\?v=\d+/);
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
