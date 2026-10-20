-- Patch 33: Maintenance Mode table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS maintenance_mode (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  message     TEXT,
  started_at  TIMESTAMPTZ,
  estimated_end TIMESTAMPTZ,
  started_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Insert the singleton row if it doesn't exist
INSERT INTO maintenance_mode (id, enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Also add donator_badge_visible from patch32 (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS donator_badge_visible BOOLEAN DEFAULT TRUE;
