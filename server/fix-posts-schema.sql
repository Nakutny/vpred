-- patch45: ensure posts table has all required columns
-- Safe to run multiple times — all use IF NOT EXISTS

-- patch11: expand posts (parent_post_id)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

-- patch14: type, topic, images
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS type    VARCHAR(20) NOT NULL DEFAULT 'research'
    CHECK (type IN ('research', 'essay', 'text', 'story')),
  ADD COLUMN IF NOT EXISTS topic   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS images  JSONB DEFAULT '[]'::jsonb;

-- patch17: erd_data
ALTER TABLE posts ADD COLUMN IF NOT EXISTS erd_data JSONB DEFAULT NULL;

-- patch29: soft-delete
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;

-- Indexes (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_posts_type    ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at) WHERE deleted_at IS NOT NULL;
