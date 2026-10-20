(function (root) {
  'use strict';
  // Operational notices never enter the assistant's conversation history.
  function show(options) {
    var confirmedFailure = options.data && options.data.charged === false;
    var canRetry = confirmedFailure && options.data.retryable === true;
    if (confirmedFailure && options.removeFailedQuestion) options.removeFailedQuestion();
    var node = document.createElement('div');
    node.className = 'ai-request-notice';
    node.setAttribute('role', 'status');
    node.style.cssText = 'margin:12px 0;padding:14px 16px;border:1px solid #d9cdb9;border-radius:14px;background:#fcf8ef;color:#65584c;font-size:14px;line-height:1.7;overflow-wrap:anywhere';
    var text = document.createElement('div');
    text.textContent = canRetry
      ? '这次回答没有通过核对，未扣提问次数。可以重新发送刚才的问题。'
      : options.message || '连接中断，回答可能仍在生成。请先查看聊天记录，再决定是否重试。';
    node.appendChild(text);
    if (canRetry) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = '重新发送';
      button.style.cssText = 'margin-top:10px;min-height:44px;padding:8px 16px;border:1px solid #b98873;border-radius:10px;background:#fffaf2;color:#8c3e35;font:inherit;cursor:pointer';
      button.addEventListener('click', function () {
        if (!options.isCurrent() || button.disabled) {
          text.textContent = '当前账号或对话已变化，请在当前对话中重新输入问题。';
          button.disabled = true;
          return;
        }
        var draft = options.input.value.trim();
        if (draft && draft !== options.question) {
          text.textContent = '输入框中有新的问题，请先发送或清空，再重试上一问。';
          options.input.focus();
          return;
        }
        button.disabled = true;
        options.input.value = options.question;
        if (options.userNode && options.userNode.parentNode) options.userNode.remove();
        node.remove();
        options.onRetry();
      });
      node.appendChild(button);
    }
    options.container.appendChild(node);
    options.container.scrollTop = options.container.scrollHeight;
    return node;
  }
  root.AiRequestRecovery = { show: show };
}(window));
