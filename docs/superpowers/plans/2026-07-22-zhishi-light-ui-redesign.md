# Zhishi Light UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public site's dark presentation with the approved light paper, ink, vermilion, pine, and aged-gold system while preserving all business logic and every existing result-page information structure.

**Architecture:** Keep the existing static HTML and JavaScript behavior intact. Add late-loaded, reversible CSS override layers (`theme-light.css` plus page-family stylesheets), make only the approved homepage markup changes, and protect result/form structures with Node contract tests before visual work begins. Back up the exact production commit before creating an isolated feature worktree.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Playwright, local Node development server, Git/GitHub, Vercel static and Node routing.

## Global Constraints

- Brand remains `知时`; do not introduce `书院` or `藏阁` as product names.
- Main slogan remains `知天时，见自己`.
- Keep the homepage intro contract unchanged; existing automated test `homepage keeps the agreed intro duration` must continue to pass.
- Keep the original dark CSS and assets in Git history and verified backups; do not implement a runtime theme toggle.
- Do not change `js/bazi.js`, calculation algorithms, AI prompts, API contracts, credits, prices, payment behavior, or database structures.
- Homepage may be moderately reorganized; every result page is skin-only: no removal, merge, rename, reorder, or layout conversion of result content.
- Keep result-page dayun, liunian, and pillar grids horizontal and scrollable on mobile.
- Homepage shows ten uniform feature cards and no standalone AI Q&A card or navigation item.
- AI follow-up remains available only for 八字、紫微、大六壬、合盘; 六爻、梅花、观面、观手、八宅风水、今日运势 remain one-shot results.
- Preserve pre-existing untracked `knowledge/fengshui_extracts/` and `兑换码.txt`; never add them to UI commits.
- Do not commit `.env`, redemption codes, access tokens, or backup archives.

---

### Task 1: Create and Verify the Pre-Change Backup

**Files:**
- Create: `docs/backups/2026-07-22-pre-light-ui.md`
- Do not modify: `knowledge/fengshui_extracts/`
- Do not modify: `兑换码.txt`
- Verify: `.env`

**Interfaces:**
- Consumes: current `main` commit `94058e0`, `origin/main`, local `.env`, and existing untracked user files.
- Produces: Git tag `backup/pre-light-ui-2026-07-22`, a verified Git bundle, a tracked-source ZIP, a local protected secrets/untracked backup, and a backup manifest committed on the feature branch.

- [ ] **Step 1: Verify the exact production baseline and dirty state**

Run from the repository root:

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
git remote -v
```

Expected: `HEAD` and `origin/main` both print `94058e0...`; status lists only `knowledge/fengshui_extracts/` and `兑换码.txt` as untracked. Stop if tracked files are modified or the two commit hashes differ.

- [ ] **Step 2: Create the immutable Git and offline backups**

```powershell
$stamp = '2026-07-22-pre-light-ui'
$backupRoot = Join-Path $env:USERPROFILE "Documents\ZhishiBackups\$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
git tag -a "backup/pre-light-ui-2026-07-22" 94058e0 -m "Backup before light UI redesign"
git bundle create (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle') --all
git archive --format=zip --output=(Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') 94058e0
Copy-Item -LiteralPath '.env' -Destination (Join-Path $backupRoot '.env.local.backup')
Copy-Item -LiteralPath '兑换码.txt' -Destination (Join-Path $backupRoot '兑换码.local.backup.txt')
Copy-Item -LiteralPath 'knowledge\fengshui_extracts' -Destination (Join-Path $backupRoot 'fengshui_extracts') -Recurse
icacls $backupRoot /inheritance:r /grant:r "$env:USERNAME:(OI)(CI)F"
$hashes = Get-FileHash (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle'), (Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') -Algorithm SHA256
$hashes | Format-Table Path,Hash -AutoSize | Out-File -LiteralPath (Join-Path $backupRoot 'checksums.sha256.txt') -Encoding utf8
```

Expected: bundle, ZIP, protected environment file, redemption-code copy, and fengshui extracts exist under `Documents\ZhishiBackups\2026-07-22-pre-light-ui` and do not appear in repository status.

- [ ] **Step 3: Verify that the backup can restore and test**

```powershell
$backupRoot = Join-Path $env:USERPROFILE 'Documents\ZhishiBackups\2026-07-22-pre-light-ui'
git bundle verify (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle')
$restoreRoot = Join-Path $backupRoot 'restore-check'
Expand-Archive -LiteralPath (Join-Path $backupRoot 'zhishi-bazi-94058e0.zip') -DestinationPath $restoreRoot -Force
npm ci --prefix $restoreRoot
node --test "$restoreRoot\tests\*.test.js"
```

Expected: bundle verification succeeds and all nine current baseline tests pass from the restored ZIP.

- [ ] **Step 4: Push the backup tag and create the isolated feature worktree**

```powershell
git push origin backup/pre-light-ui-2026-07-22
```

Then invoke `superpowers:using-git-worktrees` and create branch `feat/light-ui-redesign` from `94058e0`. Do not implement in the TRAE-managed working directory containing the untracked user files.

- [ ] **Step 5: Record the backup manifest**

Create `docs/backups/2026-07-22-pre-light-ui.md` with this exact structure and the hashes returned by `Get-FileHash`:

```markdown
# Pre-Light-UI Backup Manifest

- Production commit: `94058e0`
- Remote: `https://github.com/Eriver111/zhishi-bazi.git`
- Git tag: `backup/pre-light-ui-2026-07-22`
- Bundle: `zhishi-bazi-94058e0.bundle`
- Source archive: `zhishi-bazi-94058e0.zip`
- Restore test: `node --test tests/*.test.js` passed
- Sensitive local backup: stored outside Git under `Documents/ZhishiBackups/2026-07-22-pre-light-ui`
- Original untracked files: preserved and excluded from commits
- SHA-256 checksums: stored beside the archives in `checksums.sha256.txt`
```

Before committing, compare `checksums.sha256.txt` with fresh `Get-FileHash` output and require both hashes to match.

- [ ] **Step 6: Commit the verified manifest on the feature branch**

```powershell
git add docs/backups/2026-07-22-pre-light-ui.md
git commit -m "docs: record pre-redesign recovery point"
```

Expected: the commit contains only the manifest.

---

### Task 2: Add Light-Theme and Structure Regression Contracts

**Files:**
- Create: `tests/light-theme-contract.test.js`
- Create: `tests/result-structure-contract.test.js`
- Create: `tests/ai-flow-contract.test.js`
- Test: all files under `tests/`

**Interfaces:**
- Consumes: public HTML, planned CSS filenames, and the current static result-page structure.
- Produces: executable contracts that prevent missing theme links, homepage feature drift, result restructuring, and AI-flow mixing.

- [ ] **Step 1: Write the light-theme contract test**

Create `tests/light-theme-contract.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const publicPages = [
  'index.html', 'paipan.html', 'result.html', 'ziwei.html', 'liuren.html',
  'hepan.html', 'hepan-result.html', 'liuyao.html', 'meihua.html',
  'face.html', 'palm.html', 'fengshui.html', 'fortune.html', 'pricing.html',
  'profile.html', 'ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html',
];

test('every public page loads the light theme after existing styles', () => {
  for (const page of publicPages) {
    const html = read(page);
    const themeAt = html.lastIndexOf('css/theme-light.css');
    assert.ok(themeAt > -1, `${page} is missing theme-light.css`);
    assert.ok(themeAt > html.lastIndexOf('</style>'), `${page} loads theme before inline styles`);
  }
});

test('light theme defines the approved palette and light color scheme', () => {
  const css = read('css/theme-light.css');
  for (const token of ['#f6efdf', '#eee3cd', '#2d261f', '#796d61', '#84362f', '#365d50', '#a47b42']) {
    assert.match(css.toLowerCase(), new RegExp(token.replace('#', '#')));
  }
  assert.match(css, /color-scheme:\s*light/);
});

test('homepage exposes ten uniform tools and no standalone AI consultation CTA', () => {
  const html = read('index.html');
  const featureLinks = [...html.matchAll(/<a[^>]+class="feat-card"/g)];
  assert.equal(featureLinks.length, 10);
  assert.match(html, /知天时\s*[·，,]?\s*见自己/);
  assert.doesNotMatch(html, />\s*AI 命理咨询\s*</);
});
```

- [ ] **Step 2: Write the result-structure contract test**

Create `tests/result-structure-contract.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bazi result retains the complete ordered long-report structure', () => {
  const html = read('result.html');
  const markers = [
    'section-dayun', 'section-liunian', 'section-sizhu',
    '>专业解读<', '>日主性格<', '>父母关系<', '>今年运势<',
    '>婚姻感情<', '>财运分析<', '>学业分析<', '>近5年流年运势<',
  ];
  let previous = -1;
  for (const marker of markers) {
    const current = html.indexOf(marker);
    assert.ok(current > previous, `${marker} is missing or out of order`);
    previous = current;
  }
  assert.match(html, /class="dayun-scroll-wrapper"/);
  assert.match(html, /class="liunian-scroll-wrapper"/);
  assert.match(html, /class="pp-col pp-liunian-col"/);
  assert.match(html, /class="pp-col pp-dayun-col"/);
  assert.match(html, /js\/ai-chat-integration\.js/);
});

test('hepan result keeps its existing result and AI integration hooks', () => {
  const html = read('hepan-result.html');
  for (const marker of ['section-dayun', 'section-liunian', 'section-sizhu', 'js/hepan-result.js', 'js/ai-chat-integration.js']) {
    assert.ok(html.includes(marker), `hepan-result.html lost ${marker}`);
  }
});
```

- [ ] **Step 3: Write the AI-flow contract test**

Create `tests/ai-flow-contract.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('follow-up pages retain their contextual AI destinations', () => {
  assert.match(read('result.html'), /ai-chat-integration\.js/);
  assert.match(read('ziwei.html'), /js\/ziwei-analysis\.js/);
  assert.match(read('js/ziwei-analysis.js'), /zw-ai-chat\.html/);
  assert.match(read('liuren.html'), /lr-ai-chat\.html/);
  assert.match(read('hepan-result.html'), /ai-chat-integration\.js/);
});

test('one-shot tools do not gain follow-up chat routes', () => {
  for (const page of ['liuyao.html', 'meihua.html', 'face.html', 'palm.html', 'fengshui.html', 'fortune.html']) {
    assert.doesNotMatch(read(page), /(?:ai-chat|zw-ai-chat|lr-ai-chat)\.html/, `${page} gained a follow-up route`);
  }
});
```

- [ ] **Step 4: Run the tests and verify RED for only the planned visual changes**

```powershell
node --test tests/light-theme-contract.test.js tests/result-structure-contract.test.js tests/ai-flow-contract.test.js
```

Expected: result-structure and AI-flow tests pass; theme-link, palette, ten-card, and standalone-CTA assertions fail.

- [ ] **Step 5: Keep the failing tests uncommitted until Task 3 and Task 4 make them pass**

Do not change production files in this task.

---

### Task 3: Add the Reversible Global Light Theme Layer

**Files:**
- Create: `css/theme-light.css`
- Modify: `index.html`
- Modify: `paipan.html`
- Modify: `result.html`
- Modify: `ziwei.html`
- Modify: `liuren.html`
- Modify: `hepan.html`
- Modify: `hepan-result.html`
- Modify: `liuyao.html`
- Modify: `meihua.html`
- Modify: `face.html`
- Modify: `palm.html`
- Modify: `fengshui.html`
- Modify: `fortune.html`
- Modify: `pricing.html`
- Modify: `profile.html`
- Modify: `ai-chat.html`
- Modify: `lr-ai-chat.html`
- Modify: `zw-ai-chat.html`
- Test: `tests/light-theme-contract.test.js`

**Interfaces:**
- Consumes: existing variables from `css/style.css`, `css/landing.css`, `css/auth.css`, and inline page styles.
- Produces: approved light palette variables and shared body, card, form, navigation, modal, toast, focus, and footer styles without deleting dark CSS.

- [ ] **Step 1: Create the approved global token and component overrides**

Create `css/theme-light.css` with these complete shared token and component overrides:

```css
:root {
  color-scheme: light;
  --ink: #f6efdf;
  --paper: #eee3cd;
  --card: rgba(255, 252, 245, .68);
  --gold: #a47b42;
  --gold-l: #84362f;
  --gold-d: #6d2925;
  --gold-glow: rgba(132, 54, 47, .12);
  --star: #365d50;
  --star-dim: #557568;
  --star-glow: rgba(54, 93, 80, .08);
  --mist: #796d61;
  --mist-dim: rgba(121, 109, 97, .56);
  --tx: #2d261f;
  --tx2: #655b51;
  --tx3: #796d61;
  --bd: rgba(72, 52, 31, .16);
  --bd2: rgba(72, 52, 31, .27);
  --bd-star: rgba(54, 93, 80, .13);
  --red: #84362f;
  --zh-paper: #f6efdf;
  --zh-paper-deep: #eee3cd;
  --zh-ink: #2d261f;
  --zh-vermilion: #84362f;
  --zh-pine: #365d50;
  --zh-aged-gold: #a47b42;
}

html { background: var(--zh-paper); }
body {
  color: var(--zh-ink);
  background: linear-gradient(145deg, var(--zh-paper), var(--zh-paper-deep));
}
body::before {
  background:
    radial-gradient(circle at 78% 12%, rgba(132,54,47,.065), transparent 24%),
    radial-gradient(circle at 12% 78%, rgba(54,93,80,.05), transparent 28%),
    repeating-linear-gradient(90deg, rgba(72,52,31,.016) 0 1px, transparent 1px 14px);
  opacity: 1;
}
.bg-overlay {
  background: linear-gradient(180deg, rgba(246,239,223,.72), rgba(238,227,205,.9));
}
.card,
.chat-panel,
.modal,
.auth-modal {
  color: var(--zh-ink);
  background: rgba(255,252,245,.72);
  border-color: var(--bd);
  box-shadow: 0 16px 44px rgba(67,46,24,.08);
}
.btn-gold,
.submit,
.submit-btn,
.chat-send-btn,
.auth-submit {
  color: #fff8ea;
  background: linear-gradient(135deg, #963f38, var(--zh-vermilion));
  box-shadow: 0 8px 22px rgba(132,54,47,.16);
}
.field select,
.minute-inp,
.chat-input,
.auth-field input {
  color: var(--zh-ink);
  background-color: rgba(255,253,248,.76);
  border-color: var(--bd);
}
.field select option { color: var(--zh-ink); background: #fffaf0; }
.field select:focus,
.minute-inp:focus,
.chat-input:focus,
.auth-field input:focus {
  border-color: var(--zh-vermilion);
  box-shadow: 0 0 0 3px rgba(132,54,47,.09);
}
.toast.success { color: #244c3f; background: #e6efe8; border-color: #b8ccbe; }
.toast.error { color: #742f2a; background: #f5e5df; border-color: #dfb9af; }
.toast.info { color: #4e4338; background: #f3ead8; border-color: #d8c8b0; }
.footer,
.land-footer { color: var(--tx3); border-color: var(--bd); }
#zhishi-nav,
.site-nav,
.top-nav { color: var(--zh-ink); background: rgba(249,244,233,.9) !important; border-color: var(--bd) !important; }
.nav-user .btn-auth,
.credits-badge { color: var(--zh-pine); background: rgba(54,93,80,.055); border-color: rgba(54,93,80,.18); }
:focus-visible { outline: 2px solid var(--zh-vermilion); outline-offset: 3px; }
```

- [ ] **Step 2: Load the global theme last on every public page**

Immediately before each page's `</head>`, after its final inline `</style>` and existing stylesheet links, add:

```html
<link rel="stylesheet" href="css/theme-light.css?v=1">
```

Do not add the theme to `admin.html`, `channel-admin.html`, debug/demo pages, or promotional video files in this phase.

- [ ] **Step 3: Run the theme and existing regression tests**

```powershell
node --test tests/light-theme-contract.test.js tests/homepage-visual-contract.test.js tests/homepage-dom-contract.test.js
```

Expected: palette and link-order assertions pass; the homepage ten-card and standalone-CTA assertions remain failing until Task 4; all existing homepage tests pass.

- [ ] **Step 4: Commit the theme foundation and tests that now pass**

```powershell
git add css/theme-light.css index.html paipan.html result.html ziwei.html liuren.html hepan.html hepan-result.html liuyao.html meihua.html face.html palm.html fengshui.html fortune.html pricing.html profile.html ai-chat.html lr-ai-chat.html zw-ai-chat.html tests/light-theme-contract.test.js tests/result-structure-contract.test.js tests/ai-flow-contract.test.js
git commit -m "feat: add reversible light theme foundation"
```

Before committing, verify `git diff --cached --name-only` does not list admin/demo pages, `.env`, `knowledge/fengshui_extracts/`, or redemption-code files.

---

### Task 4: Refine the Homepage Without Changing the Intro

**Files:**
- Create: `css/theme-light-home.css`
- Modify: `index.html`
- Modify: `tests/light-theme-contract.test.js`
- Test: `tests/homepage-dom-contract.test.js`
- Test: `tests/homepage-visual-contract.test.js`
- Test: `tests/light-theme-contract.test.js`

**Interfaces:**
- Consumes: the existing `#eyeOverlay`, `.hero`, `.features`, `.trust-section`, `.cta-bottom`, and all existing feature routes.
- Produces: the approved light homepage, category navigation, ten uniform cards, a compact three-step usage section, trust/clear-use copy, and a simplified CTA/footer.

- [ ] **Step 1: Preserve the intro and document its exact invariant in the test**

Do not edit the `#eyeOverlay` markup, its animations, or the timeout sequence covered by `homepage-visual-contract.test.js`. Run:

```powershell
node --test tests/homepage-visual-contract.test.js
```

Expected: the intro-duration assertion passes before homepage edits.

- [ ] **Step 2: Rebuild only the homepage navigation markup into five categories**

Inside `#zhishi-nav`, keep `/pricing`, `/profile`, and `#nav-user-area`, and use these category destinations:

```html
<a href="/paipan" class="nav-primary">命理</a>
<a href="/liuren" class="nav-primary">卜筮</a>
<a href="/face" class="nav-secondary">观相</a>
<a href="/fengshui" class="nav-secondary">堪舆</a>
<a href="/fortune" class="nav-secondary">运势</a>
```

Keep the existing “更多” menu and its direct feature routes so every tool remains reachable on desktop and mobile. Remove only inline color/background styles that conflict with the new theme; do not change authentication hooks.

- [ ] **Step 3: Make the ten homepage feature cards structurally uniform**

Keep the current nine cards in their existing order and append this tenth card after AI 观手:

```html
<a href="/fortune" class="feat-card" style="text-decoration:none">
  <div class="feat-icon"><span>运</span></div>
  <h3>今日运势</h3>
  <p>结合个人资料查看每日趋势<br>宜忌参考 · 理性规划 · 一次性解读</p>
</a>
```

Remove per-card color declarations and the old `nth-child` special treatment in the light homepage stylesheet. Do not add AI-mode badges.

- [ ] **Step 4: Add the compact three-step usage section before `trust-section`**

```html
<section class="usage-section" aria-labelledby="usage-title">
  <h2 id="usage-title">如何使用</h2>
  <div class="usage-grid">
    <article><span>一</span><h3>选择功能</h3><p>按命理、卜筮、观相、堪舆或运势进入对应工具。</p></article>
    <article><span>二</span><h3>提交信息</h3><p>依照页面提示填写资料、问题，或上传清晰图像。</p></article>
    <article><span>三</span><h3>查看结果</h3><p>获得计算与智能解读；支持的功能可基于结果继续提问。</p></article>
  </div>
</section>
```

Retain the existing four trust cards, restyle them, and change only wording that overstates certainty. Keep the privacy and flexible-payment content truthful to current behavior.

- [ ] **Step 5: Remove the standalone consultation CTA and keep direct tool CTAs**

Delete only the bottom `AI 命理咨询` link. Keep `免费起盘` and `合盘缘分`. The hero must continue to show `知天时 · 见自己`; desktop may render it on one line and mobile may wrap it visually without changing text.

- [ ] **Step 6: Create `css/theme-light-home.css` and load it after `theme-light.css`**

The file must include these core rules and matching desktop/mobile refinements:

```css
.ink-wash-scene { opacity: .12; filter: sepia(.2) saturate(.55); }
.ink-wash-overlay { background: rgba(246,239,223,.82) !important; }
.landing-wrap { max-width: 1180px; }
.hero h1 { color: var(--zh-ink); text-shadow: none; }
.hero-tagline { color: var(--zh-vermilion); }
.hero-desc { color: var(--tx2); }
.features { grid-template-columns: repeat(5, minmax(0,1fr)); gap: 14px; }
.feat-card {
  color: var(--zh-ink);
  background: rgba(255,252,245,.68) !important;
  border-color: var(--bd) !important;
  box-shadow: 0 12px 34px rgba(67,46,24,.06) !important;
}
.feat-card h3,
.feat-card:nth-child(n) h3 { color: #4a3729 !important; background: none; -webkit-text-fill-color: currentColor; }
.usage-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
.usage-grid article { padding: 22px; border: 1px solid var(--bd); border-radius: 12px; background: rgba(255,252,245,.54); }
@media (max-width: 1024px) { .features { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 600px) {
  .features { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .usage-grid { grid-template-columns: 1fr; }
  .hero-tagline { max-width: 8em; margin-inline: auto; line-height: 1.8; }
}
```

Load it immediately after `theme-light.css`:

```html
<link rel="stylesheet" href="css/theme-light.css?v=1">
<link rel="stylesheet" href="css/theme-light-home.css?v=1">
```

- [ ] **Step 7: Run all homepage contracts and commit**

```powershell
node --test tests/homepage-dom-contract.test.js tests/homepage-visual-contract.test.js tests/light-theme-contract.test.js
git diff --check
git add index.html css/theme-light-home.css tests/light-theme-contract.test.js
git commit -m "feat: refine the light Zhishi homepage"
```

Expected: all homepage and theme tests pass, exactly ten feature cards exist, and the 1.8-second intro contract remains green.

---

### Task 5: Skin Existing Input Forms Without Changing Fields

**Files:**
- Create: `css/theme-light-forms.css`
- Create: `tests/form-structure-contract.test.js`
- Modify: `paipan.html`
- Modify: `ziwei.html`
- Modify: `liuren.html`
- Modify: `hepan.html`
- Modify: `liuyao.html`
- Modify: `meihua.html`
- Modify: `face.html`
- Modify: `palm.html`
- Modify: `fengshui.html`
- Modify: `fortune.html`
- Test: `tests/form-structure-contract.test.js`

**Interfaces:**
- Consumes: existing form controls, upload zones, toggles, field IDs, submit handlers, and calculation scripts.
- Produces: consistent light form surfaces and mobile touch targets without changing values, names, IDs, defaults, validation, or submission behavior.

- [ ] **Step 1: Add form-structure invariants before styling**

Create `tests/form-structure-contract.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bazi input retains every calculation control and script', () => {
  const html = read('paipan.html');
  for (const id of ['sYear','sMonth','sDay','sHour','sMinute','zishiHuanri','solarEnabled','province','city','district']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  for (const script of ['js/lunar.js','js/region.js','js/main.js']) assert.ok(html.includes(script));
  assert.match(html, /name=["']gender["']/);
});

test('face and palm retain their file inputs and submit handlers', () => {
  for (const page of ['face.html','palm.html']) {
    const html = read(page);
    assert.match(html, /type=["']file["']/, `${page} lost its upload input`);
    assert.match(html, /<script[\s\S]*?fetch\(/, `${page} lost its analysis request`);
  }
});

test('fengshui retains dynamic photo input creation and analysis request', () => {
  const html = read('fengshui.html');
  assert.match(html, /input\.type\s*=\s*['"]file['"]/);
  assert.match(html, /fetch\(['"]\/api\/fengshui-reading['"]/);
});
```

- [ ] **Step 2: Run the form contract before modifications**

```powershell
node --test tests/form-structure-contract.test.js
```

Expected: all tests pass on the current markup.

- [ ] **Step 3: Create the form-only light overrides**

Create `css/theme-light-forms.css`:

```css
.mode-tabs,
.radio-group,
.form-section { background: rgba(255,252,245,.42); }
.mode-tab,
.radio { color: var(--tx2); background: rgba(255,253,248,.48); border-color: var(--bd); }
.mode-tab.active,
.radio:has(input:checked) {
  color: var(--zh-vermilion);
  background: rgba(132,54,47,.08);
  border-color: rgba(132,54,47,.35);
  box-shadow: none;
}
.upload-zone,
.upload-area,
.upload-placeholder {
  color: var(--tx2);
  background: rgba(255,253,248,.58);
  border-color: rgba(54,93,80,.24);
}
.upload-zone:hover,
.upload-area:hover { border-color: var(--zh-pine); background: rgba(54,93,80,.055); }
.submit.loading,
.submit-btn.loading,
button[disabled] { opacity: .56; cursor: not-allowed; box-shadow: none; }
@media (max-width: 768px) {
  select, input, textarea, button, .radio, .mode-tab { min-height: 44px; }
}
```

- [ ] **Step 4: Load `theme-light-forms.css` last on the ten input/tool pages**

Add after `theme-light.css`:

```html
<link rel="stylesheet" href="css/theme-light-forms.css?v=1">
```

Do not move or rename form elements. Do not edit any JavaScript in this task.

- [ ] **Step 5: Run contracts and commit**

```powershell
node --test tests/form-structure-contract.test.js tests/ai-flow-contract.test.js tests/*.test.js
git diff --check
git add css/theme-light-forms.css paipan.html ziwei.html liuren.html hepan.html liuyao.html meihua.html face.html palm.html fengshui.html fortune.html tests/form-structure-contract.test.js
git commit -m "feat: apply light styling to existing tool forms"
```

Expected: all tests pass and no JavaScript file changes.

---

### Task 6: Apply Skin-Only Styling to Result Pages

**Files:**
- Create: `css/theme-light-results.css`
- Modify: `result.html`
- Modify: `hepan-result.html`
- Modify: `ziwei.html`
- Modify: `liuren.html`
- Test: `tests/result-structure-contract.test.js`
- Test: `tests/ai-flow-contract.test.js`

**Interfaces:**
- Consumes: current `.section-dayun`, `.section-liunian`, `.section-sizhu`, `.dayun-*`, `.liunian-*`, `.pp-*`, report-section, drawer, paywall, and AI integration selectors.
- Produces: the approved seven-parts-plain/three-parts-accent result skin while preserving the exact DOM, order, sizes, scroll model, and event hooks.

- [ ] **Step 1: Create the result-only stylesheet without layout conversion rules**

Create `css/theme-light-results.css` with color, border, background, shadow, and restrained spacing overrides only:

```css
.result-container { color: var(--zh-ink); }
.result-header,
.section-dayun,
.section-liunian,
.section-sizhu,
.result-section,
.analysis-section,
.pro-section {
  background: rgba(255,252,245,.62) !important;
  border-color: var(--bd) !important;
  box-shadow: 0 12px 34px rgba(67,46,24,.055) !important;
}
.section-dayun .section-header,
.section-liunian .section-header,
.section-sizhu .section-header {
  border-bottom-color: rgba(72,52,31,.12) !important;
  box-shadow: inset 2px 0 var(--zh-aged-gold);
}
.dayun-col,
.liunian-col,
.pp-col { color: var(--zh-ink); border-color: rgba(72,52,31,.12) !important; }
.dayun-col.current,
.dayun-col.active,
.liunian-col.current-year,
.liunian-col.active-ln {
  color: var(--zh-vermilion) !important;
  background: linear-gradient(180deg, rgba(132,54,47,.11), rgba(132,54,47,.045)) !important;
  box-shadow: inset 0 2px var(--zh-vermilion) !important;
}
.pp-dayun-col.active-dayun,
.pp-liunian-col.active-liunian {
  background: rgba(132,54,47,.075) !important;
  border-color: rgba(132,54,47,.24) !important;
}
.dayun-scroll-wrapper,
.liunian-scroll-wrapper,
.dayun-scroll,
.liunian-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.ai-float-btn,
#aiFloatBtn { background: linear-gradient(145deg, #963f38, #6d2925) !important; color: #fff8ea !important; }
```

Do not add `display:grid`, sidebars, reordered flex/grid areas, changed `order`, hidden sections, or new result markup. Limit this task to the selectors listed in this step; record any remaining hardcoded-color gaps for browser verification rather than editing business HTML.

- [ ] **Step 2: Load the result theme after every existing style on the four result-capable pages**

```html
<link rel="stylesheet" href="css/theme-light-results.css?v=1">
```

For `ziwei.html` and `liuren.html`, keep `theme-light-forms.css` first and `theme-light-results.css` last because those pages contain both input and result states.

- [ ] **Step 3: Prove the structure contract stayed unchanged**

```powershell
node --test tests/result-structure-contract.test.js tests/ai-flow-contract.test.js
git diff -- result.html hepan-result.html ziwei.html liuren.html
```

Expected: tests pass; HTML diffs contain stylesheet links only. No existing result markup or scripts change.

- [ ] **Step 4: Commit the result skin**

```powershell
git add css/theme-light-results.css result.html hepan-result.html ziwei.html liuren.html
git commit -m "feat: reskin result pages without structural changes"
```

---

### Task 7: Finish One-Shot Results, Chat, Pricing, Profile, and Auth Surfaces

**Files:**
- Create: `css/theme-light-pages.css`
- Modify: `liuyao.html`
- Modify: `meihua.html`
- Modify: `face.html`
- Modify: `palm.html`
- Modify: `fengshui.html`
- Modify: `fortune.html`
- Modify: `pricing.html`
- Modify: `profile.html`
- Modify: `ai-chat.html`
- Modify: `lr-ai-chat.html`
- Modify: `zw-ai-chat.html`
- Modify: `css/theme-light.css`
- Test: `tests/ai-flow-contract.test.js`

**Interfaces:**
- Consumes: existing one-shot generated-result containers, chat panels, paywall cards, profile records, auth modal, and toast selectors.
- Produces: consistent light styling on all remaining customer-facing states without adding follow-up routes or changing payment/auth behavior.

- [ ] **Step 1: Add page-family overrides**

Create `css/theme-light-pages.css`:

```css
.result-box,
.result-card,
.analysis-result,
.fortune-result,
.hexagram,
.tips-card,
.pricing-card,
.profile-card {
  color: var(--zh-ink);
  background: rgba(255,252,245,.66) !important;
  border-color: var(--bd) !important;
  box-shadow: 0 12px 32px rgba(67,46,24,.055) !important;
}
.result-box h2,
.result-box h3,
.analysis-result h2,
.analysis-result h3 { color: #4a3729; }
.result-box strong,
.analysis-result strong { color: var(--zh-pine); }
.chat-header,
.chat-input-area { border-color: var(--bd); }
.message.user .msg-bubble { background: rgba(132,54,47,.085); border-color: rgba(132,54,47,.18); }
.message.ai .msg-bubble { background: rgba(54,93,80,.065); border-color: rgba(54,93,80,.15); }
.pricing-card.featured { border-color: rgba(132,54,47,.32) !important; box-shadow: 0 14px 36px rgba(132,54,47,.08) !important; }
```

Limit this task to the selectors in the code block. Do not add new result buttons, links, or route targets.

- [ ] **Step 2: Load `theme-light-pages.css` last on the eleven listed pages**

Add:

```html
<link rel="stylesheet" href="css/theme-light-pages.css?v=1">
```

Keep `theme-light-forms.css` before it on one-shot input pages. Keep all scripts and route targets unchanged.

- [ ] **Step 3: Light-skin the existing auth and credit components in `theme-light.css`**

Add exact overrides for `.auth-overlay`, `.auth-modal`, `.migrate-banner`, `.credits-badge`, `.buy-card`, `.paywall`, and existing modal/toast selectors. Do not edit `js/auth.js`, `js/paywall.js`, or `js/hepan-paywall.js`.

- [ ] **Step 4: Run flow and full tests**

```powershell
node --test tests/ai-flow-contract.test.js tests/form-structure-contract.test.js tests/*.test.js
Get-ChildItem js,api,lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Expected: all tests and syntax checks pass; one-shot pages still have no chat routes.

- [ ] **Step 5: Commit the remaining public surfaces**

```powershell
git add css/theme-light.css css/theme-light-pages.css liuyao.html meihua.html face.html palm.html fengshui.html fortune.html pricing.html profile.html ai-chat.html lr-ai-chat.html zw-ai-chat.html
git commit -m "feat: complete light styling across public surfaces"
```

---

### Task 8: Add Accessible States and Responsive Safety Contracts

**Files:**
- Modify: `css/theme-light.css`
- Modify: `css/theme-light-home.css`
- Modify: `css/theme-light-forms.css`
- Modify: `css/theme-light-results.css`
- Modify: `css/theme-light-pages.css`
- Create: `tests/light-theme-responsive-contract.test.js`

**Interfaces:**
- Consumes: existing loading, disabled, error, modal, toast, paywall, upload, and scroll states.
- Produces: visible focus, readable status colors, 44px mobile targets, intentional result-table scrolling, and reduced decorative motion without changing the intro timing.

- [ ] **Step 1: Add a responsive and state contract**

Create `tests/light-theme-responsive-contract.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const allCss = ['theme-light.css','theme-light-home.css','theme-light-forms.css','theme-light-results.css','theme-light-pages.css']
  .map((file) => fs.readFileSync(path.join(root, 'css', file), 'utf8'))
  .join('\n');

test('light UI has keyboard focus, mobile touch, and intentional table scrolling', () => {
  assert.match(allCss, /:focus-visible/);
  assert.match(allCss, /min-height:\s*44px/);
  assert.match(allCss, /dayun-scroll-wrapper[\s\S]*overflow-x:\s*auto/);
  assert.match(allCss, /liunian-scroll-wrapper[\s\S]*overflow-x:\s*auto/);
});

test('decorative reduced-motion rules do not remove the intro contract', () => {
  assert.match(allCss, /prefers-reduced-motion/);
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /setTimeout\([\s\S]{0,300}?1800\)/);
});
```

- [ ] **Step 2: Add explicit accessible states**

Add the shared state rules to `css/theme-light.css`. Add the mobile dayun/liunian scroll rules to `css/theme-light-results.css`; keep the remaining mobile target rule in `css/theme-light.css`:

```css
button:disabled,
.submit.loading,
.submit-btn.loading { opacity: .56; cursor: not-allowed; filter: saturate(.55); }
.error,
.field-error,
[data-state="error"] { color: #84362f; }
.success,
[data-state="success"] { color: #365d50; }
@media (max-width: 768px) {
  button, a.btn, .hero-cta, .cta-btn, select, input, textarea { min-height: 44px; }
  .dayun-scroll-wrapper, .liunian-scroll-wrapper { overscroll-behavior-inline: contain; }
}
@media (prefers-reduced-motion: reduce) {
  body.loaded .landing-wrap,
  body.loaded .app,
  body.loaded .result-container,
  .feat-card,
  .card { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Do not target `#eyeOverlay`, `.loader-eye`, or the homepage timeout in the reduced-motion block; the approved intro duration remains unchanged.

- [ ] **Step 3: Run all automated checks and commit**

```powershell
node --test tests/*.test.js
Get-ChildItem js,api,lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
git add css tests/light-theme-responsive-contract.test.js
git commit -m "fix: harden light theme states and responsive behavior"
```

Expected: all tests pass, no JavaScript syntax errors, and no whitespace errors.

---

### Task 9: Browser Verification, Visual Comparison, and Rollback Proof

**Files:**
- Verify: every customer-facing HTML page listed in Task 3
- Verify: `css/theme-light.css`
- Verify: `css/theme-light-home.css`
- Verify: `css/theme-light-forms.css`
- Verify: `css/theme-light-results.css`
- Verify: `css/theme-light-pages.css`
- Verify: backup artifacts and `docs/backups/2026-07-22-pre-light-ui.md`

**Interfaces:**
- Consumes: the completed feature worktree and backup artifacts.
- Produces: automated evidence, desktop/mobile screenshots, route smoke results, and a demonstrated rollback path.

- [ ] **Step 1: Start the local site and run the complete automated suite**

```powershell
$env:PORT='3472'
node dev-server.js
```

In a second terminal:

```powershell
node --test tests/*.test.js
Get-ChildItem js,api,lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
npm audit --omit=dev --audit-level=low
git diff --check
```

Expected: zero failed tests, zero syntax failures, zero reported production dependency vulnerabilities, and no whitespace errors.

- [ ] **Step 2: Verify the desktop homepage at 1440×900**

Using the in-app browser at `http://127.0.0.1:3472/`, verify:

- intro timing test remains green and the animation still completes normally;
- slogan reads `知天时，见自己`;
- ten uniform cards exist and all routes are correct;
- no standalone AI consultation CTA exists;
- usage, trust, privacy, and footer sections are readable;
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`;
- no console errors occur.

- [ ] **Step 3: Verify the mobile homepage and inputs at 390×844**

Verify homepage, `/paipan`, `/face`, `/palm`, `/fengshui`, `/liuyao`, and `/meihua`:

- two-column homepage grid;
- all controls are usable at 44px minimum touch height;
- native selects work on the first tap;
- upload areas remain functional;
- no viewport-wide horizontal overflow;
- no console errors.

- [ ] **Step 4: Generate a sample Bazi result and compare structure**

On `/paipan`, use the non-sensitive sample `1995-08-12 14:30`, male, with location left optional. Submit and verify on desktop and mobile:

- header metadata and share action remain present;
- dayun and liunian retain their original horizontal columns;
- four-pillar grid retains the original row and column structure;
- all long-report sections remain in the original order;
- current dayun/liunian use restrained vermilion;
- interpretation and safety content use pine accents;
- the AI floating entry and paywall still work;
- mobile horizontal scrolling occurs inside the tables only.

- [ ] **Step 5: Smoke-test every route and both AI-flow types**

Open `/ziwei`, `/liuren`, `/hepan`, `/hepan-result`, `/liuyao`, `/meihua`, `/face`, `/palm`, `/fengshui`, `/fortune`, `/pricing`, `/profile`, `/ai-chat`, `/lr-ai-chat`, and `/zw-ai-chat`.

Expected:

- 八字、紫微、大六壬、合盘 keep contextual follow-up entry points;
- 六爻、梅花、观面、观手、八宅风水、今日运势 end at one-shot results;
- authentication, credits, save/share, upload, and paywall states still operate;
- no page has unintended dark text on dark surfaces or light text on light surfaces;
- no console errors or page-wide overflow.

- [ ] **Step 6: Demonstrate rollback without touching the feature worktree**

```powershell
$backupRoot = Join-Path $env:USERPROFILE 'Documents\ZhishiBackups\2026-07-22-pre-light-ui'
git bundle verify (Join-Path $backupRoot 'zhishi-bazi-94058e0.bundle')
git show backup/pre-light-ui-2026-07-22:index.html | Select-Object -First 5
```

Expected: the bundle verifies and the tagged original homepage can be read. Do not deploy the rollback; this is proof only.

- [ ] **Step 7: Review staged files and commit final verification adjustments**

```powershell
git status --short
git diff --stat
git diff --check
```

If browser verification required CSS-only fixes, stage only the theme files and their tests, then commit:

```powershell
git add css tests *.html docs/backups/2026-07-22-pre-light-ui.md
git commit -m "fix: finish verified light UI polish"
```

Before committing, confirm `.env`, backup archives, `knowledge/fengshui_extracts/`, and redemption-code files are absent from `git diff --cached --name-only`.

- [ ] **Step 8: Stop before deployment and present the verified local build**

Do not merge, push the feature branch, or deploy until the user reviews the local desktop and mobile build. Provide the feature branch name, commit list, automated test output, screenshot locations, and exact rollback tag.
