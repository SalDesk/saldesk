const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { supabaseAdmin } = require('../config/supabase');

/* Imagens "estilizadas" para o feed de catalogo (Meta/Google) -- selo de
   procura real, nota media e localizacao sobrepostos na propria foto,
   mesmo truque usado por catalogos grandes (GetYourGuide etc): o Meta nao
   tem nenhuma forma nativa de estilizar um card de anuncio de catalogo, o
   que parece "estilo do anuncio" e sempre texto desenhado na imagem antes
   de ser enviada. Nunca inventa nada: o selo de urgencia so aparece com
   reservas reais recentes a justificar, a nota so aparece com avaliacoes
   reais. */

const W = 1200;
const H = 900;
const URGENCY_THRESHOLD = 3; // reservas confirmadas nos ultimos 30 dias
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function xmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function cacheDir() {
  return path.join(process.env.UPLOADS_DIR || '/var/www/saldesk/uploads', 'catalog-images');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1).trimEnd()}…` : str;
}

function fmtDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

/* Mesma prioridade ja usada em calcularPrecoPrivado() (bookingHelpers.js) e
   em unitDisplayPrice() (seo.js) -- escalao mais barato > preco privado
   fixo > preco por pessoa. Nunca deve divergir do preco que o feed ja
   mostra para o mesmo item. */
function displayPrice(unit) {
  if (Number(unit.base_price) > 0) return Number(unit.base_price);
  if (!unit.description?.startsWith('{')) return null;
  try {
    const meta = JSON.parse(unit.description);
    const tiers = Array.isArray(meta.price_tiers) ? meta.price_tiers : [];
    const tierMin = tiers.length ? Math.min(...tiers.map((t) => Number(t.price) || 0)) : null;
    return tierMin || (Number(meta.price_private) || null);
  } catch { return null; }
}

function fmtPrice(price, currency) {
  if (!price) return null;
  return currency === 'CVE' ? `${Math.round(price)} CVE` : `€${price % 1 ? price.toFixed(2) : price.toFixed(0)}`;
}

async function getCatalogImage(req, res, next) {
  try {
    const unitId = req.params.unitId;
    const cachePath = path.join(cacheDir(), `${unitId}.jpg`);

    /* Cache em disco de 24h -- o Meta busca o feed periodicamente, nao ha
       necessidade de recompor a imagem (download + overlay) a cada pedido
       do crawler. */
    if (fs.existsSync(cachePath)) {
      const age = Date.now() - fs.statSync(cachePath).mtimeMs;
      if (age < CACHE_MAX_AGE_MS) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs.createReadStream(cachePath).pipe(res);
      }
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id, name, images, operator_id, base_price, description, duration_minutes')
      .eq('id', unitId)
      .maybeSingle();
    if (!unit || !Array.isArray(unit.images) || !unit.images[0]) {
      return res.status(404).end();
    }

    const { data: op } = await supabaseAdmin
      .from('operators')
      .select('id, name, currency, address, islands(name)')
      .eq('id', unit.operator_id)
      .maybeSingle();

    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('operator_id', unit.operator_id)
      .eq('is_public', true)
      .not('rating', 'is', null);
    const ratings = (reviews || []).map((r) => r.rating);
    const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentBookings } = await supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .gte('created_at', thirtyDaysAgo)
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    const location = truncate((op?.islands?.name || op?.address || 'Cabo Verde').toUpperCase(), 30);
    const showUrgency = (recentBookings || 0) >= URGENCY_THRESHOLD;
    const showRating = !!avgRating && ratings.length > 0;

    const price = displayPrice(unit);
    const priceLabel = fmtPrice(price, op?.currency);
    const durationLabel = fmtDuration(unit.duration_minutes);
    const title = truncate(`${unit.name} — ${op?.name || ''}`, 52);
    const subtitleParts = [location, durationLabel, priceLabel ? `A partir de ${priceLabel}` : null].filter(Boolean);
    const subtitle = subtitleParts.join('   ·   ');

    const imgRes = await axios.get(unit.images[0], { responseType: 'arraybuffer', timeout: 10000 });
    const base = await sharp(Buffer.from(imgRes.data)).resize(W, H, { fit: 'cover' }).toBuffer();

    const parts = [];
    parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="45%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.65"/>
    </linearGradient></defs>`);
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>`);

    if (showUrgency) {
      parts.push(`
        <rect x="32" y="32" rx="6" ry="6" width="330" height="52" fill="#FF6B35"/>
        <text x="52" y="66" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="white" letter-spacing="0.5">LIKELY TO SELL OUT</text>
      `);
    }
    if (showRating) {
      const label = `★ ${avgRating.toFixed(1)} (${ratings.length})`;
      const boxW = 50 + label.length * 15;
      parts.push(`
        <rect x="${W - boxW - 32}" y="32" rx="20" ry="20" width="${boxW}" height="48" fill="white" fill-opacity="0.92"/>
        <text x="${W - boxW - 12}" y="63" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#1A2332" text-anchor="end">${xmlEscape(label)}</text>
      `);
    }
    // Bloco inferior: nome + operador (linha grande), depois localizacao ·
    // duracao · preco (linha pequena) -- so mostra o que existir de facto,
    // nunca inventa duracao/preco quando a unidade nao os tem definidos.
    parts.push(`
      <text x="32" y="${H - 76}" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="white">${xmlEscape(title)}</text>
      <text x="32" y="${H - 36}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="white" fill-opacity="0.92" letter-spacing="0.3">${xmlEscape(subtitle)}</text>
    `);

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;

    const composited = await sharp(base)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer();

    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cachePath, composited);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(composited);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCatalogImage };
