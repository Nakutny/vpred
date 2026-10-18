-- Patch 26: Add 'story' post type, remove email verification requirement

-- Add 'story' to post type enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'story'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'post_type')
  ) THEN
    ALTER TYPE post_type ADD VALUE 'story';
  END IF;
EXCEPTION WHEN others THEN
  -- If post_type is not an enum but a varchar/text check constraint, handle below
  NULL;
END $$;

-- If post_type is a check constraint (not an enum), update it:
-- ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
-- ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK (type IN ('research', 'essay', 'story'));

-- Mark all existing unverified users as verified (so they can log in)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE OR email_verified IS NULL;
