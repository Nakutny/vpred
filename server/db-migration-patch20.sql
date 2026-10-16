-- Patch 20: E-Mail-Verifikation + Passwort-Reset
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ DEFAULT NULL;

-- Bestehende Nutzer als bereits verifiziert markieren
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;
