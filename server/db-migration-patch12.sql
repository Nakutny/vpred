-- Patch 12: Parent categories (for "Persons" hierarchy) + avatar in comments

-- Add parent_category_id to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Add avatar_url to comments query (no schema change needed, already on users table)

-- Insert "Persons" top-level category
INSERT INTO categories (name, slug, description)
VALUES ('Persons', 'persons', 'Research profiles on individuals')
ON CONFLICT (slug) DO NOTHING;
