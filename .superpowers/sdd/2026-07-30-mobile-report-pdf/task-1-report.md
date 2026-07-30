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

- `package.json`: `html2canvas` is `1.4.1`; the original Task 1 pin was `jspdf@2.5.2` (no version ranges).
- At the end of Task 1, `package-lock.json` resolved `node_modules/html2canvas` to `1.4.1` and `node_modules/jspdf` to `2.5.2`.

## Commit

`build: vendor mobile PDF libraries`

## Self-review

- The sync script creates `js/vendor` before copying and uses the required source and destination paths.
- Bundles are committed as local static assets, so the later export implementation can load them without a third-party CDN.
- No report behavior was changed.

## Concerns

- Correction recorded by the final fix wave: the moderate and critical audit findings were introduced by the new `jspdf@2.5.2` dependency in Task 1; they were not pre-existing baseline findings. The final fix wave replaces that unsafe pin with exact `jspdf@4.2.1`.
