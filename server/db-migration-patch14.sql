-- Patch 14: Essays
-- Add type, topic, and images columns to posts table

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'research'
    CHECK (type IN ('research', 'essay')),
  ADD COLUMN IF NOT EXISTS topic VARCHAR(100),
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Index for fast essay queries
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);

-- Set existing posts explicitly to 'research' type (already covered by DEFAULT but explicit is safer)
UPDATE posts SET type = 'research' WHERE type IS NULL OR type = 'research';
