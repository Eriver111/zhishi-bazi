const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stylesheetHrefs = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)]
  .map(({ 0: tag }) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
  .filter(Boolean);

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
  assert.match(html, /class="pp-row pp-shensha-row"/);
  assert.match(html, /class="pp-col pp-dayun-col"/);
  assert.match(html, /js\/ai-chat-integration\.js/);
});

test('mobile timing strips show both stem and branch-main ten gods with unambiguous short names', () => {
  const source = read('js/result.js');
  assert.match(source, /'偏财':'才'/);
  assert.match(source, /'正财':'财'/);
  assert.match(source, /'偏印':'枭'/);
  assert.match(source, /'正印':'印'/);
  assert.match(source, /function getBranchMainShiShen\(dayGan, zhi\)/);
  assert.match(source, /renderTimingGanZhi\('dayun', dayGan, dy\.gan, dy\.zhi\)/);
  assert.match(source, /renderTimingGanZhi\('liunian', dayGan, ln\.gan, ln\.zhi\)/);
  assert.equal((source.match(/\$\{gan\}\$\{wx\}<\/span>/g) || []).length, 3);
});

test('bazi result loads direct-pillar parsing before result initialization', () => {
  const html = read('result.html');
  const pillarInput = html.indexOf('js/pillar-input.js');
  const result = html.indexOf('js/result.js');

  assert.ok(pillarInput >= 0, 'result page must load the shared pillar parser');
  assert.ok(pillarInput < result, 'pillar parser must load before result initialization');
  assert.match(
    html,
    /未在近200年内定位出生时间，以下仅展示基础命盘，大运与流年暂不计算/,
  );
});

test('hepan result keeps its existing result and AI integration hooks', () => {
  const html = read('hepan-result.html');
  for (const marker of ['section-dayun', 'section-liunian', 'section-sizhu', 'js/hepan-result.js', 'js/ai-chat-integration.js']) {
    assert.ok(html.includes(marker), `hepan-result.html lost ${marker}`);
  }
});

test('result-capable pages load the result skin after every existing stylesheet', () => {
  for (const page of ['result.html', 'hepan-result.html', 'ziwei.html', 'liuren.html']) {
    const hrefs = stylesheetHrefs(read(page));
    assert.match(hrefs.at(-1), /^css\/theme-light-results\.css\?v=\d+$/, `${page} must load the result skin last`);
  }

  for (const page of ['ziwei.html', 'liuren.html']) {
    const hrefs = stylesheetHrefs(read(page));
    assert.ok(
      hrefs.findIndex((href) => /^css\/theme-light-forms\.css\?v=\d+$/.test(href)) <
        hrefs.findIndex((href) => /^css\/theme-light-results\.css\?v=\d+$/.test(href)),
      `${page} must keep the form skin before the result skin`,
    );
  }
});

test('result skin is additive and cannot convert or hide the existing layout', () => {
  const stylesheet = path.join(root, 'css', 'theme-light-results.css');
  assert.ok(fs.existsSync(stylesheet), 'missing result-only light theme');
  const css = read('css/theme-light-results.css');

  for (const selector of [
    '.result-container', '.result-header', '.section-dayun', '.section-liunian',
    '.section-sizhu', '.result-section', '.analysis-section', '.pro-section',
    '.dayun-col', '.liunian-col', '.pp-col', '.dayun-col.current',
    '.dayun-col.active', '.liunian-col.current-year', '.liunian-col.active-ln',
    '.pp-dayun-col.active-dayun', '.pp-liunian-col.active-liunian',
    '.dayun-scroll-wrapper', '.liunian-scroll-wrapper', '.dayun-scroll',
    '.liunian-scroll', '.ai-float-btn', '#aiFloatBtn',
  ]) {
    assert.ok(css.includes(selector), `result skin lost ${selector}`);
  }

  assert.match(css, /overflow-x\s*:\s*auto/);
  assert.match(css, /-webkit-overflow-scrolling\s*:\s*touch/);
  assert.doesNotMatch(css, /\bdisplay\s*:/i, 'result skin must not replace the existing display model');
  assert.doesNotMatch(css, /\b(?:grid-template|grid-area|order)\s*:/i, 'result skin must not reorder result modules');
  assert.doesNotMatch(css, /\b(?:visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)/i, 'result skin must not hide result modules');
});

test('result skin uses opaque paper cells and readable ink text', () => {
  const css = read('css/theme-light-results.css');
  assert.match(css, /body[^}]*background:\s*#f4eddf\s*!important/);
  assert.match(css, /\.dayun-col,[\s\S]*?\.liunian-col,[\s\S]*?\.pp-col\s*\{[^}]*background:\s*#fbf6eb\s*!important/);
  assert.match(css, /color:\s*#2d261f\s*!important/);
  assert.match(css, /(?:\.dayun-age|\.dayun-year|\.liunian-year|\.qiyun-info)[\s\S]*?color:\s*#655b51\s*!important/);
  assert.match(css, /background:\s*#efe0d6\s*!important/);
  assert.match(css, /\.liunian-col\.active-ln\s+\.liunian-gz\s*\{[^}]*color:\s*#84362f\s*!important/);
});

test('result skin overrides legacy child ink and scopes opaque chart surfaces', () => {
  const css = read('css/theme-light-results.css');
  assert.match(css, /\.dayun-col\s+\.dayun-gz,[\s\S]*?\.liunian-col\s+\.liunian-gz,[\s\S]*?\.pp-col\s+\.tian-gan,[\s\S]*?\.pp-col\s+\.di-zhi\s*\{[^}]*color:\s*#2d261f\s*!important/);
  assert.match(css, /\.liunian-year-label,[\s\S]*?\.dayun-ss,[\s\S]*?\.liunian-ss[\s\S]*?color:\s*#655b51\s*!important/);
  assert.match(css, /\.dayun-col\.current\s+\.dayun-gz,[\s\S]*?\.dayun-col\.active\s+\.dayun-gz,[\s\S]*?\.liunian-col\.current-year\s+\.liunian-gz,[\s\S]*?\.liunian-col\.active-ln\s+\.liunian-gz\s*\{[^}]*color:\s*#84362f\s*!important/);
  assert.match(css, /\.dayun-col\.current\s+\.dayun-ss,[\s\S]*?\.liunian-col\.active-ln\s+\.liunian-ss,[\s\S]*?\{[^}]*color:\s*#84362f\s*!important/);
  assert.match(css, /\.pp-dayun-col\.active-dayun\s+\.tian-gan,[\s\S]*?\.pp-liunian-col\.active-liunian\s+\.di-zhi\s*\{[^}]*color:\s*#84362f\s*!important/);
  assert.match(css, /body:has\(#zwGrid\)\s+\.card,[\s\S]*?body:has\(#zwGrid\)\s+\.palace,[\s\S]*?body:has\(#lrOutput\)\s+\.card[\s\S]*?background:\s*rgba\(251,246,235,\.94\)\s*!important/);
});

test('result skin repairs actual drawer surfaces, subdued text, and past-state legibility', () => {
  const css = read('css/theme-light-results.css');
  for (const selector of [
    '.section-drawer', '.section-drawer .drawer-body',
    '.hp-drawer', '.hp-drawer .hp-drawer-body', '.hp-drawer .drawer-body',
    '.section-drawer .drawer-body :is(p, li)',
    '.hp-drawer .drawer-body :is(p, li)',
    '.hp-bazi-card', '.hp-cross-item', '.hp-dgs-card', '.hp-do-item', '.hp-dont-item',
    '.hp-mode-card', '.hp-wuxing-card', '.hp-xiyong-card', '.hp-yearly-card',
    '.pp-ss-text', '.cang-ss-text', '.dayun-col.past', '.liunian-col.past-year',
  ]) {
    assert.ok(css.includes(selector), `missing repaired selector ${selector}`);
  }
  assert.match(css, /\.section-drawer,[\s\S]*?\.hp-drawer\s*\{[^}]*background:\s*rgba\(251,246,235,\.98\)\s*!important/);
  assert.match(css, /\.section-drawer\s+\.drawer-body,[\s\S]*?\.hp-drawer\s+\.hp-drawer-body,[\s\S]*?\.hp-drawer\s+\.drawer-body\s*\{[^}]*color:\s*#2d261f\s*!important/);
  assert.match(css, /\.cang-ss-text\s*\{[^}]*color:\s*#655b51\s*!important/);
  assert.match(css, /\.dayun-col\.past,[\s\S]*?\.liunian-col\.past-year\s*\{[^}]*opacity:\s*1\s*!important/);
  assert.match(css, /\.dayun-col\.past,[\s\S]*?\.liunian-col\.past-year\s*\{[^}]*background:\s*#f1eadf\s*!important/);
});

test('result skin gives Ziwei and Liuren emitted children semantic dark ink', () => {
  const css = read('css/theme-light-results.css');
  for (const selector of [
    'body:has(#zwGrid) #zwGrid .stars .s', 'body:has(#zwGrid) #zwGrid .mid',
    'body:has(#zwGrid) #zwGrid .bot-r .gz', 'body:has(#zwGrid) #zwGrid .pname',
    'body:has(#zwGrid) #zwGrid .center-cell .c-title', 'body:has(#zwGrid) #zwGrid .center-cell .c-info',
    'body:has(#zwGrid) #zwGrid .stars .s[style*="color:#e07050"]',
    'body:has(#zwGrid) #zwGrid .stars [style*="color:#4CAF50"]',
    'body:has(#zwGrid) #zwGrid .stars [style*="color:#F44336"]',
    'body:has(#lrOutput) #lrOutput .sp-cell .sp-zhi', 'body:has(#lrOutput) #lrOutput .sp-cell .sp-tian',
    'body:has(#lrOutput) #lrOutput .sp-cell .sp-god', 'body:has(#lrOutput) #lrOutput .sp-center-cell .cp-yj',
    'body:has(#lrOutput) #lrOutput [style*="color:var(--gold)"]',
    'body:has(#lrOutput) #lrOutput [style*="background:rgba(28,26,22"]',
  ]) {
    assert.ok(css.includes(selector), `missing readable emitted child selector ${selector}`);
  }
  assert.match(css, /body:has\(#zwGrid\)\s+#zwGrid\s+\.stars\s+\.s\s*\{[^}]*color:\s*#3d4d43\s*!important/);
  assert.match(css, /body:has\(#zwGrid\)\s+#zwGrid\s+\.stars\s+\.s\s*\.b,[\s\S]*?body:has\(#zwGrid\)\s+#zwGrid\s+\.center-cell\s+\[style\*="color:var\(--gold-l\)"\]\s*\{[^}]*!important/);
  assert.match(css, /body:has\(#lrOutput\)\s+#lrOutput\s+\.sp-cell\s+\.sp-zhi,[\s\S]*?body:has\(#lrOutput\)\s+#lrOutput\s+\.sp-center-cell\s+\.cp-yj\s*\{[^}]*color:\s*#84362f\s*!important/);
});

test('result skin directly repairs every remaining Hepan, Ziwei, and Liuren child cascade', () => {
  const css = read('css/theme-light-results.css');
  const primary = [
    '.hp-pillar-gan', '.hp-pillar-zhi', '.hp-xiyong-name', '.hp-wuxing-name',
    '.hp-dgs-name', '.hp-dgs-gan b', '.hp-dgs-strength', '.hp-cross-type',
    '.hp-cross-pillars', '.hp-mode-title', '.hp-yearly-label',
  ];
  const secondary = [
    '.hp-pillar-label', '.hp-xiyong-row', '.hp-xiyong-complement', '.hp-wx-count',
    '.hp-wuxing-desc', '.hp-wuxing-score', '.hp-dgs-gan', '.hp-dgs-wx',
    '.hp-dgs-detail', '.hp-cross-detail', '.hp-mode-detail', '.hp-yearly-advice',
  ];
  for (const selector of [...primary, ...secondary]) {
    assert.ok(css.includes(selector), `missing direct Hepan child selector ${selector}`);
  }
  for (const selector of [
    'body:has(#zwGrid) #zwGrid .mid .row1', 'body:has(#zwGrid) #zwGrid .mid .row2',
    'body:has(#zwGrid) #zwGrid .mid .ln-label', 'body:has(#zwGrid) #zwGrid .mid .xx-label',
    'body:has(#zwGrid) #zwGrid .mid .daxian',
    'body:has(#lrOutput) #lrOutput [style*="color:#d4b860"]',
  ]) {
    assert.ok(css.includes(selector), `missing direct rendered child selector ${selector}`);
  }
  assert.match(css, /\.hp-pillar-gan,[\s\S]*?\.hp-cross-pillars,[\s\S]*?\.hp-yearly-label\s*\{[^}]*color:\s*#2d261f\s*!important/);
  assert.match(css, /\.hp-pillar-label,[\s\S]*?\.hp-wuxing-desc,[\s\S]*?\.hp-yearly-advice\s*\{[^}]*color:\s*#655b51\s*!important/);
  assert.match(css, /body:has\(#zwGrid\)\s+#zwGrid\s+\.mid\s+\.row1,[\s\S]*?body:has\(#zwGrid\)\s+#zwGrid\s+\.mid\s+\.daxian\s*\{[^}]*color:\s*#655b51\s*!important/);
  assert.match(css, /body:has\(#lrOutput\)\s+#lrOutput\s+\[style\*="color:#d4b860"\]\s*\{[^}]*color:\s*#3d4d43\s*!important/);
});
