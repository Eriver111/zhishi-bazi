const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('paipan exposes a direct-pillar mode without location controls inside it', () => {
  const html = read('paipan.html');
  assert.match(html, /data-mode=["']pillars["']/);
  assert.match(html, /id=["']pillarsPanel["']/);
  for (const id of [
    'pYearGan', 'pYearZhi', 'pMonthGan', 'pMonthZhi',
    'pDayGan', 'pDayZhi', 'pHourGan', 'pHourZhi',
    'pillarCandidates',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  assert.ok(html.includes('js/bazi.js'));
  assert.ok(html.includes('js/pillar-input.js'));
  assert.ok(html.includes('js/pillar-reverse-lookup.js'));
});

test('direct-pillar dependencies load in calculation order before main', () => {
  const html = read('paipan.html');
  const scripts = [
    'js/lunar.js',
    'js/bazi.js',
    'js/pillar-input.js',
    'js/pillar-reverse-lookup.js',
    'js/region.js',
    'js/main.js',
  ];
  let previous = -1;
  for (const script of scripts) {
    const current = html.indexOf(`src="${script}"`);
    assert.ok(current > previous, `${script} must load after the preceding dependency`);
    previous = current;
  }
});

test('direct-pillar mode scopes calendar corrections and maps all three panels', () => {
  const html = read('paipan.html');
  const source = read('js/main.js');
  assert.match(html, /class=["'][^"']*calendar-only-fields[^"']*["'][\s\S]*?id=["']zishiHuanri["']/);
  assert.match(html, /class=["'][^"']*calendar-only-fields[^"']*["'][\s\S]*?id=["']province["']/);
  assert.match(source, /panelIds\s*=\s*\{\s*solar:\s*['"]solarPanel['"],\s*lunar:\s*['"]lunarPanel['"],\s*pillars:\s*['"]pillarsPanel['"]\s*\}/);
  assert.match(source, /el\.hidden\s*=\s*mode\s*===\s*['"]pillars['"]/);
});

function loadMainContext() {
  const context = {
    URLSearchParams,
    console,
    document: { addEventListener() {} },
    localStorage: { setItem() {} },
    setTimeout() {},
    alert() {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('js/pillar-input.js'), context);
  vm.runInContext(read('js/main.js'), context);
  return context;
}

const pillars = {
  year: { gan: '甲', zhi: '子' },
  month: { gan: '丙', zhi: '寅' },
  day: { gan: '戊', zhi: '辰' },
  hour: { gan: '庚', zhi: '午' },
};

test('matched candidates serialize pillars plus the selected candidate timing', () => {
  const context = loadMainContext();
  const params = context.buildDirectResultParams(pillars, 'female', {
    year: 1996,
    month: 2,
    day: 19,
    hourIndex: 6,
    clock: 12,
  });
  assert.equal(
    params.toString(),
    'yg=%E7%94%B2&yz=%E5%AD%90&mg=%E4%B8%99&mz=%E5%AF%85&dg=%E6%88%8A&dz=%E8%BE%B0&hg=%E5%BA%9A&hz=%E5%8D%88&mode=pillars&timing=matched&gender=female&year=1996&month=2&day=19&hour=6&clock=12'
  );
});

test('base-chart continuation keeps pillars and omits every fabricated date field', () => {
  const context = loadMainContext();
  const params = context.buildDirectResultParams(pillars, 'male');
  assert.equal(params.get('mode'), 'pillars');
  assert.equal(params.get('timing'), 'unknown');
  assert.equal(params.get('gender'), 'male');
  for (const key of ['year', 'month', 'day', 'hour', 'clock']) {
    assert.equal(params.has(key), false, `${key} must be omitted without a match`);
  }
});

test('an invalid resubmission dismisses a stale candidate chooser', () => {
  const context = loadMainContext();
  const candidate = { hidden: false, innerHTML: '<button>stale</button>' };
  const fields = {
    pYearGan: { value: '' }, pYearZhi: { value: '' },
    pMonthGan: { value: '' }, pMonthZhi: { value: '' },
    pDayGan: { value: '' }, pDayZhi: { value: '' },
    pHourGan: { value: '' }, pHourZhi: { value: '' },
    pillarCandidates: candidate,
  };
  context.document = {
    getElementById(id) { return fields[id] || null; },
    querySelector() { return null; },
  };
  const button = { classList: { remove() {} }, textContent: '' };

  context.handleDirectSubmit('male', button);

  assert.equal(candidate.hidden, true);
  assert.equal(candidate.innerHTML, '');
});

test('candidate chooser and pillar controls keep responsive touch targets', () => {
  const css = read('css/theme-light-forms.css');
  assert.match(css, /\.pillar-grid[\s\S]*?\.pillar-column[\s\S]*?\.pillar-candidates/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.pillar-grid[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)[\s\S]*?\.pillar-column select[\s\S]*?min-height:\s*44px/);
});
