const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_NATIVE_VISION_URL,
  DEFAULT_OPENAI_VISION_URL,
  DEFAULT_VISION_MODEL,
  normalizeVisionApiUrl,
  normalizeVisionModel,
  isOpenAICompatibleUrl,
  getOpenAICompatibleEndpoint,
  toDashScopeContent
} = require('../lib/vision-api.js');

test('legacy DashScope multimodal URL is repaired before use', () => {
  assert.equal(
    normalizeVisionApiUrl('https://dashscope.aliyuncs.com/api/v1/aigc/multimodal-generation/generation/'),
    DEFAULT_OPENAI_VISION_URL
  );
});

test('vision defaults and the legacy low model migrate to qwen3.7-plus', () => {
  assert.equal(normalizeVisionApiUrl(''), DEFAULT_OPENAI_VISION_URL);
  assert.equal(normalizeVisionModel(''), DEFAULT_VISION_MODEL);
  assert.equal(normalizeVisionModel('qwen-vl-max'), 'qwen3.7-plus');
  assert.equal(normalizeVisionModel('qwen3.8-max'), 'qwen3.8-max');
});

test('OpenAI-compatible endpoint is appended exactly once', () => {
  const base = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const full = base + '/chat/completions';
  assert.equal(isOpenAICompatibleUrl(base), true);
  assert.equal(getOpenAICompatibleEndpoint(base), full);
  assert.equal(getOpenAICompatibleEndpoint(full), full);
});

test('multimodal content converts to DashScope native image and text items', () => {
  assert.deepEqual(toDashScopeContent([
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } },
    { type: 'text', text: '户型图' }
  ]), [
    { image: 'data:image/jpeg;base64,abc' },
    { text: '户型图' }
  ]);
});

test('fengshui images follow the configured endpoint format instead of forcing OpenAI mode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'fengshui-reading.js'), 'utf8');
  assert.doesNotMatch(source, /USE_OPENAI_FORMAT\s*\|\|\s*images\.length/);
  assert.match(source, /callAIWithFallback\(FENGSHUI_SYSTEM, userContent\)/);
  assert.doesNotMatch(source, /FALLBACK_MODEL\s*=\s*['"]qwen-vl-max/);
});
