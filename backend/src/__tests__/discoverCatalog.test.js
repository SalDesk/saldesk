/* getDiscoverCatalog de ponta a ponta sobre uma base falsa: operadores, unidades, avaliacoes
   publicas (com a unidade da reserva), reservas recentes e bloqueios. Garante que cada cartao
   leva a classificacao da propria experiencia e o operador a sua media, e que os filtros do
   catalogo (operador demo, unidades nao publicadas, mesas de restaurante) se mantem. */

const BD = {};

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const filtros = [];
    let intervalo = null;
    const b = {};
    b.select = () => b;
    b.order = () => b;
    b.eq = (k, v) => { filtros.push((r) => r[k] === v); return b; };
    b.in = (k, v) => { filtros.push((r) => v.includes(r[k])); return b; };
    b.not = (k, op, v) => {
      if (op === 'is' && v === null) filtros.push((r) => r[k] !== null && r[k] !== undefined);
      if (op === 'in') { const lista = String(v).replace(/[()]/g, '').split(','); filtros.push((r) => !lista.includes(r[k])); }
      return b;
    };
    ['gte', 'lte', 'lt', 'gt'].forEach((m) => { b[m] = () => b; });
    b.range = (de, ate) => { intervalo = [de, ate]; return b; };
    const resolver = () => {
      let linhas = (BD[tabela] || []).filter((r) => filtros.every((f) => f(r)));
      if (intervalo) linhas = linhas.slice(intervalo[0], intervalo[1] + 1);
      return { data: linhas, error: null };
    };
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { getDiscoverCatalog } = require('../services/discoverCatalogService');

const op = (id, extra = {}) => ({
  id, name: `Op ${id}`, slug: id, operator_type: 'activity', address: null, currency: 'EUR',
  island_id: 'i-sal', islands: { name: 'Sal', slug: 'sal' }, free_cancellation_hours: null,
  auto_confirm_bookings: false, onboarding_complete: true, is_demo: false, ...extra,
});
const unidade = (id, operatorId, extra = {}) => ({
  id, operator_id: operatorId, unit_type: 'Tour', name: `Unidade ${id}`, description: '{}',
  base_price: 40, images: [], created_at: '2026-10-01T00:00:00Z', duration_minutes: 120,
  languages_offered: ['pt'], lat: null, lng: null, category_id: null, experience_categories: null,
  status: 'active', conect_status: 'published', ...extra,
});
const avaliacao = (operatorId, unitId, rating, extra = {}) => ({
  operator_id: operatorId, rating, reservation_id: `r-${unitId}-${rating}`,
  reservations: unitId ? { unit_id: unitId } : null, is_public: true, ...extra,
});

beforeEach(() => {
  BD.operators = [op('a'), op('b'), op('demo', { is_demo: true }), op('rest', { operator_type: 'restaurant' })];
  BD.units = [
    unidade('a1', 'a'), unidade('a2', 'a'), unidade('b1', 'b'),
    unidade('a-rascunho', 'a', { conect_status: 'draft' }),
    unidade('demo1', 'demo'),
    unidade('mesa1', 'rest', { unit_type: 'table' }),
    unidade('prato1', 'rest', { unit_type: 'menu_item' }),
  ];
  BD.reviews = [
    avaliacao('a', 'a1', 5), avaliacao('a', 'a1', 4),
    avaliacao('a', null, 3), /* sem reserva conhecida: conta para o operador, nao para a unidade */
    avaliacao('a', 'a2', 2, { is_public: false }),
    avaliacao('demo', 'demo1', 5),
  ];
  BD.reservations = [];
  BD.blocked_dates = [];
});

test('cada_cartao_leva_a_classificacao_da_propria_experiencia', async () => {
  const cat = await getDiscoverCatalog();
  const por = Object.fromEntries(cat.map((c) => [c.unit_id, c]));
  expect(por.a1.unit_avg_rating).toBe(4.5);
  expect(por.a1.unit_review_count).toBe(2);
  expect(por.a2.unit_avg_rating).toBeNull();
  expect(por.a2.unit_review_count).toBe(0);
  expect(por.b1.unit_avg_rating).toBeNull();
});

test('a_media_do_operador_fica_no_operador', async () => {
  const cat = await getDiscoverCatalog();
  const a2 = cat.find((c) => c.unit_id === 'a2');
  expect(a2.avg_rating).toBe(4);
  expect(a2.review_count).toBe(3);
  expect(cat.find((c) => c.unit_id === 'b1').avg_rating).toBeNull();
});

test('o_catalogo_deixa_de_fora_demo_rascunhos_e_mesas', async () => {
  const ids = (await getDiscoverCatalog()).map((c) => c.unit_id).sort();
  expect(ids).toEqual(['a1', 'a2', 'b1', 'prato1']);
});

test('avaliacoes_lidas_por_paginas_contam_todas', async () => {
  BD.reviews = Array.from({ length: 2300 }, (_, i) => avaliacao('b', 'b1', i % 2 ? 4 : 5, { reservation_id: `r${i}` }));
  const b1 = (await getDiscoverCatalog()).find((c) => c.unit_id === 'b1');
  expect(b1.unit_review_count).toBe(2300);
  expect(b1.unit_avg_rating).toBe(4.5);
});
