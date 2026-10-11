-- Patch 15 DB Migration
-- Run this in Supabase SQL Editor

-- 1. Unique view tracking table
CREATE TABLE IF NOT EXISTS post_views (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ip_address  VARCHAR(64),
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_post_ip
  ON post_views(post_id, ip_address);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);

-- 2. User warnings table
CREATE TABLE IF NOT EXISTS user_warnings (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  warned_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);

-- Done
