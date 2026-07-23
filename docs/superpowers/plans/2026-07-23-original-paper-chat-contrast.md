# 知时原图纸色与 AI 聊天可读性修订 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页直接呈现生成原图的暖纸色，并将三个“知时先生”聊天页的黑灰界面完整转换为清晰浅色界面。

**Architecture:** 继续使用最后加载的增量主题 CSS 覆盖旧深色样式，不改 HTML 结构和 JavaScript 逻辑。首页专属规则只负责原图、遮罩和 Canvas；共享主题负责纸色，页面主题负责三个聊天页的真实 `.msg/.bubble`、顶栏、底栏和输入控件。

**Tech Stack:** 静态 HTML、CSS、Node.js `node:test`。

## Global Constraints

- 首页约 1.8 秒开场动画保持不动。
- 三个“知时先生”页面的天眼动画及 2.5 秒时长保持不动。
- 不修改问答、积分、兑换码、分享、模式切换、API 请求或历史记录逻辑。
- 不删除旧深色样式、Canvas、动画脚本或背景资源。
- 风水、观面、观手等浅色功能页继续关闭动态背景。
- 仅修改 CSS 与视觉契约测试，除缓存版本引用外不改 HTML 内容。

---

### Task 1: 恢复首页原图色并校准共享纸色

**Files:**
- Modify: `tests/homepage-visual-contract.test.js`
- Modify: `tests/light-theme-contract.test.js`
- Modify: `css/theme-light-home.css:1-16`
- Modify: `css/theme-light.css:1-55`

**Interfaces:**
- Consumes: 原图中央实测平均色 RGB `240,230,209`。
- Produces: 不再被滤镜、遮罩或深色 Canvas 二次调色的首页，以及与原图一致的共享暖纸色。

- [ ] **Step 1: 写入失败的原图色契约**

将首页视觉测试改为明确要求：
```js
test('homepage presents the generated artwork without grey post-processing', () => {
  const themeCss = fs.readFileSync(path.join(root, 'css', 'theme-light-home.css'), 'utf8');
  assert.match(themeCss, /\.ink-wash-scene\s*\{[^}]*opacity:\s*1\s*;[^}]*filter:\s*none\s*;/s);
  assert.match(themeCss, /\.ink-wash-overlay\s*\{[^}]*rgba\(240,230,209,\.0[0-6]\)/s);
  assert.match(themeCss, /#mxhCanvas\s*\{[^}]*opacity:\s*0\s*!important/s);
  assert.match(themeCss, /\.ink-wash-scene\s*~\s*#bgCanvas\s*\{[^}]*opacity:\s*0\s*!important/s);
});
```

并把共享配色契约改为要求 `#f0e6d1` 与接近不透明卡片：
```js
assert.match(css.toLowerCase(), /--zh-paper:\s*#f0e6d1/);
assert.match(css, /\.card,[\s\S]*?\.chat-panel[\s\S]*?background:\s*rgba\(255,252,245,\.94\)/);
```

- [ ] **Step 2: 运行测试并确认旧后处理导致失败**

Run: `node --test tests/homepage-visual-contract.test.js tests/light-theme-contract.test.js`
Expected: FAIL，错误应指向旧 `.8`、旧滤镜、Canvas `.1`、旧纸色或 `.72` 卡片透明度。

- [ ] **Step 3: 最小修改首页与共享主题**

首页规则改为：
```css
.ink-wash-scene {
  opacity: 1;
  filter: none;
}
.ink-wash-overlay {
  background: rgba(240,230,209,.04) !important;
}
#mxhCanvas { opacity: 0 !important; }
.ink-wash-scene ~ #bgCanvas { opacity: 0 !important; }
```

共享主题将 `--ink`、`--zh-paper` 和页面背景统一为 `#f0e6d1`，`--paper`、`--zh-paper-deep` 设为不灰暗的 `#eadfc9`；通用 `.card/.chat-panel/.modal/.auth-modal` 使用 `rgba(255,252,245,.94)`。

- [ ] **Step 4: 运行首页与共享主题测试**

Run: `node --test tests/homepage-visual-contract.test.js tests/light-theme-contract.test.js tests/light-theme-responsive-contract.test.js`
Expected: PASS，且动态背景关闭与首页 1800ms 契约继续通过。

- [ ] **Step 5: 提交首页和纸色修复**

```powershell
git add css/theme-light-home.css css/theme-light.css tests/homepage-visual-contract.test.js tests/light-theme-contract.test.js
git commit -m "fix: restore original hero paper color"
```

### Task 2: 精准浅色化三个 AI 聊天页

**Files:**
- Modify: `tests/light-theme-contract.test.js`
- Modify: `css/theme-light-pages.css`
- Modify: `ai-chat.html`
- Modify: `lr-ai-chat.html`
- Modify: `zw-ai-chat.html`

**Interfaces:**
- Consumes: 三个页面共同使用的 `.page`、`.topbar`、`.messages`、`.msg`、`.bubble`、`.bottombar`、`.redeem-row` 和 `.input-row` 类。
- Produces: 统一的象牙纸聊天界面，不改变任何消息或积分脚本。

- [ ] **Step 1: 写入失败的真实聊天选择器契约**

新增：
```js
test('light page theme overrides the real Zhishi chat surfaces', () => {
  const css = read('css/theme-light-pages.css');
  for (const page of ['ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html']) {
    const html = read(page);
    assert.match(html, /class="msg ai"/);
    assert.match(html, /css\/theme-light-pages\.css\?v=2/);
  }
  assert.match(css, /\.page\s*\{[^}]*background:\s*#f0e6d1\s*!important/s);
  assert.match(css, /\.msg\.ai\s+\.bubble\s*\{[^}]*color:\s*#2d261f\s*!important;[^}]*background:\s*#fbf6eb\s*!important/s);
  assert.match(css, /\.msg\.user\s+\.bubble\s*\{[^}]*background:\s*#f3e5dd\s*!important/s);
  assert.match(css, /\.topbar,[\s\S]*?\.bottombar\s*\{[^}]*background:\s*rgba\(251,246,235,\.98\)\s*!important/s);
  assert.match(css, /\.redeem-row\s+input,[\s\S]*?\.input-row\s+textarea\s*\{[^}]*background:\s*#fffaf0\s*!important/s);
});
```

- [ ] **Step 2: 运行测试并确认黑灰内联规则未被覆盖**

Run: `node --test tests/light-theme-contract.test.js`
Expected: FAIL，错误应指出缺少 `.msg.ai .bubble` 或聊天页面仍加载 `theme-light-pages.css?v=1`。

- [ ] **Step 3: 添加页面级精准覆盖并更新缓存版本**

在 `theme-light-pages.css` 追加：
```css
.page { background: #f0e6d1 !important; }
.topbar,
.bottombar { background: rgba(251,246,235,.98) !important; border-color: var(--bd) !important; }
.msg.ai .bubble { color: #2d261f !important; background: #fbf6eb !important; border-color: rgba(72,52,31,.16) !important; }
.msg.user .bubble { color: #2d261f !important; background: #f3e5dd !important; }
.msg.ai .bubble strong { color: #84362f !important; }
.redeem-row input,
.input-row textarea { color: #2d261f !important; background: #fffaf0 !important; border-color: rgba(72,52,31,.16) !important; }
```

三个聊天页只把 `css/theme-light-pages.css?v=1` 更新为 `?v=2`。

- [ ] **Step 4: 运行聊天与 AI 流程契约**

Run: `node --test tests/light-theme-contract.test.js tests/ai-flow-contract.test.js`
Expected: PASS；AI 路由、后续提问目的页和输入框结构保持不变。

- [ ] **Step 5: 提交聊天页修复**

```powershell
git add css/theme-light-pages.css ai-chat.html lr-ai-chat.html zw-ai-chat.html tests/light-theme-contract.test.js
git commit -m "fix: make Zhishi chat surfaces readable"
```

### Task 3: 完整回归与交付检查

**Files:**
- Verify: all `tests/*.test.js`
- Verify: `index.html`, `ai-chat.html`, `lr-ai-chat.html`, `zw-ai-chat.html`

**Interfaces:**
- Consumes: Task 1 和 Task 2 的最终 CSS。
- Produces: 可复核的测试、资源与差异证据。

- [ ] **Step 1: 运行完整测试**

Run: `node --test tests/*.test.js`
Expected: 全部 PASS，0 FAIL。

- [ ] **Step 2: 检查页面与样式响应**

Run:
```powershell
Invoke-WebRequest http://127.0.0.1:3107/ -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:3107/ai-chat.html -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:3107/css/theme-light-pages.css?v=2 -UseBasicParsing | Select-Object StatusCode,Headers
```
Expected: 三项均为 200，CSS Content-Type 为 `text/css`。

- [ ] **Step 3: 检查差异范围**

Run: `git status --short; git diff --check; git diff --stat fac9fe0..HEAD`
Expected: 无空白错误；仅出现约定的主题、三页缓存引用、测试和提交记录。

- [ ] **Step 4: 复核不可变项**

确认首页 `1800`、三个聊天页 `2500`、`/api/ai-chat`、兑换码、分享和模式切换脚本仍在；不接受任何 HTML 结构或 JavaScript 逻辑变化。
