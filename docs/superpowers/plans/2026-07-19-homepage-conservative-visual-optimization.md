# Homepage Conservative Visual Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve homepage readability, mobile navigation, mobile feature-card layout, and background-image transfer size without changing the 1.8-second intro or any business logic.

**Architecture:** Keep all behavior and routes intact. Make page-scoped CSS/markup edits in `index.html` and `css/ink-wash.css`, use native `<picture>` fallback for WebP, and protect the agreed constraints with Node regression tests plus browser checks at desktop and 390px widths.

**Tech Stack:** Static HTML/CSS, Node.js built-in test runner, FFmpeg WebP encoder, local Node development server, browser-based visual verification.

## Global Constraints

- Keep the homepage intro delay exactly `1800` milliseconds.
- Do not modify login, payment, credits, charting, AI, uploads, or API behavior.
- Keep all nine homepage feature links and their current order and destinations.
- Keep `images/cleveland_screen_print.jpg` as the fallback asset.
- Do not touch existing untracked `knowledge/fengshui_extracts/` or redemption-code files.

---

### Task 1: Add Visual Contract Regression Tests

**Files:**
- Create: `tests/homepage-visual-contract.test.js`
- Test: `tests/homepage-visual-contract.test.js`

**Interfaces:**
- Consumes: `index.html`, `css/ink-wash.css` as UTF-8 text.
- Produces: regression assertions for the 1800ms delay, WebP/JPG fallback, two-column mobile grid, and mobile navigation classes.

- [ ] **Step 1: Write the failing test**

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inkCss = fs.readFileSync(path.join(root, 'css', 'ink-wash.css'), 'utf8');

test('homepage keeps the agreed intro duration', () => {
  assert.match(html, /setTimeout\([\s\S]{0,300}?1800\)/);
});

test('homepage uses WebP with the original JPG fallback', () => {
  assert.match(html, /<source[^>]+cleveland_screen_print\.webp[^>]+image\/webp/);
  assert.match(html, /<img[^>]+cleveland_screen_print\.jpg/);
});

test('homepage has mobile navigation hooks and a two-column mobile feature grid', () => {
  assert.match(html, /class="zhishi-nav-links"/);
  assert.match(html, /class="mobile-nav-extra"/);
  assert.match(html, /@media\(max-width:600px\)[\s\S]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('hero description uses a stronger readable color', () => {
  assert.match(inkCss, /\.hero-desc\s*\{[^}]+rgba\(232,224,204,\.78\)/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/homepage-visual-contract.test.js`

Expected: WebP, navigation-hook, mobile-grid, and readable-color assertions fail while the 1800ms assertion passes.

- [ ] **Step 3: Leave production files unchanged until the failing output is recorded**

- [ ] **Step 4: Commit after the implementation tasks make this contract pass**

Commit is intentionally deferred so the test and its implementation land together.

---

### Task 2: Improve Hero Contrast and Mobile Layout

**Files:**
- Modify: `index.html:553-583`
- Modify: `index.html:621-669`
- Modify: `css/ink-wash.css:139-151`
- Test: `tests/homepage-visual-contract.test.js`

**Interfaces:**
- Consumes: existing `.hero-*`, `#zhishi-nav`, `.features`, and `.feat-card` selectors.
- Produces: readable hero copy, single-row primary mobile navigation, and two-column mobile cards.

- [ ] **Step 1: Add stable navigation hooks and mobile-only fallback links**

Add `zhishi-brand`, `zhishi-nav-links`, `nav-primary`, `nav-secondary`, `nav-more`, `nav-points`, and `mobile-nav-extra` classes without changing existing href values. Add mobile-only 风水、观面、观手 links inside the existing 更多 menu.

- [ ] **Step 2: Remove the feature section's inline three-column override**

Change `<section class="features" style="grid-template-columns:repeat(3,1fr)">` to `<section class="features">` so media queries can control the layout.

- [ ] **Step 3: Add the narrow-screen rules**

```css
.mobile-nav-extra { display: none !important; }

@media(max-width:600px) {
  #zhishi-nav { padding: 8px 10px !important; }
  #zhishi-nav .zhishi-brand { margin-right: 4px !important; }
  #zhishi-nav .zhishi-nav-links { flex-wrap: nowrap !important; gap: 1px !important; }
  #zhishi-nav .nav-secondary { display: none !important; }
  #zhishi-nav .mobile-nav-extra { display: block !important; }
  #zhishi-nav .nav-primary,
  #zhishi-nav .nav-points,
  #zhishi-nav .nav-more > span { padding: 6px 7px !important; font-size: 12px !important; }
  #nav-user-area { display: none !important; }
  .features { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
  .feat-card { padding: 24px 14px; }
  .feat-card h3 { font-size: 16px; letter-spacing: 3px; }
  .feat-card p { font-size: 12px; line-height: 1.9; }
}
```

- [ ] **Step 4: Improve hero copy contrast without changing geometry or animation**

Update `css/ink-wash.css` so `.hero-desc` uses `rgba(232,224,204,.78)` with a restrained dark text shadow, and `.hero-tagline` uses a slightly brighter warm neutral. Do not change sizes, margins, transforms, animation names, or delays.

- [ ] **Step 5: Run the visual contract test**

Run: `node --test tests/homepage-visual-contract.test.js`

Expected: only the WebP assertion remains failing until Task 3.

---

### Task 3: Add WebP Background With Native Fallback

**Files:**
- Create: `images/cleveland_screen_print.webp`
- Modify: `index.html:574-577`
- Test: `tests/homepage-visual-contract.test.js`

**Interfaces:**
- Consumes: `images/cleveland_screen_print.jpg`.
- Produces: `images/cleveland_screen_print.webp` and a native `<picture>` source-selection block.

- [ ] **Step 1: Encode one WebP frame**

Run:

```powershell
ffmpeg -y -i images/cleveland_screen_print.jpg -frames:v 1 -c:v libwebp -quality 82 -compression_level 6 images/cleveland_screen_print.webp
```

Expected: output exists, has nonzero dimensions, and is materially smaller than 1,147,234 bytes.

- [ ] **Step 2: Add native HTML fallback**

```html
<picture>
  <source srcset="images/cleveland_screen_print.webp" type="image/webp">
  <img src="images/cleveland_screen_print.jpg" alt="" loading="eager" fetchpriority="high">
</picture>
```

The existing `.ink-wash-scene img` selector continues to style and animate the nested image.

- [ ] **Step 3: Run the contract and media checks**

Run:

```powershell
node --test tests/*.test.js
ffprobe -v error -show_entries stream=codec_name,width,height -of default=noprint_wrappers=1 images/cleveland_screen_print.webp
```

Expected: all tests pass; codec is WebP and dimensions match the source aspect ratio.

---

### Task 4: Browser and Repository Regression Verification

**Files:**
- Verify: `index.html`
- Verify: `css/ink-wash.css`
- Verify: `images/cleveland_screen_print.webp`
- Verify: all files under `js/`, `api/`, `lib/`, and `tests/`

**Interfaces:**
- Consumes: the completed local site.
- Produces: evidence that the visual changes do not introduce runtime or layout regressions.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
node --test tests/*.test.js
Get-ChildItem js,api,lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
npm audit --omit=dev --audit-level=low
git diff --check
```

Expected: zero failed tests, zero JavaScript syntax failures, zero dependency vulnerabilities, and no whitespace errors.

- [ ] **Step 2: Verify desktop browser layout**

At 1440×900, verify the intro still lasts 1800ms, the homepage has no console errors, the hero copy is readable, the navigation remains unchanged, and `scrollWidth === clientWidth`.

- [ ] **Step 3: Verify mobile browser layout**

At 390×844, verify the primary navigation stays on one row, the 更多 menu contains the hidden low-frequency links, the feature grid has two columns, all nine feature links remain available, and `scrollWidth === clientWidth`.

- [ ] **Step 4: Smoke-test major routes**

Open `/paipan`, `/ziwei`, `/fengshui`, `/face`, `/palm`, `/hepan`, `/fortune`, `/meihua`, `/liuyao`, `/liuren`, `/pricing`, `/profile`, `/result`, `/hepan-result`, `/ai-chat`, and `/verify`. Record console errors and horizontal overflow; expect none beyond intentional missing-data redirects.

- [ ] **Step 5: Commit verified implementation**

```powershell
git add index.html css/ink-wash.css images/cleveland_screen_print.webp dev-server.js server.js js/pro-analysis.js tests
git commit -m "fix: harden site and optimize homepage presentation"
```

Do not add `knowledge/fengshui_extracts/` or redemption-code files.
