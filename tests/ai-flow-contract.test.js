const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const attributeValue = (tag, name) => {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>]+))", 'i'));
  return match && (match[1] ?? match[2] ?? match[3]);
};
const externalScriptSources = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*>/gi)]
  .map(({ 0: tag }) => attributeValue(tag, 'src'))
  .filter(Boolean);
const loadsAiIntegration = (html) => externalScriptSources(html)
  .some((src) => /^(?:\.\/)?js\/ai-chat-integration\.js(?:[?#].*)?$/i.test(src));
const assertBaziAiRoute = (source) => {
  const target = source.match(/\b([A-Za-z_$][\w$]*)\s*=\s*['"]ai-chat\.html['"]/);
  assert.ok(target, 'AI integration must assign ai-chat.html as its default target');
  assert.match(
    source,
    new RegExp(`(?:window\\.)?location\\.href\\s*=\\s*${target[1]}\\b`),
    'AI integration must navigate to its ai-chat.html target',
  );
};

test('follow-up pages retain their contextual AI destinations', () => {
  const aiIntegration = read('js/ai-chat-integration.js');
  for (const page of ['result.html', 'hepan-result.html']) {
    assert.ok(loadsAiIntegration(read(page)), `${page} must load ai-chat-integration.js with an executable script src`);
  }
  assertBaziAiRoute(aiIntegration);
  assert.match(read('ziwei.html'), /js\/ziwei-analysis\.js/);
  assert.match(read('js/ziwei-analysis.js'), /zw-ai-chat\.html/);
  assert.match(read('liuren.html'), /lr-ai-chat\.html/);
});

test('Ziwei follow-up carries explicit context and cache-busts repaired bundles', () => {
  const ziweiPage = read('ziwei.html');
  const ziweiAnalysis = read('js/ziwei-analysis.js');
  assert.match(ziweiPage, /js\/ziwei-professional\.js\?v=6/);
  assert.match(ziweiPage, /js\/ziwei-render\.js\?v=12/);
  assert.match(ziweiPage, /js\/ziwei-analysis\.js\?v=2/);
  assert.match(ziweiAnalysis, /zw-ai-chat\.html\?t=zw&v=2/);
});

test('Ziwei chat always submits Ziwei mode and unlocks after missing chart data', () => {
  const chat = read('zw-ai-chat.html');
  assert.match(chat, /js\/ziwei-chat\.js\?v=1/);
  assert.match(chat, /ZiweiChat\.buildRequest\s*\(/);
  assert.doesNotMatch(chat, /五行图分析中|盲派算法分析中|子平派分析中/);
  assert.doesNotMatch(chat, /sp2\.get\(['"]t['"]\)\s*===\s*['"]zw['"]/);
  const missingChart = chat.match(/if\s*\(!chartData\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(missingChart, 'missing-chart branch must exist');
  assert.match(missingChart[1], /hideThinking\(\)/);
  assert.match(missingChart[1], /AI\.isWaiting\s*=\s*false/);
  assert.match(missingChart[1], /sendBtn['"]\)\.disabled\s*=\s*false/);
});

test('Ziwei chat synchronizes account entitlement and authenticates AI requests', () => {
  const chat = read('zw-ai-chat.html');
  assert.match(chat, /syncUserCredits\(\)/);
  assert.match(chat, /\/api\/auth\/profile/);
  assert.match(chat, /Auth\.ready\s*\(/);
  assert.match(chat, /AI\.isMonthly\s*=\s*true/);
  assert.match(chat, /AI\.credits\s*=\s*d\.credits/);
  assert.match(chat, /headers\[['"]Authorization['"]\]\s*=\s*['"]Bearer ['"]\s*\+\s*Auth\.getToken\(\)/);
  assert.match(chat, /fetch\(['"]\/api\/ai-chat['"],\{method:['"]POST['"],headers:headers/);
});

test('one-shot tools do not gain follow-up chat routes', () => {
  for (const page of ['liuyao.html', 'meihua.html', 'face.html', 'palm.html', 'fengshui.html', 'fortune.html']) {
    assert.doesNotMatch(read(page), /(?:ai-chat|zw-ai-chat|lr-ai-chat)\.html/, `${page} gained a follow-up route`);
  }
});

test('result skin preserves the floating AI entry as a visible interactive control', () => {
  const css = read('css/theme-light-results.css');
  assert.match(css, /\.ai-float-btn\s*,\s*#aiFloatBtn\s*\{[^}]*background\s*:/s);
  assert.doesNotMatch(css, /(?:\.ai-float-btn|#aiFloatBtn)[^{]*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|pointer-events\s*:\s*none)/is);
});
