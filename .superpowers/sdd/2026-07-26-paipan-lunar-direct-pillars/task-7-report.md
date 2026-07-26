# Task 7 Report

Status: **DONE**

## Changes

- Added the deferred dedicated pre-Li-Chun reverse-lookup regression.
- Added executable mode-switch and rendered-candidate click coverage.
- Created `docs/verification/2026-07-26-paipan-enhancements.md`.

## Verification

- Full suite: `78/78` passed, `0` failed.
- Explicit lunar suite: `5/5` passed, `0` failed.
- Targeted reverse-lookup/direct UI suite: `14/14` passed, `0` failed.
- Solar, lunar, matched-direct, and no-match direct runtime flows passed through the installed Playwright + Edge fallback.
- Viewports `1440×900`, `390×844`, and `430×932` had no horizontal overflow, aligned tabs, and readable candidate selection.

## Blocking findings

- The requested in-app browser backend is unavailable (`Browser is not available: iab`; available backend list `[]`).
- Direct-mode calendar-only controls remain visibly rendered even though `hidden=true` and the controls are disabled.
- Desktop pillar selects render at `19px`, below the `44px` acceptance target; mobile controls render at approximately `44px`.

No production behavior was changed.

## Follow-up after reviewed fix `60346b7`

The previously blocked visual checks were rerun with the existing Playwright + Microsoft Edge fallback.

- Focused direct-mode acceptance tests: `11/11` passed, `0` failed.
- Full suite: `80/80` passed, `0` failed.
- At `1440×900`, `390×844`, and `430×932`, all three calendar-only rows had `hidden=true`, computed `display:none`, zero height, and disabled fields while direct mode was active.
- All eight pillar selects measured exactly `44px` at all three viewports.
- No horizontal overflow occurred at any target viewport.
- Returning to solar mode restored all three calendar-only rows. Normal controls were enabled; the dependent district selector remained disabled until a parent location is selected, as designed.

The hidden-field and desktop sizing blockers are resolved. In-app browser availability remains deferred, but the complete focused acceptance ran successfully through the established Edge fallback. Final status: **DONE**.

## Scope correction

Commit `e294f17` had merged remote `main` into the feature branch after Task 6, adding unrelated changes to `js/bazi.js` and `js/result.js`. It was corrected additively, without reset or rebase, by first-parent revert commit:

```text
ba355cc Revert "Merge branch 'main' of https://github.com/Eriver111/zhishi-bazi into feat/light-ui-redesign"
```

Post-correction verification:

- Focused direct-pillar and solar-safety suite: `31/31` passed, `0` failed.
- Full suite: `80/80` passed, `0` failed.
- `git diff 7c9052a..HEAD` contains exactly four intended files:
  - `css/theme-light-forms.css` — 2 insertions
  - `docs/verification/2026-07-26-paipan-enhancements.md` — verification record
  - `tests/paipan-direct-mode-contract.test.js` — Task 7 and reviewed visual-fix coverage
  - `tests/pillar-reverse-lookup.test.js` — pre-Li-Chun regression
- `git diff --quiet 7c9052a..HEAD -- js/bazi.js js/result.js` exits `0`; neither production JavaScript file differs from the Task 6 endpoint.

The unrelated remote-main content is no longer present in the resulting feature-branch state. Intended paipan commits and later Task 7 verification commits remain preserved in history.

## Verification fix round 1 — final corrected HEAD

Tested commit:

```text
ba355cc90a4448d6d0b6797acef053bb9be791ab
```

Commands and observed results:

```text
node <temporary Playwright + Microsoft Edge acceptance harness>
  PASS — solar, lunar, matched-direct, unknown-direct; three viewports

node --test tests/*.test.js
  PASS — 80 tests, 80 passed, 0 failed

node --test tests/lunar-calendar.test.js
  PASS — 5 tests, 5 passed, 0 failed
```

The live harness entered solar `2024-03-18`, hour-index `3`, clock `06:00`, male; lunar `2013-1-1`, hour-index `3`, clock `06:00`, female; matched direct `甲辰 丁卯 辛巳 辛卯`, male; and unknown direct `甲辰 丁卯 辛巳 甲子`, male. It asserted the exact solar and lunar URLs, preserved matched result pillars, and verified the unknown URL had no fabricated timing, location, or correction parameters.

At `1440×900`, `390×844`, and `430×932`, direct mode had no horizontal overflow, exactly two candidates, and eight `44px` selects. The solar-restoration checks confirmed active 公历/solar state, inactive 四柱/pillars state, and visible calendar fields at all three viewports. Final screenshot evidence is committed at `docs/verification/evidence/bazi-task7-final-ba355cc-*.png`; the new `390×844` solar-restoration image visibly shows 公历 selected, correcting the prior evidence mismatch.

No production code was changed. The in-app browser backend remains unavailable; this run used the established local headless Edge fallback.

## Final-review fix wave — leap-month day selector

Root cause: `updateLunarDays()` always used the ordinary-month `monthDays()` API after parsing a selected leap-month option. This omitted day 30 for 2017 leap June and offered invalid day 30 for 2023 leap February.

- Added `LunarCalendar.lunarMonthDays(year, month, isLeap)` and used the selected option's parsed `isLeap` state in the lunar day selector.
- Added executable API and selector coverage for 2017 ordinary/leap June (`29`/`30`) and 2023 ordinary/leap February (`30`/`29`).

Commands and observed results:

```text
node --test tests/lunar-calendar.test.js tests/lunar-day-selector.test.js
  RED before implementation: 5 passed, 2 failed
  GREEN after implementation: 7 passed, 0 failed

node --test tests/*.test.js
  PASS — 82 tests, 82 passed, 0 failed

node --check js/lunar.js
node --check js/main.js
git diff --check
  PASS — all exited 0
```
