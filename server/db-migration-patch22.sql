-- Patch 22: Idempotent migration (safe to run even if patch20 was already applied)

-- Add email verification columns (if not already there)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ DEFAULT NULL;

-- Mark ALL existing accounts as verified (so they can still log in)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- Create visitor_log table (if not already there from patch21)
CREATE TABLE IF NOT EXISTS visitor_log (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  city TEXT,
  region TEXT,
  isp TEXT,
  path TEXT,
  method TEXT DEFAULT 'GET',
  user_agent TEXT,
  referrer TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_log_created ON visitor_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_log_ip ON visitor_log(ip);
CREATE INDEX IF NOT EXISTS idx_visitor_log_country ON visitor_log(country_code);
CREATE INDEX IF NOT EXISTS idx_visitor_log_user ON visitor_log(user_id);
