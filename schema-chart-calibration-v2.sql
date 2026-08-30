-- 命盘应事校对 v2：增加排他取象、连续追问与命中程度。
-- 仅扩展校对表，不接触订单、支付、积分或核心排盘数据。

ALTER TABLE chart_calibration_events
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mechanism_key VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS selected_option VARCHAR(80),
  ADD COLUMN IF NOT EXISTS selected_detail VARCHAR(64),
  ADD COLUMN IF NOT EXISTS match_level VARCHAR(12);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chart_calibration_events_match_level_check'
  ) THEN
    ALTER TABLE chart_calibration_events
      ADD CONSTRAINT chart_calibration_events_match_level_check
      CHECK (match_level IN ('exact', 'partial', 'none', 'unsure'));
  END IF;
END $$;
