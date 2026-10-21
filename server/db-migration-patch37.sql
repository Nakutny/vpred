-- Patch 37: Selfmade Music
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS music_tracks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  filename      TEXT NOT NULL,
  file_data     TEXT NOT NULL,        -- base64 encoded mp3
  file_size     INTEGER NOT NULL,     -- bytes
  uploader_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id      UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,        -- e.g. "Slowed", "Super Slowed"
  filename      TEXT NOT NULL,
  file_data     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  uploader_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS music_tracks_uploader_idx   ON music_tracks (uploader_id);
CREATE INDEX IF NOT EXISTS music_tracks_deleted_idx    ON music_tracks (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS music_versions_track_idx    ON music_versions (track_id);
