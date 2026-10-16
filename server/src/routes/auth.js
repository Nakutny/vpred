import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js';

const router = express.Router();

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Username must be between 3 and 50 characters.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Username may only contain letters, numbers, _ and -.' });

    const exists = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)', [email, username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email or username already in use.' });

    const password_hash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query(
      `INSERT INTO users (username, email, password_hash, email_verified, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, FALSE, $4, $5) RETURNING id, username, email, role, avatar_url`,
      [username, email, password_hash, verificationToken, verificationExpires]
    );
    const user = result.rows[0];

    // Send verification email (non-fatal)
    try { await sendVerificationEmail(email, verificationToken); } catch (e) { console.error('Verification email failed:', e.message); }

    res.status(201).json({ message: 'Account created. Please check your email to verify your account.', user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const result = await query(
      'SELECT id, username, email, role, avatar_url, password_hash, is_banned, email_verified FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.', code: 'EMAIL_NOT_VERIFIED', email: user.email });
    }

    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const result = await query('SELECT id, email_verified FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = result.rows[0];

    // Always 200 (anti-enumeration)
    if (!user || user.email_verified) return res.json({ message: 'If that email is registered and unverified, we sent a new link.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query('UPDATE users SET email_verification_token=$1, email_verification_expires=$2 WHERE id=$3', [token, expires, user.id]);
    try { await sendVerificationEmail(email, token); } catch (e) { console.error('Resend email failed:', e.message); }

    res.json({ message: 'If that email is registered and unverified, we sent a new link.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification email.' });
  }
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'No token provided.' });

    const result = await query(
      'SELECT id, email_verification_expires FROM users WHERE email_verification_token = $1',
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already used verification link.' });
    if (new Date(user.email_verification_expires) < new Date()) return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });

    await query('UPDATE users SET email_verified=TRUE, email_verification_token=NULL, email_verification_expires=NULL WHERE id=$1', [user.id]);
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Email verification failed.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const result = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const user = result.rows[0];

    // Always 200 (anti-enumeration)
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await query('UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3', [token, expires, user.id]);
      try { await sendPasswordResetEmail(email, token); } catch (e) { console.error('Reset email failed:', e.message); }
    }

    res.json({ message: 'If that email is registered, we sent a password reset link.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const result = await query('SELECT id, password_reset_expires FROM users WHERE password_reset_token = $1', [token]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already used reset link.' });
    if (new Date(user.password_reset_expires) < new Date()) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const password_hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires=NULL WHERE id=$2', [password_hash, user.id]);
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
