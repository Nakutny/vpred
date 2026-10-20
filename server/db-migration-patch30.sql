-- Patch 30: Maintenance mode + security hardening
-- Run this in Supabase SQL Editor before deploying

-- 1. Maintenance mode table
CREATE TABLE IF NOT EXISTS maintenance_mode (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  message TEXT DEFAULT 'The platform is temporarily under maintenance. Please check back soon.',
  started_at TIMESTAMPTZ,
  estimated_end TIMESTAMPTZ,
  started_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure only one row ever exists
INSERT INTO maintenance_mode (id, enabled, message)
VALUES (1, FALSE, 'The platform is temporarily under maintenance. Please check back soon.')
ON CONFLICT (id) DO NOTHING;

-- 2. Index improvements for security queries
CREATE INDEX IF NOT EXISTS idx_visitor_log_ip ON visitor_log(ip);
CREATE INDEX IF NOT EXISTS idx_visitor_log_ip_created ON visitor_log(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned) WHERE is_banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
