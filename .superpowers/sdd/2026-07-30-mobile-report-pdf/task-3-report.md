# Task 3 Report: Mobile Export Action Sheet

## Outcome

The existing mobile branch of `openReportInNewTab()` now opens an accessible in-page action sheet and prepares a PDF in memory. Download and Web Share remain explicit post-generation user gestures. The desktop blob/new-tab/auto-print path is unchanged, and HTML export remains available throughout generation and after failure.

## RED evidence

- Initial command: `node --test tests/mobile-report-pdf.test.js`
- Result after correcting a test extraction helper: 9 tests, 1 pass, 8 expected failures.
- The passing test characterized the existing desktop route. Failures covered missing local dependency wiring, missing mobile controller, the old mobile blob/new-tab branch, missing gated download/share behavior, missing fallback UI, and the unchanged `zhishi-v5` cache.
- Self-review added a further capability-edge test: `node --test --test-name-pattern="share stays disabled" tests/mobile-report-pdf.test.js`.
- Result: 1 test, 0 pass, 1 expected failure because `canShare()` alone incorrectly enabled a dead share action when `navigator.share` was absent.

## GREEN evidence

- Focused command: `node --test tests/mobile-report-pdf.test.js`
- Result: 10 tests, 10 pass, 0 fail.
- Required regression command: `node --test tests/mobile-report-pdf.test.js tests/payment-ui-contract.test.js tests/static-mime-types.test.js tests/report-pdf.test.js`
- Result: 31 tests, 31 pass, 0 fail.
- Syntax command: `node --check js/result.js`
- Result: exit code 0.
- Supplemental preservation command: `node --test tests/poster-result-contract.test.js tests/result-structure-contract.test.js tests/light-theme-contract.test.js tests/paipan-direct-mode-contract.test.js`
- Result: 50 tests, 50 pass, 0 fail.

## UI and behavior decisions

- Added one bottom-sheet dialog with an accessible name and description, polite live status, semantic progressbar, 44px-or-larger controls, Escape/backdrop/close handling, and focus restoration.
- The PDF download and share controls start disabled. Successful preparation always enables download and enables share only when both `navigator.share` exists and `navigator.canShare({ files: [file] })` accepts the exact prepared file.
- The download handler calls `ReportPdf.download(file, filename)` only from its dedicated enabled button click.
- The share handler repeats the exact-file `canShare` check immediately before `navigator.share`; `AbortError` cancellation leaves the prepared download state unchanged.
- PDF failure leaves both PDF actions disabled, displays clear fallback guidance, and keeps “下载 HTML 备用” active.
- The report HTML is still produced by the existing `buildReportHTML()`, so paid-section filtering and report content remain centralized and unchanged.
- The existing report filename logic was extracted into `reportFilename(extension)` and reused for both HTML and PDF without changing direct-pillar naming.
- Local PDF scripts load in dependency order before `result.js`. The service worker cache advanced once from `zhishi-v5` to `zhishi-v6`, and the previous cache-name assertion was updated accordingly.

## Self-review

- Confirmed the mobile branch returns before session storage, blob creation, `window.open`, or printing.
- Confirmed desktop export still sets `zhishi_auto_print`, opens the generated report in a new tab, and retains the existing popup guidance and cleanup.
- Confirmed no paywall, paid-report rendering, poster, direct-pillar, report-layout, or light-theme implementation was changed.
- Confirmed unsupported sharing cannot produce an enabled dead button.
- Confirmed `.data-store.json` was not generated and `.superpowers/brainstorm/` was not touched.

## Commit

`feat: add mobile PDF download flow` (this task commit)

## Concerns

No blocking concerns. Native file sharing remains browser-dependent by design; unsupported browsers receive the enabled PDF download action and HTML fallback instead.
