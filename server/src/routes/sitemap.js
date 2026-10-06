import express from 'express';
import { query } from '../db/client.js';

const router = express.Router();

// GET /sitemap.xml
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY updated_at DESC`
    );

    const BASE = process.env.CLIENT_URL || 'https://vpred.org';

    const staticPages = [
      { url: `${BASE}/`, priority: '1.0', changefreq: 'daily' },
      { url: `${BASE}/categories`, priority: '0.8', changefreq: 'weekly' },
      { url: `${BASE}/impressum`, priority: '0.3', changefreq: 'monthly' },
      { url: `${BASE}/privacy`, priority: '0.3', changefreq: 'monthly' },
      { url: `${BASE}/about`, priority: '0.5', changefreq: 'monthly' },
    ];

    const postUrls = result.rows.map(p => ({
      url: `${BASE}/post/${p.slug}`,
      lastmod: new Date(p.updated_at).toISOString().split('T')[0],
      priority: '0.9',
      changefreq: 'weekly',
    }));

    const allUrls = [...staticPages, ...postUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.url}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Failed to generate sitemap');
  }
});

export default router;
