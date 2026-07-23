# Final light-theme contrast fix report

Status: DONE

## Scope and implementation

- Added near-opaque paper and primary/secondary ink overrides for the real BaZi `.section-drawer` / `.drawer-body` and Hepan `.hp-drawer` / `.hp-drawer-body` surfaces. The scoped Hepan card selectors cover the emitted `hp-bazi-card`, `hp-cross-item`, `hp-dgs-card`, `hp-do-item`, `hp-dont-item`, `hp-mode-card`, `hp-wuxing-card`, `hp-xiyong-card`, and `hp-yearly-card` classes.
- Added warm-grey `#655b51` for `.pp-ss-text` and `.cang-ss-text`. Past dayun/liunian cells now use a deliberate subdued paper/ink state with `opacity: 1 !important`, preventing their legacy whole-cell opacity from reducing readability.
- Added page-root-scoped `!important` overrides for Ziwei emitted stars, chart labels, palace values, and renderer inline colors. The semantic star and four-transformation hues remain distinct (deep ochre, vermilion, blue, and green) rather than collapsing into one ink color.
- Added page-root-scoped Liuren overrides for the heavenly-plate (`.sp-tian`), earthly-plate (`.sp-zhi`), gods, dun labels, centre values, and generated dark inline card/value styles. Positive/negative inline semantic colors are not overwritten.
- Bumped every page reference to `css/theme-light-results.css?v=2` and the homepage reference to `css/theme-light-home.css?v=2`.
- Added contract coverage for each repaired drawer/card/child selector, secondary text, past states, Ziwei inline renderer selectors, Liuren children, and the cache-busted references.

## Cascade reasoning

The result skin is loaded last. Its selectors are limited to result surfaces or pages detected by `body:has(#zwGrid)` / `body:has(#lrOutput)`, and use `!important` only where legacy page CSS or generated inline styles otherwise win. The scope deliberately does not alter structure, display, grid ordering, scrolling, JavaScript, paywall, AI, or generated assets.

## Files

- `css/theme-light-results.css`
- `index.html`
- `result.html`
- `hepan-result.html`
- `ziwei.html`
- `liuren.html`
- `tests/result-structure-contract.test.js`
- `tests/light-theme-contract.test.js`

## Commit

- `799da9c fix: complete light result contrast overrides`

## TDD evidence

### RED

Command:

```text
node --test tests/result-structure-contract.test.js tests/light-theme-contract.test.js
```

Exact output:

```text
ℹ tests 18
ℹ suites 0
ℹ pass 14
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 89.9797

✖ failing tests:

✖ homepage loads a dedicated responsive light stylesheet after the shared theme
AssertionError: theme-light-home.css?v=2 was not loaded after theme-light.css?v=1

✖ result-capable pages load the result skin after every existing stylesheet
AssertionError: result.html must load the result skin last
+ actual - expected
+ 'css/theme-light-results.css?v=1'
- 'css/theme-light-results.css?v=2'

✖ result skin repairs actual drawer surfaces, subdued text, and past-state legibility
AssertionError: missing repaired selector .section-drawer

✖ result skin gives Ziwei and Liuren emitted children semantic dark ink
AssertionError: missing readable emitted child selector body:has(#zwGrid) #zwGrid .stars .s
```

The expanded Ziwei semantic-selector assertion was also proved sensitive by temporarily removing its `#F44336` override:

```text
node --test tests/result-structure-contract.test.js
ℹ tests 8
ℹ pass 7
ℹ fail 1
✖ result skin gives Ziwei and Liuren emitted children semantic dark ink
AssertionError: missing readable emitted child selector body:has(#zwGrid) #zwGrid .stars [style*="color:#F44336"]
```

### GREEN: required focused group

Command:

```text
node --test tests/result-structure-contract.test.js tests/homepage-visual-contract.test.js tests/light-theme-contract.test.js tests/ai-flow-contract.test.js
```

Exact output:

```text
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 115.5074
```

### GREEN: full suite

Command:

```text
node --test tests/*.test.js
```

Exact output:

```text
✔ follow-up pages retain their contextual AI destinations
✔ one-shot tools do not gain follow-up chat routes
✔ result skin preserves the floating AI entry as a visible interactive control
✔ bazi input retains every calculation control and script
✔ face and palm retain their file inputs and submit handlers
✔ fengshui retains dynamic photo input creation and analysis request
✔ form light theme covers selected controls, uploads, disabled states and touch targets
✔ every tool input page loads the form light theme after the shared light theme
✔ calendar preview handlers tolerate pages without the optional preview node
✔ homepage scripts do not reference removed hexagram loader nodes
✔ homepage keeps the agreed intro duration
✔ homepage uses art-directed desktop and mobile hero backgrounds
✔ homepage light treatment keeps the artwork visible
✔ homepage has mobile navigation hooks and a two-column mobile feature grid
✔ hero description uses a stronger readable color
✔ every public page loads the light theme after existing styles
✔ light theme defines the approved palette and light color scheme
✔ light theme covers the real chat composer controls and states
✔ inline legacy navigations expose a light-theme hook and light dropdown
✔ homepage exposes the approved ten uniform tools and no standalone AI consultation CTA
✔ homepage navigation uses five practical categories and retains every tool route
✔ homepage more menu uses a semantic button with an explicit ARIA relationship
✔ homepage more menu script supports keyboard, outside click, focus, mouse and touch-safe click hooks
✔ homepage adds three usage steps before the four trust cards and keeps two direct bottom CTAs
✔ homepage loads a dedicated responsive light stylesheet after the shared theme
✔ light UI has keyboard focus, mobile touch, and intentional table scrolling
✔ decorative reduced-motion rules do not remove the intro contract
✔ professional analysis waits while chart data is null
✔ bazi result retains the complete ordered long-report structure
✔ hepan result keeps its existing result and AI integration hooks
✔ result-capable pages load the result skin after every existing stylesheet
✔ result skin is additive and cannot convert or hide the existing layout
✔ result skin uses opaque paper cells and readable ink text
✔ result skin overrides legacy child ink and scopes opaque chart surfaces
✔ result skin repairs actual drawer surfaces, subdued text, and past-state legibility
✔ result skin gives Ziwei and Liuren emitted children semantic dark ink
✔ static assets have correct content type and browser caching
✔ server.js serves site media with explicit MIME types
✔ dev-server.js serves site media with explicit MIME types
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 268.1552
```

Concerns: none.
