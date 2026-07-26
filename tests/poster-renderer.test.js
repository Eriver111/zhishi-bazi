const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'js', 'poster-renderer.js');

function loadRenderer() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.PosterRenderer;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createContext(operations) {
  const context = {
    createLinearGradient() {
      const gradient = {
        addColorStop(offset, color) {
          operations.push({ type: 'gradient-stop', offset, color });
        },
      };
      operations.push({ type: 'gradient' });
      return gradient;
    },
    drawImage() {
      operations.push({ type: 'drawImage', args: Array.from(arguments) });
    },
    fillRect(x, y, width, height) {
      operations.push({ type: 'fillRect', x, y, width, height, fillStyle: this.fillStyle, alpha: this.globalAlpha });
    },
    fillText(text, x, y) {
      operations.push({ type: 'fillText', text, x, y, fillStyle: this.fillStyle, alpha: this.globalAlpha, filter: this.filter });
    },
    save() { operations.push({ type: 'save' }); },
    restore() { operations.push({ type: 'restore' }); },
    textAlign: 'start',
    textBaseline: 'alphabetic',
    font: '',
    fillStyle: '',
    globalAlpha: 1,
    filter: 'none',
  };
  return context;
}

function createCanvas(operations) {
  const context = createContext(operations);
  let width = 0;
  let height = 0;
  return {
    get width() { return width; },
    set width(value) { width = value; operations.push({ type: 'width', value }); },
    get height() { return height; },
    set height(value) { height = value; operations.push({ type: 'height', value }); },
    getContext(kind) {
      operations.push({ type: 'getContext', kind });
      return context;
    },
  };
}

const model = {
  dayGan: '乙',
  dayMasterLabel: '乙木女',
  subtitle: '藤萝之木',
  patternName: '正官格',
  copyLines: ['柔而有守，方能生长。', '循序向上，自有枝叶。'],
  sealText: '知时',
  footer: '知天时，见自己',
};

test('renders the fixed poster after image and font readiness in the required draw order', async () => {
  const renderer = loadRenderer();
  const operations = [];
  const readiness = [];
  const canvas = createCanvas(operations);
  let resolveImage;
  let resolveFonts;
  const imageReady = new Promise((resolve) => { resolveImage = resolve; });
  const fontsReady = new Promise((resolve) => { resolveFonts = resolve; });
  const background = { naturalWidth: 1200, naturalHeight: 1200 };

  const rendering = renderer.render({ canvas, model, backgroundUrl: '/poster.jpg' }, {
    loadImage: async (url) => {
      readiness.push(`image-start:${url}`);
      await imageReady;
      readiness.push('image-ready');
      return background;
    },
    waitForFonts: async () => {
      readiness.push('fonts-start');
      await fontsReady;
      readiness.push('fonts-ready');
    },
  });

  await Promise.resolve();
  assert.deepEqual(operations.slice(0, 2), [{ type: 'width', value: 1080 }, { type: 'height', value: 1920 }]);
  assert.deepEqual(readiness, ['image-start:/poster.jpg', 'fonts-start']);
  assert.equal(operations.some((operation) => operation.type === 'drawImage'), false);

  resolveFonts();
  await Promise.resolve();
  assert.equal(operations.some((operation) => operation.type === 'drawImage'), false, 'background still gates drawing');
  resolveImage();

  assert.deepEqual(plain(await rendering), { ok: true });
  assert.deepEqual(readiness, ['image-start:/poster.jpg', 'fonts-start', 'fonts-ready', 'image-ready']);

  const drawImageIndex = operations.findIndex((operation) => operation.type === 'drawImage');
  const firstTextIndex = operations.findIndex((operation) => operation.type === 'fillText');
  assert.ok(drawImageIndex >= 0);
  assert.ok(firstTextIndex > drawImageIndex, 'background precedes text');
  assert.deepEqual(operations[drawImageIndex].args.slice(1), [262.5, 0, 675, 1200, 0, 0, 1080, 1920], 'cover crop fills the fixed canvas');

  const text = operations.filter((operation) => operation.type === 'fillText');
  assert.deepEqual(text.map((operation) => operation.text), [
    '乙', '乙', '乙木女', '藤萝之木', '知时', '正官格', '柔而有守，方能生长。', '循序向上，自有枝叶。', '知天时，见自己',
  ]);
  assert.equal(text[0].alpha < 1, true, 'first glyph is the ink-bleed duplicate');
  assert.match(text[0].filter, /blur/);
  assert.equal(text[1].alpha, 1, 'main glyph is opaque');
  assert.equal(text.some((operation) => /知时命格|·/.test(operation.text)), false);

  const solidSeals = operations.filter((operation) => operation.type === 'fillRect' && operation.fillStyle === '#b6382e');
  assert.equal(solidSeals.length, 2, 'top and pattern seals are solid cinnabar blocks');
  assert.equal(solidSeals.every((operation) => operation.alpha === 1), true);
  assert.equal(operations.some((operation) => operation.type === 'gradient'), true, 'copy sits over a controlled gradient');
});

test('returns typed readiness failures without drawing', async () => {
  const renderer = loadRenderer();
  const cases = [
    {
      name: 'background',
      dependencies: { loadImage: async () => { throw new Error('missing'); }, waitForFonts: async () => {} },
      expected: 'BACKGROUND_LOAD_FAILED',
    },
    {
      name: 'fonts',
      dependencies: { loadImage: async () => ({ width: 1080, height: 1920 }), waitForFonts: async () => { throw new Error('not ready'); } },
      expected: 'FONT_LOAD_FAILED',
    },
  ];

  for (const scenario of cases) {
    const operations = [];
    const canvas = createCanvas(operations);
    const result = await renderer.render({ canvas, model, backgroundUrl: '/poster.jpg' }, scenario.dependencies);
    assert.deepEqual(plain(result), { ok: false, error: scenario.expected }, scenario.name);
    assert.equal(operations.some((operation) => operation.type === 'drawImage' || operation.type === 'fillText'), false, scenario.name);
  }
});

test('exports WebP first and falls back to JPEG while cleaning temporary download resources', async () => {
  const renderer = loadRenderer();
  const calls = [];
  const removed = [];
  const anchor = {
    click() { calls.push('click'); },
    remove() { removed.push('anchor'); },
  };
  const document = {
    body: { appendChild(node) { calls.push(['append', node]); } },
    createElement(name) { calls.push(['create', name]); return anchor; },
  };
  const URL = {
    createObjectURL(blob) { calls.push(['create-url', blob]); return 'blob:poster'; },
    revokeObjectURL(url) { calls.push(['revoke-url', url]); },
  };
  const jpegBlob = { type: 'image/jpeg' };
  const canvas = {
    toBlob(callback, type, quality) {
      calls.push(['toBlob', type, quality]);
      callback(type === 'image/webp' ? null : jpegBlob);
    },
  };

  const result = await renderer.download({ canvas, model }, { document, URL });

  assert.deepEqual(plain(result), { ok: true });
  assert.deepEqual(calls.filter((call) => Array.isArray(call) && call[0] === 'toBlob'), [
    ['toBlob', 'image/webp', 0.92],
    ['toBlob', 'image/jpeg', 0.94],
  ]);
  assert.equal(anchor.download, '知时-乙木女-正官格.webp');
  assert.equal(anchor.href, 'blob:poster');
  assert.deepEqual(removed, ['anchor']);
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === 'revoke-url'), true);
});

test('returns EXPORT_FAILED when neither export format produces a blob', async () => {
  const renderer = loadRenderer();
  const canvas = {
    toBlob(callback) { callback(null); },
  };
  const result = await renderer.download({ canvas, model }, {
    document: { createElement() { throw new Error('should not create an anchor'); } },
    URL: {},
  });
  assert.deepEqual(plain(result), { ok: false, error: 'EXPORT_FAILED' });
});
