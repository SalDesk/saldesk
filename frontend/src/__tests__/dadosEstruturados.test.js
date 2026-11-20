import { describe, it, expect } from 'vitest';
import { jsonLdExperiencia } from '../utils/dadosEstruturados';

/* Dados estruturados (schema.org) da pagina de uma experiencia: so o que e verdade */
const URL = 'https://app.saldesk.cv/book/demo/servico/u1';
const OP = { name: 'Sal Aventura', currency: 'EUR' };
const meta = (m) => JSON.stringify(m);

describe('jsonLdExperiencia', () => {
  it('jsonld_experiencia_com_preco_e_avaliacoes', () => {
    const unit = { name: 'Volta a ilha', base_price: 45, images: ['https://x/a.jpg', 'https://x/b.jpg'], description: meta({ short_pt: 'Curto', desc_pt: 'Longo' }) };
    const j = jsonLdExperiencia({ unit, op: OP, classificacao: { avg: 4.3, count: 3 }, url: URL });
    expect(j).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Volta a ilha',
      description: 'Curto',
      image: ['https://x/a.jpg', 'https://x/b.jpg'],
      url: URL,
      brand: { '@type': 'Organization', name: 'Sal Aventura' },
      offers: { '@type': 'Offer', price: 45, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: URL },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.3, reviewCount: 3 },
    });
  });

  it('sem_avaliacoes_nao_inventa_classificacao', () => {
    const j = jsonLdExperiencia({ unit: { name: 'X', base_price: 10 }, op: { ...OP, avg_rating: 4.9 }, classificacao: null, url: URL });
    expect(j).not.toHaveProperty('aggregateRating');
    const k = jsonLdExperiencia({ unit: { name: 'X', base_price: 10 }, op: OP, url: URL });
    expect(k).not.toHaveProperty('aggregateRating');
    /* uma lista de avaliacoes (que pode ser o fallback do operador) nunca chega para classificar */
    const l = jsonLdExperiencia({ unit: { name: 'X', base_price: 10 }, op: OP, reviews: [{ rating: 5 }], url: URL });
    expect(l).not.toHaveProperty('aggregateRating');
    const m = jsonLdExperiencia({ unit: { name: 'X', base_price: 10 }, op: OP, classificacao: { avg: 0, count: 0 }, url: URL });
    expect(m).not.toHaveProperty('aggregateRating');
  });

  it('sem_preco_sem_oferta', () => {
    const j = jsonLdExperiencia({ unit: { name: 'X', base_price: 0, description: meta({}) }, op: OP, url: URL });
    expect(j).not.toHaveProperty('offers');
    expect(j).not.toHaveProperty('image');
  });

  it('preco_por_escalao_ou_privado_e_moeda_cve', () => {
    const tiers = { name: 'X', base_price: 0, description: meta({ price_tiers: [{ price: 300 }, { price: 120 }], price_private: 90 }) };
    expect(jsonLdExperiencia({ unit: tiers, op: OP, url: URL }).offers.price).toBe(120);
    const priv = { name: 'X', base_price: null, description: meta({ price_private: 90 }) };
    expect(jsonLdExperiencia({ unit: priv, op: OP, url: URL }).offers.price).toBe(90);
    const cve = jsonLdExperiencia({ unit: { name: 'X', base_price: 2750 }, op: { name: 'Op', currency: 'CVE' }, url: URL });
    expect(cve.offers).toMatchObject({ price: 2750, priceCurrency: 'CVE' });
  });

  it('descricao_de_texto_simples_e_cortada', () => {
    const longo = 'a'.repeat(600);
    expect(jsonLdExperiencia({ unit: { name: 'X', description: longo }, op: OP, url: URL }).description).toHaveLength(500);
    expect(jsonLdExperiencia({ unit: { name: 'X', description: meta({ desc_pt: 'So longo' }) }, op: OP, url: URL }).description).toBe('So longo');
    expect(jsonLdExperiencia({ unit: { name: 'X', description: '' }, op: OP, url: URL })).not.toHaveProperty('description');
  });

  it('sem_unidade_devolve_null', () => {
    expect(jsonLdExperiencia({ unit: null, op: OP, url: URL })).toBeNull();
    expect(jsonLdExperiencia({ unit: { name: '' }, op: OP, url: URL })).toBeNull();
  });
});
