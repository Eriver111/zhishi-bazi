# Task 4 Report: Result-Page Poster Modal

## Status

Implemented the result-page poster entry and isolated modal without moving or restructuring any existing result section.

## Changes

- Added one `#posterButton` beside the existing share-report action.
- Added one accessible `#posterModal` with Canvas preview, live status, free download, retry, and close controls.
- Added `window.PosterUI.configure()` and `window.PosterUI.open()` in `js/poster-ui.js`.
- Kept `configure()` side-effect free beyond model resolution: it does not fetch the manifest, load an image, or render.
- Made `open()` fetch `/images/posters/manifest.json` lazily, select only the configured background entry, and issue one renderer call.
- Added typed manifest, background, font, render, and export failure states with retry.
- Added in-flight render/download guards, successful-preview reuse, one-time listener binding, Escape close, backdrop close, focus return, and body scroll restoration.
- Added responsive modal/preview rules and 44px touch targets at 390px.
- Loaded poster templates, renderer, and UI before `js/result.js` and the existing result integrations.
- Configured the poster at the end of `render(data)` using `_bazi`, `_params.gender`, and `getPattern(_bazi)`.

## TDD Evidence

1. Added `tests/poster-result-contract.test.js`.
2. Ran the focused test before production changes.
3. Confirmed 10 expected failures caused by the missing poster IDs, scripts, configure call, UI module, and responsive CSS.
4. Added the minimal integration.
5. Re-ran the focused suite: 10/10 passed.
6. Independent review identified four edge cases; added four focused regressions, watched them fail, and fixed only those cases.
7. Final focused suite: 13/13 passed.

## Verification

- Syntax:
  - `node --check js/poster-ui.js`
  - `node --check js/result.js`
  - Result: passed.
- Focused and structural regression:
  - `node --test tests/poster-result-contract.test.js tests/result-structure-contract.test.js tests/poster-templates.test.js tests/poster-renderer.test.js tests/poster-fonts.test.js`
  - Result: 42/42 passed.
- Full suite:
  - PowerShell-expanded `node --test` over every `tests/*.test.js` file.
  - Result: 114/114 passed.
- Diff hygiene:
  - `git diff --check`
  - Result: passed.

## Self-Review

- Existing share behavior and result section IDs remain intact.
- Poster work is isolated to the requested files.
- Poster generation and download paths do not call paywall or point APIs.
- Repeated open calls share one in-flight render and do not duplicate event listeners.
- Reconfiguration waits for an existing Canvas render, then renders the newly selected model without overlap or stale UI updates.
- Synchronous and asynchronous export failures both restore the download control and remain typed.
- Tab and Shift+Tab stay within the open modal; the mobile result-page entry and modal controls meet the 44px target.
- Manifest data is cached only after a successful lazy fetch; a manifest failure can be retried.
- Existing untracked `.superpowers/brainstorm/` content was not modified.

## Concerns / Follow-Up

- Task 5 still needs to add `/images/posters/manifest.json` and the 20 background assets. Until then, opening the modal intentionally shows the typed retry state without affecting the result page.
- `PosterUI` accepts a manifest array or an object containing `entries`, `posters`, `backgrounds`, or `assets` arrays; it also accepts a direct background-key mapping. Task 5 entries may identify the selected asset by key or by `{dayGan, gender}` and must provide `src`.
