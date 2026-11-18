/* Link publico de avaliacao (GET /reviews/token/:token), definicao do pedido automatico
   (GET/PUT /reviews/settings) e avaliacao por viajantes sem check-out. */
jest.mock('../services/pedidoAvaliacaoService', () => ({ enviarPedido: jest.fn() }));

const estado = {};
function repor() {
  Object.assign(estado, { review: null, operador: null, reserva: null, updates: [], inserts: [], reviewDaReserva: null });
}

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, op: 'select', filtros: {}, linha: null };
    ['select', 'order', 'limit', 'not', 'ilike', 'in'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.eq = jest.fn((c, v) => { b.filtros[c] = v; return b; });
    b.update = jest.fn((l) => { b.op = 'update'; b.linha = l; return b; });
    b.insert = jest.fn((l) => { b.op = 'insert'; b.linha = l; return b; });
    const resolver = () => {
      if (b.op === 'update') { estado.updates.push({ tabela, linha: b.linha, filtros: b.filtros }); return { data: { id: 'x', ...b.linha }, error: null }; }
      if (b.op === 'insert') { estado.inserts.push({ tabela, linha: b.linha }); return { data: { id: 'n', ...b.linha }, error: null }; }
      if (tabela === 'reviews' && b.filtros.review_token) return { data: estado.review, error: null };
      if (tabela === 'reviews') return { data: estado.reviewDaReserva, error: null };
      if (tabela === 'operators') return { data: estado.operador, error: null };
      if (tabela === 'reservations') return { data: estado.reserva, error: null };
      return { data: null, error: null };
    };
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { tokenInfo, obterDefinicoes, guardarDefinicoes } = require('../controllers/reviewController');
const traveler = require('../controllers/travelerController');

function resFalso() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
const TOKEN = 'a'.repeat(40);
const ontem = () => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); };
const daqui = (dias) => new Date(Date.now() + dias * 86400000).toISOString();

beforeEach(repor);

test('token_valido_devolve_so_o_necessario', async () => {
  estado.review = { review_token: TOKEN, token_expires_at: daqui(10), operator_id: 'op1', reservation_id: 'res-123' };
  estado.operador = { name: 'Logan Tours', slug: 'loganislandtours', brand_color: '#0d5470' };
  estado.reserva = { customer_name: 'Ana Silva', customer_email: 'ana@exemplo.cv', customer_phone: '+2389999999', customer_country: 'GB', total_price: 120, check_in: '2026-11-17', units: { name: 'Turtle Watch' } };
  const res = resFalso();
  await tokenInfo({ params: { token: TOKEN } }, res, jest.fn());
  expect(res.body.data).toEqual({
    estado: 'ok',
    operador: { name: 'Logan Tours', slug: 'loganislandtours', brand_color: '#0d5470' },
    unidade: 'Turtle Watch', data: '2026-11-17', cliente: 'Ana', lingua: 'en',
  });
  const texto = JSON.stringify(res.body);
  ['ana@exemplo.cv', '+2389999999', '120', 'res-123', 'op1'].forEach((s) => expect(texto).not.toContain(s));
});

test('token_expirado_e_invalido', async () => {
  estado.review = { review_token: TOKEN, token_expires_at: daqui(-1), operator_id: 'op1', reservation_id: 'r' };
  estado.operador = { name: 'Logan Tours', slug: 'loganislandtours', brand_color: null };
  let res = resFalso();
  await tokenInfo({ params: { token: TOKEN } }, res, jest.fn());
  expect(res.body.data).toEqual({ estado: 'expirado', operador: { name: 'Logan Tours', slug: 'loganislandtours', brand_color: null } });

  estado.review = null;
  res = resFalso();
  await tokenInfo({ params: { token: TOKEN } }, res, jest.fn());
  expect(res.body.data).toEqual({ estado: 'invalido' });

  /* formato estranho nem chega a base de dados */
  res = resFalso();
  await tokenInfo({ params: { token: 'x; drop' } }, res, jest.fn());
  expect(res.body.data).toEqual({ estado: 'invalido' });
});

test('definicoes_le_e_grava_booleano', async () => {
  estado.operador = { review_auto_request: null };
  let res = resFalso();
  await obterDefinicoes({ operator: { id: 'op1' } }, res, jest.fn());
  expect(res.body.data).toEqual({ review_auto_request: true });

  res = resFalso();
  await guardarDefinicoes({ operator: { id: 'op1' }, body: { review_auto_request: false } }, res, jest.fn());
  expect(estado.updates[0]).toMatchObject({ tabela: 'operators', linha: { review_auto_request: false }, filtros: { id: 'op1' } });
  expect(res.body.data).toEqual({ review_auto_request: false });

  res = resFalso();
  await guardarDefinicoes({ operator: { id: 'op1' }, body: { review_auto_request: 'nao' } }, res, jest.fn());
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('INVALID_VALUE');
  expect(estado.updates).toHaveLength(1);
});

test('viajante_avalia_reserva_confirmada_passada', async () => {
  estado.reserva = { id: 'r1', operator_id: 'op1', customer_email: 'ana@exemplo.cv', status: 'confirmed', check_out: ontem() };
  let res = resFalso();
  await traveler.submitReview({ params: { reservationId: 'r1' }, body: { rating: 5, comment: 'Top' }, traveler: { email: 'ANA@exemplo.cv' } }, res, jest.fn());
  expect(res.statusCode).toBe(201);
  expect(estado.inserts[0]).toMatchObject({ tabela: 'reviews', linha: { rating: 5, reservation_id: 'r1', is_public: true } });

  estado.reserva = { ...estado.reserva, check_out: new Date().toLocaleDateString('en-CA', { timeZone: 'Atlantic/Cape_Verde' }) };
  res = resFalso();
  await traveler.submitReview({ params: { reservationId: 'r1' }, body: { rating: 5 }, traveler: { email: 'ana@exemplo.cv' } }, res, jest.fn());
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('INVALID_STATUS');
});
