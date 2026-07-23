# 知时首页背景与结果页对比度修订 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用两张原创响应式东方写意背景替换首页灰雾背景，并在不改变结果页结构和业务逻辑的前提下恢复全部数据的清晰对比度。

**Architecture:** 首页继续沿用现有 `picture + overlay + canvas` 分层，只替换图片资源、响应式来源和浅色主题透明度。结果页仍由最后加载的增量主题文件覆盖旧版颜色，不改 HTML 结构与脚本；Node 原生测试负责锁定资源引用、色值和结构不变量，浏览器截图负责最终视觉验收。

**Tech Stack:** 静态 HTML、CSS、Node.js `node:test`、Playwright/本地浏览器、内置图像生成工具。

## Global Constraints

- 首页约 1.8 秒开场动画保持不动。
- 只修改视觉表现，不改变功能、数据、页面结构、计算链路、付费逻辑和 AI 问答方式。
- 原深色 UI、现有背景图片和 `backup/pre-light-ui-2026-07-22` 均保留，不覆盖删除。
- 新背景无文字、无人像、无符咒、无大幅八卦、无神像，桌面与手机分别构图。
- 结果页不得新增 `display`、`grid-template`、`grid-area`、`order` 或隐藏内容的规则。

---

### Task 1: 生成并固化两张首页背景

**Files:**
- Create: `images/zhishi-hero-ink-v2.png`
- Create: `images/zhishi-hero-ink-mobile-v2.png`
- Create: `images/zhishi-hero-ink-v2.webp`
- Create: `images/zhishi-hero-ink-mobile-v2.webp`

**Interfaces:**
- Consumes: 已确认设计稿中的桌面中央 50% 留白、手机中央 65% 留白规则。
- Produces: `index.html` 可直接引用的桌面与手机 PNG/WebP 资源。

- [ ] **Step 1: 使用内置图像生成工具生成桌面背景**

```text
Use case: stylized-concept
Asset type: responsive website hero background, desktop landscape
Primary request: 原创当代东方写意山水首页背景，温润米宣纸基底，左右边缘与下方有淡墨远山、少量松枝和极克制的旧金色微光，中央约 50% 大面积干净留白，用于叠加网站标题和按钮。
Style/medium: refined Chinese ink wash painting on warm rice paper, contemporary editorial luxury, subtle paper fibers, restrained brushwork
Composition/framing: 16:9 landscape; visual weight at far left, far right and lower edge; calm central negative space; safe crop for desktop hero
Lighting/mood: soft diffused daylight, quiet, trustworthy, cultured, premium
Color palette: warm ivory, soft charcoal ink, muted pine green, tiny aged-gold accents
Constraints: no text, no people, no logo, no watermark, no architecture dominating the scene
Avoid: grey fog covering the entire image, fantasy game art, dramatic black mountains, talismans, bagua symbols, deity imagery, glowing magic circles, clutter in the center
```

- [ ] **Step 2: 使用同一画风生成手机背景**

```text
Use case: stylized-concept
Asset type: responsive website hero background, mobile portrait
Primary request: 与桌面版完全同一视觉体系的原创当代东方写意山水首页背景，温润米宣纸基底，细松枝与淡墨山势集中在顶部边角、左右边缘和最下方，中央约 65% 保持干净安静，用于手机标题、说明和按钮。
Style/medium: refined Chinese ink wash painting on warm rice paper, contemporary editorial luxury, subtle paper fibers, restrained brushwork
Composition/framing: 2:3 portrait; large central vertical negative space; important scenery kept away from center and lower navigation safe area
Lighting/mood: soft diffused daylight, quiet, trustworthy, cultured, premium
Color palette: warm ivory, soft charcoal ink, muted pine green, tiny aged-gold accents
Constraints: no text, no people, no logo, no watermark
Avoid: grey fog covering the image, fantasy game art, talismans, bagua symbols, deity imagery, glowing magic circles, central clutter
```

- [ ] **Step 3: 检查生成图并复制到项目**

用图像查看器确认两张图中央留白、无文字水印、桌面/手机构图方向正确，再复制为上述 PNG 文件；不得只保存在默认生成目录。

- [ ] **Step 4: 生成网页版本并检查尺寸**

Run:
```powershell
magick images/zhishi-hero-ink-v2.png -quality 86 images/zhishi-hero-ink-v2.webp
magick images/zhishi-hero-ink-mobile-v2.png -quality 86 images/zhishi-hero-ink-mobile-v2.webp
magick identify images/zhishi-hero-ink-v2.png images/zhishi-hero-ink-mobile-v2.png images/zhishi-hero-ink-v2.webp images/zhishi-hero-ink-mobile-v2.webp
```
Expected: 四个文件均可读取，桌面图为横向、手机图为竖向。

### Task 2: 以测试先行接入响应式背景

**Files:**
- Modify: `tests/homepage-visual-contract.test.js`
- Modify: `index.html:588-592`
- Modify: `css/theme-light-home.css:1-16`

**Interfaces:**
- Consumes: Task 1 的四张稳定路径图片。
- Produces: 手机媒体源优先、桌面 WebP、PNG 回退的首页图片层，以及可见但克制的浅色遮罩。

- [ ] **Step 1: 写入失败的首页视觉契约**

将原背景测试替换为：
```js
test('homepage uses art-directed desktop and mobile hero backgrounds', () => {
  assert.match(html, /<source[^>]+media=["']\(max-width:\s*600px\)["'][^>]+zhishi-hero-ink-mobile-v2\.webp/);
  assert.match(html, /<source[^>]+zhishi-hero-ink-v2\.webp[^>]+image\/webp/);
  assert.match(html, /<img[^>]+zhishi-hero-ink-v2\.png/);
});

test('homepage light treatment keeps the artwork visible', () => {
  const themeCss = fs.readFileSync(path.join(root, 'css', 'theme-light-home.css'), 'utf8');
  assert.match(themeCss, /\.ink-wash-scene\s*\{[^}]*opacity:\s*\.8/);
  assert.match(themeCss, /\.ink-wash-overlay\s*\{[^}]*rgba\(246,239,223,\.2[0-9]\)/);
});
```

- [ ] **Step 2: 运行测试并确认因旧资源失败**

Run: `node --test tests/homepage-visual-contract.test.js`
Expected: FAIL，错误应指出缺少 `zhishi-hero-ink-mobile-v2.webp` 或新的透明度规则。

- [ ] **Step 3: 最小修改图片引用与视觉叠层**

将首页 `picture` 改为：
```html
<picture>
  <source media="(max-width: 600px)" srcset="images/zhishi-hero-ink-mobile-v2.webp" type="image/webp">
  <source srcset="images/zhishi-hero-ink-v2.webp" type="image/webp">
  <img src="images/zhishi-hero-ink-v2.png" alt="" loading="eager" fetchpriority="high">
</picture>
```

并将首页主题开头改为：
```css
.ink-wash-scene {
  opacity: .8;
  filter: saturate(.88) contrast(.96);
}

.ink-wash-overlay {
  background: linear-gradient(180deg, rgba(246,239,223,.26), rgba(246,239,223,.18) 48%, rgba(246,239,223,.28)) !important;
}

#mxhCanvas,
#bgCanvas { opacity: .1; }
```

- [ ] **Step 4: 运行首页契约测试**

Run: `node --test tests/homepage-visual-contract.test.js tests/homepage-dom-contract.test.js`
Expected: PASS，且 1800ms 开场动画测试继续通过。

- [ ] **Step 5: 提交首页背景接入**

```powershell
git add images/zhishi-hero-ink-v2.* images/zhishi-hero-ink-mobile-v2.* index.html css/theme-light-home.css tests/homepage-visual-contract.test.js
git commit -m "feat: add responsive ink wash hero artwork"
```

### Task 3: 以测试先行修复结果页对比度

**Files:**
- Modify: `tests/result-structure-contract.test.js`
- Modify: `css/theme-light-results.css`

**Interfaces:**
- Consumes: 现有结果页 HTML 类名和浅色主题变量。
- Produces: 仅改变颜色的高对比结果页皮肤，适用于八字、合盘、紫微和大六壬结果区域。

- [ ] **Step 1: 写入失败的结果页颜色契约**

在现有结果皮肤测试中加入：
```js
test('result skin uses opaque paper cells and readable ink text', () => {
  const css = read('css/theme-light-results.css');
  assert.match(css, /body[^}]*background:\s*#f4eddf\s*!important/);
  assert.match(css, /\.dayun-col,[\s\S]*?\.liunian-col,[\s\S]*?\.pp-col\s*\{[^}]*background:\s*#fbf6eb\s*!important/);
  assert.match(css, /color:\s*#2d261f\s*!important/);
  assert.match(css, /(?:\.dayun-age|\.dayun-year|\.liunian-year|\.qiyun-info)[\s\S]*?color:\s*#655b51\s*!important/);
  assert.match(css, /background:\s*#efe0d6\s*!important/);
});
```

- [ ] **Step 2: 运行测试并确认旧深色格底未被覆盖**

Run: `node --test tests/result-structure-contract.test.js`
Expected: FAIL，错误应指出缺少 `#f4eddf`、`#fbf6eb` 或 `#655b51`。

- [ ] **Step 3: 添加最小颜色覆盖，不触碰布局**

在 `theme-light-results.css` 中加入明确覆盖：
```css
body { background: #f4eddf !important; color: #2d261f !important; }

.result-header,
.section-dayun,
.section-liunian,
.section-sizhu,
.result-section,
.analysis-section,
.pro-section { background: rgba(251,246,235,.94) !important; }

.dayun-col,
.liunian-col,
.pp-col {
  color: #2d261f !important;
  background: #fbf6eb !important;
}

.dayun-age,
.dayun-year,
.liunian-year,
.qiyun-info,
.section-subtitle,
.pp-ss-text { color: #655b51 !important; }

.dayun-col.current,
.dayun-col.active,
.liunian-col.current-year,
.liunian-col.active-ln,
.pp-dayun-col.active-dayun,
.pp-liunian-col.active-liunian {
  color: #84362f !important;
  background: #efe0d6 !important;
}
```
保留现有边框、滚动和 AI 浮动按钮规则，不新增任何布局属性。

- [ ] **Step 4: 运行结果页契约并检查无结构改写**

Run: `node --test tests/result-structure-contract.test.js tests/ai-flow-contract.test.js`
Expected: PASS；现有禁止 `display/grid/order/hidden` 的断言继续通过。

- [ ] **Step 5: 提交结果页对比度修复**

```powershell
git add css/theme-light-results.css tests/result-structure-contract.test.js
git commit -m "fix: restore readable result page contrast"
```

### Task 4: 桌面、手机与全量回归验收

**Files:**
- Verify: `index.html`
- Verify: `result.html`
- Verify: all `tests/*.test.js`

**Interfaces:**
- Consumes: Task 2 和 Task 3 的最终页面。
- Produces: 可复核的通过记录和视觉检查结果。

- [ ] **Step 1: 运行完整测试套件**

Run: `node --test tests/*.test.js`
Expected: 全部 PASS，0 FAIL。

- [ ] **Step 2: 检查资源响应**

Run:
```powershell
Invoke-WebRequest http://127.0.0.1:3107/images/zhishi-hero-ink-v2.webp -UseBasicParsing | Select-Object StatusCode,Headers
Invoke-WebRequest http://127.0.0.1:3107/images/zhishi-hero-ink-mobile-v2.webp -UseBasicParsing | Select-Object StatusCode,Headers
```
Expected: 两项均为 200，Content-Type 为 `image/webp`。

- [ ] **Step 3: 浏览器检查桌面与手机首页**

在约 1440×900 与 390×844 视口检查：首页背景非灰雾、中心内容无遮挡、标题与按钮清晰、功能卡片无横向溢出、开场动画仍约 1.8 秒。

- [ ] **Step 4: 浏览器检查桌面与手机结果页**

使用固定测试参数打开 `/result?year=2024&month=3&day=18&hour=6&gender=male&clock=11&minute=18`，检查大运、流年、四柱、辅助说明、专业解读、付费区与 AI 入口；要求深墨主文、暖灰辅文、浅朱砂选中态均清晰，结构与横向滚动不变。

- [ ] **Step 5: 检查工作区与最终差异**

Run: `git status --short; git diff --check; git log --oneline -5`
Expected: 仅保留既有未跟踪 `.superpowers/`，无空白错误，提交记录包含背景接入与结果页修复。
