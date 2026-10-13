-- Patch 17: ERD support on posts
-- Run this in Supabase SQL Editor

-- Add erd_data column to posts table (stores nodes + edges as JSONB)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS erd_data JSONB DEFAULT NULL;

-- Index for posts that have an ERD (optional, for admin queries)
CREATE INDEX IF NOT EXISTS idx_posts_has_erd ON posts ((erd_data IS NOT NULL)) WHERE erd_data IS NOT NULL;
