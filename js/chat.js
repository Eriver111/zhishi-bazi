/**
 * AI 对话模块
 * 管理聊天界面、消息发送和接收
 */

let chatState = {
  credits: 0,
  code: '',
  messages: [],
  isWaiting: false,
  baziInfo: null
};

/**
 * 发送消息
 */
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();

  if (!text || chatState.isWaiting) return;
  if (chatState.credits <= 0) {
    showToast('次数不足，请先购买', 'error');
    showModal('modalBuy');
    return;
  }

  // 添加用户消息
  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  // 显示打字动画
  showTyping();
  chatState.isWaiting = true;
  updateSendButton();

  try {
    const resp = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: chatState.code,
        question: text,
        bazi: chatState.baziInfo,
        history: chatState.messages.slice(-6) // 最近 6 条作为上下文
      })
    });

    const data = await resp.json();

    // 移除打字动画
    hideTyping();

    if (data.error) {
      addMessage('ai', '抱歉，' + data.error);
      if (data.error.includes('次数') || data.error.includes('兑换码')) {
        chatState.credits = 0;
        updateCreditsDisplay(0);
        disableChat();
      }
    } else {
      // 添加 AI 回答
      addMessage('ai', data.reply);
      // 更新剩余次数
      if (data.credits_left !== undefined) {
        chatState.credits = data.credits_left;
        updateCreditsDisplay(data.credits_left);
        if (data.credits_left <= 0) {
          disableChat();
          addMessage('ai', '💡 你的提问次数已用完，可以再次购买继续咨询。');
        }
      }
    }
  } catch (e) {
    hideTyping();
    addMessage('ai', '抱歉，网络出现异常，请稍后重试。');
    console.error('AI 请求失败:', e);
  }

  chatState.isWaiting = false;
  updateSendButton();
}

/**
 * 添加消息到聊天区域
 */
function addMessage(role, content) {
  chatState.messages.push({ role, content });

  const container = document.getElementById('chatMessages');
  const emptyEl = document.getElementById('chatEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + (role === 'user' ? 'user' : 'ai');

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '我' : '师';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // 简单 Markdown 渲染
  bubble.innerHTML = renderMarkdown(content);

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);

  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

/**
 * 简单 Markdown 转 HTML
 */
function renderMarkdown(text) {
  if (!text) return '';
  // 转义 HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 粗体 **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // 换行
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  // 包裹段落
  html = '<p>' + html + '</p>';

  return html;
}

/**
 * 显示打字动画
 */
function showTyping() {
  const container = document.getElementById('chatMessages');
  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.id = 'typingIndicator';
  typing.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

/**
 * 隐藏打字动画
 */
function hideTyping() {
  const typing = document.getElementById('typingIndicator');
  if (typing) typing.remove();
}

/**
 * 键盘事件处理
 */
function handleChatKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

/**
 * 启用聊天
 */
function enableChat() {
  document.getElementById('chatInput').disabled = false;
  document.getElementById('btnSend').disabled = false;
  document.getElementById('chatStatus').textContent = '可提问';
  document.getElementById('chatInput').placeholder = '输入你的问题，如：我的八字喜用神是什么？';

  // 隐藏空状态
  const emptyEl = document.getElementById('chatEmpty');
  if (emptyEl && chatState.messages.length === 0) {
    emptyEl.innerHTML = `
      <div class="chat-empty-icon">🏮</div>
      <h3>AI 命理师已就绪</h3>
      <p>你可以问任何八字命理相关的问题</p>
    `;
  }
}

/**
 * 禁用聊天
 */
function disableChat() {
  document.getElementById('chatInput').disabled = true;
  document.getElementById('btnSend').disabled = true;
  document.getElementById('chatStatus').textContent = '次数已用完';
  document.getElementById('chatInput').placeholder = '次数已用完，请购买后继续提问';
}

/**
 * 更新发送按钮状态
 */
function updateSendButton() {
  const btn = document.getElementById('btnSend');
  btn.disabled = chatState.isWaiting || chatState.credits <= 0;
}

/**
 * 聚焦聊天输入框
 */
function focusChat() {
  document.getElementById('chatInput').focus();
}

/**
 * 更新次数显示
 */
function updateCreditsDisplay(credits) {
  chatState.credits = credits;
  const badge = document.getElementById('creditsBadge');
  const count = document.getElementById('creditsCount');

  if (credits > 0) {
    badge.style.display = 'flex';
    count.textContent = credits;
  } else if (credits === 0 && chatState.code) {
    badge.style.display = 'flex';
    count.textContent = '0';
    count.style.color = 'var(--red)';
  } else {
    badge.style.display = 'none';
  }
}
