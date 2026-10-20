-- Patch 31: NowPayments Donation System

-- Add donator fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_donator BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donator_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS donated_at TIMESTAMPTZ DEFAULT NULL;

-- Donations history table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_id TEXT UNIQUE NOT NULL,         -- NowPayments payment_id
  payment_status TEXT NOT NULL DEFAULT 'waiting',  -- waiting, confirming, confirmed, finished, failed, expired
  pay_currency TEXT,                        -- e.g. BTC, ETH
  pay_amount NUMERIC(20, 8),               -- crypto amount
  price_amount NUMERIC(10, 2),             -- EUR amount
  price_currency TEXT DEFAULT 'EUR',
  order_description TEXT,
  actually_paid NUMERIC(20, 8) DEFAULT 0,
  chosen_color TEXT,                        -- color chosen at donation time
  ipn_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_donations_payment_id ON donations(payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_donator ON users(is_donator) WHERE is_donator = TRUE;
