-- 命盘过往事件校准（独立于订单、积分、深度报告和核心算法）
-- 在 Supabase SQL Editor 中执行一次。

CREATE TABLE IF NOT EXISTS chart_calibrations (
  id                 UUID PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_key          VARCHAR(96) NOT NULL,
  chart_signature    VARCHAR(80) NOT NULL DEFAULT '',
  candidate_version  VARCHAR(24) NOT NULL DEFAULT 'bazi-cal-v1',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, chart_key)
);

CREATE TABLE IF NOT EXISTS chart_calibration_events (
  id              UUID PRIMARY KEY,
  calibration_id  UUID NOT NULL REFERENCES chart_calibrations(id) ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key       VARCHAR(80) NOT NULL,
  event_year      INTEGER NOT NULL CHECK (event_year BETWEEN 1900 AND 2200),
  domain          VARCHAR(20) NOT NULL,
  prompt          VARCHAR(180) NOT NULL,
  evidence        JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence      VARCHAR(12) NOT NULL DEFAULT 'medium',
  answer          VARCHAR(12) CHECK (answer IN ('yes', 'no', 'unsure')),
  actual_year     INTEGER CHECK (actual_year BETWEEN 1900 AND 2200),
  note            VARCHAR(240) NOT NULL DEFAULT '',
  answered_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calibration_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_chart_calibrations_user_updated
  ON chart_calibrations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chart_calibration_events_lookup
  ON chart_calibration_events(user_id, calibration_id, event_year DESC);

-- 浏览器不直连表；所有访问由网站后端校验登录身份后完成。
ALTER TABLE chart_calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_calibration_events ENABLE ROW LEVEL SECURITY;
