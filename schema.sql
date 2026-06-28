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

-- 索引
CREATE INDEX IF NOT EXISTS idx_credits_code ON user_credits(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_code ON user_subscriptions(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_free_log_identifier ON free_credits_log(identifier);
CREATE INDEX IF NOT EXISTS idx_chat_code ON chat_history(code);
