# Task 3 Report: Canvas Poster Renderer

## Status

Complete.

Created `js/poster-renderer.js` and `tests/poster-renderer.test.js`. The browser module exposes `window.PosterRenderer.render()` and `window.PosterRenderer.download()`.

## TDD Evidence

### RED

`node --test tests/poster-renderer.test.js` failed with four expected `ENOENT` errors because `js/poster-renderer.js` did not yet exist.

### GREEN

`node --test tests/poster-renderer.test.js` passed: 4 tests, 4 passed, 0 failed.

The tests use a fake 2D context and injected readiness dependencies to cover fixed dimensions, readiness and drawing order, cover cropping, the required glyph/text/seal/gradient layout, typed readiness failures, WebP-to-JPEG fallback, default filename, and object-URL/anchor cleanup.

## Verification

- `node --check js/poster-renderer.js` — exit 0
- `node --test tests/poster-renderer.test.js` — 4 passed, 0 failed
- `node --test tests/*.test.js` — 97 passed, 0 failed
- `git diff --check` — exit 0

## Self-review

- Canvas dimensions are reset before either readiness dependency is invoked or any draw operation occurs.
- Image and font work begin together; drawing begins only after both succeed.
- Background cover crop is drawn before all text. The only translucent effect is the intentional blurred duplicate of the main glyph; no top parchment banner or explanatory top line is rendered.
- Both seals are opaque cinnabar blocks, copy uses a lower-third controlled gradient, and all coordinates use the 1080 by 1920 design canvas.
- Background, font, and export errors are converted to the required result objects. Export tries WebP first, retries JPEG when it gets no blob, and always cleans the temporary URL/anchor after a download attempt.

## Commit

`feat: add canvas poster renderer`

## Concerns

No known blockers. Page integration and background selection remain intentionally deferred to later tasks.

## Review Fix Round 1

### Findings fixed

1. Readiness is now failure-first. Background and font readiness begin together, race for the first settled result, and immediately return either typed failure without waiting for a peer that never settles. When the first result succeeds, rendering waits for the remaining readiness result before drawing.
2. The default browser font path requests every canvas font declaration and its rendered text through `document.fonts.load()` before awaiting `document.fonts.ready`. This covers the brush glyph and every serif text size used by the poster.
3. The automatic download filename now follows the successful blob type: `.webp` for WebP and `.jpg` for JPEG fallback. An explicitly supplied filename is unchanged.
4. Canvas sizing, context acquisition, and drawing errors now return `{ ok: false, error: 'RENDER_FAILED' }` instead of rejecting into the page.

### TDD evidence

The new focused regression tests failed before the fix for the expected reasons:

- readiness tests timed out when a peer promise never settled;
- the browser font test observed no `document.fonts.load()` requests;
- JPEG fallback retained a `.webp` filename;
- a null context threw a `TypeError`.

After the implementation, `node --test tests/poster-renderer.test.js` passed 8 tests with 0 failures.

### Verification

- `node --check js/poster-renderer.js`
- `node --test tests/poster-renderer.test.js`
- `node --test tests/*.test.js`
- `git diff --check`

All commands passed in the final verification run.

### Self-review and concern resolution

- The pending peer readiness promise has a rejection handler before failure-first return, so it cannot create an unhandled rejection.
- `context.filter` now degrades safely on contexts that do not expose that property; the intentional ink-bleed text remains blurred where the API is available.
- No result-page UI or background-selection code was changed.

### Commit

`fix: harden canvas poster renderer`
