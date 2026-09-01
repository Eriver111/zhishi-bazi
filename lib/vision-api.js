const DEFAULT_NATIVE_VISION_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DEFAULT_OPENAI_VISION_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_VISION_MODEL = 'qwen3.7-plus';

function normalizeVisionApiUrl(value) {
  var raw = String(value || '').trim();
  if (!raw) return DEFAULT_OPENAI_VISION_URL;
  var url = raw.replace(/\/+$/, '');

  // 服务器上曾保存过缺少 /services/ 的无效旧路径；直接迁移到官方兼容接口。
  if (url.includes('/api/v1/aigc/multimodal-generation/generation')) {
    return DEFAULT_OPENAI_VISION_URL;
  }

  return url || DEFAULT_OPENAI_VISION_URL;
}

function normalizeVisionModel(value) {
  var model = String(value || '').trim();
  // 旧部署曾固定为 qwen-vl-max；统一迁移到当前指定的多模态模型。
  if (!model || model === 'qwen-vl-max' || model === 'qwen-vl-max-latest') {
    return DEFAULT_VISION_MODEL;
  }
  return model;
}

function isOpenAICompatibleUrl(value) {
  var url = normalizeVisionApiUrl(value);
  return url.includes('/compatible-mode/') || /\/chat\/completions(?:$|[?#])/.test(url);
}

function getOpenAICompatibleEndpoint(value) {
  var url = normalizeVisionApiUrl(value);
  if (/\/chat\/completions(?:$|[?#])/.test(url)) return url;
  return url + '/chat/completions';
}

function toDashScopeContent(content) {
  if (!Array.isArray(content)) return content;
  return content.map(function(item) {
    if (item && item.image_url && item.image_url.url) return { image: item.image_url.url };
    if (item && item.type === 'text' && item.text) return { text: item.text };
    return item;
  });
}

module.exports = {
  DEFAULT_NATIVE_VISION_URL,
  DEFAULT_OPENAI_VISION_URL,
  DEFAULT_VISION_MODEL,
  normalizeVisionApiUrl,
  normalizeVisionModel,
  isOpenAICompatibleUrl,
  getOpenAICompatibleEndpoint,
  toDashScopeContent
};
