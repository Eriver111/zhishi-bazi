# Mobile Hero Background Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the homepage mobile hero artwork with a richer portrait composition that preserves text readability and removes the excessive empty middle area.

**Architecture:** Use the existing portrait artwork as the first image-edit target and fall back to a new generation only if the edit has visible seams or inconsistent brushwork. Save the selected result as versioned PNG and WebP assets, switch only the mobile `<source>` to v3, and keep the desktop v2 source and mobile v2 rollback assets unchanged.

**Tech Stack:** Built-in image generation/editing, HTML `<picture>`, CSS responsive art direction, FFmpeg WebP conversion, Node.js test runner, in-app browser responsive validation.

## Global Constraints

- Final mobile asset dimensions: exactly 1024×1536 (2:3).
- Mobile breakpoint: `max-width: 600px`.
- Keep `images/zhishi-hero-ink-v2.webp` as the desktop WebP source.
- Keep `images/zhishi-hero-ink-mobile-v2.png` and `.webp` in the repository for rollback.
- Do not restore mobile background pan animation or the dark water gradient.
- No people, dominant buildings, text, seals, logos, watermarks, modern objects, or dark horizontal bands in the artwork.
- Central title, description, and button area must remain low-contrast and readable.

---

### Task 1: Lock the responsive asset contract

**Files:**
- Modify: `tests/homepage-visual-contract.test.js`
- Test: `tests/homepage-visual-contract.test.js`

**Interfaces:**
- Consumes: Homepage HTML read through the existing `html` fixture.
- Produces: A contract requiring mobile v3, desktop v2, and both new asset files.

- [ ] **Step 1: Write the failing test**

Replace the existing art-direction test body with:

```js
test('homepage uses v3 mobile artwork while preserving the v2 desktop artwork', () => {
  assert.match(html, /<source[^>]+media=["']\(max-width:\s*600px\)["'][^>]+zhishi-hero-ink-mobile-v3\.webp/);
  assert.match(html, /<source[^>]+zhishi-hero-ink-v2\.webp[^>]+image\/webp/);
  assert.match(html, /<img[^>]+zhishi-hero-ink-v2\.png/);
  assert.ok(fs.existsSync(path.join(root, 'images', 'zhishi-hero-ink-mobile-v3.png')));
  assert.ok(fs.existsSync(path.join(root, 'images', 'zhishi-hero-ink-mobile-v3.webp')));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/homepage-visual-contract.test.js
```

Expected: FAIL because `zhishi-hero-ink-mobile-v3.webp` is not referenced and the v3 files do not exist.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add tests/homepage-visual-contract.test.js
git commit -m "test: require refined mobile hero artwork"
```

---

### Task 2: Create and select the mobile artwork

**Files:**
- Reference/edit target: `images/zhishi-hero-ink-mobile-v2.png`
- Create: `images/zhishi-hero-ink-mobile-v3.png`
- Create: `images/zhishi-hero-ink-mobile-v3.webp`

**Interfaces:**
- Consumes: The current v2 portrait artwork and the approved composition spec.
- Produces: A 1024×1536 PNG master and visually equivalent WebP delivery asset.

- [ ] **Step 1: Edit the existing artwork with the built-in image tool**

Use `images/zhishi-hero-ink-mobile-v2.png` as the edit target with this prompt:

```text
Use case: precise-object-edit
Asset type: mobile website hero background, 1024×1536 portrait
Primary request: preserve the existing warm rice-paper texture and restrained Chinese ink-wash style, but rebalance the composition for a mobile homepage. Raise the lower misty mountain landscape so its main ridgeline begins around 68% of the image height. Add very subtle horizontal mist and pale middle-distance ink layers between 52% and 72% height so the lower half no longer feels empty. Let the upper-left pine branch extend slightly farther inward and retain faint upper-right mountains.
Composition: keep the central area from roughly 16% to 84% width and 13% to 58% height quiet, pale, and low contrast for black title copy and two buttons.
Palette: warm ivory paper, pale umber, soft grey ink, tiny restrained aged-gold flecks.
Constraints: keep the original paper grain and hand-painted character; no dark band; no high-contrast subject behind the copy area; no people, dominant buildings, text, seals, logos, watermark, or modern elements.
```

- [ ] **Step 2: Inspect the edit**

Accept the edit only if:

- Paper texture and brushwork remain continuous with no pasted seams.
- The lower ridgeline begins near 68% height.
- The central copy-safe area remains quiet.
- No dark horizontal band or generated text appears.

If any condition fails, generate a new 1024×1536 image using the same prompt with `Use case: stylized-concept` and without referring to the old image as an edit target.

- [ ] **Step 3: Save the selected PNG into the project**

Copy the selected built-in output to:

```text
images/zhishi-hero-ink-mobile-v3.png
```

Do not overwrite the v2 files.

- [ ] **Step 4: Validate and normalize dimensions**

Run:

```powershell
ffmpeg -y -i images/zhishi-hero-ink-mobile-v3.png -vf "scale=1024:1536:flags=lanczos" images/zhishi-hero-ink-mobile-v3.normalized.png
```

After visual inspection, replace `zhishi-hero-ink-mobile-v3.png` with the normalized output using native PowerShell file operations.

```powershell
Move-Item -Force -LiteralPath images/zhishi-hero-ink-mobile-v3.normalized.png -Destination images/zhishi-hero-ink-mobile-v3.png
```

- [ ] **Step 5: Create the WebP delivery asset**

Run:

```powershell
ffmpeg -y -i images/zhishi-hero-ink-mobile-v3.png -c:v libwebp -quality 82 -compression_level 6 images/zhishi-hero-ink-mobile-v3.webp
```

- [ ] **Step 6: Inspect both project assets**

Open both the PNG and WebP and confirm that color, composition, and edges match.

- [ ] **Step 7: Commit the assets**

```powershell
git add images/zhishi-hero-ink-mobile-v3.png images/zhishi-hero-ink-mobile-v3.webp
git commit -m "assets: add refined mobile hero artwork"
```

---

### Task 3: Wire the v3 artwork into the homepage

**Files:**
- Modify: `index.html`
- Test: `tests/homepage-visual-contract.test.js`

**Interfaces:**
- Consumes: `images/zhishi-hero-ink-mobile-v3.webp`.
- Produces: Mobile-only art direction through the existing `<picture>` element.

- [ ] **Step 1: Update only the mobile source**

Change:

```html
<source media="(max-width: 600px)" srcset="images/zhishi-hero-ink-mobile-v2.webp" type="image/webp">
```

to:

```html
<source media="(max-width: 600px)" srcset="images/zhishi-hero-ink-mobile-v3.webp" type="image/webp">
```

Leave the desktop WebP and PNG fallback lines unchanged.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```powershell
node --test tests/homepage-visual-contract.test.js
```

Expected: all homepage visual contract tests PASS.

- [ ] **Step 3: Commit the integration**

```powershell
git add index.html
git commit -m "feat: use refined artwork on mobile homepage"
```

---

### Task 4: Validate responsive composition and release

**Files:**
- Verify: `index.html`
- Verify: `css/theme-light-home.css`
- Verify: `images/zhishi-hero-ink-mobile-v3.webp`
- Test: `tests/*.test.js`

**Interfaces:**
- Consumes: The integrated v3 mobile asset.
- Produces: A visually accepted and fully tested release on both feature and main branches.

- [ ] **Step 1: Validate at 390×844**

Open `http://127.0.0.1:3107/`, set viewport to 390×844, wait for the fixed 1.8-second intro, scroll to the top, and capture the first viewport.

Confirm:

- The pine branch and upper-right mountain remain visible.
- The title, description, and buttons have clean low-contrast backing.
- Mist and raised lower mountains visually connect the lower half.
- There is no dark band.

- [ ] **Step 2: Validate at 430×932**

Repeat at 430×932 and apply the same acceptance criteria.

- [ ] **Step 3: Verify desktop remains unchanged**

At 1440×900 confirm `currentSrc` is `images/zhishi-hero-ink-v2.webp` and the desktop `paintingPan` animation remains active.

- [ ] **Step 4: Run the complete test suite**

Run:

```powershell
node --test tests/*.test.js
git diff --check
git status -sb
```

Expected: all tests PASS, `git diff --check` emits no errors, and only intended commits are ahead of the remote.

- [ ] **Step 5: Push the release**

```powershell
git push origin feat/light-ui-redesign
git push origin HEAD:main
```

- [ ] **Step 6: Verify remote refs**

Run:

```powershell
git ls-remote origin refs/heads/main refs/heads/feat/light-ui-redesign
```

Expected: both remote refs resolve to the same final commit.
