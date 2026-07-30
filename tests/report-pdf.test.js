const test = require('node:test');
const assert = require('node:assert/strict');

const ReportPdf = require('../js/report-pdf.js');

function createSourceCanvas(width, height) {
  let currentWidth = width;
  let currentHeight = height;

  return {
    get width() { return currentWidth; },
    set width(value) { currentWidth = value; },
    get height() { return currentHeight; },
    set height(value) { currentHeight = value; },
  };
}

function createFakeDocument(blocks) {
  const appended = [];
  const removed = [];
  const sliceCanvases = [];
  const sliceDraws = [];
  let noPrintRemovalCount = 0;

  const contentDocument = {
    fonts: { ready: Promise.resolve() },
    querySelectorAll(selector) {
      if (selector === '.no-print') {
        return [{ remove() { noPrintRemovalCount += 1; } }];
      }
      if (selector === '.cover, .section, .footer') return blocks;
      return [];
    },
  };

  const body = {
    appendChild(element) {
      appended.push(element);
      element.parentNode = body;
      return element;
    },
    removeChild(element) {
      const index = appended.indexOf(element);
      if (index >= 0) appended.splice(index, 1);
      removed.push(element);
      element.parentNode = null;
      return element;
    },
  };

  function createIframe() {
    const listeners = {};
    const attributes = {};
    return {
      contentDocument,
      style: {},
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name]; },
      addEventListener(type, listener) { listeners[type] = listener; },
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
      set srcdoc(value) {
        this._srcdoc = value;
        queueMicrotask(() => listeners.load());
      },
      get srcdoc() { return this._srcdoc; },
    };
  }

  function createSliceCanvas() {
    const canvas = {
      width: 0,
      height: 0,
      getContext(kind) {
        assert.equal(kind, '2d');
        return {
          drawImage() {
            sliceDraws.push(Array.from(arguments));
          },
        };
      },
    };
    sliceCanvases.push(canvas);
    return canvas;
  }

  return {
    body,
    createElement(tagName) {
      if (tagName === 'iframe') return createIframe();
      if (tagName === 'canvas') return createSliceCanvas();
      throw new Error(`Unexpected element: ${tagName}`);
    },
    appended,
    removed,
    sliceCanvases,
    sliceDraws,
    get noPrintRemovalCount() { return noPrintRemovalCount; },
  };
}

function createPdfHarness() {
  const instances = [];

  class FakePdf {
    constructor(options) {
      this.options = options;
      this.images = [];
      this.addPageCount = 0;
      instances.push(this);
    }

    addImage(image, format, x, y, width, height) {
      this.images.push({
        image,
        imageWidth: image.width,
        imageHeight: image.height,
        format,
        x,
        y,
        width,
        height,
      });
    }

    addPage() {
      this.addPageCount += 1;
    }

    output(type) {
      assert.equal(type, 'blob');
      return new Blob(['pdf'], { type: 'application/pdf' });
    }
  }

  return { FakePdf, instances };
}

test('renders report blocks in DOM order and reports 100 percent progress', async () => {
  const blocks = [{ id: 'cover' }, { id: 'section' }, { id: 'footer' }];
  const documentRef = createFakeDocument(blocks);
  const { FakePdf, instances } = createPdfHarness();
  const rendered = [];
  const progress = [];
  const canvases = [];

  const result = await ReportPdf.prepare({
    html: '<main>report</main>',
    filename: 'report.pdf',
    documentRef,
    windowRef: { devicePixelRatio: 3 },
    JsPdfCtor: FakePdf,
    html2canvasImpl: async (block, options) => {
      rendered.push({ id: block.id, options });
      const canvas = createSourceCanvas(1000, 500);
      canvases.push(canvas);
      return canvas;
    },
    onProgress(value) { progress.push(value); },
  });

  assert.equal(result.type, 'application/pdf');
  assert.deepEqual(rendered.map((entry) => entry.id), ['cover', 'section', 'footer']);
  assert.deepEqual(rendered.map((entry) => entry.options), [
    { useCORS: true, backgroundColor: '#0d0f18', scale: 1.6 },
    { useCORS: true, backgroundColor: '#0d0f18', scale: 1.6 },
    { useCORS: true, backgroundColor: '#0d0f18', scale: 1.6 },
  ]);
  assert.deepEqual(progress, [33, 67, 100]);
  assert.deepEqual(instances[0].options, {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  assert.equal(instances[0].images.length, 3);
  assert.equal(instances[0].addPageCount, 2, 'the first image uses jsPDF initial page');
  assert.equal(documentRef.noPrintRemovalCount, 1);
  assert.equal(documentRef.appended.length, 0);
  assert.equal(documentRef.removed.length, 1);
  assert.equal(
    documentRef.removed[0].getAttribute('sandbox'),
    'allow-same-origin',
    'report scripts stay disabled while the parent can read the iframe DOM',
  );
  assert.deepEqual(canvases.map((canvas) => [canvas.width, canvas.height]), [[0, 0], [0, 0], [0, 0]]);
});

test('slices a tall canvas across A4 pages without distorting any slice', async () => {
  const documentRef = createFakeDocument([{ id: 'section' }]);
  const { FakePdf, instances } = createPdfHarness();
  const sourceCanvas = createSourceCanvas(1000, 3000);

  await ReportPdf.prepare({
    html: '<section>long report</section>',
    documentRef,
    windowRef: { devicePixelRatio: 1 },
    JsPdfCtor: FakePdf,
    html2canvasImpl: async () => sourceCanvas,
  });

  const pdf = instances[0];
  assert.equal(pdf.images.length, 3);
  assert.equal(pdf.addPageCount, 2, 'no blank page precedes the first slice');
  assert.deepEqual(documentRef.sliceDraws.map((args) => args.slice(1, 5)), [
    [0, 0, 1000, 1457],
    [0, 1457, 1000, 1457],
    [0, 2914, 1000, 86],
  ]);
  assert.deepEqual(pdf.images.map((image) => [image.imageWidth, image.imageHeight]), [
    [1000, 1457],
    [1000, 1457],
    [1000, 86],
  ]);
  for (const image of pdf.images) {
    assert.equal(image.width, 190);
    assert.ok(Math.abs((image.height / image.width) - (image.imageHeight / image.imageWidth)) < 1e-12);
  }
  assert.deepEqual(documentRef.sliceCanvases.map((canvas) => [canvas.width, canvas.height]), [
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  assert.deepEqual([sourceCanvas.width, sourceCanvas.height], [0, 0]);
});

test('removes the export iframe and wraps rendering errors in Chinese', async () => {
  const documentRef = createFakeDocument([{ id: 'cover' }]);
  const { FakePdf } = createPdfHarness();

  await assert.rejects(
    ReportPdf.prepare({
      html: '<main>report</main>',
      documentRef,
      windowRef: { devicePixelRatio: 1 },
      JsPdfCtor: FakePdf,
      html2canvasImpl: async () => {
        throw new Error('canvas exhausted');
      },
    }),
    /PDF 生成失败：canvas exhausted/,
  );

  assert.equal(documentRef.appended.length, 0);
  assert.equal(documentRef.removed.length, 1);
});

test('downloads through a temporary anchor and revokes the object URL after a delay', () => {
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;
  const originalSetTimeout = globalThis.setTimeout;
  const appended = [];
  const removed = [];
  const clicks = [];
  const revocations = [];
  const timers = [];
  const file = new Blob(['pdf'], { type: 'application/pdf' });
  const anchor = {
    click() { clicks.push(this.href); },
    remove() {
      removed.push(this);
      const index = appended.indexOf(this);
      if (index >= 0) appended.splice(index, 1);
    },
  };

  globalThis.document = {
    body: {
      appendChild(element) {
        appended.push(element);
        return element;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return anchor;
    },
  };
  globalThis.URL = {
    createObjectURL(value) {
      assert.equal(value, file);
      return 'blob:report-pdf';
    },
    revokeObjectURL(value) { revocations.push(value); },
  };
  globalThis.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return 1;
  };

  try {
    ReportPdf.download(file, '命理报告.pdf');
    assert.equal(anchor.href, 'blob:report-pdf');
    assert.equal(anchor.download, '命理报告.pdf');
    assert.deepEqual(clicks, ['blob:report-pdf']);
    assert.equal(appended.length, 0);
    assert.deepEqual(removed, [anchor]);
    assert.deepEqual(revocations, []);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 60000);

    timers[0].callback();
    assert.deepEqual(revocations, ['blob:report-pdf']);
  } finally {
    globalThis.document = originalDocument;
    globalThis.URL = originalUrl;
    globalThis.setTimeout = originalSetTimeout;
  }
});
