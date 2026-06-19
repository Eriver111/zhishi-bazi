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

-- 聊天记录表
CREATE TABLE IF NOT EXISTS chat_history (
  id          BIGSERIAL PRIMARY KEY,
  code        VARCHAR(32) NOT NULL,
  role        VARCHAR(16) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_credits_code ON user_credits(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_code ON user_subscriptions(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_log_identifier ON free_credits_log(identifier);
CREATE INDEX IF NOT EXISTS idx_chat_code ON chat_history(code);
