const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');

/* robots.txt */
router.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    `Sitemap: ${process.env.API_URL || 'https://api.saldesk.cv'}/sitemap.xml`,
  ].join('\n'));
});

/* sitemap.xml dinamico */
router.get('/sitemap.xml', async (_req, res) => {
  try {
    const { data: ops } = await supabaseAdmin
      .from('operators')
      .select('slug, updated_at')
      .eq('onboarding_complete', true);

    const base = process.env.FRONTEND_URL || 'https://app.saldesk.cv';
    const publicBase = process.env.WEBSITE_URL || 'https://saldesk.cv';

    const urls = [
      { loc: publicBase, priority: '1.0' },
      { loc: `${publicBase}/discover/`, priority: '0.9' },
      ...( ops || []).map(op => ({
        loc: `${base}/book/${op.slug}`,
        lastmod: op.updated_at?.split('T')[0],
        priority: '0.8',
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('<?xml version="1.0"?><urlset/>');
  }
});

module.exports = router;
