-- Patch 36 — Performance index migration
-- Run once in Supabase SQL editor

-- Posts: speed up feed/essays/texts list queries (type + status + ordering)
CREATE INDEX IF NOT EXISTS posts_type_status_created_idx
  ON posts (type, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Posts: speed up author profile page (all posts by a user)
CREATE INDEX IF NOT EXISTS posts_author_id_idx
  ON posts (author_id)
  WHERE deleted_at IS NULL;

-- Friendships: speed up "my accepted friends" lookup
CREATE INDEX IF NOT EXISTS friendships_requester_status_idx
  ON friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx
  ON friendships (addressee_id, status);

-- Notifications: speed up unread count per user
CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON notifications (user_id, is_read);

-- Post votes: speed up vote lookup per post
CREATE INDEX IF NOT EXISTS post_votes_post_id_idx
  ON post_votes (post_id);
