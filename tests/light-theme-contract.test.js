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
  for (const token of ['#f6efdf', '#eee3cd', '#2d261f', '#796d61', '#84362f', '#365d50', '#a47b42']) {
    assert.match(css.toLowerCase(), new RegExp(token.replace('#', '#')));
  }
  assert.match(css, /color-scheme:\s*light/);
});

test('homepage exposes ten uniform tools and no standalone AI consultation CTA', () => {
  const html = read('index.html');
  const featureLinks = [...html.matchAll(/<a[^>]+class="feat-card"/g)];
  assert.equal(featureLinks.length, 10);
  const tagline = activeMarkup(html).match(/<[^>]*\bclass\s*=\s*(["'])[^"']*\bhero-tagline\b[^"']*\1[^>]*>([\s\S]*?)<\/[^>]+>/i);
  assert.ok(tagline, 'homepage is missing the hero tagline');
  assert.match(textContent(tagline[2]), /知天时[，,、·•]?见自己/);

  const standaloneAiEntries = [...activeMarkup(html).matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
    .filter((match) => /AI\s*(?:命理\s*咨询|问答)/iu.test(
      `${attributeValue(match[0], 'aria-label') || ''}${textContent(match[2])}`,
    ));
  assert.equal(standaloneAiEntries.length, 0, 'homepage must not expose a standalone AI consultation or AI Q&A entry');
});
