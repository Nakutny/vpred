-- patch46: add audio_url column to music_tracks for Cloudflare R2 storage
-- Safe to run multiple times

-- R2 object key (e.g. "tracks/1234567890_My_Song.mp3")
ALTER TABLE music_tracks ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;

-- Optional: index for quick lookups
CREATE INDEX IF NOT EXISTS idx_music_tracks_audio_url ON music_tracks(audio_url) WHERE audio_url IS NOT NULL;
