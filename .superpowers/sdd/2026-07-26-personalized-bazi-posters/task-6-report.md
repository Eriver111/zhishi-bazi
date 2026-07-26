# Task 6 Report: Poster Assets and Lazy Loading

## Delivered

- Added `tests/poster-assets.test.js`.
- Verified the 20-entry poster manifest maps each of the ten day masters to exactly one male and one female asset.
- Verified every referenced asset is a local, unique, non-empty WebP below 900 KiB; a dependency-free RIFF/VP8-family parser validates each at 1080 by 1920 and confirms manifest dimensions.
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

## Review fix round 1

- Fixed root-relative homepage dependency traversal: `/js/...` and `/css/...` references resolve from the declared repository/site root. Lexical and real-path containment keep the entry file and every traversed dependency inside that root. A temporary-site regression fixture proves root-relative linked assets and imports are scanned while an outside-root entry is rejected.
- Removed the undeclared machine `ffprobe` dependency. WebP verification now uses only Node built-ins to validate the RIFF/WEBP signature, exact declared container size, chunk bounds, required zero padding, and a single supported image payload.
- Tightened VP8-family checks: `VP8X` must be first and unique, reserved flag bits/bytes must be zero, animation is rejected for poster assets, and canvas area/dimensions are validated; `VP8 ` and `VP8L` signatures, versions, first-partition bounds/non-empty bitstreams, non-zero dimensions, and VP8X-to-payload dimension agreement are checked.
- Added hand-built VP8, VP8L, and VP8X fixtures plus regressions for wrong signatures/sizes, truncated containers and bitstreams, invalid padding, reserved metadata, duplicate/late/animated VP8X headers, unsupported versions, zero dimensions, excessive canvas area, and contradictory dimensions.
- Focused verification after the fix: `node --test tests/poster-assets.test.js` — 13 passed.
- Full verification after the fix: `node --test tests/*.test.js` — 127 passed.
- Syntax checks for the changed test and poster UI modules passed; `git diff --check` passed.

## Recovery note

- Preserved the two Task 6 working files before aborting an accidental merge, then restored them byte-for-byte.
- Restored `js/bazi.js` in both the index and working tree to the exact `ac998df` blob; it is not part of this change.
- Restored the pre-existing untracked `.superpowers/brainstorm/` visual-session assets in place with all 17 per-file SHA-256 hashes unchanged; they are excluded from the Task 6 commit.

## Review fix round 2

- Renamed the pure-Node routine to `inspectWebPContainer`: it remains a defensive RIFF/chunk and advertised-dimension inspection only, rather than implying full image decoding.
- Added a real Playwright browser-decoder check. It opens one headless Chromium browser/page and feeds the 20 manifest assets as `data:image/webp` URLs to `HTMLImageElement.decode()`, then verifies every decoded image reports natural dimensions of 1080 by 1920.
- The test also supplies a hand-built VP8 RIFF fixture whose structural header advertises 1080 by 1920 but whose payload is not a complete VP8 bitstream. The pure container inspector accepts that header structure; Chromium rejects it, proving the regression check exercises an actual decoder.
- Browser startup prefers Playwright's bundled Chromium. If that executable is absent locally, the test may use an installed Microsoft Edge executable; otherwise it fails with a clear local-installation message. This verification used the bundled Chromium and never started the application server.
- The browser is closed in a `finally` block so test failures do not leak a process.
