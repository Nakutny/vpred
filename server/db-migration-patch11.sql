-- Patch 11: Add parent_post_id for "Expand" feature
ALTER TABLE posts ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_post_id);
