import jwt from 'jsonwebtoken';
import { query } from '../db/client.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'You must be signed in to do this.' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = await query(
      'SELECT id, username, email, role, avatar_url, is_banned, ban_expires_at FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found.' });

    const user = result.rows[0];

    // Check ban status — auto-lift expired bans
    if (user.is_banned) {
      if (user.ban_expires_at && new Date(user.ban_expires_at) <= new Date()) {
        // Ban has expired — auto-unban
        await query(
          'UPDATE users SET is_banned = FALSE, ban_expires_at = NULL WHERE id = $1',
          [user.id]
        );
        user.is_banned = false;
        user.ban_expires_at = null;
      } else {
        // Still banned
        const expiresMsg = user.ban_expires_at
          ? ` until ${new Date(user.ban_expires_at).toLocaleDateString()}`
          : ' permanently';
        return res.status(403).json({ error: `Your account has been suspended${expiresMsg}.` });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

export function requireModerator(req, res, next) {
  if (!['admin', 'moderator'].includes(req.user?.role)) return res.status(403).json({ error: 'Moderator access required.' });
  next();
}

export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { req.user = null; return next(); }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
}
