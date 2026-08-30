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
    this.inert = false;
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

  removeAttribute(name) {
    this.attributes.delete(name);
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
    dispatch(type, event = {}) {
      const payload = {
        type,
        preventDefault() {},
        ...event,
      };
      for (const listener of this.listeners.get(type) || []) listener(payload);
    },
  };
  document.body = new FakeElement('body', document);
  document.body.style.overflow = '';
  document.body.children = [];
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
    AbortController,
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function extractOpenReport() {
  const source = read('js/result.js');
  const start = source.indexOf('function openReportInNewTab() {');
  const end = source.indexOf('// 快捷方法：一键打印', start);
  assert.ok(start >= 0 && end > start, 'result.js must retain the report export entry point');
  return source.slice(start, end);
}

function extractBuildReportHTML() {
  const source = read('js/result.js');
  const match = source.match(/function buildReportHTML\(\) \{[\s\S]*?\r?\n    return html;\r?\n\}/);
  assert.ok(match, 'result.js must retain the real report builder');
  return match[0];
}

test('real report builder resolves every configured result.html section in export order', () => {
  const expectedOrder = [
    'sizhuSection',
    'dayunSection',
    'liunianSection',
    'proSection',
    'characterSection',
    'parentsSection',
    'thisYearSection',
    'marriageSection',
    'wealthSection',
    'studySection',
    'fortuneSection',
  ];
  const resultHtml = read('result.html');
  const liveIds = new Set(
    Array.from(resultHtml.matchAll(/\bid=["']([^"']+)["']/g), (match) => match[1]),
  );
  const requestedIds = [];
  const missingIds = [];
  const document = {
    getElementById(id) {
      requestedIds.push(id);
      if (!liveIds.has(id)) {
        missingIds.push(id);
        return null;
      }
      return {
        cloneNode() {
          return {
            innerHTML: `<p data-export-source="${id}">live report section content</p>`,
            querySelectorAll() { return []; },
          };
        },
      };
    },
  };
  const context = {
    document,
    _isPaywallActive: () => false,
    _params: {
      gender: 'male',
      mode: 'birth',
      year: 1990,
      month: 6,
      day: 15,
      hour: 0,
      prov: '',
    },
    SHI_CHEN_NAMES: ['子时'],
  };

  vm.createContext(context);
  vm.runInContext(`${extractBuildReportHTML()}; this.__report = buildReportHTML();`, context);

  assert.deepEqual(requestedIds, expectedOrder);
  assert.deepEqual(missingIds, []);
  const exportedOrder = Array.from(
    context.__report.matchAll(/data-export-source="([^"]+)"/g),
    (match) => match[1],
  );
  assert.deepEqual(exportedOrder, expectedOrder);
});

test('result page loads local PDF dependencies in order and exposes one accessible action sheet', () => {
  const html = read('result.html');
  const scripts = [
    '/js/vendor/html2canvas.min.js?v=2',
    '/js/vendor/jspdf.umd.min.js?v=2',
    '/js/report-pdf.js?v=3',
    'js/result.js?v=19',
  ];
  const indexes = scripts.map((src) => html.indexOf(`src="${src}`));

  indexes.forEach((index, position) => {
    assert.ok(index >= 0, `result page must load ${scripts[position]}`);
  });
  assert.ok(indexes.every((index, position) => position === 0 || index > indexes[position - 1]));
  assert.equal((html.match(/\bid="reportPdfSheet"/g) || []).length, 1);
  assert.match(html, /id="reportPdfSheet"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="reportPdfTitle"/);
  assert.match(html, /id="reportPdfProgress"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);
  assert.match(html, /id="reportPdfClose"[^>]*aria-label="关闭 PDF 操作面板"/);
  assert.match(html, /id="reportPdfDownload"[^>]*disabled[^>]*>[\s\S]*?直接下载/);
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
  assert.ok(fixture.calls.prepare[0].signal instanceof AbortSignal);
  assert.equal(fixture.calls.prepare[0].signal.aborted, false);
  fixture.calls.prepare[0].onProgress(42);
  assert.equal(progress.getAttribute('aria-valuenow'), '42');
  assert.equal(fixture.document.getElementById('reportPdfProgressBar').style.width, '42%');

  fixture.resolvePrepare(fixture.file);
  await promise;
  assert.equal(status.textContent, 'PDF 已生成，手机建议使用“保存或分享”存入文件。');
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
  fixture.calls.prepare[0].onProgress(63);
  fixture.rejectPrepare(new Error('canvas unavailable'));
  await promise;

  assert.match(fixture.document.getElementById('reportPdfStatus').textContent, /PDF 生成失败/);
  assert.equal(fixture.document.getElementById('reportPdfProgress').getAttribute('aria-valuenow'), '0');
  assert.equal(fixture.document.getElementById('reportPdfProgressBar').style.width, '0%');
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

  assert.equal(fixture.document.getElementById('reportPdfStatus').textContent, 'PDF 已生成，手机建议使用“保存或分享”存入文件。');
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

test('closing and reopening ignores an older success and its stale progress', async () => {
  const preparations = [];
  const downloads = [];
  const fixture = loadMobileController({
    ReportPdf: {
      prepare(options) {
        const operation = deferred();
        preparations.push({ ...operation, options });
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled');
            error.name = 'AbortError';
            operation.reject(error);
          }, { once: true });
        }
        return operation.promise;
      },
      download(prepared, filename) {
        downloads.push({ prepared, filename });
      },
    },
  });
  const olderFile = { name: 'older.pdf', type: 'application/pdf' };
  const newerFile = { name: 'newer.pdf', type: 'application/pdf' };

  const olderPromise = fixture.api.prepareMobileReportPdf();
  fixture.document.getElementById('reportPdfClose').dispatch('click');
  const newerPromise = fixture.api.prepareMobileReportPdf();
  await settle();
  assert.equal(preparations.length, 2);
  assert.ok(preparations[0].options.signal);
  assert.equal(preparations[0].options.signal.aborted, true);
  preparations[1].resolve(newerFile);
  await newerPromise;
  preparations[0].options.onProgress(19);
  await olderPromise;

  assert.equal(fixture.document.getElementById('reportPdfProgress').getAttribute('aria-valuenow'), '100');
  assert.equal(fixture.document.getElementById('reportPdfStatus').textContent, 'PDF 已生成，手机建议使用“保存或分享”存入文件。');
  fixture.document.getElementById('reportPdfDownload').dispatch('click');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].prepared, newerFile);
});

test('a stale rejection cannot clear a newer prepared PDF', async () => {
  const preparations = [];
  const downloads = [];
  const fixture = loadMobileController({
    ReportPdf: {
      prepare(options) {
        const operation = deferred();
        preparations.push({ ...operation, options });
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            const error = new Error('older render cancelled');
            error.name = 'AbortError';
            operation.reject(error);
          }, { once: true });
        }
        return operation.promise;
      },
      download(prepared, filename) {
        downloads.push({ prepared, filename });
      },
    },
  });
  const newerFile = { name: 'newer.pdf', type: 'application/pdf' };

  const olderPromise = fixture.api.prepareMobileReportPdf();
  const newerPromise = fixture.api.prepareMobileReportPdf();
  assert.equal(preparations.length, 1, 'replacement waits for the aborted operation to settle');
  await settle();
  assert.equal(preparations.length, 2);
  assert.ok(preparations[0].options.signal);
  assert.equal(preparations[0].options.signal.aborted, true);
  preparations[1].resolve(newerFile);
  await newerPromise;
  await olderPromise;

  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, false);
  assert.equal(fixture.document.getElementById('reportPdfStatus').textContent, 'PDF 已生成，手机建议使用“保存或分享”存入文件。');
  fixture.document.getElementById('reportPdfDownload').dispatch('click');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].prepared, newerFile);
});

test('closing active generation aborts work and resets actions without showing a failure', async () => {
  const fixture = loadMobileController();
  const pending = fixture.api.prepareMobileReportPdf();
  const options = fixture.calls.prepare[0];

  fixture.document.getElementById('reportPdfClose').dispatch('click');

  assert.ok(options.signal);
  assert.equal(options.signal.aborted, true);
  assert.equal(fixture.document.getElementById('reportPdfSheet').hidden, true);
  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, true);
  assert.equal(fixture.document.getElementById('reportPdfShare').disabled, true);
  assert.equal(fixture.document.getElementById('reportPdfProgress').getAttribute('aria-valuenow'), '0');
  const closedStatus = fixture.document.getElementById('reportPdfStatus').textContent;

  const abortError = new Error('cancelled');
  abortError.name = 'AbortError';
  fixture.rejectPrepare(abortError);
  assert.equal(await pending, null);
  assert.equal(fixture.document.getElementById('reportPdfStatus').textContent, closedStatus);
});

test('closing a completed generation releases its file and disables later download or share', async () => {
  const fixture = loadMobileController();
  const pending = fixture.api.prepareMobileReportPdf();
  fixture.resolvePrepare(fixture.file);
  await pending;

  fixture.document.getElementById('reportPdfClose').dispatch('click');
  fixture.document.getElementById('reportPdfDownload').dispatch('click');
  fixture.document.getElementById('reportPdfShare').dispatch('click');
  await settle();

  assert.equal(fixture.document.getElementById('reportPdfDownload').disabled, true);
  assert.equal(fixture.document.getElementById('reportPdfShare').disabled, true);
  assert.equal(fixture.document.getElementById('reportPdfProgress').getAttribute('aria-valuenow'), '0');
  assert.equal(fixture.calls.download.length, 0);
  assert.equal(fixture.calls.share.length, 0);
});

test('replacement aborts and settles the previous pipeline before another one starts', async () => {
  const preparations = [];
  let activeCount = 0;
  let maxActiveCount = 0;
  const fixture = loadMobileController({
    ReportPdf: {
      prepare(options) {
        const operation = deferred();
        activeCount += 1;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        preparations.push({ ...operation, options });
        options.signal.addEventListener('abort', () => {
          activeCount -= 1;
          const error = new Error('cancelled');
          error.name = 'AbortError';
          operation.reject(error);
        }, { once: true });
        return operation.promise.then((value) => {
          activeCount -= 1;
          return value;
        });
      },
      download() {},
    },
  });

  const first = fixture.api.prepareMobileReportPdf();
  const second = fixture.api.prepareMobileReportPdf();

  assert.equal(preparations.length, 1);
  assert.equal(preparations[0].options.signal.aborted, true);
  await settle();
  assert.equal(preparations.length, 2);
  assert.equal(maxActiveCount, 1);

  preparations[1].resolve(fixture.file);
  assert.equal(await first, null);
  assert.equal(await second, fixture.file);
  assert.equal(maxActiveCount, 1);
});

test('open sheet traps focus and suppresses then restores background interaction', () => {
  const fixture = loadMobileController();
  const sheet = fixture.document.getElementById('reportPdfSheet');
  const close = fixture.document.getElementById('reportPdfClose');
  const fallback = fixture.document.getElementById('reportHtmlFallback');
  const opener = new FakeElement('exportButton', fixture.document);
  const inertBackground = new FakeElement('reportContent', fixture.document);
  const ariaBackground = new FakeElement('legacyContent', fixture.document);
  delete ariaBackground.inert;
  ariaBackground.setAttribute('aria-hidden', 'false');
  fixture.document.body.children = [opener, inertBackground, ariaBackground, sheet];
  fixture.document.body.style.overflow = 'clip';
  fixture.document.activeElement = opener;

  fixture.api.prepareMobileReportPdf();

  assert.equal(fixture.document.activeElement, close);
  assert.equal(fixture.document.body.style.overflow, 'hidden');
  assert.equal(inertBackground.inert, true);
  assert.equal(ariaBackground.getAttribute('aria-hidden'), 'true');
  assert.equal(sheet.inert, false);
  assert.notEqual(sheet.getAttribute('aria-hidden'), 'true');

  fixture.document.dispatch('keydown', { key: 'Tab' });
  assert.equal(fixture.document.activeElement, fallback);
  fixture.document.dispatch('keydown', { key: 'Tab' });
  assert.equal(fixture.document.activeElement, close);
  fixture.document.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(fixture.document.activeElement, fallback);

  fixture.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(sheet.hidden, true);
  assert.equal(fixture.document.body.style.overflow, 'clip');
  assert.equal(inertBackground.inert, false);
  assert.equal(ariaBackground.getAttribute('aria-hidden'), 'false');
  assert.equal(fixture.document.activeElement, opener);
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

test('service worker rolls the mobile PDF cache to v22 and precaches all local PDF scripts', () => {
  const source = read('sw.js');
  assert.equal((source.match(/var CACHE_NAME\s*=\s*'zhishi-v23'/g) || []).length, 1);
  assert.equal((source.match(/var CACHE_NAME\s*=/g) || []).length, 1);
  for (const asset of [
    '/js/vendor/html2canvas.min.js?v=2',
    '/js/vendor/jspdf.umd.min.js?v=2',
    '/js/report-pdf.js?v=3',
  ]) {
    assert.equal((source.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
  }
});
