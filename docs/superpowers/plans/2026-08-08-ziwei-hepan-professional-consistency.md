# Ziwei and Hepan Professional Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ziwei charts deterministic and correct at date/hour boundaries, and make Hepan consume the exact same BaZi chart and professional facts as the personal result page.

**Architecture:** Add small testable normalization functions at the existing calculator boundaries. Keep `iztro 2.5.8` as the sole Ziwei engine and `BaZiCalculator.getProfessionalReportFacts()` as the sole BaZi professional source; rendering code only displays returned facts. Do not modify payment, order, report-unlock, or payment persistence files.

**Tech Stack:** Browser JavaScript, Node.js built-in test runner, `iztro 2.5.8`, existing `BaZiCalculator`.

## Global Constraints

- Do not modify payment APIs, payment UI, callbacks, report unlocking, or payment database logic.
- Do not push to the remote repository.
- Preserve existing public URLs and page structure.
- Personal BaZi results are authoritative for four pillars, strength, pattern, and 喜用忌.
- Every production behavior change must have a failing regression test first.

---

### Task 1: Ziwei birth-input normalization

**Files:**
- Create: `js/ziwei-input.js`
- Create: `tests/ziwei-professional-core.test.js`
- Modify: `ziwei.html`
- Modify: `js/ziwei-render.js`

**Interfaces:**
- Produces: `ZiweiInput.validateSolarDate(year, month, day): boolean`
- Produces: `ZiweiInput.clockHourToBranchIndex(hour): number`
- Produces: `ZiweiInput.normalizeBirth(input): { solarDate, timeIndex, trueHour, trueMinute, dayOffset }`
- Consumes: normalized result in `doPaipan()` before `iztro.astro.bySolar()`.

- [ ] **Step 1: Write failing Ziwei tests**

Add tests proving that invalid dates are rejected, hour labels and calculation agree for all 24 hours, 23:00 uses time index 12, true-solar correction preserves the correct previous/next date, and renderer uses the current `iztro`命身宫 fields.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/ziwei-professional-core.test.js`

Expected: failures because `js/ziwei-input.js` and the required renderer behavior do not exist.

- [ ] **Step 3: Implement the minimal normalization module and wire it into the page**

Implement a browser/Node compatible module, include it before `ziwei-render.js`, replace the inline hour/date normalization, use index `12` for late Zi hour, and catch `iztro` errors without leaving the loading state active.

- [ ] **Step 4: Correct renderer-owned professional labels**

Use `earthlyBranchOfSoulPalace` and `earthlyBranchOfBodyPalace`; derive 阴阳男/女 and lunar Ganzhi from `zi.chineseDate`; stop using fixed-forward locally generated flow-year data when library data is available.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/ziwei-professional-core.test.js`

Expected: all Ziwei tests pass.

### Task 2: Shared BaZi birth normalization for personal and Hepan pages

**Files:**
- Modify: `js/bazi.js`
- Modify: `js/result.js`
- Modify: `js/hepan-result.js`
- Modify: `tests/bazi-professional-core.test.js`
- Create: `tests/hepan-professional-consistency.test.js`

**Interfaces:**
- Produces: `BaZiCalculator.normalizeBirthInput(params): normalizedParams`
- Produces: `BaZiCalculator.calculateFromBirthInput(params): { bazi, normalized }`
- Consumes: both personal result and Hepan person builders.

- [ ] **Step 1: Write failing shared-input tests**

Test identical raw parameters through personal and Hepan paths, including true-solar cross-day, disabled true-solar time, Zi-hour day change, minutes, location, and lunar-converted dates.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/bazi-professional-core.test.js tests/hepan-professional-consistency.test.js`

Expected: Hepan loses location/timing flags and no shared calculator entry point exists.

- [ ] **Step 3: Add the shared calculator boundary**

Move the existing result-page normalization semantics into `BaZiCalculator.normalizeBirthInput()` and `calculateFromBirthInput()`. Preserve the rule that true-solar cross-day changes the civil date, while optional Zi-hour day change changes only the day pillar offset.

- [ ] **Step 4: Make both result pages consume the shared boundary**

Update personal result construction and Hepan `buildPerson()` to call the same entry point. Extend Hepan parameter parsing to retain `prov`, `city`, `dist`, `solar`, and `zishi`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/bazi-professional-core.test.js tests/hepan-professional-consistency.test.js`

Expected: both paths produce byte-for-byte identical four pillars for the same inputs.

### Task 3: Use personal professional facts throughout Hepan

**Files:**
- Modify: `js/hepan-core.js`
- Modify: `js/hepan-result.js`
- Modify: `tests/hepan-professional-consistency.test.js`

**Interfaces:**
- Consumes: `person._professionalFacts.yongJi` and `.strength`.
- Produces: Hepan `xiyong.p1/p2` with array-valued `xiShen`, `yongShen`, and `jiShen` identical to personal results.

- [ ] **Step 1: Write failing professional-fact tests**

For representative 调候、扶抑、格局救应 and 从格 charts, assert Hepan output exactly equals `BaZiCalculator.getProfessionalReportFacts()` and downstream advice references the same roles.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/hepan-professional-consistency.test.js`

Expected: old `calcXiyong()` differs from personal facts.

- [ ] **Step 3: Replace the old Hepan decision path**

Populate `_professionalFacts` once per person. Make `calcDayGanStrength()` and `calcXiyong()` read it, remove silent legacy fallbacks from the formal page path, and update complement matching/copy for array-valued 喜神.

- [ ] **Step 4: Update rendering for array values**

Join 喜神、用神、忌神 arrays with `、` and preserve current card layout.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/hepan-professional-consistency.test.js`

Expected: all professional consistency tests pass.

### Task 4: Resolve existing BaZi professional regressions

**Files:**
- Modify: `js/bazi.js`
- Modify only if professional evidence requires it: `tests/bazi-professional-core.test.js`

**Interfaces:**
- Preserves: `calcDayMasterStrength()` scoring contract.
- Preserves: `getGanHe()` result with `isTransformed` plus a description containing the general category and specific reason.

- [ ] **Step 1: Use the two existing failures as RED evidence**

Run: `node --test tests/bazi-professional-core.test.js`

Expected: wet-earth score mismatch and missing “合而不化” wording.

- [ ] **Step 2: Trace the wet-earth one-point difference**

Compare the score before and after later position/combination adjustments. Change production scoring only if the current code violates the documented wet-earth rule; otherwise update the expected score and add evidence assertions so the test does not merely lock an unexplained number.

- [ ] **Step 3: Preserve both Gan-He classification and reason**

For an unsupported distant pair, emit wording equivalent to `合而不化（隔柱不化）：...`; keep successfully transformed pairs unchanged.

- [ ] **Step 4: Run all professional tests**

Run: `node --test tests/bazi-professional-core.test.js tests/bazi-yongji-report.test.js tests/hepan-professional-consistency.test.js tests/ziwei-professional-core.test.js`

Expected: all pass.

### Task 5: Final regression and scope verification

**Files:**
- No production files unless a test exposes an in-scope regression.

**Interfaces:**
- Verifies all prior tasks and confirms payment files have no diff.

- [ ] **Step 1: Run JavaScript syntax checks and all tests**

Run: `node --check js/ziwei-input.js; node --check js/ziwei-render.js; node --check js/bazi.js; node --check js/result.js; node --check js/hepan-core.js; node --check js/hepan-result.js; node --test tests/*.test.js`

- [ ] **Step 2: Verify payment scope is untouched**

Run: `git diff --name-only <design-commit>..HEAD` and confirm no payment/order/report-unlock files appear.

- [ ] **Step 3: Review the final diff and working tree**

Confirm unrelated pre-existing `.env`, media deletions, local data, and user files remain untouched and unstaged.

- [ ] **Step 4: Create one local implementation commit**

Stage only the Ziwei, Hepan, BaZi, test, and plan files. Do not push.
