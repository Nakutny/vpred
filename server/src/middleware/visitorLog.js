import { query } from '../db/client.js';

// Geolocation-Cache (IP → Daten), damit ip-api nicht bei jedem Request getroffen wird
const geoCache = new Map();
const GEO_TTL_MS = 30 * 60 * 1000; // 30 Minuten

async function geoLookup(ip) {
  const now = Date.now();
  const cached = geoCache.get(ip);
  if (cached && now - cached.ts < GEO_TTL_MS) return cached.data;

  // Loopback / Private IPs → keine Anfrage
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    const data = { country: 'Local', country_code: 'XX', city: null, region: null, isp: null };
    geoCache.set(ip, { data, ts: now });
    return data;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp`);
    const json = await res.json();
    const data = json.status === 'success'
      ? { country: json.country || null, country_code: json.countryCode || null, city: json.city || null, region: json.regionName || null, isp: json.isp || null }
      : { country: null, country_code: null, city: null, region: null, isp: null };
    geoCache.set(ip, { data, ts: now });
    return data;
  } catch {
    return { country: null, country_code: null, city: null, region: null, isp: null };
  }
}

export function visitorLogMiddleware(app) {
  app.use(async (req, res, next) => {
    // Nur lesende Requests loggen (GET/HEAD), keine internen Health-Checks
    if (req.method !== 'GET' && req.method !== 'HEAD') { next(); return; }
    if (req.path === '/health') { next(); return; }

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const path = req.originalUrl;
    const user_agent = req.headers['user-agent'] || null;
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;

    // Nicht blockierend – Logging im Hintergrund
    (async () => {
      try {
        const geo = await geoLookup(ip);
        // user_id aus JWT wenn vorhanden (optional, keine Auth-Prüfung hier)
        let user_id = null;
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          try {
            const { default: jwt } = await import('jsonwebtoken');
            const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
            user_id = decoded.userId || null;
          } catch { /* kein gültiger Token → ignorieren */ }
        }
        await query(
          `INSERT INTO visitor_log (ip, country, country_code, city, region, isp, path, method, user_agent, referrer, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [ip, geo.country, geo.country_code, geo.city, geo.region, geo.isp, path, req.method, user_agent, referrer, user_id]
        );
      } catch (e) { console.error('Visitor log error:', e.message); }
    })();

    next();
  });
}
