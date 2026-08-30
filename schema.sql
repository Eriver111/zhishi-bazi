-- Supabase 数据库建表 SQL v3.0
-- 在 Supabase SQL Editor 中执行

-- 用户次数表：一个兑换码对应 N 次提问
CREATE TABLE IF NOT EXISTS user_credits (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) UNIQUE NOT NULL,
  credits     INT DEFAULT 5,
  total_used  INT DEFAULT 0,
  order_id    VARCHAR(64),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 月度订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) UNIQUE NOT NULL,
  order_id    VARCHAR(64),
  starts_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 免费次数追踪
CREATE TABLE IF NOT EXISTS free_credits_log (
  id          BIGSERIAL PRIMARY KEY,
  identifier  VARCHAR(64) NOT NULL,
  used_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 手机绑定表（找回兑换码）
CREATE TABLE IF NOT EXISTS phone_bindings (
  id          BIGSERIAL PRIMARY KEY,
  phone       VARCHAR(11) UNIQUE NOT NULL,
  code        VARCHAR(32) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 聊天记录表
CREATE TABLE IF NOT EXISTS chat_history (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) NOT NULL,
  role        VARCHAR(16) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== v4.0 用户系统 ====================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  phone       VARCHAR(11),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 用户数据表（灵活的 key-value 存储）
CREATE TABLE IF NOT EXISTS user_data (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  key         VARCHAR(64) NOT NULL,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_data_user ON user_data(user_id);

-- 现有表增加 user_id 外键（可空，向后兼容）
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE free_credits_log ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE phone_bindings ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_credits_user ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);

-- v4.1 分销渠道字段
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS channel VARCHAR(32);
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS channel VARCHAR(32);

-- 索引
CREATE INDEX IF NOT EXISTS idx_credits_code ON user_credits(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_code ON user_subscriptions(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_log_identifier ON free_credits_log(identifier);
CREATE INDEX IF NOT EXISTS idx_chat_code ON chat_history(code);

-- AI 对话会话：每个用户、术数类型和命盘分别保存，避免跨盘串话。
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
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation_created ON chat_history(conversation_id, created_at DESC);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- 命盘过往事件校准：候选事实先生成并锁定，用户只确认是否发生。
CREATE TABLE IF NOT EXISTS chart_calibrations (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_key VARCHAR(96) NOT NULL,
  chart_signature VARCHAR(80) NOT NULL DEFAULT '',
  candidate_version VARCHAR(24) NOT NULL DEFAULT 'bazi-cal-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, chart_key)
);
CREATE TABLE IF NOT EXISTS chart_calibration_events (
  id UUID PRIMARY KEY,
  calibration_id UUID NOT NULL REFERENCES chart_calibrations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key VARCHAR(80) NOT NULL,
  event_year INTEGER NOT NULL CHECK (event_year BETWEEN 1900 AND 2200),
  domain VARCHAR(20) NOT NULL,
  prompt VARCHAR(180) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence VARCHAR(12) NOT NULL DEFAULT 'medium',
  answer VARCHAR(12) CHECK (answer IN ('yes', 'no', 'unsure')),
  actual_year INTEGER CHECK (actual_year BETWEEN 1900 AND 2200),
  note VARCHAR(240) NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calibration_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_chart_calibrations_user_updated ON chart_calibrations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chart_calibration_events_lookup ON chart_calibration_events(user_id, calibration_id, event_year DESC);
ALTER TABLE chart_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_calibration_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_orders (
  order_id      VARCHAR(96) PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id),
  report_type   VARCHAR(16) NOT NULL,
  report_key    VARCHAR(64) NOT NULL,
  report_params JSONB NOT NULL,
  label         VARCHAR(160) NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_orders_access
  ON report_orders(user_id, report_type, report_key, status);
CREATE INDEX IF NOT EXISTS idx_report_orders_user_paid
  ON report_orders(user_id, paid_at DESC);

-- Customer-service feedback. This table is server-only: the service-role key
-- bypasses RLS while public/anonymous Supabase clients receive no policy.
CREATE TABLE IF NOT EXISTS feedback (
  id          BIGSERIAL PRIMARY KEY,
  message     VARCHAR(500) NOT NULL,
  contact     VARCHAR(100) NOT NULL DEFAULT '',
  page        VARCHAR(32) NOT NULL DEFAULT '',
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_key  CHAR(64) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_client_recent
  ON feedback(client_key, created_at DESC);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Serialize count-and-insert per anonymous client key so concurrent serverless
-- requests cannot both pass the five-attempt limit.
CREATE OR REPLACE FUNCTION create_feedback_rate_limited(
  p_message TEXT,
  p_contact TEXT,
  p_page TEXT,
  p_context JSONB,
  p_client_key TEXT,
  p_created_at TIMESTAMPTZ,
  p_since TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS TABLE(accepted BOOLEAN, feedback_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_key, 0));
  IF (
    SELECT COUNT(*)
    FROM feedback
    WHERE client_key = p_client_key
      AND created_at >= p_since
  ) >= LEAST(GREATEST(p_limit, 1), 5) THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT;
    RETURN;
  END IF;

  INSERT INTO feedback(message, contact, page, context, client_key, created_at)
  VALUES(p_message, p_contact, p_page, p_context, p_client_key, p_created_at)
  RETURNING id INTO inserted_id;

  RETURN QUERY SELECT TRUE, inserted_id;
END;
$$;
REVOKE ALL ON FUNCTION create_feedback_rate_limited(
  TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_feedback_rate_limited(
  TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER
) TO service_role;
