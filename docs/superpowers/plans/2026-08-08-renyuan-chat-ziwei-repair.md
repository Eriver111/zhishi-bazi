# Renyuan, Mobile Chat, and Ziwei Professional Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing renyuan seasonal-command evidence consistently, keep all mobile AI chats stable when the keyboard opens, and replace error-prone Ziwei presentation logic with evidence derived from iztro 2.5.8.

**Architecture:** Add small shared, browser/Node-compatible helpers for renyuan evidence, chat viewport sizing, and Ziwei professional facts. Existing pages keep their current layouts and consume those helpers, so the calculation source is singular and testable while visual changes stay narrow.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Node.js built-in test runner, iztro 2.5.8, browser smoke testing.

## Global Constraints

- Do not modify payment, order, callback, report-unlock, credit, or `.env` files.
- Human-yuan seasonal command is reference evidence only and must not alter official strength, pattern, or xi/yong/ji results.
- Show the renyuan note only when its element differs from the month-branch main qi and a real birth date is available.
- Keep all three chat pages visually unchanged on desktop; mobile text inputs must use at least 16px type.
- Keep iztro 2.5.8 as the sole Ziwei calculation source and do not fabricate star brightness or deterministic outcomes.
- Preserve the current Ziwei page/card framework while replacing fixed good/bad scores with traceable evidence.

---

### Task 1: Renyuan evidence contract

**Files:**
- Modify: `js/bazi.js`
- Modify: `tests/bazi-professional-core.test.js`

**Interfaces:**
- Consumes: `bazi._siLing`, `getShiShen(stem, dayStem)`, five-element production/control helpers.
- Produces: `getRenYuanEvidence(bazi)` returning `{visible, days, stem, element, tenGod, status, scoreDelta, text}` and `professionalFacts.renYuan`.

- [ ] **Step 1: Write failing tests for different-element visibility, same-element suppression, and absent-date suppression.**
- [ ] **Step 2: Run `node --test tests/bazi-professional-core.test.js` and verify the new assertions fail because the public evidence contract is absent.**
- [ ] **Step 3: Implement `getRenYuanEvidence` with the 旺/相/休/囚/死 relationship map and the approved cautious copy.**
- [ ] **Step 4: Add the evidence to `getProfessionalReportFacts` without changing `calcDayMasterStrength`, `getPattern`, or `getYongJi`.**
- [ ] **Step 5: Re-run the focused test and verify all assertions pass.**
- [ ] **Step 6: Commit `feat: expose renyuan seasonal evidence`.**

### Task 2: Renyuan result-page and AI consistency

**Files:**
- Modify: `js/result.js`
- Modify: `result.html`
- Modify: `api/ai-chat.js`
- Create: `tests/renyuan-presentation.test.js`

**Interfaces:**
- Consumes: `BaZiCalculator.getRenYuanEvidence(bazi)` and the single `dayMasterStrength.level` value.
- Produces: `chartData.renYuan`, one subdued result-page note, and a matching AI context line.

- [ ] **Step 1: Write static/VM tests proving the result and AI paths consume `renYuan`, show it before strength evidence, and do not derive a second strength label.**
- [ ] **Step 2: Run `node --test tests/renyuan-presentation.test.js` and verify failure.**
- [ ] **Step 3: Populate `chartData.renYuan`, render the approved note at approximately 9px only when `visible`, and append the same text to the Bazi AI context.**
- [ ] **Step 4: Re-run the new test and `tests/bazi-professional-core.test.js`.**
- [ ] **Step 5: Commit `feat: show renyuan evidence consistently`.**

### Task 3: Shared mobile chat viewport stabilizer

**Files:**
- Create: `js/chat-viewport.js`
- Modify: `ai-chat.html`
- Modify: `zw-ai-chat.html`
- Modify: `lr-ai-chat.html`
- Create: `tests/mobile-chat-viewport.test.js`

**Interfaces:**
- Produces: `ChatViewport.init({root, scrollTarget})`, which updates `--chat-viewport-height` from `window.visualViewport.height`, listens to resize/scroll/orientation changes, and keeps the latest message visible.
- Consumes: each page's `.page`, message list, textarea, and redemption input.

- [ ] **Step 1: Write VM tests for viewport-height updates and static tests requiring all three pages to load the helper, use one height source, and use 16px mobile inputs.**
- [ ] **Step 2: Run `node --test tests/mobile-chat-viewport.test.js` and verify failure.**
- [ ] **Step 3: Implement the shared helper and wire all three pages without transforms or negative offsets.**
- [ ] **Step 4: Re-run the test and verify desktop CSS remains unchanged outside the mobile override.**
- [ ] **Step 5: Commit `fix: stabilize mobile chat viewport`.**

### Task 4: Ziwei shared professional facts and complete four transformations

**Files:**
- Create: `js/ziwei-professional.js`
- Modify: `ziwei.html`
- Modify: `js/ziwei-render.js`
- Modify: `tests/ziwei-professional-core.test.js`

**Interfaces:**
- Produces: `ZiweiProfessional.collectMutagens(zi)`, `getSurroundedEvidence(zi, palaceName)`, `getBorrowedOpposite(zi, palaceName)`, and `getCurrentHoroscope(zi, date)`.
- Consumes: iztro palace `majorStars`, `minorStars`, `surroundedPalaces`, `decadal`, `ages`, and `horoscope` data.

- [ ] **Step 1: Add failing tests for minor-star transformations in 丙/戊/己/辛/壬 charts and four-palace surrounded evidence.**
- [ ] **Step 2: Run `node --test tests/ziwei-professional-core.test.js` and verify failure.**
- [ ] **Step 3: Implement the pure helper and load it before render/analysis scripts.**
- [ ] **Step 4: Replace major-star-only collection in the page and `ai_ziwei_data` with `collectMutagens`.**
- [ ] **Step 5: Re-run the Ziwei core tests and verify all five heavenly-stem cases pass.**
- [ ] **Step 6: Commit `fix: complete ziwei professional facts`.**

### Task 5: Evidence-based Ziwei analysis

**Files:**
- Modify: `js/ziwei-analysis.js`
- Modify: `tests/ziwei-professional-core.test.js`

**Interfaces:**
- Consumes: `ZiweiProfessional.getSurroundedEvidence` and `getBorrowedOpposite`.
- Produces: four-palace evidence summaries with no universal star moral labels, numeric pseudo-scores, or deterministic empty-palace conclusions.

- [ ] **Step 1: Add failing source/behavior tests that reject `ZW_GOOD`, `ZW_BAD`, numeric star scoring, three-palace-only summaries, and deterministic empty-palace claims.**
- [ ] **Step 2: Run the focused Ziwei test and verify failure.**
- [ ] **Step 3: Replace fixed ratings with neutral summaries listing the target, wealth, career, and opposite palaces plus visible transformations/brightness evidence.**
- [ ] **Step 4: Make empty-palace copy explicitly borrow the opposite palace as reference without asserting weak marriage, late marriage, or spouse dependence.**
- [ ] **Step 5: Re-run focused tests and commit `fix: make ziwei analysis evidence based`.**

### Task 6: Official Ziwei time scopes and full verification

**Files:**
- Modify: `js/ziwei-render.js`
- Modify: `tests/ziwei-professional-core.test.js`

**Interfaces:**
- Consumes: `palace.decadal`, `palace.ages`, and `ZiweiProfessional.getCurrentHoroscope`.
- Produces: page time-scope labels directly backed by iztro, with no manual `lnByZhi` or fallback brightness tables.

- [ ] **Step 1: Add failing tests that reject manual flow-year mapping and fabricated brightness fallbacks.**
- [ ] **Step 2: Run the focused test and verify failure.**
- [ ] **Step 3: Render decadal and age values from palace data and current annual context from `zi.horoscope(new Date())`; use only library-provided brightness.**
- [x] **Step 4: Run syntax checks and focused Bazi/Ziwei/chat tests.**
- [x] **Step 5: Run the complete Node test suite and confirm there are no new failures beyond the five documented pre-existing PDF/payment UI failures.**
- [x] **Step 6: Browser-check the result page and all three chat pages at 390x844 and 412x915, including focused textareas and horizontal overflow.**
- [x] **Step 7: Confirm `git diff --name-only origin/main...HEAD` contains no payment or environment files.**
- [ ] **Step 8: Fetch the remote, integrate any safe upstream changes without force-pushing, and push the verified branch to `main`.**
