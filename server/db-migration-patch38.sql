-- ─── Patch 38: music_tracks table ────────────────────────────────────────────
-- Run this in Supabase SQL Editor before deploying patch38.

CREATE TABLE IF NOT EXISTS music_tracks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  artist           TEXT,
  description      TEXT,
  audio_data       TEXT NOT NULL,          -- base64-encoded MP3
  mime_type        TEXT NOT NULL DEFAULT 'audio/mpeg',
  duration_seconds INTEGER,
  uploaded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_deleted_at ON music_tracks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_music_tracks_created_at ON music_tracks(created_at DESC);

-- ─── End of patch38 ───────────────────────────────────────────────────────────
