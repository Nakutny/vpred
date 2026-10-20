-- ─── Patch 32 DB Migration ────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor BEFORE deploying Patch 32

-- 1. Add donator_badge_visible column to users (if not exists)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS donator_badge_visible BOOLEAN DEFAULT TRUE;

-- 2. Ensure is_donator and donator_color exist (from patch 31, safe to re-run)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_donator BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donator_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS donated_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Ensure donations table exists (from patch 31, safe to re-run)
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_id TEXT UNIQUE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'waiting',
  pay_currency TEXT,
  pay_amount NUMERIC(20,8),
  price_amount NUMERIC(10,2),
  price_currency TEXT DEFAULT 'EUR',
  order_description TEXT,
  actually_paid NUMERIC(20,8) DEFAULT 0,
  chosen_color TEXT,
  ipn_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_payment_id ON donations(payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
