# Task 2 Report: Paginated PDF Rendering Core

## Status

Implemented the browser/CommonJS `ReportPdf` module and its focused Node test suite.

## RED evidence

Command:

```text
node --test tests/report-pdf.test.js
```

Observed before `js/report-pdf.js` existed:

```text
Error: Cannot find module '../js/report-pdf.js'
tests 1
pass 0
fail 1
```

This was the expected failure: the tests could not load the not-yet-created production module.

## GREEN evidence

Command:

```text
node --test tests/report-pdf.test.js
```

Observed after the implementation:

```text
tests 4
pass 4
fail 0
```

Syntax verification:

```text
node --check js/report-pdf.js
```

Exited with status 0 and no diagnostics.

## Implementation decisions

- The iframe is visually hidden off-screen rather than `display:none`, preserving layout for canvas rendering.
- The iframe is sandboxed with `allow-same-origin` but not `allow-scripts`, preserving parent DOM access while preventing legacy report scripts from invoking native printing during export.
- Report blocks are queried once in DOM order and rendered sequentially, so only one source canvas is retained at a time.
- A4 output uses 10 mm margins and 190 mm content width. Tall canvases are sliced at `floor(277 * canvasWidth / 190)` source pixels per page; each PDF image height is derived from that exact slice height to preserve its aspect ratio.
- The first image uses jsPDF's initial page. Every subsequent block or slice adds a page immediately before its image, preventing an empty first page.
- Source canvases and temporary slice canvases are zeroed in `finally` blocks to release Android graphics memory even if PDF insertion fails.
- Browser-only dependencies are injectable through `prepare`; normal browser globals remain the fallback.
- Blob URLs are revoked after 60 seconds, while the temporary download anchor is removed immediately.

## Tests

- DOM-order block rendering, html2canvas options, jsPDF options, final 100% progress, iframe cleanup, and source-canvas release.
- Three-page slicing of a 1000×3000 canvas, exact source offsets/heights, one image per page, aspect-ratio preservation, no blank first page, and temporary-canvas release.
- Chinese error wrapping and iframe cleanup after a rendering failure.
- Object URL creation, temporary anchor click/removal, filename assignment, and delayed URL revocation.

## Self-review

- Confirmed the implementation contains no `window.print()` call and no remote library loading.
- Confirmed cleanup runs through `finally` for the iframe, each source canvas after creation, and every temporary slice canvas.
- Confirmed no report/paywall content or permissions were changed.
- Confirmed `.superpowers/brainstorm/` was not touched and `.data-store.json` was not generated.
- Reviewed mutations for wrong A4 slice height, eager `addPage()`, omitted canvas release, wrong progress rounding, and missing error wrapping; each is covered by a focused assertion.

## Review follow-up

An independent read-only review found that unsandboxed `srcdoc` could execute the existing report's legacy auto-print script. A regression assertion was added first and produced the expected RED:

```text
expected 'allow-same-origin'
actual undefined
tests 4
pass 3
fail 1
```

The iframe now uses `sandbox="allow-same-origin"` without `allow-scripts`. The focused suite returned to 4/4 GREEN and the syntax check remained clean. The review also suggested JPEG encoding, but the exact Task 2 brief does not require an image format; direct canvas insertion was retained to avoid adding an unrequested base64 encoding allocation.

## Commit

Required commit message: `feat: generate paginated report PDFs`

## Concerns

The focused suite uses complete fake browser/PDF boundaries; a real mobile-browser smoke test remains appropriate when the later integration task wires this module into the report UI.
