-- Patch 35: Ban bio/avatar backup columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS pre_ban_bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pre_ban_avatar_url TEXT;

-- Optional index for faster user lookups by username (case-insensitive)
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
