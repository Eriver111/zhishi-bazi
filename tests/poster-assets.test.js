const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const postersDir = path.join(root, 'images', 'posters');
const manifestPath = path.join(postersDir, 'manifest.json');
const posterUiPath = path.join(root, 'js', 'poster-ui.js');
const dayMasters = ['\u7532', '\u4e59', '\u4e19', '\u4e01', '\u620a', '\u5df1', '\u5e9a', '\u8f9b', '\u58ec', '\u7678'];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function decodeWebP(file) {
  const info = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=codec_name,width,height', '-of', 'json', file,
  ], { encoding: 'utf8' }));
  return info.streams && info.streams[0];
}

function localPath(reference, fromFile) {
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || /^(?:[a-z]+:|\/\/)/i.test(clean)) return null;
  const resolved = path.resolve(path.dirname(fromFile), clean);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

function homepageResources() {
  const queue = [path.join(root, 'index.html')];
  const seen = new Set();
  const resources = [];

  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    resources.push({ file, source });
    const references = [
      ...source.matchAll(/<(?:link|script)\b[^>]+(?:href|src)=["']([^"']+)["']/gi),
      ...source.matchAll(/@import\s+(?:url\()?\s*["']?([^"'\s)]+)["']?\s*\)?/gi),
      ...source.matchAll(/\bimport\s*(?:[^'"()]+?\s+from\s*)?["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ];
    for (const match of references) {
      const dependency = localPath(match[1], file);
      if (dependency && fs.existsSync(dependency) && fs.statSync(dependency).isFile()) queue.push(dependency);
    }
  }
  return resources;
}

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
    this.classList = { add() {}, remove() {} };
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, preventDefault() {} });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

function createDocument() {
  const document = {
    elements: new Map(), listeners: new Map(), activeElement: null,
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    getElementById(id) { return this.elements.get(id) || null; },
  };
  document.body = new FakeElement('body', document);
  for (const id of ['posterButton', 'posterModal', 'posterCanvas', 'posterStatus', 'posterDownload', 'posterRetry', 'posterClose']) {
    document.elements.set(id, new FakeElement(id, document));
  }
  document.getElementById('posterModal').hidden = true;
  document.getElementById('posterCanvas').hidden = true;
  document.getElementById('posterDownload').hidden = true;
  document.getElementById('posterRetry').hidden = true;
  return document;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function response(entries) {
  return { ok: true, json: async () => ({ entries }) };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function loadUI(overrides = {}) {
  const document = createDocument();
  const entries = overrides.entries || JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const models = overrides.models || [
    { dayGan: '\u4e59', backgroundKey: 'yi-female', copyLines: ['a', 'b'] },
    { dayGan: '\u7532', backgroundKey: 'jia-male', copyLines: ['c', 'd'] },
  ];
  let modelIndex = 0;
  const calls = { fetch: [], render: [] };
  const window = {
    document,
    BaZiPosterTemplates: {
      resolve() { return models[Math.min(modelIndex++, models.length - 1)]; },
    },
    PosterRenderer: {
      async render(input) { calls.render.push(input); return { ok: true }; },
      async download() { return { ok: true }; },
    },
    async fetch(url) {
      calls.fetch.push(url);
      return response(entries);
    },
    ...overrides,
  };
  window.window = window;
  vm.runInNewContext(fs.readFileSync(posterUiPath, 'utf8'), { window, Promise, setTimeout, clearTimeout });
  return { ui: window.PosterUI, document, calls };
}

test('poster manifest provides one safe local asset for each day-master and gender', () => {
  const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedKeys = new Set(dayMasters.flatMap((dayGan) => [`${dayGan}:male`, `${dayGan}:female`]));
  const entryKeys = entries.map((entry) => `${entry.dayGan}:${entry.gender}`);
  const sources = new Set();

  assert.equal(entries.length, 20);
  assert.equal(new Set(entryKeys).size, 20);
  assert.deepEqual(new Set(entryKeys), expectedKeys);
  for (const entry of entries) {
    assert.match(entry.src, /^\/images\/posters\/[^/?#]+\.webp$/);
    assert.equal(entry.src.includes('..'), false);
    assert.equal(sources.has(entry.src), false, `duplicate image ${entry.src}`);
    sources.add(entry.src);
    assert.equal(typeof entry.alt, 'string');
    assert.ok(entry.alt.trim());
    assert.equal(typeof entry.version, 'string');
    assert.ok(entry.version.trim());

    const file = path.join(root, entry.src.slice(1));
    assert.ok(fs.existsSync(file), `missing ${entry.src}`);
    const size = fs.statSync(file).size;
    assert.ok(size > 0, `${entry.src} is empty`);
    assert.ok(size < 900 * 1024, `${entry.src} exceeds 900 KiB`);
    const decoded = decodeWebP(file);
    assert.equal(decoded.codec_name, 'webp');
    assert.equal(decoded.width, 1080);
    assert.equal(decoded.height, 1920);
    assert.equal(entry.width, decoded.width);
    assert.equal(entry.height, decoded.height);
  }
  const nonWebpSources = fs.readdirSync(postersDir).filter((file) => /\.(?:png|jpe?g)$/i.test(file));
  assert.deepEqual(nonWebpSources, []);
});

test('homepage dependency graph excludes poster implementation and assets', () => {
  const forbidden = /\/images\/posters\/|poster-(?:ui|renderer|templates)\.js/i;
  const resources = homepageResources();

  assert.ok(resources.length > 1, 'expected homepage to load local CSS or JavaScript');
  for (const resource of resources) {
    assert.doesNotMatch(resource.source, forbidden, path.relative(root, resource.file));
  }
});

test('configuration defers every poster resource until the first open, then renders only the selected background once', async () => {
  const { ui, calls } = loadUI();
  ui.configure({ bazi: { day: { gan: '\u4e59' } }, gender: 'female' });
  assert.deepEqual(calls, { fetch: [], render: [] });

  await ui.open();
  assert.deepEqual(calls.fetch, ['/images/posters/manifest.json']);
  assert.equal(calls.render.length, 1);
  assert.equal(calls.render[0].backgroundUrl, '/images/posters/yi-female-v1.webp');
  await ui.open();
  assert.equal(calls.render.length, 1, 'a completed canvas must be reused');
});

test('a new configuration serializes a fresh selected render so a stale render cannot win', async () => {
  const first = deferred();
  const renderInputs = [];
  const { ui, calls } = loadUI({
    PosterRenderer: {
      render(input) {
        renderInputs.push(input);
        return renderInputs.length === 1 ? first.promise : Promise.resolve({ ok: true });
      },
      async download() { return { ok: true }; },
    },
  });
  ui.configure({ bazi: { day: { gan: '\u4e59' } }, gender: 'female' });
  const oldOpen = ui.open();
  await settle();
  ui.configure({ bazi: { day: { gan: '\u7532' } }, gender: 'male' });
  const newOpen = ui.open();
  first.resolve({ ok: true });
  await Promise.all([oldOpen, newOpen]);

  assert.deepEqual(calls.fetch, ['/images/posters/manifest.json']);
  assert.deepEqual(renderInputs.map((input) => input.backgroundUrl), [
    '/images/posters/yi-female-v1.webp', '/images/posters/jia-male-v1.webp',
  ]);
});

test('a missing or malformed selected entry is a typed retry failure without rendering or leaving the result page', async () => {
  for (const entry of [
    { key: 'yi-female', dayGan: '\u4e59', gender: 'female' },
    { key: 'yi-female', dayGan: '\u4e59', gender: 'female', src: 42 },
  ]) {
    const { ui, document, calls } = loadUI({
      async fetch(url) {
        calls.fetch.push(url);
        return response([entry]);
      },
    });
    ui.configure({ bazi: { day: { gan: '\u4e59' } }, gender: 'female' });
    const result = await ui.open();

    assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: false, error: 'MANIFEST_ENTRY_MISSING' });
    assert.equal(calls.render.length, 0);
    assert.equal(document.getElementById('posterStatus').dataset.error, 'MANIFEST_ENTRY_MISSING');
    assert.equal(document.getElementById('posterRetry').hidden, false);
    assert.equal(document.getElementById('posterModal').hidden, false);
  }
});
