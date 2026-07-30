# Mobile Report PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Android and iPhone users generate, download, or share a real PDF file without relying on unsupported mobile `window.print()`.

**Architecture:** The existing report HTML remains the single content source. A focused browser module renders cover/sections/footer one block at a time into A4 PDF pages using locally hosted html2canvas and jsPDF, then presents explicit Download and Share buttons so each browser action has a fresh user gesture.

**Tech Stack:** Browser JavaScript, html2canvas 1.4.1, jsPDF 2.5.2, Node built-in test runner.

## Global Constraints

- Mobile saving must not require `window.print()`.
- Desktop print-to-PDF remains available as a fallback.
- PDF libraries are stored locally and never fetched from a third-party CDN at export time.
- Long reports render block-by-block and release canvases to reduce Android memory pressure.
- Existing report content, paid-section checks, and download permissions remain unchanged.
- Do not push or deploy during implementation.

---

### Task 1: Freeze Local PDF Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/sync-pdf-vendor.js`
- Create: `js/vendor/html2canvas.min.js`
- Create: `js/vendor/jspdf.umd.min.js`
- Create: `tests/pdf-vendor.test.js`

**Interfaces:**
- Consumes: npm packages `html2canvas@1.4.1` and `jspdf@2.5.2`.
- Produces: deterministic local browser assets under `js/vendor/`.

- [ ] **Step 1: Write the failing vendor test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('mobile PDF dependencies are local non-empty browser bundles', () => {
  for (const file of ['js/vendor/html2canvas.min.js', 'js/vendor/jspdf.umd.min.js']) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(body.length > 50000, file);
  }
});
```

- [ ] **Step 2: Run the vendor test and verify it fails**

Run: `node --test tests/pdf-vendor.test.js`  
Expected: FAIL because the vendor files do not exist.

- [ ] **Step 3: Install pinned dependencies**

Run: `npm install --save-exact html2canvas@1.4.1 jspdf@2.5.2`  
Expected: `package.json` and `package-lock.json` record exact versions.

- [ ] **Step 4: Add the vendor sync script**

```js
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = [
  ['node_modules/html2canvas/dist/html2canvas.min.js', 'js/vendor/html2canvas.min.js'],
  ['node_modules/jspdf/dist/jspdf.umd.min.js', 'js/vendor/jspdf.umd.min.js']
];
fs.mkdirSync(path.join(root, 'js/vendor'), { recursive:true });
for (const [source, target] of files) {
  fs.copyFileSync(path.join(root, source), path.join(root, target));
}
```

Add `"vendor:pdf": "node scripts/sync-pdf-vendor.js"` to `package.json`.

- [ ] **Step 5: Generate and test local bundles**

Run: `npm run vendor:pdf`  
Run: `node --test tests/pdf-vendor.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit the frozen dependencies**

```bash
git add package.json package-lock.json scripts/sync-pdf-vendor.js js/vendor tests/pdf-vendor.test.js
git commit -m "build: vendor mobile PDF libraries"
```

### Task 2: Paginated PDF Rendering Core

**Files:**
- Create: `js/report-pdf.js`
- Create: `tests/report-pdf.test.js`

**Interfaces:**
- Consumes: `{ html, filename, html2canvasImpl, JsPdfCtor, documentRef, onProgress }`.
- Produces: `ReportPdf.prepare(options) -> Promise<File|Blob>` and `ReportPdf.download(file, filename)`.

- [ ] **Step 1: Write failing renderer tests**

Use fake canvases and a fake jsPDF class to prove:

```js
test('prepare renders cover, sections and footer in DOM order and reaches 100', async () => {
  const rendered = [];
  const progress = [];
  const fixture = makeFixture(['cover', 'section-a', 'section-b', 'footer']);
  const file = await ReportPdf.prepare({
    html:fixture.html,
    documentRef:fixture.document,
    html2canvasImpl:async element => {
      rendered.push(element.id);
      return fakeCanvas(1200, 800);
    },
    JsPdfCtor:FakePdf,
    onProgress:value => progress.push(value)
  });
  assert.deepEqual(rendered, ['cover', 'section-a', 'section-b', 'footer']);
  assert.equal(progress.at(-1), 100);
  assert.equal(file.type, 'application/pdf');
});

test('an element taller than one A4 page is sliced across PDF pages', async () => {
  FakePdf.reset();
  const fixture = makeFixture(['cover']);
  await ReportPdf.prepare({
    html:fixture.html,
    documentRef:fixture.document,
    html2canvasImpl:async () => fakeCanvas(1200, 6000),
    JsPdfCtor:FakePdf
  });
  assert.ok(FakePdf.instances[0].images.length > 1);
  assert.equal(FakePdf.instances[0].pages, FakePdf.instances[0].images.length);
});

test('temporary frame is removed when rendering fails', async () => {
  const fixture = makeFixture(['cover']);
  await assert.rejects(
    ReportPdf.prepare({
      html:fixture.html,
      documentRef:fixture.document,
      html2canvasImpl:async () => { throw new Error('canvas failed'); },
      JsPdfCtor:FakePdf
    }),
    /PDF 生成失败/
  );
  assert.equal(fixture.document.querySelectorAll('iframe[data-report-pdf]').length, 0);
});
```

Define `fakeCanvas(width, height)` with a functioning `getContext('2d').drawImage`, `toDataURL`, and mutable width/height. Define `FakePdf` with recorded `addPage()`, `addImage()`, and `output('blob')` methods. Define `makeFixture(ids)` as a minimal fake document that creates one iframe whose `contentDocument.querySelectorAll()` returns block elements in the supplied order.

The fake PDF must record `addPage`, `addImage`, and `output('blob')` calls so page count is asserted without a real browser.

- [ ] **Step 2: Run renderer tests and verify they fail**

Run: `node --test tests/report-pdf.test.js`  
Expected: FAIL because `js/report-pdf.js` does not exist.

- [ ] **Step 3: Implement isolated report loading**

Create a hidden iframe with `srcdoc = html`, wait for `load` and `document.fonts.ready`, remove `.no-print`, and collect:

```js
const blocks = Array.from(frame.contentDocument.querySelectorAll('.cover, .section, .footer'));
if (!blocks.length) throw new Error('未找到可导出的报告内容');
```

- [ ] **Step 4: Implement block-by-block A4 rendering**

Use:

```js
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 10;
const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;
```

For each block, call html2canvas with a white/dark report background matching the source, `useCORS:true`, and scale capped at `Math.min(1.6, devicePixelRatio || 1)`. Slice canvases taller than the available page height into temporary page canvases, add each slice as JPEG, then set slice dimensions to `0` before processing the next block.

- [ ] **Step 5: Implement Blob creation, cleanup, and download**

Expose:

```js
async function prepare(options) {
  const documentRef = options.documentRef || document;
  const render = options.html2canvasImpl || window.html2canvas;
  const Pdf = options.JsPdfCtor || window.jspdf.jsPDF;
  const frame = createReportFrame(documentRef, options.html);
  try {
    await waitForReportFrame(frame);
    const blocks = Array.from(frame.contentDocument.querySelectorAll('.cover, .section, .footer'));
    if (!blocks.length) throw new Error('未找到可导出的报告内容');
    const pdf = new Pdf({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
    for (let index = 0; index < blocks.length; index += 1) {
      const canvas = await render(blocks[index], {
        useCORS:true,
        backgroundColor:'#0d0f18',
        scale:Math.min(1.6, window.devicePixelRatio || 1)
      });
      appendCanvasPages(pdf, canvas, index === 0);
      canvas.width = 0;
      canvas.height = 0;
      if (options.onProgress) options.onProgress(Math.round(((index + 1) / blocks.length) * 100));
    }
    const blob = pdf.output('blob');
    return typeof File === 'function'
      ? new File([blob], options.filename || '知时命理报告.pdf', { type:'application/pdf' })
      : blob;
  } catch (error) {
    throw new Error('PDF 生成失败：' + (error && error.message || '请使用 HTML 备用下载'));
  } finally {
    frame.remove();
  }
}

function download(file, filename) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
```

Clean the hidden iframe in `finally`.

- [ ] **Step 6: Run renderer tests**

Run: `node --test tests/report-pdf.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit the rendering core**

```bash
git add js/report-pdf.js tests/report-pdf.test.js
git commit -m "feat: generate paginated report PDFs"
```

### Task 3: Mobile Export Action Sheet

**Files:**
- Modify: `result.html`
- Modify: `js/result.js`
- Modify: `sw.js`
- Create: `tests/mobile-report-pdf.test.js`

**Interfaces:**
- Consumes: `buildReportHTML()` and `ReportPdf.prepare`.
- Produces: progress UI followed by explicit Download and Share actions.

- [ ] **Step 1: Write failing UI contract tests**

Assert:

```js
assert.match(resultHtml, /html2canvas\.min\.js/);
assert.match(resultHtml, /jspdf\.umd\.min\.js/);
assert.match(resultHtml, /report-pdf\.js/);
assert.match(resultSource, /ReportPdf\.prepare/);
assert.match(resultSource, /navigator\.canShare/);
assert.match(resultSource, /下载 PDF/);
assert.match(resultSource, /保存或分享/);
```

Also assert the mobile branch does not call `window.print()` as its primary action.

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `node --test tests/mobile-report-pdf.test.js`  
Expected: FAIL.

- [ ] **Step 3: Add the export action-sheet markup and styles**

Add one accessible modal with:

- status text;
- progress bar;
- “下载 PDF” button;
- “保存或分享” button;
- “下载 HTML 备用” link;
- close button.

Keep action buttons disabled until generation completes.

- [ ] **Step 4: Replace the mobile print branch**

Implement:

```js
async function prepareMobileReportPdf() {
  openPdfSheet('正在生成报告…', 0);
  try {
    const file = await ReportPdf.prepare({
      html:buildReportHTML(),
      filename:reportFilename('.pdf'),
      onProgress:updatePdfProgress
    });
    window._preparedReportPdf = file;
    showPdfActions(file);
  } catch (error) {
    showPdfFailure(error.message || 'PDF 生成失败，请下载 HTML 备用文件');
  }
}
```

The Download button calls `ReportPdf.download` in its own click handler. The Share button calls:

```js
if (navigator.canShare && navigator.canShare({ files:[file] })) {
  await navigator.share({ files:[file], title:'知时命理报告' });
}
```

Desktop `openReportInNewTab()` remains available.

- [ ] **Step 5: Cache the new local scripts**

Add the three PDF scripts to the service-worker static asset list and increment the cache version once.

- [ ] **Step 6: Run mobile export tests**

Run: `node --test tests/mobile-report-pdf.test.js tests/payment-ui-contract.test.js tests/static-mime-types.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit the mobile export UI**

```bash
git add result.html js/result.js sw.js tests/mobile-report-pdf.test.js
git commit -m "feat: add mobile PDF download flow"
```

### Task 4: Mobile Browser Verification

**Files:**
- Modify: `js/report-pdf.js` and tests only if verification exposes a reproducible defect.

**Interfaces:**
- Consumes: completed mobile PDF flow.
- Produces: verified Android/iPhone behavior with fallback paths.

- [ ] **Step 1: Run focused and full automated tests**

Run:

```bash
node --test tests/pdf-vendor.test.js tests/report-pdf.test.js tests/mobile-report-pdf.test.js
node --test tests/*.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Verify Android Chrome**

Using device emulation first and a real Android browser when available:

1. Unlock a report.
2. Tap “保存为 PDF”.
3. Confirm progress reaches 100%.
4. Tap “下载 PDF”.
5. Open the downloaded file and verify Chinese text, all paid sections, and multiple pages.

- [ ] **Step 3: Verify an Android in-app browser fallback**

Confirm either Share is available or the HTML fallback is visible and usable. The UI must not leave the user on a button that silently does nothing.

- [ ] **Step 4: Verify iPhone Safari and desktop**

Confirm iPhone can download/share the generated file and desktop can still use the existing print-to-PDF route.

- [ ] **Step 5: Inspect memory and cleanup**

Generate the longest available report twice. Confirm the second export completes, no hidden iframes remain, and the page remains responsive.

- [ ] **Step 6: Commit verification fixes if needed**

```bash
git add js/report-pdf.js js/result.js result.html tests/report-pdf.test.js tests/mobile-report-pdf.test.js
git commit -m "fix: harden mobile report export"
```
