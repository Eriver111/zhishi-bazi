const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

class FakeElement {
  constructor(id, document) {
    this.id = id;
    this.ownerDocument = document;
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
    };
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    const payload = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() {},
      ...event,
    };
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

function createDocument() {
  const document = {
    elements: new Map(),
    listeners: new Map(),
    activeElement: null,
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of this.listeners.get(type) || []) listener({ type, ...event });
    },
    getElementById(id) {
      return this.elements.get(id) || null;
    },
  };
  document.body = new FakeElement('body', document);
  document.body.style.overflow = 'clip';
  document.documentElement = new FakeElement('html', document);
  for (const id of [
    'posterButton', 'posterModal', 'posterCanvas', 'posterStatus',
    'posterDownload', 'posterRetry', 'posterClose',
  ]) {
    document.elements.set(id, new FakeElement(id, document));
  }
  document.getElementById('posterModal').hidden = true;
  document.getElementById('posterCanvas').hidden = true;
  document.getElementById('posterDownload').hidden = true;
  document.getElementById('posterRetry').hidden = true;
  return document;
}

function response(body) {
  return {
    ok: true,
    async json() {
      return body;
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function loadUI(overrides = {}) {
  const document = createDocument();
  const calls = { resolve: [], fetch: [], render: [], download: [] };
  const model = {
    dayGan: '乙',
    dayMasterLabel: '乙木女',
    subtitle: '藤萝之木',
    patternName: '正官格',
    copyLines: ['第一句', '第二句'],
    backgroundKey: 'yi-female',
    sealText: '知时',
    footer: '知天时，见自己',
  };
  const window = {
    document,
    BaZiPosterTemplates: {
      resolve(input) {
        calls.resolve.push(input);
        return model;
      },
    },
    PosterRenderer: {
      async render(input) {
        calls.render.push(input);
        return { ok: true };
      },
      async download(input) {
        calls.download.push(input);
        return { ok: true };
      },
    },
    async fetch(url) {
      calls.fetch.push(url);
      return response({
        entries: [{
          key: 'yi-female',
          dayGan: '乙',
          gender: 'female',
          src: '/images/posters/yi-female-v1.webp',
          width: 1080,
          height: 1920,
          version: 1,
          alt: '乙木女命海报背景',
        }],
      });
    },
    ...overrides,
  };
  window.window = window;
  vm.runInNewContext(read('js/poster-ui.js'), {
    window,
    Promise,
    setTimeout,
    clearTimeout,
  });
  return { ui: window.PosterUI, window, document, calls, model };
}

test('result page adds one isolated poster entry and dialog without changing the report structure', () => {
  const html = read('result.html');
  const countId = (id) => (html.match(new RegExp(`\\bid=["']${id}["']`, 'g')) || []).length;

  for (const id of [
    'posterButton', 'posterModal', 'posterCanvas', 'posterDownload',
    'posterRetry', 'posterClose',
  ]) {
    assert.equal(countId(id), 1, `result page must contain exactly one #${id}`);
  }
  assert.match(html, /<button\b[^>]*class=["'][^"']*\bshare-btn\b[^"']*["'][^>]*>[\s\S]*?分享报告[\s\S]*?<\/button>/);
  assert.ok(
    html.indexOf('id="posterButton"') > html.indexOf('class="share-btn"')
      && html.indexOf('id="posterButton"') < html.indexOf('</header>'),
    'poster action must remain next to the existing share action',
  );
  assert.match(html, /id="posterModal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  for (const id of [
    'liunianSection', 'proSection', 'characterSection', 'parentsSection',
    'thisYearSection', 'marriageSection', 'wealthSection', 'studySection',
    'fortuneSection',
  ]) {
    assert.equal(countId(id), 1, `existing result section #${id} must be preserved`);
  }
  assert.doesNotMatch(`${html}\n${read('js/poster-ui.js')}`, /换一句/u);
});

test('result page loads poster dependencies in order before existing result integrations', () => {
  const html = read('result.html');
  const orderedScripts = [
    'js/poster-templates.js',
    'js/poster-renderer.js',
    'js/poster-ui.js',
    'js/result.js',
    'js/pro-analysis.js',
    'js/ai-chat-integration.js',
  ];
  let previous = -1;
  for (const script of orderedScripts) {
    const current = html.indexOf(script);
    assert.ok(current > previous, `${script} must exist after the preceding dependency`);
    previous = current;
  }
  assert.match(html, /href=["']css\/poster\.css["']/);
});

test('result render configures the poster from the assigned bazi, gender, and computed pattern', () => {
  const source = read('js/result.js');
  assert.match(
    source,
    /if\s*\(\s*window\.PosterUI\s*&&\s*window\.BaZiCalculator\.getPattern\s*\)\s*\{[\s\S]*?window\.PosterUI\.configure\s*\(\s*\{[\s\S]*?bazi\s*:\s*_bazi\s*,[\s\S]*?gender\s*:\s*_params\.gender\s*,[\s\S]*?pattern\s*:\s*window\.BaZiCalculator\.getPattern\s*\(\s*_bazi\s*\)[\s\S]*?\}\s*\)\s*;/,
  );
});

test('configure resolves and stores the model without fetching, loading, or rendering', () => {
  const { ui, calls } = loadUI();
  const input = { bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' };

  ui.configure(input);

  assert.deepEqual(calls.resolve, [input]);
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.render.length, 0);
});

test('open lazily resolves only the selected background and renders it once', async () => {
  const { ui, document, calls, model } = loadUI();
  const opener = document.getElementById('posterButton');
  opener.focus();
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });

  const opened = ui.open();
  assert.equal(document.getElementById('posterModal').hidden, false);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(document.activeElement, document.getElementById('posterClose'));
  await opened;

  assert.deepEqual(calls.fetch, ['/images/posters/manifest.json']);
  assert.equal(calls.render.length, 1);
  assert.equal(calls.render[0].canvas, document.getElementById('posterCanvas'));
  assert.equal(calls.render[0].model, model);
  assert.equal(calls.render[0].backgroundUrl, '/images/posters/yi-female-v1.webp');
  assert.equal(document.getElementById('posterCanvas').hidden, false);
  assert.equal(document.getElementById('posterDownload').hidden, false);
  assert.equal(document.getElementById('posterRetry').hidden, true);
});

test('successful render hides the status so the canvas is the only visible preview item', async () => {
  const { ui, document } = loadUI();
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });

  await ui.open();

  assert.equal(document.getElementById('posterCanvas').hidden, false);
  assert.equal(document.getElementById('posterStatus').hidden, true);
  assert.equal(document.getElementById('posterDownload').hidden, false);
});

test('typed render failure shows retry and retry can recover without closing the result page', async () => {
  let attempts = 0;
  const { ui, document, calls } = loadUI({
    PosterRenderer: {
      async render(input) {
        calls.render.push(input);
        attempts += 1;
        return attempts === 1
          ? { ok: false, error: 'BACKGROUND_LOAD_FAILED' }
          : { ok: true };
      },
      async download(input) {
        calls.download.push(input);
        return { ok: true };
      },
    },
  });
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });

  await ui.open();
  assert.equal(document.getElementById('posterStatus').dataset.error, 'BACKGROUND_LOAD_FAILED');
  assert.equal(document.getElementById('posterRetry').hidden, false);
  assert.equal(document.getElementById('posterModal').hidden, false);

  document.getElementById('posterRetry').dispatch('click');
  await settle();
  assert.equal(calls.render.length, 2);
  assert.equal(document.getElementById('posterCanvas').hidden, false);
  assert.equal(document.getElementById('posterRetry').hidden, true);
});

test('close and Escape restore focus and the previous body scroll state', async () => {
  const { ui, document } = loadUI();
  const opener = document.getElementById('posterButton');
  opener.focus();
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });
  await ui.open();

  document.getElementById('posterClose').dispatch('click');
  assert.equal(document.getElementById('posterModal').hidden, true);
  assert.equal(document.body.style.overflow, 'clip');
  assert.equal(document.activeElement, opener);

  opener.focus();
  await ui.open();
  document.dispatch('keydown', { key: 'Escape' });
  assert.equal(document.getElementById('posterModal').hidden, true);
  assert.equal(document.body.style.overflow, 'clip');
  assert.equal(document.activeElement, opener);
});

test('repeated open reuses one in-flight render and never duplicates listeners', async () => {
  const rendering = deferred();
  let renderCalls = 0;
  const { ui, document } = loadUI({
    PosterRenderer: {
      render() {
        renderCalls += 1;
        return rendering.promise;
      },
      async download() {
        return { ok: true };
      },
    },
  });
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });

  const first = ui.open();
  const listenerCounts = {
    close: document.getElementById('posterClose').listeners.get('click').length,
    retry: document.getElementById('posterRetry').listeners.get('click').length,
    download: document.getElementById('posterDownload').listeners.get('click').length,
    escape: document.listeners.get('keydown').length,
  };
  const second = ui.open();
  assert.equal(renderCalls, 0, 'manifest resolution remains asynchronous');
  await settle();
  assert.equal(renderCalls, 1);
  assert.deepEqual({
    close: document.getElementById('posterClose').listeners.get('click').length,
    retry: document.getElementById('posterRetry').listeners.get('click').length,
    download: document.getElementById('posterDownload').listeners.get('click').length,
    escape: document.listeners.get('keydown').length,
  }, listenerCounts);

  rendering.resolve({ ok: true });
  await Promise.all([first, second]);
  await ui.open();
  assert.equal(renderCalls, 1, 'a completed preview is reused on later opens');
});

test('reconfiguration during an in-flight render serializes the new selected render', async () => {
  const firstRender = deferred();
  const renderInputs = [];
  let resolveCount = 0;
  const models = [
    {
      dayGan: '乙', backgroundKey: 'yi-female', copyLines: ['甲', '乙'],
      dayMasterLabel: '乙木女', subtitle: '藤萝之木', patternName: '正官格',
    },
    {
      dayGan: '甲', backgroundKey: 'jia-male', copyLines: ['丙', '丁'],
      dayMasterLabel: '甲木男', subtitle: '参天之木', patternName: '正财格',
    },
  ];
  const { ui } = loadUI({
    BaZiPosterTemplates: {
      resolve() {
        const resolved = models[Math.min(resolveCount, models.length - 1)];
        resolveCount += 1;
        return resolved;
      },
    },
    async fetch() {
      return response({
        entries: [
          { key: 'yi-female', dayGan: '乙', gender: 'female', src: '/yi.webp' },
          { key: 'jia-male', dayGan: '甲', gender: 'male', src: '/jia.webp' },
        ],
      });
    },
    PosterRenderer: {
      render(input) {
        renderInputs.push(input);
        return renderInputs.length === 1 ? firstRender.promise : Promise.resolve({ ok: true });
      },
      async download() {
        return { ok: true };
      },
    },
  });
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });
  const oldOpen = ui.open();
  await settle();
  assert.equal(renderInputs.length, 1);

  ui.configure({ bazi: { day: { gan: '甲' } }, gender: 'male', pattern: '正财格' });
  const newOpen = ui.open();
  await settle();
  assert.equal(renderInputs.length, 1, 'a reconfiguration must not start a concurrent canvas render');

  firstRender.resolve({ ok: true });
  await Promise.all([oldOpen, newOpen]);
  assert.equal(renderInputs.length, 2);
  assert.equal(renderInputs[0].backgroundUrl, '/yi.webp');
  assert.equal(renderInputs[1].backgroundUrl, '/jia.webp');
  assert.equal(renderInputs[1].model, models[1]);
});

test('typed download failure keeps the modal open and preserves retry/close controls', async () => {
  const { ui, document, calls } = loadUI({
    PosterRenderer: {
      async render(input) {
        calls.render.push(input);
        return { ok: true };
      },
      async download(input) {
        calls.download.push(input);
        return { ok: false, error: 'EXPORT_FAILED' };
      },
    },
  });
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });
  await ui.open();

  document.getElementById('posterDownload').dispatch('click');
  await settle();

  assert.equal(calls.download.length, 1);
  assert.equal(document.getElementById('posterStatus').dataset.error, 'EXPORT_FAILED');
  assert.equal(document.getElementById('posterModal').hidden, false);
  assert.equal(document.getElementById('posterCanvas').hidden, false);
  assert.equal(document.getElementById('posterRetry').hidden, false);
  assert.equal(document.getElementById('posterClose').hidden, false);
});

test('synchronous download exceptions become typed failures and restore the download control', async () => {
  const { ui, document } = loadUI({
    PosterRenderer: {
      async render() {
        return { ok: true };
      },
      download() {
        throw new Error('synchronous export failure');
      },
    },
  });
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });
  await ui.open();

  assert.doesNotThrow(() => document.getElementById('posterDownload').dispatch('click'));
  await settle();
  assert.equal(document.getElementById('posterStatus').dataset.error, 'EXPORT_FAILED');
  assert.equal(document.getElementById('posterDownload').disabled, false);
  assert.equal(document.getElementById('posterModal').hidden, false);
});

test('Tab and Shift+Tab keep keyboard focus within the open modal controls', async () => {
  const { ui, document } = loadUI();
  ui.configure({ bazi: { day: { gan: '乙' } }, gender: 'female', pattern: '正官格' });
  await ui.open();
  const close = document.getElementById('posterClose');
  const download = document.getElementById('posterDownload');

  close.focus();
  document.dispatch('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(document.activeElement, download);
  document.dispatch('keydown', { key: 'Tab', preventDefault() {} });
  assert.equal(document.activeElement, close);
  document.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(document.activeElement, download);
});

test('poster controls remain touch-sized and the preview is capped to the viewport', () => {
  const css = read('css/poster.css');
  assert.match(css, /#posterCanvas\s*\{[^}]*max-width:\s*100%[^}]*max-height:\s*(?:calc\()?[^;}]*v[wh]/s);
  assert.match(css, /@media\s*\(\s*max-width:\s*390px\s*\)[\s\S]*?(?:#posterDownload|\.poster-action)[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media\s*\(\s*max-width:\s*390px\s*\)[\s\S]*?\.poster-entry[\s\S]*?min-height:\s*44px/);
});
