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
  const target = source.match(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]ai-chat\.html['"]/);
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

test('one-shot tools do not gain follow-up chat routes', () => {
  for (const page of ['liuyao.html', 'meihua.html', 'face.html', 'palm.html', 'fengshui.html', 'fortune.html']) {
    assert.doesNotMatch(read(page), /(?:ai-chat|zw-ai-chat|lr-ai-chat)\.html/, `${page} gained a follow-up route`);
  }
});
