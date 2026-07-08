-- 页面浏览统计表（在 Supabase SQL 编辑器中执行）
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, path)
);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(date DESC);
