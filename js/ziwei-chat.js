(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZiweiChat = api;
})(typeof window !== 'undefined' ? window : this, function () {
  var THINK_STEPS = ['定位命身十二宫', '核对三方四正', '梳理四化运限'];

  function buildRequest(options) {
    options = options || {};
    var messages = (options.messages || []).slice();
    if (messages.length && messages[messages.length - 1].role === 'user'
      && messages[messages.length - 1].content === options.question) messages.pop();
    var body = {
      question: options.question,
      mode: 'ziwei',
      response_mode: options.responseMode === 'pro' ? 'pro' : 'simple',
      history: messages.slice(-6),
      chartData: options.chartData
    };
    if (!options.isMonthly && Number(options.freeRemaining) > 0) {
      body.free_mode = true;
      body.free_id = options.freeId;
    } else if (options.code) {
      body.code = options.code;
    }
    return body;
  }

  function buildPrelude(chartData) {
    if (!chartData) return '';
    var parts = [];
    if (chartData.mingGong) parts.push('命宫：' + chartData.mingGong + '宫');
    if (chartData.bodyPalaceZhi) parts.push('身宫：' + chartData.bodyPalaceZhi + '宫'
      + (chartData.bodyPalace ? '（落' + chartData.bodyPalace + '宫）' : ''));
    if (chartData.wuxingJu) parts.push('五行局：' + chartData.wuxingJu);
    return parts.length ? '【系统排盘】' + parts.join('；') + '。以下为AI详细解读：\n\n---\n\n' : '';
  }

  return { THINK_STEPS: THINK_STEPS, buildRequest: buildRequest, buildPrelude: buildPrelude };
});
