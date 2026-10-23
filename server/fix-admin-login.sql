-- ─── Admin Login Fix ─────────────────────────────────────────────────────────
-- If you cannot log in with your admin account, run this to check what's wrong.

-- 1. Find your admin user:
SELECT id, username, email, role, email_verified, is_banned
FROM users
WHERE role = 'admin';

-- 2. If email_verified is FALSE, fix it:
-- UPDATE users SET email_verified = TRUE WHERE role = 'admin';

-- 3. If is_banned is TRUE, fix it:
-- UPDATE users SET is_banned = FALSE, ban_expires_at = NULL WHERE role = 'admin';

-- 4. To reset your admin password to a known value:
-- You need to generate a bcrypt hash first. Use this Node.js snippet:
--
--   node -e "const b=require('bcryptjs'); b.hash('YourNewPassword123!', 12).then(h => console.log(h));"
--
-- Then run:
-- UPDATE users SET password_hash = '<paste-hash-here>' WHERE email = 'your@email.com';

-- 5. To promote a user to admin:
-- UPDATE users SET role = 'admin' WHERE email = 'your@email.com';

-- ─── End ──────────────────────────────────────────────────────────────────────
