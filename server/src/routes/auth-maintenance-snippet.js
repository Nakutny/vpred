// ════════════════════════════════════════════════════════════════════
// PATCH 33 — Füge diesen Block in server/src/routes/auth.js ein
// ════════════════════════════════════════════════════════════════════
//
// Suche in der POST /api/auth/login Route nach der Stelle wo
// der Ban-Check endet und das JWT generiert wird.
// Füge DAVOR folgenden Block ein:
//
// ─── NACH dem Ban-Check, VOR dem JWT-sign ────────────────────────────
//
//   // Maintenance mode: only admin/mod can log in
//   try {
//     const maintRes = await pool('SELECT enabled FROM maintenance_mode WHERE id = 1');
//     if (maintRes.rows[0]?.enabled && !['admin', 'moderator'].includes(user.role)) {
//       return res.status(503).json({
//         error: 'maintenance',
//         message: 'The platform is temporarily under maintenance. Only admins and moderators can log in.',
//         code: 'MAINTENANCE',
//       });
//     }
//   } catch (_) { /* table might not exist yet — allow login */ }
//
// ════════════════════════════════════════════════════════════════════
