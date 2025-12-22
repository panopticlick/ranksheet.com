-- RankSheet CMS — Postgres bootstrap (schema isolation + extra tables)
-- NOTE: Payload collection tables are managed via `payload migrate`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS ranksheet;

-- Updated timestamp trigger helper (for non-Payload tables only)
CREATE OR REPLACE FUNCTION ranksheet.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Job runs (ops/audit + optional async queue later)
CREATE TABLE IF NOT EXISTS ranksheet.job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(80) NOT NULL,
  keyword_slug VARCHAR(255),
  status VARCHAR(20) NOT NULL,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  detail JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_time
  ON ranksheet.job_runs(job_name, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_keyword_time
  ON ranksheet.job_runs(keyword_slug, queued_at DESC);

-- ASIN cache (optional; used for persistent product-card caching if needed)
CREATE TABLE IF NOT EXISTS ranksheet.asin_cache (
  asin VARCHAR(20) PRIMARY KEY,
  title TEXT,
  brand TEXT,
  image_url TEXT,
  parent_asin VARCHAR(20),
  price_cents INTEGER,
  price_currency VARCHAR(3) DEFAULT 'USD',
  is_prime BOOLEAN,
  source VARCHAR(50) DEFAULT 'express',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ranksheet.asin_cache
  ADD COLUMN IF NOT EXISTS price_cents INTEGER;

ALTER TABLE ranksheet.asin_cache
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) DEFAULT 'USD';

ALTER TABLE ranksheet.asin_cache
  ADD COLUMN IF NOT EXISTS is_prime BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_asin_cache_parent ON ranksheet.asin_cache(parent_asin);
CREATE INDEX IF NOT EXISTS idx_asin_cache_expires ON ranksheet.asin_cache(expires_at);

DROP TRIGGER IF EXISTS trg_asin_cache_updated_at ON ranksheet.asin_cache;
CREATE TRIGGER trg_asin_cache_updated_at
BEFORE UPDATE ON ranksheet.asin_cache
FOR EACH ROW EXECUTE FUNCTION ranksheet.update_timestamp();

-- Affiliate clicks (optional)
CREATE TABLE IF NOT EXISTS ranksheet.affiliate_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  keyword_slug VARCHAR(255) NOT NULL,
  asin VARCHAR(20) NOT NULL,
  rank INTEGER,
  position_context VARCHAR(50),
  user_ip_hash VARCHAR(64),
  user_agent TEXT,
  referrer_url TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(150),
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aff_clicks_slug_time
  ON ranksheet.affiliate_clicks(keyword_slug, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_aff_clicks_asin_time
  ON ranksheet.affiliate_clicks(asin, clicked_at DESC);

CREATE TABLE IF NOT EXISTS ranksheet.affiliate_clicks_daily (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day DATE NOT NULL,
  keyword_slug VARCHAR(255) NOT NULL,
  asin VARCHAR(20),
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_aff_daily_day_slug_asin
  ON ranksheet.affiliate_clicks_daily(day, keyword_slug, asin);

DROP TRIGGER IF EXISTS trg_affiliate_clicks_daily_updated_at ON ranksheet.affiliate_clicks_daily;
CREATE TRIGGER trg_affiliate_clicks_daily_updated_at
BEFORE UPDATE ON ranksheet.affiliate_clicks_daily
FOR EACH ROW EXECUTE FUNCTION ranksheet.update_timestamp();

-- Keyword request voting (anti-spam; no FK because Payload tables are created later by `payload migrate`)
CREATE TABLE IF NOT EXISTS ranksheet.keyword_request_votes (
  request_id INTEGER NOT NULL,
  user_ip_hash VARCHAR(64) NOT NULL,
  user_agent TEXT,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (request_id, user_ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_keyword_request_votes_time
  ON ranksheet.keyword_request_votes(voted_at DESC);
