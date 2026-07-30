# Task 1 Report: Freeze Local PDF Dependencies

## RED evidence

Command: `node --test tests/pdf-vendor.test.js`

Result: 0 passing, 2 failing. Both failures were expected `ENOENT` errors for the missing local paths:

- `js/vendor/html2canvas.min.js`
- `js/vendor/jspdf.umd.min.js`

## GREEN evidence

Commands:

```text
npm run vendor:pdf
node --test tests/pdf-vendor.test.js
```

Result: 2 passing, 0 failing. The generated local browser bundles measure 198,689 bytes (`html2canvas.min.js`) and 365,730 bytes (`jspdf.umd.min.js`).

## Changed files

- `package.json` — exact package versions and `vendor:pdf` script.
- `package-lock.json` — resolved dependency graph.
- `scripts/sync-pdf-vendor.js` — copies the two installed browser bundles into `js/vendor`.
- `js/vendor/html2canvas.min.js` — locally frozen html2canvas browser bundle.
- `js/vendor/jspdf.umd.min.js` — locally frozen jsPDF browser bundle.
- `tests/pdf-vendor.test.js` — verifies each local bundle exceeds 50,000 characters.

## Version checks

- `package.json`: `html2canvas` is `1.4.1`; `jspdf` is `2.5.2` (no version ranges).
- `package-lock.json`: `node_modules/html2canvas` resolves to `1.4.1`; `node_modules/jspdf` resolves to `2.5.2`.

## Commit

`build: vendor mobile PDF libraries`

## Self-review

- The sync script creates `js/vendor` before copying and uses the required source and destination paths.
- Bundles are committed as local static assets, so the later export implementation can load them without a third-party CDN.
- No report behavior was changed.

## Concerns

- `npm install` reports two existing dependency-audit findings (one moderate and one critical); they were not addressed because they are outside this dependency-freezing task.
