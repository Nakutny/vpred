import jwt from 'jsonwebtoken';
import { query } from '../db/client.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nicht eingeloggt' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const result = await query(
      'SELECT id, username, email, role, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }

    if (result.rows[0].is_banned) {
      return res.status(403).json({ error: 'Konto gesperrt' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Adminrechte' });
  }
  next();
}

export function requireModerator(req, res, next) {
  if (!['admin', 'moderator'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Keine Moderatorrechte' });
  }
  next();
}

export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
}
