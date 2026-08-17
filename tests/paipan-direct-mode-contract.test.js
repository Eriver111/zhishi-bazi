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
    'js/county-longitudes.js?v=county-centroid-v1',
    'js/bazi.js?v=20260817j',
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

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, force) {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
    },
    contains(value) { return values.has(value); },
  };
}

function makeField(required = false) {
  const attributes = new Map(required ? [['required', '']] : []);
  return {
    disabled: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
  };
}

function makeElement(tagName = 'div') {
  const listeners = {};
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    className: '',
    classList: makeClassList(),
    hidden: false,
    innerHTML: '',
    textContent: '',
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, listener) { listeners[type] = listener; },
    click() { if (listeners.click) listeners.click.call(this); },
  };
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

test('switching modes executes panel, tab, required-field, and calendar-control state changes', () => {
  const context = loadMainContext();
  const solarField = makeField(true);
  const lunarField = makeField(true);
  const pillarField = makeField(true);
  const calendarField = makeField();
  const solarPanel = {
    classList: makeClassList(['active']),
    querySelectorAll() { return [solarField]; },
  };
  const lunarPanel = {
    classList: makeClassList(),
    querySelectorAll() { return [lunarField]; },
  };
  const pillarsPanel = {
    classList: makeClassList(),
    querySelectorAll() { return [pillarField]; },
  };
  const tabs = ['solar', 'lunar', 'pillars'].map((mode) => ({
    mode,
    classList: makeClassList(mode === 'solar' ? ['active'] : []),
    getAttribute(name) { return name === 'data-mode' ? mode : null; },
  }));
  const calendarFields = {
    hidden: false,
    querySelectorAll() { return [calendarField]; },
  };
  const panels = { solarPanel, lunarPanel, pillarsPanel };
  context.document = {
    getElementById(id) { return panels[id] || null; },
    querySelector(selector) {
      if (selector === '.mode-panel.active') {
        return [solarPanel, lunarPanel, pillarsPanel].find((panel) => panel.classList.contains('active')) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.mode-tab') return tabs;
      if (selector === '.calendar-only-fields') return [calendarFields];
      return [];
    },
  };

  context.switchMode('pillars');

  assert.equal(pillarsPanel.classList.contains('active'), true);
  assert.equal(solarPanel.classList.contains('active'), false);
  assert.equal(tabs.find((tab) => tab.mode === 'pillars').classList.contains('active'), true);
  assert.equal(solarField.disabled, true);
  assert.equal(solarField.hasAttribute('required'), false);
  assert.equal(pillarField.disabled, false);
  assert.equal(pillarField.hasAttribute('required'), true);
  assert.equal(calendarFields.hidden, true);
  assert.equal(calendarField.disabled, true);

  context.switchMode('lunar');

  assert.equal(lunarPanel.classList.contains('active'), true);
  assert.equal(pillarsPanel.classList.contains('active'), false);
  assert.equal(calendarFields.hidden, false);
  assert.equal(calendarField.disabled, false);
});

test('clicking a rendered candidate executes direct-result navigation without calendar fields', () => {
  const context = loadMainContext();
  const container = makeElement();
  context.location = { href: '' };
  context.document = {
    getElementById(id) { return id === 'pillarCandidates' ? container : null; },
    createElement(tagName) { return makeElement(tagName); },
  };
  const candidate = {
    year: 1996,
    month: 2,
    day: 19,
    hourIndex: 6,
    clock: 12,
    hourName: '午时',
    hourRange: '11:00—12:59',
  };

  context.renderPillarCandidates([candidate], pillars, 'female');
  const candidateButton = container.children.find((child) => child.className === 'pillar-candidate');
  assert.ok(candidateButton);

  candidateButton.click();

  assert.match(context.location.href, /^result\?/);
  const params = new URLSearchParams(context.location.href.slice('result?'.length));
  assert.equal(params.get('mode'), 'pillars');
  assert.equal(params.get('timing'), 'matched');
  assert.equal(params.get('year'), '1996');
  for (const key of ['prov', 'city', 'dist', 'solar', 'zishi']) {
    assert.equal(params.has(key), false, `${key} must not be present`);
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
  assert.match(css, /\.pillar-grid[\s\S]*?\.pillar-column[\s\S]*?\.pillar-control[\s\S]*?\.pillar-candidates/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.pillar-grid[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)[\s\S]*?\.pillar-column select[\s\S]*?min-height:\s*44px/);
});

test('direct-pillar markup preserves four columns and emphasizes the day pillar', () => {
  const html = read('paipan.html');
  assert.match(html, /css\/theme-light-forms\.css\?v=2/, 'page must bust the old two-column form stylesheet cache');
  assert.match(html, /class=["'][^"']*pillar-column[^"']*pillar-day[^"']*["']\s+data-pillar=["']day["']/);
  assert.equal((html.match(/class=["']pillar-control["']/g) || []).length, 8);
  const css = read('css/theme-light-forms.css');
  assert.match(css, /\.pillar-day[\s\S]*?var\(--zh-vermilion\)/);
  assert.match(css, /@media\s*\(max-width:\s*420px\)[\s\S]*?\.pillar-grid[\s\S]*?overflow:\s*visible/);
});

test('calendar-only rows stay visually absent when direct mode sets hidden', () => {
  const css = read('css/theme-light-forms.css');
  assert.match(
    css,
    /\.calendar-only-fields\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
    'an author-level hidden rule must override the legacy .row display rule'
  );
});

test('direct pillar selects meet the 44px target before mobile overrides apply', () => {
  const desktopCss = read('css/theme-light-forms.css').split('@media')[0];
  assert.match(
    desktopCss,
    /\.pillar-column select\s*\{[^}]*min-height:\s*44px/,
    'desktop pillar selects must not depend on a mobile-only minimum height'
  );
});
