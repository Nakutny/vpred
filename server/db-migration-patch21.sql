-- Patch 21: Visitor-Log-Tabelle
CREATE TABLE IF NOT EXISTS visitor_log (
  id            BIGSERIAL PRIMARY KEY,
  ip            TEXT NOT NULL,
  country       TEXT,
  country_code  TEXT,
  city          TEXT,
  region        TEXT,
  isp           TEXT,
  path          TEXT,
  method        TEXT DEFAULT 'GET',
  user_agent    TEXT,
  referrer      TEXT,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_log_created     ON visitor_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_log_ip          ON visitor_log(ip);
CREATE INDEX IF NOT EXISTS idx_visitor_log_country     ON visitor_log(country_code);
CREATE INDEX IF NOT EXISTS idx_visitor_log_user        ON visitor_log(user_id);
