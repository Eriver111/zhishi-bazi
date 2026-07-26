const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
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

function decodeWebP(input) {
  const bytes = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  let offset = 12;
  let extendedSize = null;
  let imageSize = null;

  if (
    bytes.length < 12
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Invalid WebP RIFF signature');
  }
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) {
    throw new Error('WebP RIFF size is outside container bounds');
  }

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated WebP chunk header');
    const type = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    const nextOffset = dataEnd + (chunkSize % 2);
    if (dataEnd > bytes.length || nextOffset > bytes.length) {
      throw new Error(`Truncated WebP ${type} chunk outside container bounds`);
    }
    if (chunkSize % 2 && bytes[dataEnd] !== 0) {
      throw new Error(`Invalid WebP ${type} chunk padding`);
    }

    if (type === 'VP8X') {
      if (chunkSize !== 10) throw new Error('Invalid WebP VP8X chunk size');
      if (extendedSize) throw new Error('WebP contains multiple VP8X headers');
      if (offset !== 12) throw new Error('WebP VP8X header must be the first chunk');
      if (
        (bytes[dataStart] & 0xc1)
        || bytes[dataStart + 1]
        || bytes[dataStart + 2]
        || bytes[dataStart + 3]
      ) {
        throw new Error('Invalid WebP VP8X reserved bits');
      }
      if (bytes[dataStart] & 0x02) {
        throw new Error('Animated WebP is not supported for poster assets');
      }
      extendedSize = {
        width: bytes.readUIntLE(dataStart + 4, 3) + 1,
        height: bytes.readUIntLE(dataStart + 7, 3) + 1,
      };
      if (extendedSize.width * extendedSize.height > 0xffffffff) {
        throw new Error('Invalid WebP VP8X canvas dimensions: canvas area exceeds 32 bits');
      }
    } else if (type === 'VP8 ') {
      if (imageSize) throw new Error('WebP contains multiple image payloads');
      if (
        chunkSize < 10
        || (bytes[dataStart] & 1) !== 0
        || bytes[dataStart + 3] !== 0x9d
        || bytes[dataStart + 4] !== 0x01
        || bytes[dataStart + 5] !== 0x2a
      ) {
        throw new Error('Invalid WebP VP8 key-frame header');
      }
      const frameTag = bytes.readUIntLE(dataStart, 3);
      if (((frameTag >>> 1) & 0x07) > 3) {
        throw new Error('Unsupported WebP VP8 version');
      }
      const firstPartitionSize = frameTag >>> 5;
      if (!firstPartitionSize || firstPartitionSize + 10 >= chunkSize) {
        throw new Error('Truncated WebP VP8 first partition');
      }
      const width = bytes.readUInt16LE(dataStart + 6) & 0x3fff;
      const height = bytes.readUInt16LE(dataStart + 8) & 0x3fff;
      if (!width || !height) throw new Error('Invalid WebP VP8 dimensions');
      imageSize = { width, height };
    } else if (type === 'VP8L') {
      if (imageSize) throw new Error('WebP contains multiple image payloads');
      if (chunkSize < 5 || bytes[dataStart] !== 0x2f) {
        throw new Error('Invalid WebP VP8L signature');
      }
      if (chunkSize === 5) throw new Error('Truncated WebP VP8L bitstream');
      const dimensions = bytes.readUInt32LE(dataStart + 1);
      if (dimensions >>> 29) throw new Error('Unsupported WebP VP8L version');
      imageSize = {
        width: (dimensions & 0x3fff) + 1,
        height: ((dimensions >>> 14) & 0x3fff) + 1,
      };
    }
    offset = nextOffset;
  }

  if (!imageSize || !imageSize.width || !imageSize.height) {
    throw new Error('WebP has no supported VP8 or VP8L image payload');
  }
  if (
    extendedSize
    && (extendedSize.width !== imageSize.width || extendedSize.height !== imageSize.height)
  ) {
    throw new Error('WebP VP8X canvas dimensions do not match image payload');
  }
  return {
    codec_name: 'webp',
    width: (extendedSize || imageSize).width,
    height: (extendedSize || imageSize).height,
  };
}

function localPath(reference, fromFile, siteRoot) {
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || /^(?:[a-z]+:|\/\/)/i.test(clean)) return null;
  const resolved = clean.startsWith('/')
    ? path.resolve(siteRoot, clean.slice(1))
    : path.resolve(path.dirname(fromFile), clean);
  const relative = path.relative(siteRoot, resolved);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    ? resolved
    : null;
}

function homepageResources(entryFile = path.join(root, 'index.html'), siteRoot = root) {
  const declaredRoot = path.resolve(siteRoot);
  const requestedEntry = path.resolve(entryFile);
  const declaredRelative = path.relative(declaredRoot, requestedEntry);
  if (
    declaredRelative === '..'
    || declaredRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(declaredRelative)
  ) {
    throw new Error('Homepage entry file must be inside the site root');
  }
  const realRoot = fs.realpathSync(declaredRoot);
  const realEntry = fs.realpathSync(requestedEntry);
  const realEntryRelative = path.relative(realRoot, realEntry);
  if (
    realEntryRelative === '..'
    || realEntryRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(realEntryRelative)
  ) {
    throw new Error('Homepage entry file must be inside the site root');
  }

  const queue = [realEntry];
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
      const dependency = localPath(match[1], file, realRoot);
      if (!dependency || !fs.existsSync(dependency)) continue;
      const realDependency = fs.realpathSync(dependency);
      const relative = path.relative(realRoot, realDependency);
      if (
        relative !== '..'
        && !relative.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relative)
        && fs.statSync(realDependency).isFile()
      ) {
        queue.push(realDependency);
      }
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

function webpChunk(type, data) {
  const padding = data.length % 2;
  const chunk = Buffer.alloc(8 + data.length + padding);
  chunk.write(type, 0, 4, 'ascii');
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);
  return chunk;
}

function webpFile(...chunks) {
  const payload = Buffer.concat([Buffer.from('WEBP'), ...chunks]);
  const file = Buffer.alloc(8 + payload.length);
  file.write('RIFF', 0, 4, 'ascii');
  file.writeUInt32LE(payload.length, 4);
  payload.copy(file, 8);
  return file;
}

function vp8Data(width, height) {
  const data = Buffer.alloc(12);
  data.writeUIntLE(1 << 5, 0, 3);
  data.set([0x9d, 0x01, 0x2a], 3);
  data.writeUInt16LE(width, 6);
  data.writeUInt16LE(height, 8);
  return data;
}

function vp8lData(width, height) {
  const data = Buffer.alloc(6);
  const dimensions = (width - 1) | ((height - 1) << 14);
  data[0] = 0x2f;
  data.writeUInt32LE(dimensions, 1);
  return data;
}

function vp8xData(width, height) {
  const data = Buffer.alloc(10);
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return data;
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

test('homepage dependency traversal follows root-relative local scripts, styles, and imports', (t) => {
  const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-homepage-'));
  const outsideEntry = path.join(path.dirname(siteRoot), `${path.basename(siteRoot)}-outside.js`);
  t.after(() => fs.rmSync(siteRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outsideEntry, { force: true }));
  fs.mkdirSync(path.join(siteRoot, 'js'), { recursive: true });
  fs.mkdirSync(path.join(siteRoot, 'css'), { recursive: true });
  fs.writeFileSync(
    path.join(siteRoot, 'index.html'),
    '<script src="/js/app.js"></script><link rel="stylesheet" href="/css/base.css">',
  );
  fs.writeFileSync(path.join(siteRoot, 'js', 'app.js'), "import '/js/poster-reference.js';");
  fs.writeFileSync(path.join(siteRoot, 'js', 'poster-reference.js'), "fetch('/images/posters/manifest.json');");
  fs.writeFileSync(path.join(siteRoot, 'css', 'base.css'), "@import '/css/poster-reference.css';");
  fs.writeFileSync(path.join(siteRoot, 'css', 'poster-reference.css'), ".card{background:url('/images/posters/yi-female-v1.webp')}");
  fs.writeFileSync(outsideEntry, "import '/js/poster-reference.js';");

  const resources = homepageResources(path.join(siteRoot, 'index.html'), siteRoot);
  const relativeFiles = resources
    .map(({ file }) => path.relative(siteRoot, file).split(path.sep).join('/'))
    .sort();
  const combinedSource = resources.map(({ source }) => source).join('\n');

  assert.deepEqual(relativeFiles, [
    'css/base.css',
    'css/poster-reference.css',
    'index.html',
    'js/app.js',
    'js/poster-reference.js',
  ]);
  assert.match(combinedSource, /\/images\/posters\/manifest\.json/);
  assert.match(combinedSource, /\/images\/posters\/yi-female-v1\.webp/);
  assert.throws(
    () => homepageResources(outsideEntry, siteRoot),
    /entry file.*site root/i,
  );
});

test('pure Node WebP inspection extracts VP8, VP8L, and VP8X dimensions', () => {
  const fixtures = [
    { bytes: webpFile(webpChunk('VP8 ', vp8Data(1080, 1920))), expected: { codec_name: 'webp', width: 1080, height: 1920 } },
    { bytes: webpFile(webpChunk('VP8L', vp8lData(321, 654))), expected: { codec_name: 'webp', width: 321, height: 654 } },
    {
      bytes: webpFile(
        webpChunk('VP8X', vp8xData(777, 999)),
        webpChunk('VP8 ', vp8Data(777, 999)),
      ),
      expected: { codec_name: 'webp', width: 777, height: 999 },
    },
  ];

  for (const fixture of fixtures) assert.deepEqual(decodeWebP(fixture.bytes), fixture.expected);
});

test('pure Node WebP inspection rejects corrupt signatures and truncated containers', () => {
  const wrongSignature = webpFile(webpChunk('VP8 ', vp8Data(20, 30)));
  wrongSignature.write('NOPE', 0, 4, 'ascii');
  const wrongRiffSize = webpFile(webpChunk('VP8L', vp8lData(20, 30)));
  wrongRiffSize.writeUInt32LE(wrongRiffSize.length, 4);
  const truncatedChunk = webpFile(webpChunk('VP8 ', vp8Data(20, 30))).subarray(0, -1);
  truncatedChunk.writeUInt32LE(truncatedChunk.length - 8, 4);

  assert.throws(() => decodeWebP(wrongSignature), /RIFF|WebP/i);
  assert.throws(() => decodeWebP(wrongRiffSize), /size|bounds/i);
  assert.throws(() => decodeWebP(truncatedChunk), /truncated|bounds/i);
});

test('pure Node WebP inspection rejects non-zero RIFF chunk padding', () => {
  const bytes = webpFile(
    webpChunk('JUNK', Buffer.from([0x42])),
    webpChunk('VP8 ', vp8Data(20, 30)),
  );
  bytes[12 + 8 + 1] = 0xff;

  assert.throws(() => decodeWebP(bytes), /padding/i);
});

test('pure Node WebP inspection rejects invalid VP8X reserved fields and canvas area', () => {
  const reservedFlag = vp8xData(20, 30);
  reservedFlag[0] = 0x80;
  const reservedByte = vp8xData(20, 30);
  reservedByte[1] = 0x01;
  const oversizedCanvas = vp8xData(65536, 65536);

  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8X', reservedFlag),
      webpChunk('VP8 ', vp8Data(20, 30)),
    )),
    /reserved/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8X', reservedByte),
      webpChunk('VP8 ', vp8Data(20, 30)),
    )),
    /reserved/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8X', oversizedCanvas))),
    /canvas.*area|dimensions/i,
  );
});

test('pure Node WebP inspection rejects zero and contradictory image dimensions', () => {
  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8 ', vp8Data(0, 30)))),
    /VP8 dimensions/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8X', vp8xData(20, 30)),
      webpChunk('VP8L', vp8lData(20, 31)),
    )),
    /dimensions.*match/i,
  );
});

test('pure Node WebP inspection rejects truncated VP8 family bitstreams', () => {
  const truncatedVp8 = vp8Data(20, 30);
  truncatedVp8.writeUIntLE(3 << 5, 0, 3);
  const truncatedVp8l = vp8lData(20, 30).subarray(0, 5);
  const unsupportedVp8 = vp8Data(20, 30);
  unsupportedVp8[0] |= 4 << 1;
  const unsupportedVp8l = vp8lData(20, 30);
  unsupportedVp8l.writeUInt32LE(unsupportedVp8l.readUInt32LE(1) | (1 << 29), 1);

  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8 ', truncatedVp8))),
    /VP8.*partition|truncated/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8L', truncatedVp8l))),
    /VP8L.*bitstream|truncated/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8 ', unsupportedVp8))),
    /VP8 version/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(webpChunk('VP8L', unsupportedVp8l))),
    /VP8L version/i,
  );
});

test('pure Node WebP inspection rejects duplicate, late, or animated VP8X headers', () => {
  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8X', vp8xData(20, 30)),
      webpChunk('VP8X', vp8xData(20, 30)),
      webpChunk('VP8 ', vp8Data(20, 30)),
    )),
    /multiple VP8X/i,
  );
  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8 ', vp8Data(20, 30)),
      webpChunk('VP8X', vp8xData(20, 30)),
    )),
    /VP8X.*first/i,
  );
  const animatedHeader = vp8xData(20, 30);
  animatedHeader[0] = 0x02;
  assert.throws(
    () => decodeWebP(webpFile(
      webpChunk('VP8X', animatedHeader),
      webpChunk('VP8 ', vp8Data(20, 30)),
    )),
    /animated/i,
  );
});

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
