import rateLimit from 'express-rate-limit';

// ─── AUTH Rate Limiter ────────────────────────────────────────────────────────
// Brute-force protection for login/register/password-reset
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failed requests
});

// ─── General API Rate Limiter ─────────────────────────────────────────────────
// Light protection for all API routes
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// ─── Donate Rate Limiter ──────────────────────────────────────────────────────
// Prevent spamming payment creation
export const donateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 payment attempts per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts. Please try again in an hour.' },
});
