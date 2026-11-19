/* Dados estruturados (schema.org, JSON-LD) da pagina de uma experiencia, para o Google.
   So o que e verdade: a classificacao vem das avaliacoes DESTA experiencia (nunca da
   nota do operador) e a oferta so existe quando ha preco. Mesma prioridade de preco do
   cartao do Discover: por pessoa > escalao mais barato > preco privado.
   Spec: docs/superpowers/specs/2026-11-19-discover-filtros-google-design.md */

function lerMeta(unit) {
  const raw = unit?.description;
  if (typeof raw !== 'string' || !raw.startsWith('{')) return {};
  try { const m = JSON.parse(raw); return m && typeof m === 'object' ? m : {}; } catch { return {}; }
}

function descricao(unit, meta) {
  const raw = unit?.description;
  const texto = typeof raw === 'string' && !raw.startsWith('{')
    ? raw
    : (meta.short_pt || meta.desc_pt || meta.description || '');
  const t = String(texto || '').trim();
  return t ? t.slice(0, 500) : null;
}

function preco(unit, meta) {
  const base = Number(unit?.base_price);
  if (base > 0) return base;
  const tiers = Array.isArray(meta.price_tiers) ? meta.price_tiers : [];
  const valores = tiers.map((t) => Number(t?.price)).filter((p) => p > 0);
  if (valores.length) return Math.min(...valores);
  const priv = Number(meta.price_private);
  return priv > 0 ? priv : null;
}

/* classificacao: { avg, count } calculada pelo servidor so com avaliacoes DESTA experiencia
   (unit_rating de /units/:id/reviews); nunca a lista de avaliacoes, que pode ser a do operador */
export function jsonLdExperiencia({ unit, op, classificacao, url } = {}) {
  const nome = typeof unit?.name === 'string' ? unit.name.trim() : '';
  if (!nome) return null;
  const meta = lerMeta(unit);
  const j = { '@context': 'https://schema.org', '@type': 'Product', name: nome };
  const desc = descricao(unit, meta);
  if (desc) j.description = desc;
  const imagens = (Array.isArray(unit.images) ? unit.images : []).filter((i) => typeof i === 'string' && i);
  if (imagens.length) j.image = imagens;
  if (url) j.url = url;
  if (op?.name) j.brand = { '@type': 'Organization', name: op.name };
  const p = preco(unit, meta);
  if (p !== null) {
    j.offers = {
      '@type': 'Offer', price: p, priceCurrency: op?.currency === 'CVE' ? 'CVE' : 'EUR',
      availability: 'https://schema.org/InStock', ...(url ? { url } : {}),
    };
  }
  const media = Number(classificacao?.avg);
  const total = Number(classificacao?.count);
  if (total >= 1 && media >= 1 && media <= 5) {
    j.aggregateRating = { '@type': 'AggregateRating', ratingValue: Math.round(media * 10) / 10, reviewCount: Math.round(total) };
  }
  return j;
}
