/**
 * GET /api/chat-history?mode=bazi&chart_key=...
 * 返回登录用户在当前命盘下保存的会话，不参与积分与支付流程。
 */
const { requireAuth } = require('../lib/auth.js');
const {
  getOrCreateChatConversation,
  getConversationMessages
} = require('../lib/supabase.js');

function send(res, status, body) {
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return send(res, 405, { error: '仅支持 GET' });

  const user = requireAuth(req);
  if (!user) return send(res, 401, { error: '请先登录后查看历史对话' });

  const mode = String((req.query && req.query.mode) || 'bazi');
  const chartKey = String((req.query && req.query.chart_key) || 'general');
  try {
    const conversation = await getOrCreateChatConversation(user.uid, mode, chartKey, '命理解读');
    if (!conversation) {
      return send(res, 200, { conversation_id: null, messages: [], storage_ready: false });
    }
    const messages = await getConversationMessages(user.uid, conversation.id, 60);
    return send(res, 200, {
      conversation_id: conversation.id,
      title: conversation.title || '命理解读',
      messages,
      memory_ready: !!conversation.memory_summary,
      storage_ready: true
    });
  } catch (error) {
    console.error('[chat-history] 读取失败:', error.message);
    return send(res, 500, { error: '对话记录暂时无法读取' });
  }
};
