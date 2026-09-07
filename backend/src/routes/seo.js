const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { frontendBase } = require('../utils/urls');
const { getDiscoverCatalog } = require('../services/discoverCatalogService');

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
    '',
    `# Catalogo Meta Commerce Manager / Google Merchant Center:`,
    `# ${process.env.API_URL || 'https://api.saldesk.cv'}/catalog-feed.xml`,
  ].join('\n'));
});

/* sitemap.xml dinamico */
router.get('/sitemap.xml', async (_req, res) => {
  try {
    const { data: ops } = await supabaseAdmin
      .from('operators')
      .select('slug, updated_at')
      .eq('onboarding_complete', true);

    const base = frontendBase();
    const publicBase = process.env.WEBSITE_URL || 'https://saldesk.cv';

    const urls = [
      { loc: publicBase, priority: '1.0' },
      { loc: `${publicBase}/discover/`, priority: '0.9' },
      { loc: `${publicBase}/operadores.html`, priority: '0.8' },
      { loc: `${publicBase}/planos.html`, priority: '0.8' },
      { loc: `${publicBase}/impacto.html`, priority: '0.6' },
      { loc: `${publicBase}/sobre.html`, priority: '0.5' },
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

function xmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

/* unit.description guarda um JSON de metadados (tour/quarto/viatura/mesa) --
   mesmo parser generico ja usado no frontend/socialPreviewController.js,
   so o texto legivel em PT. */
function unitDescriptionText(rawDescription) {
  if (!rawDescription) return '';
  if (rawDescription.startsWith('{')) {
    try {
      const meta = JSON.parse(rawDescription);
      return meta.desc_pt || meta.description || '';
    } catch { return ''; }
  }
  return rawDescription;
}

/* Sem preco por pessoa (base_price), um tour pode ainda ter preco privado/
   por escaloes configurado no mesmo JSON -- mesma prioridade ja usada em
   calcularPrecoPrivado() (bookingHelpers.js): o escalao mais barato antes
   do preco privado fixo. Devolve null quando genuinamente nao ha preco
   nenhum -- esse item fica de fora do feed (Meta exige g:price sempre). */
function unitDisplayPrice(unit) {
  if (Number(unit.base_price) > 0) return Number(unit.base_price);
  if (!unit.description?.startsWith('{')) return null;
  try {
    const meta = JSON.parse(unit.description);
    const tiers = Array.isArray(meta.price_tiers) ? meta.price_tiers : [];
    const tierMin = tiers.length ? Math.min(...tiers.map((t) => Number(t.price) || 0)) : null;
    return tierMin || (Number(meta.price_private) || null);
  } catch { return null; }
}

const FB_CATEGORY_BY_TYPE = {
  activity:   'Arts &amp; Entertainment > Events &amp; Attractions',
  restaurant: 'Arts &amp; Entertainment > Events &amp; Attractions',
};

/* Feed de catalogo compativel com Meta Commerce Manager / Google Merchant
   Center (mesmo formato RSS 2.0 + namespace g:, usado por ambos) -- base
   necessaria para anuncios dinamicos/carrossel tipo GetYourGuide no
   Facebook. So o feed em si; criar a conta de anuncios, carregar este URL
   no Commerce Manager, e montar a campanha continua a ser feito na propria
   interface do Meta pelo operador/fundador, fora do alcance do codigo. */
router.get('/catalog-feed.xml', async (_req, res) => {
  try {
    const catalog = await getDiscoverCatalog();
    const base = frontendBase();

    const items = catalog
      .map((u) => {
        const price = unitDisplayPrice(u);
        const image = Array.isArray(u.images) && u.images[0] ? u.images[0] : null;
        // Meta exige preco e imagem -- sem qualquer um dos dois, o item nunca
        // seria aprovado no Commerce Manager; melhor omitir do que enviar
        // um item garantido a ser rejeitado.
        if (!price || !image) return null;

        const title = `${u.unit_name} — ${u.operator_name}`;
        const description = unitDescriptionText(u.description)
          || `Reserve directamente em ${u.operator_name}, sem comissões.`;
        const link = `${base}/book/${u.operator_slug}/servico/${u.unit_id}`;
        const availability = u.next_available ? 'in stock' : 'out of stock';
        const currency = u.currency || 'EUR';
        const extraImages = Array.isArray(u.images) ? u.images.slice(1, 10) : [];
        const fbCategory = FB_CATEGORY_BY_TYPE[u.operator_type];

        return `  <item>
    <g:id>${xmlEscape(u.unit_id)}</g:id>
    <title>${xmlEscape(title)}</title>
    <description>${xmlEscape(description)}</description>
    <link>${xmlEscape(link)}</link>
    <g:image_link>${xmlEscape(image)}</g:image_link>
${extraImages.map((img) => `    <g:additional_image_link>${xmlEscape(img)}</g:additional_image_link>`).join('\n')}
    <g:availability>${availability}</g:availability>
    <g:price>${price.toFixed(2)} ${xmlEscape(currency)}</g:price>
    <g:condition>new</g:condition>
    <g:brand>${xmlEscape(u.operator_name)}</g:brand>
${fbCategory ? `    <g:google_product_category>${fbCategory}</g:google_product_category>\n` : ''}${u.category_label_pt ? `    <g:product_type>${xmlEscape(u.category_label_pt)}</g:product_type>\n` : ''}  </item>`;
      })
      .filter(Boolean)
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>SalDesk — Catálogo de experiências</title>
  <link>${xmlEscape(process.env.WEBSITE_URL || 'https://saldesk.cv')}</link>
  <description>Actividades, hotéis, rent-a-car e restaurantes reserváveis directamente via SalDesk, Cabo Verde.</description>
${items}
</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'application/xml');
    res.send('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
  }
});

module.exports = router;
