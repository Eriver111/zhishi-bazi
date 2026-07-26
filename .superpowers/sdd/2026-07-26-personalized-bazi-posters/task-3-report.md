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
