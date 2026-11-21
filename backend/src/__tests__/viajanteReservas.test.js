/* Area do viajante: as reservas, recibos e avaliacoes sao so as do proprio email (sem caracteres
   curinga do LIKE a misturar emails parecidos), e o lembrete de avaliacao conta como o separador. */
jest.mock('../helpers/receiptPdf', () => ({ desenharRecibo: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn().mockResolvedValue([]) }));

const BD = {};

/* LIKE do PostgreSQL: % qualquer sequencia, _ um caracter, \ escapa o seguinte */
function mockLikeParaRegex(padrao) {
  let re = '';
  for (let i = 0; i < padrao.length; i += 1) {
    const c = padrao[i];
    if (c === '\\' && i + 1 < padrao.length) { i += 1; re += padrao[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    else if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const filtros = [];
    let acao = 'select'; let dados = null;
    const b = {};
    b.select = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.eq = (k, v) => { filtros.push((r) => r[k] === v); return b; };
    b.in = (k, v) => { filtros.push((r) => v.includes(r[k])); return b; };
    b.not = (k, op, v) => { if (op === 'is' && v === null) filtros.push((r) => r[k] !== null && r[k] !== undefined); return b; };
    b.ilike = (k, padrao) => { const re = mockLikeParaRegex(padrao); filtros.push((r) => typeof r[k] === 'string' && re.test(r[k])); return b; };
    b.insert = (d) => { acao = 'insert'; dados = d; return b; };
    b.update = (d) => { acao = 'update'; dados = d; return b; };
    const linhas = () => (BD[tabela] || []).filter((r) => filtros.every((f) => f(r)));
    const resolver = () => {
      if (acao === 'insert') { const row = { id: `novo-${tabela}`, ...dados }; (BD[tabela] = BD[tabela] || []).push(row); return { data: row, error: null }; }
      if (acao === 'update') { linhas().forEach((r) => Object.assign(r, dados)); return { data: linhas()[0] || null, error: null }; }
      return { data: linhas(), error: null };
    };
    b.single = () => Promise.resolve((() => { const r = resolver(); return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null }; })());
    b.maybeSingle = b.single;
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const ctrl = require('../controllers/travelerController');

const VIAJANTE = { id: 't1', email: 'j_silva@gmail.com', email_verificado: true };
const ONTEM = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

function resposta() {
  const res = { statusCode: 200, corpo: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.corpo = j; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
async function chamar(fn, req) {
  const res = resposta(); const next = jest.fn();
  await fn({ params: {}, query: {}, body: {}, traveler: VIAJANTE, ...req }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0] || new Error('next chamado');
  return res;
}

beforeEach(() => {
  BD.reservations = [
    { id: 'r-meu', operator_id: 'o1', unit_id: 'u1', customer_email: 'J_Silva@Gmail.com', status: 'confirmed', check_in: ONTEM, check_out: ONTEM },
    { id: 'r-outro', operator_id: 'o1', unit_id: 'u1', customer_email: 'jxsilva@gmail.com', status: 'confirmed', check_in: ONTEM, check_out: ONTEM },
    { id: 'r-sem-email', operator_id: 'o1', unit_id: 'u1', customer_email: null, status: 'checked_out', check_in: ONTEM, check_out: ONTEM },
  ];
  BD.operators = [{ id: 'o1', name: 'Op', slug: 'op' }];
  BD.units = [{ id: 'u1', name: 'Tour', images: [] }];
  BD.reviews = [];
  BD.traveler_notifications = [];
  BD.traveler_wishlist = [];
});

test('reservas_so_do_proprio_email_mesmo_com_underscore', async () => {
  const res = await chamar(ctrl.getBookings);
  expect(res.corpo.data.map((r) => r.id)).toEqual(['r-meu']);
});

test('reservas_substituidas_e_pagamentos_nao_concluidos_ficam_escondidas_mas_pago_sem_lugar_nao', async () => {
  const base = { operator_id: 'o1', unit_id: 'u1', customer_email: 'j_silva@gmail.com', status: 'cancelled', check_in: ONTEM, check_out: ONTEM };
  BD.reservations.push(
    { ...base, id: 'r-subst', cancel_reason: 'replaced' },
    { ...base, id: 'r-abandonada', cancel_reason: 'payment_not_completed' },
    { ...base, id: 'r-sem-lugar', cancel_reason: 'paid_after_expiry' },
  );
  const res = await chamar(ctrl.getBookings);
  const ids = res.corpo.data.map((r) => r.id);
  expect(ids).toContain('r-sem-lugar');
  expect(ids).not.toContain('r-subst');
  expect(ids).not.toContain('r-abandonada');
});

test('recibo_de_uma_reserva_de_email_parecido_e_404', async () => {
  const res = await chamar(ctrl.getBookingInvoice, { params: { id: 'r-outro' } });
  expect(res.statusCode).toBe(404);
});

test('avaliar_reserva_de_email_parecido_ou_sem_email_e_404', async () => {
  expect((await chamar(ctrl.submitReview, { params: { reservationId: 'r-outro' }, body: { rating: 5 } })).statusCode).toBe(404);
  expect((await chamar(ctrl.submitReview, { params: { reservationId: 'r-sem-email' }, body: { rating: 5 } })).statusCode).toBe(404);
  expect(BD.reviews).toEqual([]);
});

test('lembrete_de_avaliacao_conta_as_mesmas_reservas_que_o_separador', async () => {
  /* r-meu: confirmada e ja terminou (sem check-out marcado) -- o separador deixa avaliar */
  const reservas = await chamar(ctrl.getBookings);
  expect(reservas.corpo.data.filter((r) => r.can_review).map((r) => r.id)).toEqual(['r-meu']);
  const notif = await chamar(ctrl.getNotifications);
  expect(notif.corpo.data[0]).toMatchObject({ id: 'review-reminder', content: 'Tem 1 reserva por avaliar.' });
  expect(notif.corpo.unread_count).toBe(1);
});
