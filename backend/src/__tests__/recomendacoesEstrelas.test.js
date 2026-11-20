/* GET /traveler/recommendations: entre experiencias com a mesma correspondencia (categoria/ilha),
   desempata pelas estrelas da PROPRIA experiencia, nunca pela media do operador. */
jest.mock('../helpers/pedidoAvaliacao', () => ({ podeAvaliarViajante: jest.fn(), hojeCaboVerde: jest.fn() }));
jest.mock('../helpers/receiptPdf', () => ({ desenharRecibo: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../config/supabase', () => {
  const tabelas = { traveler_wishlist: [{ unit_id: 'visto' }], reservations: [] };
  function construir(t) {
    const b = {};
    ['select', 'eq', 'ilike'].forEach((m) => { b[m] = () => b; });
    b.then = (ok, ko) => Promise.resolve({ data: tabelas[t] || [], error: null }).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { getDiscoverCatalog } = require('../services/discoverCatalogService');
const { getRecommendations } = require('../controllers/travelerController');

function pedir() {
  const req = { query: {}, traveler: { id: 't1', email: 'Viajante@Exemplo.cv' } };
  const res = { json: jest.fn() };
  const next = jest.fn();
  return getRecommendations(req, res, next).then(() => ({ res, next }));
}

const item = (id, extra = {}) => ({
  unit_id: id, category_id: 'cat-barco', island_id: 'i-sal', recent_bookings: 0,
  avg_rating: null, review_count: 0, unit_avg_rating: null, unit_review_count: 0, ...extra,
});

test('desempata_pelas_estrelas_da_propria_experiencia', async () => {
  getDiscoverCatalog.mockResolvedValue([
    item('visto'),
    item('operador-bom', { avg_rating: 5, review_count: 30, recent_bookings: 3 }),
    item('experiencia-avaliada', { unit_avg_rating: 4.2, unit_review_count: 3 }),
    item('sem-nada', { recent_bookings: 1 }),
  ]);
  const { res, next } = await pedir();
  expect(next).not.toHaveBeenCalled();
  const corpo = res.json.mock.calls[0][0];
  expect(corpo.personalized).toBe(true);
  expect(corpo.data.map((i) => i.unit_id)).toEqual(['experiencia-avaliada', 'operador-bom', 'sem-nada']);
});
