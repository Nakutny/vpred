-- ============================================================
-- Patch 70 Migration — platform_settings table
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings (skip if key already exists)
INSERT INTO platform_settings (key, value, description) VALUES
  ('site_name',               'vpred.org',        'Display name shown in the browser title and footer'),
  ('site_tagline',            'Open Research Collective', 'Short description shown in the sidebar'),
  ('admin_name_color',        '#4f8ef7',          'Color used for the admin username across the platform'),
  ('registration_open',       'true',             'Allow new user registrations (true / false)'),
  ('posts_require_approval',  'false',            'New posts stay hidden until an admin approves them (true / false)'),
  ('max_post_length',         '50000',            'Maximum character count allowed per post'),
  ('contact_email',           '',                 'Email shown on the About / Support pages'),
  ('donations_enabled',       'true',             'Show the Donate page and donation features (true / false)'),
  ('music_section_enabled',   'true',             'Show the Selfmade Music section in the nav (true / false)')
ON CONFLICT (key) DO NOTHING;
