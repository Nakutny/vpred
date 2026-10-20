-- Patch 29 Migration
-- Run in Supabase SQL Editor before deploying

-- 1. Add moderator support to users (role already supports 'moderator')
-- 2. Soft-delete for posts (deleted_at timestamp)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;

-- 3. DB cleanup log table
CREATE TABLE IF NOT EXISTS db_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  visitor_log_deleted INT DEFAULT 0,
  audit_log_deleted INT DEFAULT 0,
  messages_deleted INT DEFAULT 0,
  anomalies_saved INT DEFAULT 0,
  visitor_log_total INT DEFAULT 0,
  audit_log_total INT DEFAULT 0
);

-- 4. Anomalies table (unusual traffic/log entries saved before deletion)
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'visitor_log' | 'audit_log'
  data JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_visitor_log_created_at ON visitor_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anomalies_created_at ON anomalies(created_at);
