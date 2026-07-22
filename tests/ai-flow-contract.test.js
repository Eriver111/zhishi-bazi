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
