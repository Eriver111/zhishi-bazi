# Shared Birth Input and Pillar UI Implementation Plan

> **For Codex:** Follow test-driven development. Keep payment, report unlock, account storage, and direct-pillar professional calculations out of scope.

**Goal:** Make Ziwei public/lunar input reuse the BaZi birth normalization path, default BaZi Zi-hour rollover on without changing its existing algorithm, and restyle the direct-pillar input responsively.

**Architecture:** Keep `BaZiCalculator.normalizeBirthInput` as the single professional time-normalization authority. Convert Ziwei clock-hour inputs into BaZi's branch-index plus exact clock, call the BaZi normalizer, then adapt the returned date/time to `iztro`'s early/late Zi-hour indexes. Keep `iztro` responsible for Ziwei palaces and stars. Reuse `LunarCalendar` for Ziwei lunar conversion.

**Stack:** Browser JavaScript, HTML/CSS, Node test runner, Playwright for visual/runtime checks.

---

## Task 1: Lock the existing Zi-hour rule and default state

**Files:**
- Modify: `tests/bazi-professional-core.test.js`
- Modify: `tests/form-structure-contract.test.js`
- Modify: `paipan.html`

1. Add a failing test proving `ziHourNextDay: true` gives offset `1` for branch index `0` and offset `0` for every other branch.
2. Add a failing contract test requiring the BaZi `zishiHuanri` checkbox to be checked by default.
3. Run the focused tests and confirm failure only for the missing default state.
4. Add `checked` to the existing checkbox without changing `normalizeBirthInput`, `calculateBaZi`, or `getDayPillar`.
5. Re-run the focused tests.

## Task 2: Make Ziwei consume BaZi normalization

**Files:**
- Modify: `tests/ziwei-professional-core.test.js`
- Modify: `js/ziwei-input.js`
- Modify: `js/ziwei-render.js`
- Modify: `ziwei.html`

1. Add failing tests comparing Ziwei normalization against `BaZiCalculator.normalizeBirthInput` for ordinary hours, Zi hour, true-solar transitions, and date crossings.
2. Add a page contract requiring `js/bazi.js` to load before `js/ziwei-input.js`.
3. Refactor `ZiweiInput.normalizeBirth` into an adapter around the BaZi normalizer; remove the independent equation-of-time and longitude calculation path.
4. Derive `iztro` time index `12` only when the normalized exact hour is 23; use `0` for the rest of Zi hour and the normal branch index otherwise.
5. Remove Ziwei's duplicate province/city longitude tables and pass the same location precedence as BaZi.
6. Re-run focused Ziwei and BaZi tests.

## Task 3: Add public/lunar Ziwei entry modes

**Files:**
- Modify: `tests/ziwei-professional-core.test.js`
- Modify: `ziwei.html`
- Modify: `js/ziwei-render.js`

1. Add failing page-contract tests for public/lunar tabs, lunar year/month/day fields, leap-month handling, and shared correction switches.
2. Load `js/lunar.js` and add Ziwei public/lunar panels using the existing site form vocabulary.
3. Populate valid lunar months/days with `LunarCalendar`, including leap months.
4. Convert lunar submissions to public dates before calling the shared BaZi normalizer.
5. Add true-solar and Zi-hour checkboxes; default both on. Preserve their state in the current in-page chart context.
6. Show one shared normalization summary in the Ziwei information area.
7. Run focused tests.

## Task 4: Adapt the direct-pillar UI to the current site theme

**Files:**
- Modify: `tests/paipan-direct-mode-contract.test.js`
- Modify: `paipan.html`
- Modify: `css/theme-light-forms.css`

1. Add failing structural/style tests requiring four columns at desktop and phone widths, day-pillar emphasis, 44px controls, and no horizontal overflow strategy.
2. Wrap each existing select in a themed control shell while preserving every ID, name, query parameter, and event path.
3. Apply existing warm-paper, vermilion, pine, border, radius, and typography variables; do not add unrelated decorative assets.
4. Keep four columns on mobile by tightening gaps and auxiliary labels, not by shrinking touch targets.
5. Restyle candidate dates and gender/action hierarchy without changing behavior.
6. Run direct-pillar tests.

## Task 5: Regression and browser verification

**Files:**
- Test only unless a verified issue requires a scoped correction.

1. Run all Node tests and compare failures with the known baseline.
2. Start the local site and exercise BaZi public, lunar, direct-pillar and Ziwei public/lunar flows.
3. Verify at desktop and narrow mobile widths, including 320px.
4. Verify the same birth input yields the same normalized date, time, branch index, and Zi-hour offset evidence across BaZi and Ziwei.
5. Confirm no payment-related file changed.
6. Review the final diff, then commit implementation locally. Do not push unless the user requests it.

