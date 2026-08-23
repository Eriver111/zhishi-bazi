-- AI 对话持久化与长记忆（向后兼容，不删除旧 chat_history 数据）
-- 在 Supabase SQL Editor 中执行一次。

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              UUID PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            VARCHAR(16) NOT NULL DEFAULT 'bazi',
  chart_key       VARCHAR(96) NOT NULL DEFAULT 'general',
  title           VARCHAR(60) NOT NULL DEFAULT '命理解读',
  memory_summary  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mode, chart_key)
);

ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE;
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS mode VARCHAR(16);
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS chart_key VARCHAR(96);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation_created
  ON chat_history(conversation_id, created_at DESC);

-- 所有访问都经网站后端服务账号完成，浏览器不直接读写。
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
