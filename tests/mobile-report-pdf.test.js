const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

class FakeElement {
  constructor(id, document) {
    this.id = id;
    this.ownerDocument = document;
    this.hidden = id === 'reportPdfSheet';
    this.disabled = false;
    this.style = {};
    this.textContent = '';
    this.attributes = new Map();
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    if (type === 'click' && this.disabled) return;
    const payload = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() {},
      ...event,
    };
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

function createDocument() {
  const ids = [
    'reportPdfSheet', 'reportPdfClose', 'reportPdfStatus',
    'reportPdfProgress', 'reportPdfProgressBar', 'reportPdfDownload',
    'reportPdfShare', 'reportHtmlFallback',
  ];
  const document = {
    readyState: 'complete',
    activeElement: null,
    listeners: new Map(),
    elements: new Map(),
    body: { style: {} },
    getElementById(id) {
      return this.elements.get(id) || null;
    },
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
  };
  for (const id of ids) document.elements.set(id, new FakeElement(id, document));
  document.getElementById('reportPdfDownload').disabled = true;
  document.getElementById('reportPdfShare').disabled = true;
  return document;
}

function extractMobileController() {
  const source = read('js/result.js');
  const match = source.match(
    /\/\/ ==================== 移动端 PDF 操作面板 ====================[\s\S]*?(?=\/\/ 直接下载 HTML 文件)/,
  );
  assert.ok(match, 'result.js must define the isolated mobile PDF action-sheet controller');
  return match[0];
}

function loadMobileController(overrides = {}) {
  const document = createDocument();
  const calls = { prepare: [], download: [], canShare: [], share: [], html: 0 };
  const file = { name: 'prepared.pdf', type: 'application/pdf' };
  let resolvePrepare;
  let rejectPrepare;
  const preparePromise = new Promise((resolve, reject) => {
    resolvePrepare = resolve;
    rejectPrepare = reject;
  });
  const context = {
    console,
    Promise,
    document,
    navigator: {
      canShare(input) {
        calls.canShare.push(input);
        return true;
      },
      async share(input) {
        calls.share.push(input);
      },
    },
    ReportPdf: {
      prepare(options) {
        calls.prepare.push(options);
        return preparePromise;
      },
      download(prepared, filename) {
        calls.download.push({ prepared, filename });
      },
    },
    buildReportHTML() {
      return '<main>current paid report</main>';
    },
    downloadReport() {
      calls.html += 1;
    },
    _params: { year: 1990, month: 6, day: 15 },
    setTimeout,
    clearTimeout,
    ...overrides,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    `${extractMobileController()}
this.__mobilePdf = {
  prepareMobileReportPdf,
  closeMobileReportPdfSheet
};`,
    context,
  );
  return {
    api: context.__mobilePdf,
    context,
    document,
    calls,
    file,
    resolvePrepare,
    rejectPrepare,
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

function extractOpenReport() {
  const source = read('js/result.js');
  const start = source.indexOf('function openReportInNewTab() {');
  const end = source.indexOf('// 快捷方法：一键打印', start);
  assert.ok(start >= 0 && end > start, 'result.js must retain the report export entry point');
  return source.slice(start, end);
}

test('result page loads local PDF dependencies in order and exposes one accessible action sheet', () => {
  const html = read('result.html');
  const scripts = [
    '/js/vendor/html2canvas.min.js',
    '/js/vendor/jspdf.umd.min.js',
    '/js/report-pdf.js',
    'js/result.js',
  ];
  const indexes = scripts.map((src) => html.indexOf(`src="${src}"`));

  indexes.forEach((index, position) => {
    assert.ok(index >= 0, `result page must load ${scripts[position]}`);
  });
  assert.ok(indexes.every((index, position) => position === 0 || index > indexes[position - 1]));
  assert.equal((html.match(/\bid="reportPdfSheet"/g) || []).length, 1);
  assert.match(html, /id="reportPdfSheet"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="reportPdfTitle"/);
  assert.match(html, /id="reportPdfProgress"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);
  assert.match(html, /id="reportPdfClose"[^>]*aria-label="关闭 PDF 操作面板"/);
  assert.match(html, /id="reportPdfDownload"[^>]*disabled[^>]*>[\s\S]*?下载 PDF/);
  assert.match(html, /id="reportPdfShare"[^>]*disabled[^>]*>[\s\S]*?保存或分享/);
  assert.match(html, /id="reportHtmlFallback"[^>]*>[\s\S]*?下载 HTML 备用/);
});

test('mobile generation opens immediately and prepares the current report with progress', async () => {
  const fixture = loadMobileController();
  const promise = fixture.api.prepareMobileReportPdf();
  const status = fixture.document.getElementById('reportPdfStatus');
  const progress = fixture.document.getElementById('reportPdfProgress');

  assert.equal(fixture.document.getElementById('reportPdfSheet').hidden, false);
  assert.equal(status.textContent, '正在生成报告……');
  assert.equal(progress.getAttribute('aria-valuenow'), '0');
  assert.equal(fixture.calls.prepare.length, 1);
  assert.equal(fixture.calls.prepare[0].html, '<main>current paid report</main>');
  assert.match(fixture.calls.prepare[0].filename, /\.pdf$/);
  fixture.calls.prepare[0].onProgress(42);
  assert.equal(progress.getAttribute('aria-valuenow'), '42');
  assert.equal(fixture.document.getElementById('reportPdfProgressBar').style.width, '42%');

  fixture.resolvePrepare(fixture.file);
  await promise;
  assert.equal(status.textContent, 'PDF 已生成，请选择下载或分享');
  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, false);
  assert.equal(fixture.document.getElementById('reportPdfShare').disabled, false);
});

test('mobile export entry prepares in-page without printing or opening a new tab', async () => {
  const calls = { prepare: 0, open: 0, print: 0, storage: 0 };
  const context = {
    isMobile: () => true,
    prepareMobileReportPdf() { calls.prepare += 1; },
    buildReportHTML() { throw new Error('mobile must not build the desktop blob route'); },
    window: {
      open() { calls.open += 1; },
      print() { calls.print += 1; },
    },
    sessionStorage: { setItem() { calls.storage += 1; } },
    Blob,
    URL: { createObjectURL() { throw new Error('mobile must not create a desktop object URL'); } },
    alert() {},
    setTimeout,
  };
  vm.runInNewContext(`${extractOpenReport()}; openReportInNewTab();`, context);

  assert.equal(calls.prepare, 1);
  assert.equal(calls.open, 0);
  assert.equal(calls.print, 0);
  assert.equal(calls.storage, 0);
});

test('prepared PDF downloads only from its dedicated enabled button', async () => {
  const fixture = loadMobileController();
  const download = fixture.document.getElementById('reportPdfDownload');
  download.dispatch('click');
  assert.equal(fixture.calls.download.length, 0);

  const promise = fixture.api.prepareMobileReportPdf();
  download.dispatch('click');
  assert.equal(fixture.calls.download.length, 0);
  fixture.resolvePrepare(fixture.file);
  await promise;
  assert.equal(fixture.calls.download.length, 0);

  download.dispatch('click');
  assert.equal(fixture.calls.download.length, 1);
  assert.equal(fixture.calls.download[0].prepared, fixture.file);
  assert.match(fixture.calls.download[0].filename, /\.pdf$/);
});

test('share re-checks support for the exact prepared file before invoking Web Share', async () => {
  const fixture = loadMobileController();
  const promise = fixture.api.prepareMobileReportPdf();
  fixture.resolvePrepare(fixture.file);
  await promise;
  const checksAfterPrepare = fixture.calls.canShare.length;

  fixture.document.getElementById('reportPdfShare').dispatch('click');
  await settle();

  assert.equal(fixture.calls.canShare.length, checksAfterPrepare + 1);
  assert.equal(fixture.calls.canShare.at(-1).files[0], fixture.file);
  assert.equal(fixture.calls.share.length, 1);
  assert.equal(fixture.calls.share[0].files[0], fixture.file);
  assert.equal(fixture.calls.share[0].title, '知时命理报告');
});

test('generation failure keeps a visible HTML fallback and usable close control', async () => {
  const fixture = loadMobileController();
  const promise = fixture.api.prepareMobileReportPdf();
  fixture.rejectPrepare(new Error('canvas unavailable'));
  await promise;

  assert.match(fixture.document.getElementById('reportPdfStatus').textContent, /PDF 生成失败/);
  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, true);
  assert.equal(fixture.document.getElementById('reportPdfShare').disabled, true);
  fixture.document.getElementById('reportHtmlFallback').dispatch('click');
  assert.equal(fixture.calls.html, 1);
  fixture.document.getElementById('reportPdfClose').dispatch('click');
  assert.equal(fixture.document.getElementById('reportPdfSheet').hidden, true);
  assert.equal(fixture.calls.download.length, 0);
  assert.equal(fixture.calls.share.length, 0);
});

test('share cancellation leaves the prepared PDF ready for download', async () => {
  const cancelled = new Error('cancelled');
  cancelled.name = 'AbortError';
  const fixture = loadMobileController({
    navigator: {
      canShare() { return true; },
      async share() { throw cancelled; },
    },
  });
  const promise = fixture.api.prepareMobileReportPdf();
  fixture.resolvePrepare(fixture.file);
  await promise;
  fixture.document.getElementById('reportPdfShare').dispatch('click');
  await settle();

  assert.equal(fixture.document.getElementById('reportPdfStatus').textContent, 'PDF 已生成，请选择下载或分享');
  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, false);
});

test('share stays disabled when the browser has no share action', async () => {
  const fixture = loadMobileController({
    navigator: {
      canShare() { return true; },
    },
  });
  const promise = fixture.api.prepareMobileReportPdf();
  fixture.resolvePrepare(fixture.file);
  await promise;

  assert.equal(fixture.document.getElementById('reportPdfShare').disabled, true);
});

test('desktop export retains the existing new-tab print-to-PDF route', () => {
  const calls = { open: [], storage: [] };
  const context = {
    isMobile: () => false,
    prepareMobileReportPdf() { throw new Error('desktop must not use mobile generation'); },
    buildReportHTML() { return '<main>desktop report</main>'; },
    window: {
      open(url, target) {
        calls.open.push({ url, target });
        return {};
      },
    },
    sessionStorage: {
      setItem(key, value) { calls.storage.push({ key, value }); },
      removeItem() {},
    },
    Blob,
    URL: {
      createObjectURL() { return 'blob:desktop-report'; },
      revokeObjectURL() {},
    },
    alert() {},
    setTimeout() { return 1; },
  };
  vm.runInNewContext(`${extractOpenReport()}; openReportInNewTab();`, context);

  assert.deepEqual(calls.storage, [{ key: 'zhishi_auto_print', value: '1' }]);
  assert.deepEqual(calls.open, [{ url: 'blob:desktop-report', target: '_blank' }]);
});

test('service worker increments one cache version and precaches all local PDF scripts', () => {
  const source = read('sw.js');
  assert.equal((source.match(/const CACHE_NAME\s*=\s*'zhishi-v6'/g) || []).length, 1);
  assert.equal((source.match(/const CACHE_NAME\s*=/g) || []).length, 1);
  for (const asset of [
    '/js/vendor/html2canvas.min.js',
    '/js/vendor/jspdf.umd.min.js',
    '/js/report-pdf.js',
  ]) {
    assert.equal((source.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
  }
});
