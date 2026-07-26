# Task 6 Report: Poster Assets and Lazy Loading

## Delivered

- Added `tests/poster-assets.test.js`.
- Verified the 20-entry poster manifest maps each of the ten day masters to exactly one male and one female asset.
- Verified every referenced asset is a local, unique, non-empty WebP below 900 KiB; `ffprobe` decodes each at 1080 by 1920 and confirms manifest dimensions.
- Verified there are no PNG/JPEG production poster sources.
- Verified the homepage's local CSS/JS dependency graph does not load poster assets or poster implementation files.
- Verified `PosterUI.configure()` is resource-free; first open fetches only the manifest and renders only the selected URL once; completed renders are reused; reconfiguration waits for the stale render then renders only the new selection; malformed entries produce the typed retry state without rendering.

## TDD evidence

- The first focused run exposed two test-harness issues: an existing PWA `/manifest.json` injection in `js/auth.js` (not a poster dependency), and cross-realm object comparison from the UI VM.
- The homepage check was scoped to the poster manifest/assets, preserving the unrelated PWA manifest behavior; VM output is normalized before comparison. No production defect was demonstrated, so no runtime or manifest changes were made.

## Verification

- `node --test tests/poster-assets.test.js` — 5 passed.
- `node --test tests/*.test.js` — 119 passed.
- `node --check tests/poster-assets.test.js`, `node --check js/poster-ui.js`, `node --check js/poster-renderer.js`, and `node --check js/poster-templates.js` — passed.
- `git diff --check` — passed.

## Scope note

`js/auth.js` intentionally loads the site-wide PWA `/manifest.json`; it is not the poster manifest and remains unchanged. The homepage exclusion test rejects the poster manifest path and all poster asset/module references.
