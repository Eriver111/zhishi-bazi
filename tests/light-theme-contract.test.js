const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const activeMarkup = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
const attributeValue = (tag, name) => {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>]+))", 'i'));
  return match && (match[1] ?? match[2] ?? match[3]);
};
const stylesheetLinks = (html) => [...activeMarkup(html).matchAll(/<link\b[^>]*>/gi)]
  .filter(({ 0: tag }) => attributeValue(tag, 'rel')?.split(/\s+/).includes('stylesheet'));
const textContent = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(nbsp|#160|#x0*a0);/gi, ' ')
  .replace(/\s+/g, '');
const publicPages = [
  'index.html', 'paipan.html', 'result.html', 'ziwei.html', 'liuren.html',
  'hepan.html', 'hepan-result.html', 'liuyao.html', 'meihua.html',
  'face.html', 'palm.html', 'fengshui.html', 'fortune.html', 'pricing.html',
  'profile.html', 'ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html',
];

test('every public page loads the light theme after existing styles', () => {
  for (const page of publicPages) {
    const html = activeMarkup(read(page));
    const themeLink = stylesheetLinks(html).find(({ 0: tag }) => {
      const href = attributeValue(tag, 'href');
      return /^(?:\.\/)?css\/theme-light\.css(?:[?#].*)?$/i.test(href || '');
    });
    assert.ok(themeLink, `${page} is missing a stylesheet link to css/theme-light.css`);
    assert.ok(themeLink.index > html.lastIndexOf('</style>'), `${page} loads theme before inline styles`);
  }
});

test('light theme defines the approved palette and light color scheme', () => {
  const themePath = path.join(root, 'css', 'theme-light.css');
  assert.ok(fs.existsSync(themePath), 'css/theme-light.css is missing');
  const css = fs.readFileSync(themePath, 'utf8');
  for (const token of ['#f0e6d1', '#eadfc9', '#2d261f', '#796d61', '#84362f', '#365d50', '#a47b42']) {
    assert.match(css.toLowerCase(), new RegExp(token.replace('#', '#')));
  }
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css.toLowerCase(), /--zh-paper:\s*#f0e6d1/);
  assert.match(css, /--card:\s*rgba\(255,\s*252,\s*245,\s*\.94\)/);
  assert.match(css, /\.card,[\s\S]*?\.chat-panel[\s\S]*?background:\s*rgba\(255,252,245,\.94\)/);
  assert.match(css, /\.bg-overlay\s*\{[^}]*rgba\(240,230,209,\.0[0-6]\)/s);
  assert.doesNotMatch(css, /\.bg-overlay\s*\{[^}]*rgba\(246,239,223,\.72\)[^}]*rgba\(238,227,205,\.9\)/s);
});

test('shared light theme suppresses dynamic background canvas while the homepage restores its restrained canvas', () => {
  const css = read('css/theme-light.css');
  assert.match(css, /body\s+#bgCanvas\s*\{[^}]*opacity:\s*0\s*!important/s);
  assert.match(activeMarkup(read('paipan.html')), /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bbg-layer\b[^"']*\1[^>]*>\s*<canvas\b[^>]*\bid\s*=\s*(["'])bgCanvas\2/i);
  assert.match(read('paipan.html'), /#bgCanvas\s*\{[^}]*opacity:\s*\.6/, 'paipan must retain its nested canvas styling beneath the shared suppression');
  for (const page of publicPages) {
    const hrefs = stylesheetLinks(activeMarkup(read(page))).map(({ 0: tag }) => attributeValue(tag, 'href'));
    assert.ok(hrefs.includes('css/theme-light.css?v=2'), `${page} must load the cache-busted shared light theme`);
  }
  const homeLinks = stylesheetLinks(activeMarkup(read('index.html'))).map(({ 0: tag }) => attributeValue(tag, 'href'));
  assert.ok(homeLinks.indexOf('css/theme-light-home.css?v=2') > homeLinks.indexOf('css/theme-light.css?v=2'));
  assert.match(read('css/theme-light-home.css'), /\.ink-wash-scene\s*~\s*#bgCanvas\s*\{[^}]*opacity:\s*0\s*!important/s);
});

test('light theme covers the real chat composer controls and states', () => {
  const css = read('css/theme-light.css');
  for (const page of ['ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html']) {
    assert.match(read(page), /class="input-row"[\s\S]*?<textarea\b/, `${page} must retain its textarea composer`);
  }
  assert.match(css, /\.input-row\s+textarea(?:\s*,|\s*\{)/);
  assert.match(css, /\.input-row\s+textarea::placeholder\s*\{[^}]*color:\s*var\(--tx3\)[^}]*opacity:\s*1\s*;/s);
  assert.match(css, /\.input-row\s+textarea:focus(?:\s*,|\s*\{)/);
  assert.match(css, /\.input-row\s+\.send(?:\s*,|\s*\{)/);
  assert.match(css, /\.input-row\s+\.send:disabled\s*\{[^}]*cursor:\s*not-allowed/s);
});

test('light page theme overrides the real Zhishi chat surfaces', () => {
  const css = read('css/theme-light-pages.css');
  for (const page of ['ai-chat.html', 'lr-ai-chat.html', 'zw-ai-chat.html']) {
    const html = read(page);
    assert.match(html, /className\s*=\s*['"]msg ai['"]/, `${page} must retain the runtime AI message class`);
    assert.match(html, /css\/theme-light-pages\.css\?v=2/);
  }
  assert.match(css, /\.page\s*\{[^}]*background:\s*#f0e6d1\s*!important/s);
  assert.match(css, /\.msg\.ai\s+\.bubble\s*\{[^}]*color:\s*#2d261f\s*!important;[^}]*background:\s*#fbf6eb\s*!important/s);
  assert.match(css, /\.msg\.user\s+\.bubble\s*\{[^}]*background:\s*#f3e5dd\s*!important/s);
  assert.match(css, /\.topbar,[\s\S]*?\.bottombar\s*\{[^}]*background:\s*rgba\(251,246,235,\.98\)\s*!important/s);
  assert.match(css, /\.redeem-row\s+input,[\s\S]*?\.input-row\s+textarea\s*\{[^}]*background:\s*#fffaf0\s*!important/s);
});

test('inline legacy navigations expose a light-theme hook and light dropdown', () => {
  for (const page of ['result.html', 'ziwei.html', 'fortune.html']) {
    assert.match(
      activeMarkup(read(page)),
      /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\btop-nav\b[^"']*\1[^>]*>/i,
      `${page} navigation is missing the top-nav theme hook`,
    );
  }
  const css = read('css/theme-light.css');
  assert.match(css, /\.top-nav\s*\{[^}]*background:\s*rgba\(249,244,233,\.9\)\s*!important;[^}]*border-color:\s*var\(--bd\)\s*!important/s);
  assert.match(css, /\.top-nav\s+\.dd-menu\s*\{[^}]*background:\s*rgba\(249,244,233,\.98\)\s*!important/s);
  assert.match(css, /\.top-nav\s+a(?:\s*,|\s*\{)[\s\S]*?color:\s*var\(--tx2\)\s*!important/);
});

test('homepage exposes the approved ten uniform tools and no standalone AI consultation CTA', () => {
  const html = read('index.html');
  const featureSection = activeMarkup(html).match(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\bfeatures\b[^"']*\1[^>]*>([\s\S]*?)<\/section\s*>/i);
  assert.ok(featureSection, 'homepage is missing the feature grid');
  const featureLinks = [...featureSection[2].matchAll(/<a\b[^>]*\bclass\s*=\s*(["'])[^"']*\bfeat-card\b[^"']*\1[^>]*>[\s\S]*?<\/a\s*>/gi)];
  assert.equal(featureLinks.length, 10);
  const expectedTools = [
    ['/paipan', '八字排盘'],
    ['/ziwei', '紫微斗数'],
    ['/liuren', '大六壬'],
    ['/liuyao', '六爻占卜'],
    ['/meihua', '梅花易数'],
    ['/hepan', '合盘缘分'],
    ['/fengshui', '八宅风水'],
    ['/face', 'AI观面'],
    ['/palm', 'AI观手'],
    ['/fortune', '今日运势'],
  ];
  assert.deepEqual(featureLinks.map((match) => [
    attributeValue(match[0], 'href'),
    textContent(match[0].match(/<h3\b[^>]*>([\s\S]*?)<\/h3\s*>/i)?.[1] || ''),
  ]), expectedTools);
  for (const { 0: card } of featureLinks) {
    assert.match(card, /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bfeat-icon\b[^"']*\1[^>]*>/i);
    assert.match(card, /<p\b[^>]*>[\s\S]*?<\/p\s*>/i);
    assert.doesNotMatch(card, /\bstyle\s*=\s*(["'])[^"']*(?:^|;)\s*(?:color|background)\s*:/i, 'feature cards must not carry per-card colors');
  }
  const tagline = activeMarkup(html).match(/<[^>]*\bclass\s*=\s*(["'])[^"']*\bhero-tagline\b[^"']*\1[^>]*>([\s\S]*?)<\/[^>]+>/i);
  assert.ok(tagline, 'homepage is missing the hero tagline');
  assert.equal(textContent(tagline[2]), '知天时，见自己');

  const standaloneAiEntries = [...activeMarkup(html).matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
    .filter((match) => /AI\s*(?:命理\s*咨询|问答)/iu.test(
      `${attributeValue(match[0], 'aria-label') || ''}${textContent(match[2])}`,
    ));
  assert.equal(standaloneAiEntries.length, 0, 'homepage must not expose a standalone AI consultation or AI Q&A entry');
});

test('homepage navigation uses five practical categories and retains every tool route', () => {
  const html = activeMarkup(read('index.html'));
  const nav = html.match(/<div\b[^>]*\bid\s*=\s*(["'])zhishi-nav\1[^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*\bid\s*=\s*(["'])eyeOverlay\3/i);
  assert.ok(nav, 'homepage is missing #zhishi-nav');
  const links = [...nav[2].matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)];
  const categoryLinks = links
    .filter(({ 0: tag }) => /\bclass\s*=\s*(["'])[^"']*\bnav-(?:primary|secondary)\b[^"']*\1/i.test(tag))
    .map(({ 0: tag }) => [attributeValue(tag, 'href'), textContent(tag)]);
  assert.deepEqual(categoryLinks, [
    ['/paipan', '命理'],
    ['/liuren', '卜筮'],
    ['/face', '观相'],
    ['/fengshui', '堪舆'],
    ['/fortune', '运势'],
  ]);
  for (const route of ['/paipan', '/ziwei', '/liuren', '/liuyao', '/meihua', '/hepan', '/fengshui', '/fortune', '/face', '/palm', '/pricing', '/profile']) {
    assert.ok(links.some(({ 0: tag }) => attributeValue(tag, 'href') === route), `homepage navigation is missing ${route}`);
  }
  assert.match(nav[2], /\bid\s*=\s*(["'])nav-user-area\1/i);
  assert.doesNotMatch(textContent(nav[2]), /书院|藏阁/);
});

test('homepage more menu uses a semantic button with an explicit ARIA relationship', () => {
  const html = activeMarkup(read('index.html'));
  const button = html.match(/<button\b[^>]*\bid\s*=\s*(["'])nav-more-toggle\1[^>]*>[\s\S]*?<\/button\s*>/i);
  assert.ok(button, 'homepage more menu is missing its semantic button');
  assert.equal(attributeValue(button[0], 'type'), 'button');
  assert.equal(attributeValue(button[0], 'aria-haspopup'), 'true');
  assert.equal(attributeValue(button[0], 'aria-expanded'), 'false');
  assert.equal(attributeValue(button[0], 'aria-controls'), 'nav-more-menu');
  assert.doesNotMatch(button[0], /\bonclick\s*=/i);
  assert.match(html, /<div\b[^>]*\bid\s*=\s*(["'])nav-more-menu\1[^>]*\bclass\s*=\s*(["'])[^"']*\bdd-menu\b[^"']*\2/i);
  assert.doesNotMatch(html, /\bclass\s*=\s*(["'])[^"']*\bnav-more\b[^"']*\1[^>]*\bonmouse(?:enter|leave)\s*=/i);
});

test('homepage more menu script supports keyboard, outside click, focus, mouse and touch-safe click hooks', () => {
  const html = read('index.html');
  assert.match(html, /getElementById\(['"]nav-more-toggle['"]\)/);
  assert.match(html, /getElementById\(['"]nav-more-menu['"]\)/);
  assert.match(html, /toggle\.addEventListener\(['"]click['"]/);
  assert.match(html, /toggle\.addEventListener\(['"]keydown['"][\s\S]*?['"]Enter['"][\s\S]*?['"] ['"]/);
  assert.match(html, /document\.addEventListener\(['"]keydown['"][\s\S]*?['"]Escape['"]/);
  assert.match(html, /document\.addEventListener\(['"]pointerdown['"]/);
  assert.match(html, /wrap\.addEventListener\(['"]mouseenter['"]/);
  assert.match(html, /wrap\.addEventListener\(['"]mouseleave['"]/);
  assert.match(html, /var openedByHover=false/);
  assert.match(html, /if\(openedByHover\)\{openedByHover=false;return\}/);
  assert.match(html, /firstItem\.focus\(\)/);
  assert.match(html, /toggle\.focus\(\)/);
  assert.match(html, /setAttribute\(['"]aria-expanded['"],\s*['"](?:true|false)['"]\)/);
});

test('homepage adds three usage steps before the four trust cards and keeps two direct bottom CTAs', () => {
  const html = activeMarkup(read('index.html'));
  const usageStart = html.search(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\busage-section\b[^"']*\1/i);
  const trustStart = html.search(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\btrust-section\b[^"']*\1/i);
  assert.ok(usageStart >= 0 && usageStart < trustStart, 'usage section must appear before the trust section');
  const usage = html.match(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\busage-section\b[^"']*\1[^>]*>([\s\S]*?)<\/section\s*>/i);
  assert.equal((usage?.[2].match(/<article\b/g) || []).length, 3);
  for (const heading of ['选择功能', '提交信息', '查看结果']) assert.match(textContent(usage?.[2] || ''), new RegExp(heading));
  const trust = html.match(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\btrust-section\b[^"']*\1[^>]*>([\s\S]*?)<\/section\s*>/i);
  assert.equal((trust?.[2].match(/class="trust-item"/g) || []).length, 4);
  const trustText = textContent(trust?.[2] || '');
  assert.match(trustText, /基础排盘由本地规则计算，AI解读仅供传统文化参考/);
  assert.doesNotMatch(trustText, /1900[-–—]2100|严格往返验证|全范围准确/);
  const cta = html.match(/<section\b[^>]*\bclass\s*=\s*(["'])[^"']*\bcta-bottom\b[^"']*\1[^>]*>([\s\S]*?)<\/section\s*>/i);
  const ctaLinks = [...(cta?.[2] || '').matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)];
  assert.deepEqual(ctaLinks.map(({ 0: tag }) => attributeValue(tag, 'href')), ['paipan', 'hepan']);
});

test('homepage loads a dedicated responsive light stylesheet after the shared theme', () => {
  const html = activeMarkup(read('index.html'));
  const links = stylesheetLinks(html).map(({ 0: tag }) => attributeValue(tag, 'href'));
  assert.ok(links.indexOf('css/theme-light-home.css?v=2') > links.indexOf('css/theme-light.css?v=2'));
  const themePath = path.join(root, 'css', 'theme-light-home.css');
  assert.ok(fs.existsSync(themePath), 'css/theme-light-home.css is missing');
  const css = fs.readFileSync(themePath, 'utf8');
  assert.match(css, /\.features\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.usage-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/s);
  assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.features\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.usage-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.feat-card p\s*\{[^}]*color:\s*var\(--tx2\)\s*!important/s);
  assert.match(css, /\.trust-item\s*\{[^}]*background:\s*rgba\(255,252,245,\.5\)\s*!important/s);
  assert.match(css, /\.trust-body h4\s*\{[^}]*color:\s*var\(--zh-ink\)\s*!important/s);
  assert.match(css, /\.trust-body p\s*\{[^}]*color:\s*var\(--tx2\)\s*!important/s);
  assert.doesNotMatch(css, /\.feat-card:nth-child\((?!n\))/i, 'homepage theme must not special-case individual cards');
});
