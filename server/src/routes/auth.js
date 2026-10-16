import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js';

const router = express.Router();

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username may only contain letters, numbers, _ and -.' });
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const result = await query(
      `INSERT INTO users (username, email, password_hash, email_verified, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, FALSE, $4, $5)
       RETURNING id, username, email, role`,
      [username, email.toLowerCase(), passwordHash, verificationToken, verificationExpires]
    );

    const user = result.rows[0];

    // Send verification email — if it fails, the account is still created.
    // The user can resend via /resend-verification.
    try {
      await sendVerificationEmail(user.email, verificationToken);
      console.log('[auth] Verification email sent to', user.email);
    } catch (mailErr) {
      console.error('[auth] Failed to send verification email:', mailErr.message);
      // Do not fail the registration — user can resend
    }

    res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.', email: user.email });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  // Always return 200 to prevent email enumeration
  try {
    const { email } = req.body;
    if (!email) return res.json({ message: 'If that email exists, a new link has been sent.' });

    const result = await query(
      'SELECT id, email, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (user && !user.email_verified) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await query(
        'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
        [token, expires, user.id]
      );
      try {
        await sendVerificationEmail(user.email, token);
      } catch (mailErr) {
        console.error('[auth] resend-verification mail error:', mailErr.message);
      }
    }
  } catch (err) {
    console.error('Resend verification error:', err);
  }
  res.json({ message: 'If that email exists, a new verification link has been sent.' });
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const result = await query(
      'SELECT id, email_verification_expires FROM users WHERE email_verification_token = $1',
      [token]
    );
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link.' });
    if (new Date(user.email_verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    await query(
      'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  // Always return 200 to prevent email enumeration
  try {
    const { email } = req.body;
    if (email) {
      const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      const user = result.rows[0];
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
        await query(
          'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
          [token, expires, user.id]
        );
        try {
          await sendPasswordResetEmail(email.toLowerCase(), token);
        } catch (mailErr) {
          console.error('[auth] forgot-password mail error:', mailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }
  res.json({ message: 'If that email exists, a password reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const result = await query(
      'SELECT id, password_reset_expires FROM users WHERE password_reset_token = $1',
      [token]
    );
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await query(
      'SELECT id, username, email, role, password_hash, is_banned, email_verified, avatar_url FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const token = createToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
