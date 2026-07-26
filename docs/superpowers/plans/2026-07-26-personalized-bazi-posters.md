# Personalized BaZi Posters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free 1080×1920 personalized BaZi poster that combines one of 20 approved Eastern-fantasy day-master backgrounds with deterministic day-master-and-pattern copy.

**Architecture:** Keep poster content, image loading, Canvas rendering, and result-page UI in separate browser modules. The result page passes its already-calculated BaZi, gender, and `getPattern()` result into a deterministic template resolver; the renderer loads a versioned local background and self-hosted fonts, draws one fixed composition, and exports locally without an API call.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Canvas 2D, local WebP assets, self-hosted OFL fonts, Node.js `node:test`, Playwright/manual visual verification, built-in ImageGen for background production.

## Global Constraints

- Poster generation is free and consumes no points.
- No server-side image generation, storage, or new runtime dependency.
- There is no “换一句”, random seed, chart hash, or refresh-based copy variation.
- Copy priority is exact day master + exact pattern, then day master + compatible pattern category, then day-master fallback.
- Gender affects identity naming, background composition, and necessary tone only; it does not alter metaphysical meaning.
- Same day master and pattern must produce the same core copy.
- Poster UI must not restructure the existing result page.
- Backgrounds contain no text, people, logos, watermarks, or unrelated scenery.
- Final art direction is Eastern fantasy gongbi + ink wash + mineral pigments + silk texture + restrained cinnabar and antique gold.
- The top contains no translucent parchment banner and no “知时命格 · 乙木” line; only a small solid cinnabar “知时” seal remains.
- Day-master subtitle uses grounded dark ink; pattern uses a solid cinnabar seal.
- Export size is exactly 1080×1920.
- Runtime loads only the selected poster background, never all 20 and never from the homepage.

---

## File Structure

- Create `js/poster-templates.js`: supported pattern names, identity metadata, exact copy matrix, and deterministic fallback.
- Create `js/poster-renderer.js`: font/image readiness, Canvas layout, preview, export, and error results.
- Create `js/poster-ui.js`: result-page modal lifecycle and button state.
- Create `css/poster.css`: isolated preview/modal/responsive styles and `@font-face`.
- Create `images/posters/manifest.json`: day-master/gender asset mapping, dimensions, version, and alt description.
- Create `images/posters/*.webp`: 20 optimized backgrounds.
- Create `fonts/posters/`: self-hosted calligraphic and serif font files plus license texts.
- Modify `result.html`: one poster button, one modal, CSS and script tags.
- Modify `js/result.js`: call `PosterUI.configure()` after `_bazi` and pattern are available.
- Create `tests/poster-templates.test.js`: complete copy coverage and no-randomness contract.
- Create `tests/poster-renderer.test.js`: draw order, size, readiness, and failure behavior.
- Create `tests/poster-assets.test.js`: manifest completeness, file existence, file-size and dimension checks.
- Create `tests/poster-result-contract.test.js`: result-page integration without structural regression.

### Task 1: Build the Deterministic Poster Content Model

**Files:**
- Create: `js/poster-templates.js`
- Create: `tests/poster-templates.test.js`

**Interfaces:**
- Produces `window.BaZiPosterTemplates.resolve({ bazi, gender, pattern })`.
- Returns `{dayGan, dayMasterLabel, subtitle, patternName, copyLines, backgroundKey, sealText, footer}`.
- `copyLines` is an array of exactly two non-empty strings.

- [ ] **Step 1: Write coverage and determinism tests**

```js
const DAY_GANS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const PATTERNS = [
  '正官格','七杀格','正财格','偏财格','正印格','偏印格',
  '食神格','伤官格','建禄格','羊刃格','官印相生格',
  '杀印相生格','财生官格','食神生财格','印绶格','杂格'
];

test('every supported day-master and pattern pair has reviewed copy', () => {
  for (const dayGan of DAY_GANS) {
    for (const patternName of PATTERNS) {
      const model = templates.resolve({
        bazi:{day:{gan:dayGan}}, gender:'female', pattern:{name:patternName}
      });
      assert.equal(model.copyLines.length, 2);
      assert.ok(model.copyLines.every(line => line.trim().length >= 6));
    }
  }
});

test('same chart identity always resolves the same core copy', () => {
  const input = {bazi:{day:{gan:'乙'}}, gender:'female', pattern:{name:'正官格'}};
  assert.deepEqual(templates.resolve(input).copyLines, templates.resolve(input).copyLines);
});

test('module contains no random or cycling mechanism', () => {
  const source = read('js/poster-templates.js');
  assert.doesNotMatch(source, /Math\.random|seed|hash|换一句|cycle/i);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/poster-templates.test.js`

Expected: FAIL because the template module does not exist.

- [ ] **Step 3: Define day-master identity metadata**

Create exact entries for all ten stems:

```js
var DAY_MASTER_META = {
  '甲': { subtitle:'参天之木', element:'木' },
  '乙': { subtitle:'藤萝之木', element:'木' },
  '丙': { subtitle:'太阳之火', element:'火' },
  '丁': { subtitle:'灯烛之火', element:'火' },
  '戊': { subtitle:'城垣之土', element:'土' },
  '己': { subtitle:'田园之土', element:'土' },
  '庚': { subtitle:'刚健之金', element:'金' },
  '辛': { subtitle:'珠玉之金', element:'金' },
  '壬': { subtitle:'江海之水', element:'水' },
  '癸': { subtitle:'雨露之水', element:'水' }
};
```

Gender labels are `${dayGan}${element}男` and `${dayGan}${element}女`.

- [ ] **Step 4: Create the reviewed exact copy matrix**

Define `COPY_MATRIX[dayGan][patternName] = [line1, line2]` for all 160 combinations in the test constants. Each pair must explicitly reference both the day-master temperament and the pattern’s core tendency. Do not concatenate a random adjective list.

Use these approved semantic rules:

- 正官：秩序、责任、分寸。
- 七杀：决断、压力转行动、制化。
- 正财：务实、积累、稳定经营。
- 偏财：机会感、资源调度、开阔。
- 正印：学习、承接、温厚。
- 偏印：独立思考、钻研、非标准路径。
- 食神：表达、从容、创造。
- 伤官：敏锐、突破、锋芒有度。
- 建禄：自立、根基、能担事。
- 羊刃：强势行动、边界、懂得收放。
- 官印相生：责任与学习互相成就。
- 杀印相生：压力经学习与判断转化。
- 财生官：资源经营通向责任与位置。
- 食神生财：创造与表达转化为价值。
- 印绶：吸收、思考、知识沉淀。
- 杂格：不强行定型，强调多面与因势而用。

Pin the approved example:

```js
COPY_MATRIX['乙']['正官格'] = [
  '看似柔软，自有守住分寸的力量。',
  '循序向上，责任会成为你攀援的支点。'
];
```

- [ ] **Step 5: Implement exact and fallback resolution**

Normalize unknown/empty patterns to `杂格`. Resolve the exact matrix first. If a future pattern name is absent, map by its contained ten-god keyword; if still absent, use `COPY_MATRIX[dayGan]['杂格']`. Never choose among multiple entries.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/poster-templates.test.js`

Expected: all 160 combinations PASS.

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/poster-templates.js tests/poster-templates.test.js
git commit -m "feat: add deterministic poster copy matrix"
```

### Task 2: Add Self-Hosted Poster Fonts

**Files:**
- Create: `fonts/posters/MaShanZheng-Regular.woff2`
- Create: `fonts/posters/NotoSerifSC-SemiBold.woff2`
- Create: `fonts/posters/OFL-MaShanZheng.txt`
- Create: `fonts/posters/OFL-NotoSerifSC.txt`
- Create: `css/poster.css`
- Create: `tests/poster-fonts.test.js`

**Interfaces:**
- Produces CSS families `ZhishiBrush` and `ZhishiSerif`.
- Produces `document.fonts.load('132px ZhishiBrush', '乙')` and `document.fonts.load('28px ZhishiSerif', '乙木女')`.

- [ ] **Step 1: Write font asset tests**

Test that all four files exist, both font files are non-empty WOFF2, both license files contain `SIL OPEN FONT LICENSE`, and `css/poster.css` references only local `/fonts/posters/` URLs.

- [ ] **Step 2: Run the test to verify failure**

Run: `node --test tests/poster-fonts.test.js`

Expected: FAIL because the assets are absent.

- [ ] **Step 3: Obtain fonts from primary official repositories**

Download Ma Shan Zheng and Noto Serif SC from their official Google Fonts repository sources, preserve their OFL license texts, convert/subset to WOFF2 only if the official asset is not already WOFF2, and include all characters used by:

- ten heavenly stems;
- male/female identity labels;
- all 16 pattern names;
- every character in `COPY_MATRIX`;
- “知时”“知天时，见自己”.

Do not use a third-party font mirror and do not rely on a runtime CDN.

- [ ] **Step 4: Define scoped font faces**

```css
@font-face {
  font-family: "ZhishiBrush";
  src: url("../fonts/posters/MaShanZheng-Regular.woff2") format("woff2");
  font-display: swap;
}
@font-face {
  font-family: "ZhishiSerif";
  src: url("../fonts/posters/NotoSerifSC-SemiBold.woff2") format("woff2");
  font-display: swap;
}
```

Keep all modal and preview selectors prefixed with `.poster-`.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/poster-fonts.test.js`

Expected: PASS.

```bash
git add fonts/posters css/poster.css tests/poster-fonts.test.js
git commit -m "assets: add self-hosted poster fonts"
```

### Task 3: Build the Canvas Renderer

**Files:**
- Create: `js/poster-renderer.js`
- Create: `tests/poster-renderer.test.js`

**Interfaces:**
- Produces `PosterRenderer.render({canvas, model, backgroundUrl}) -> Promise<{ok,error?}>`.
- Produces `PosterRenderer.download({canvas, filename}) -> Promise<{ok,error?}>`.
- Canvas is always reset to `1080×1920`.

- [ ] **Step 1: Write a fake-Canvas render-order test**

Use a fake 2D context that records `drawImage`, `fillText`, `strokeRect`, and gradient calls. Assert:

1. canvas size is set first;
2. background is drawn before text;
3. day-master main glyph is drawn;
4. identity, subtitle, solid pattern seal, two copy lines, “知时” seal, and footer are drawn;
5. no top banner string is drawn.

- [ ] **Step 2: Add readiness and error tests**

Inject `loadImage` and `waitForFonts` dependencies. Verify:

- rendering waits for both promises;
- failed background returns `{ok:false,error:'BACKGROUND_LOAD_FAILED'}`;
- failed font readiness returns `{ok:false,error:'FONT_LOAD_FAILED'}`;
- failed export returns `{ok:false,error:'EXPORT_FAILED'}`;
- errors are returned, not thrown into the result page.

- [ ] **Step 3: Run tests to verify failure**

Run: `node --test tests/poster-renderer.test.js`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 4: Implement the confirmed composition**

Use proportional coordinates from the approved sample:

- small solid cinnabar “知时” seal at top-right;
- main brush glyph in upper center with a low-opacity blurred duplicate for ink bleed;
- identity directly below;
- grounded dark-ink subtitle plus solid cinnabar pattern seal;
- no translucent banner and no top explanatory line;
- two-line copy in the lower third over a controlled dark gradient;
- small footer at the bottom.

All text coordinates and font sizes must derive from the fixed 1080×1920 canvas, not the preview CSS size.

- [ ] **Step 5: Implement export**

Use `canvas.toBlob()` with `image/webp` at `0.92`. If the returned blob is null, retry once with `image/jpeg` at `0.94`. Generate a safe filename:

```js
`知时-${model.dayMasterLabel}-${model.patternName}.webp`
```

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/poster-renderer.test.js`

Expected: PASS.

```bash
git add js/poster-renderer.js tests/poster-renderer.test.js
git commit -m "feat: render downloadable bazi posters"
```

### Task 4: Integrate a Non-Invasive Result-Page Poster Modal

**Files:**
- Create: `js/poster-ui.js`
- Create: `tests/poster-result-contract.test.js`
- Modify: `result.html:2308-2330,2724-2729`
- Modify: `js/result.js:90-170`
- Modify: `css/poster.css`

**Interfaces:**
- Produces `PosterUI.configure({bazi, gender, pattern})`.
- Produces global button handler `PosterUI.open()`.
- Consumes Tasks 1–3.

- [ ] **Step 1: Write result-page contract tests**

Assert:

- one `#posterButton` exists near the existing share action;
- one `#posterModal`, `#posterCanvas`, `#posterDownload`, `#posterRetry`, and `#posterClose` exist;
- there is no “换一句” control or string;
- scripts load in order: templates, renderer, UI, then existing result integrations;
- the existing share button and result section IDs remain.

- [ ] **Step 2: Run the contract to verify failure**

Run: `node --test tests/poster-result-contract.test.js`

Expected: FAIL because the poster UI is absent.

- [ ] **Step 3: Add minimal modal markup**

Insert one button beside the existing report share button and one dialog near the end of `body`. The modal contains the Canvas preview, loading/error status, free-download button, retry button shown only after failure, and close button. Do not move existing result sections.

- [ ] **Step 4: Implement `PosterUI`**

On `configure()`:

1. resolve the model;
2. read the background URL from the manifest mapping;
3. store data without rendering.

On `open()`:

1. show modal and loading state;
2. call renderer once;
3. show preview and download on success;
4. show retry on a typed error;
5. preserve the result page on every failure.

- [ ] **Step 5: Configure after result data exists**

At the end of `render(data)` after `_bazi` is assigned:

```js
if (window.PosterUI && window.BaZiCalculator.getPattern) {
  window.PosterUI.configure({
    bazi: _bazi,
    gender: _params.gender,
    pattern: window.BaZiCalculator.getPattern(_bazi)
  });
}
```

- [ ] **Step 6: Add responsive and accessibility behavior**

Use `role="dialog"`, `aria-modal="true"`, Escape-to-close, focus return to the opening button, scroll lock while open, and a preview width capped at the viewport. At 390px, controls remain at least 44px high.

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/poster-result-contract.test.js tests/result-structure-contract.test.js`

Expected: PASS.

```bash
git add result.html js/result.js js/poster-ui.js css/poster.css tests/poster-result-contract.test.js
git commit -m "feat: add result poster preview"
```

### Task 5: Define and Generate the 20-Background Art Pack

**Files:**
- Create: `images/posters/manifest.json`
- Create: `docs/poster-art-prompts.md`
- Create: 20 temporary reviewed PNG sources outside the tracked tree.
- Create after review: 20 `images/posters/<key>.webp` files.

**Interfaces:**
- Background keys are `<pinyin-stem>-<male|female>`.
- Manifest entry shape is `{dayGan, gender, src, width, height, version, alt}`.
- Consumed by `PosterUI`.

- [ ] **Step 1: Write the shared production prompt**

Save this fixed prompt framework in `docs/poster-art-prompts.md`:

```text
Use case: ads-marketing
Asset type: 9:16 BaZi identity poster background
Style: unmistakably Chinese Eastern fantasy; gongbi mineral-pigment painting fused
with xieyi ink wash on aged silk; malachite, ink, restrained cinnabar and antique gold;
living ink, cloud-and-water qi, gold spiritual meridians; premium and mature.
Composition: day-master subject frames left/lower and restrained upper-right areas;
large quiet luminous text-safe field in upper-middle/center; strong lower-third contrast.
Constraints: background only; no people, text, characters, logo, seal, watermark;
no Western Art Nouveau, Celtic, European fairy, baroque frame, photorealistic lens look;
no unrelated mountain, bridge, pavilion, architecture, or garden scenery.
```

- [ ] **Step 2: Add exact subject directions for all 20 calls**

Use one built-in ImageGen call per row:

| Key | Core subject and gender composition |
|---|---|
| jia-male | Monumental ink-black ancient trunk rising vertically, broad evergreen branches, vigorous upward gold meridians, open center-right |
| jia-female | Majestic living ancient tree with finer branching rhythm, jade shoots and restrained blossoms, luminous but still strong |
| yi-male | Long dark-jade vines gripping a firm wood support, fewer flowers, decisive diagonal ascent, stronger ink contrast |
| yi-female | Approved benchmark: flowering vines, soft grasses, dark symbolic wood support, gongbi blossoms, ink-cloud aura, gold veins |
| bing-male | Vast cinnabar-gold solar disc and outward fire qi, bold radial force, ink-dark perimeter, no landscape |
| bing-female | Luminous vermilion sun aura with layered silk-like flame clouds, warmer fine gold rhythm, clear central text field |
| ding-male | A single concentrated bronze-lamp flame floating in deep ink, precise upward flame core, controlled sparks |
| ding-female | Delicate but unwavering lotus-shaped lamp flame, cinnabar and gold light reflected through translucent ink layers |
| wu-male | Monumental earthen mass and square seal-like strata, ochre mineral texture, heavy stable base, no decorative scenery |
| wu-female | Layered fertile earth, rounded terraces expressed abstractly in ink and mineral pigment, quiet holding strength, fine sprouts |
| ji-male | Dark fertile soil patterns with ordered grain shoots and grounded gold lines, practical and contained |
| ji-female | Rich silk-textured earth with fine herbs, grain and soft green shoots, nurturing but not pastoral illustration |
| geng-male | Unadorned forged steel blade and angular metallic qi, silver-white edge, black-ink sparks, forceful diagonal |
| geng-female | Refined celestial steel with crisp planes and controlled silver aura, firm rather than jewelry-like, elegant sharpness |
| xin-male | Cut white metal, jade-like mineral facets and a small ritual seal form, precise restrained gleam |
| xin-female | Pearl, white jade and fine worked-metal light gathered as an abstract precious-metal aura, clean and discerning |
| ren-male | Vast surging ink-water current and deep blue-black waves, powerful horizontal-to-upward flow, no boat or shoreline |
| ren-female | Expansive layered water ribbons and moonlit indigo current, fluid intelligence, finer wave rhythm without becoming gentle wallpaper |
| gui-male | Concentrated rain threads, dew and underground water qi gathering into a dark clear current, subtle persistence |
| gui-female | Luminous rain, dew beads and translucent water-calligraphy on silk, quiet permeating force, pearl-blue highlights |

- [ ] **Step 3: Import the approved Yi-female benchmark**

Use the approved source currently preserved by the visual brainstorming session as the Yi-female candidate. Do not regenerate or alter it unless the user rejects it during the final contact sheet review.

- [ ] **Step 4: Generate the remaining 19 candidates**

Use the built-in `image_gen` tool, one call per asset. Add the row-specific subject direction and either:

- male: stronger silhouette, broader structure, deeper contrast;
- female: finer rhythm, more luminous detail, equal strength without pink stereotyping.

Keep all outputs in an untracked review directory until selected.

- [ ] **Step 5: Create a contact sheet and obtain visual approval**

Create five review sheets—wood, fire, earth, metal, water—each showing four labeled thumbnails. Check each image for:

- unmistakable day-master subject;
- matching shared Eastern-fantasy language;
- usable text-safe field;
- absence of text, people, Western motifs and unrelated scenery;
- meaningful male/female composition difference.

Do not optimize or wire an unapproved image into the site.

- [ ] **Step 6: Convert approved assets to WebP**

Use a deterministic image tool such as Pillow or ImageMagick:

- crop/resize to 1080×1920;
- preserve color profile;
- export WebP quality 88;
- target each file below 700 KB where quality permits;
- keep no source PNG in Git.

- [ ] **Step 7: Build `manifest.json`**

List exactly 20 entries and point each to a versioned filename such as `yi-female-v1.webp`.

- [ ] **Step 8: Commit the approved pack**

```bash
git add images/posters docs/poster-art-prompts.md
git commit -m "assets: add day-master poster backgrounds"
```

### Task 6: Verify Poster Assets and Lazy Loading

**Files:**
- Create: `tests/poster-assets.test.js`
- Modify: `js/poster-ui.js`
- Modify: `images/posters/manifest.json` only to fix confirmed metadata.

**Interfaces:**
- Consumes the 20-asset manifest.
- Produces a verified, lazy-loaded background path.

- [ ] **Step 1: Write manifest completeness tests**

Assert exactly 20 unique `(dayGan, gender)` pairs, existing local files, `.webp` extensions, 1080×1920 dimensions, non-empty alt descriptions, version fields, and file sizes below 900 KB.

- [ ] **Step 2: Add homepage exclusion test**

Read `index.html` and all homepage CSS/JS. Assert none contains `/images/posters/` or imports `poster-ui.js`.

- [ ] **Step 3: Add lazy-load behavior test**

Stub image loading and verify `PosterUI.configure()` loads zero images while `PosterUI.open()` loads exactly the selected manifest URL.

- [ ] **Step 4: Run tests**

Run: `node --test tests/poster-assets.test.js tests/poster-result-contract.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/poster-assets.test.js js/poster-ui.js images/posters/manifest.json
git commit -m "test: verify poster asset pack"
```

### Task 7: Final Poster Visual and Download Verification

**Files:**
- Create: `docs/verification/2026-07-26-personalized-posters.md`
- Modify: production files only for defects proven by this verification.

**Interfaces:**
- Consumes all poster tasks.
- Produces the poster release checkpoint.

- [ ] **Step 1: Run all automated tests**

Run: `node --test tests/*.test.js`

Expected: zero failures.

- [ ] **Step 2: Verify the approved Yi-female sample**

Use an 乙木 female chart with 正官格. Confirm:

- background matches the approved Eastern-fantasy vine benchmark;
- only the top-right solid “知时” seal appears;
- there is no parchment banner or top explanatory line;
- “藤萝之木” is dark and grounded;
- “正官格” is a solid cinnabar seal;
- copy equals the exact `COPY_MATRIX['乙']['正官格']` value.

- [ ] **Step 3: Verify representative combinations**

Render at least:

- 甲木男 · 建禄格
- 丁火女 · 食神格
- 戊土男 · 正财格
- 辛金女 · 正印格
- 壬水男 · 七杀格
- 癸水女 · 杂格

Check background mapping, identity label, exact pattern copy, safe-area readability and no visual overlap.

- [ ] **Step 4: Verify responsive modal behavior**

At 1440×900, 390×844 and 430×932, open/close with mouse, touch and Escape. Verify focus return, scroll lock, readable buttons, and no result-page reflow.

- [ ] **Step 5: Verify actual downloads**

Download WebP in Chrome/Edge and the in-app browser. Inspect dimensions as 1080×1920, confirm font fidelity, no clipped glyphs, no blank background, and filename includes day-master identity and pattern.

- [ ] **Step 6: Test failure isolation**

Temporarily point a local manifest entry to a missing file, verify the modal shows retry, and verify the result page, AI follow-up and share report remain usable. Restore the manifest before committing.

- [ ] **Step 7: Record and commit verification**

Record tested commit, commands, browser sizes, sample chart parameters, downloaded filenames, and any deferred issue in the verification document.

```bash
git add docs/verification/2026-07-26-personalized-posters.md
git commit -m "docs: verify personalized bazi posters"
```

