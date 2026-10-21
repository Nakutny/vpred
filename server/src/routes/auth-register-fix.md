# Patch 34 — Fix: Kein Auto-Login nach Registrierung

In server/src/routes/auth.js, in der POST /register Route:
Suche nach dem letzten res.json({ ... }) das token zurückgibt.

Ersetze:
  res.json({ message: 'Registration successful.', token, user: { ... } });

Mit:
  res.json({ message: 'Registration successful. Please log in.' });

(Das token und user Objekt einfach weglassen — kein Token zurückgeben)
