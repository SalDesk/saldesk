const { supabaseAdmin } = require('../config/supabase');
const { frontendBase } = require('../utils/urls');

/* Pre-renderizacao minima para crawlers de redes sociais (Facebook, WhatsApp,
   Twitter/X, LinkedIn, etc.) -- estes NUNCA executam JavaScript ao gerar a
   pre-visualizacao de um link partilhado, por isso as tags og: / twitter:
   injectadas via JS em runtime (injectSeo() em PublicBooking.jsx) sao
   invisiveis para eles. Esta rota so e alcancada via nginx (location
   ~ ^/book/ com deteccao de User-Agent de bot conhecido) -- visitantes
   humanos continuam a receber sempre a SPA React normal, nunca isto. */

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* unit.description guarda um JSON de metadados (tour/quarto/viatura/mesa) --
   mesmo parser generico ja usado no frontend (getUnitDescription em
   ServiceDetail.jsx), extrai so o texto legivel em PT. */
function unitDescriptionText(unit) {
  const raw = unit?.description;
  if (!raw) return '';
  if (raw.startsWith('{')) {
    try {
      const meta = JSON.parse(raw);
      return meta.short_pt || meta.desc_pt || meta.description || '';
    } catch { return ''; }
  }
  return raw;
}

function renderPreviewHtml({ title, description, image, url }) {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
</body>
</html>`;
}

async function previewOperator(req, res) {
  try {
    const { slug } = req.params;
    const { data: op } = await supabaseAdmin
      .from('operators')
      .select('name, business_name, description, logo_url, address, islands(name)')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .maybeSingle();

    const base = frontendBase();
    const url = `${base}/book/${slug}`;
    if (!op) {
      return res.status(404).type('html').send(renderPreviewHtml({
        title: 'SalDesk', description: 'Reservas directas em Cabo Verde.', image: null, url,
      }));
    }
    const name = op.business_name || op.name;
    const locality = op.address || op.islands?.name || 'Cabo Verde';
    const description = op.description || `Reserve directamente em ${name}, ${locality}.`;

    return res.type('html').send(renderPreviewHtml({
      title: `${name} — Reservar · SalDesk`,
      description,
      image: op.logo_url || null,
      url,
    }));
  } catch (err) {
    return res.status(500).type('html').send(renderPreviewHtml({
      title: 'SalDesk', description: 'Reservas directas em Cabo Verde.', image: null, url: frontendBase(),
    }));
  }
}

async function previewUnit(req, res) {
  try {
    const { slug, unitId } = req.params;
    const { data: op } = await supabaseAdmin
      .from('operators')
      .select('id, name, business_name, logo_url')
      .eq('slug', slug)
      .eq('onboarding_complete', true)
      .maybeSingle();

    const base = frontendBase();
    const url = `${base}/book/${slug}/servico/${unitId}`;

    if (!op) {
      return res.status(404).type('html').send(renderPreviewHtml({
        title: 'SalDesk', description: 'Reservas directas em Cabo Verde.', image: null, url,
      }));
    }

    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('name, description, images, base_price, price_unit')
      .eq('id', unitId)
      .eq('operator_id', op.id)
      .eq('status', 'active')
      .maybeSingle();

    const opName = op.business_name || op.name;
    if (!unit) {
      return res.status(404).type('html').send(renderPreviewHtml({
        title: `${opName} · SalDesk`, description: `Reserve directamente em ${opName}.`, image: op.logo_url || null, url,
      }));
    }

    const desc = unitDescriptionText(unit) || `Reserve "${unit.name}" directamente em ${opName}, sem comissões.`;
    const image = Array.isArray(unit.images) && unit.images[0] ? unit.images[0] : (op.logo_url || null);

    return res.type('html').send(renderPreviewHtml({
      title: `${unit.name} — ${opName} · SalDesk`,
      description: desc,
      image,
      url,
    }));
  } catch (err) {
    return res.status(500).type('html').send(renderPreviewHtml({
      title: 'SalDesk', description: 'Reservas directas em Cabo Verde.', image: null, url: frontendBase(),
    }));
  }
}

module.exports = { previewOperator, previewUnit };
