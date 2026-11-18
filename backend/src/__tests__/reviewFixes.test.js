/* Correcoes da revisao final do pedido automatico de avaliacao:
   - o link do WhatsApp nunca apaga uma avaliacao dada e reaproveita um pedido por responder;
   - a lista do operador (GET /reviews) so mostra avaliacoes dadas;
   - o envio publico valida a nota e o comentario e ignora staff_id. */
jest.mock('../services/pedidoAvaliacaoService', () => ({ enviarPedido: jest.fn() }));

const estado = {};
function repor() {
  Object.assign(estado, { existente: null, upserts: [], updates: [], nots: [], review: null, staff: null });
}

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, op: 'select', filtros: {}, linha: null };
    ['select', 'order', 'limit', 'gte', 'in'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.eq = jest.fn((c, v) => { b.filtros[c] = v; return b; });
    b.not = jest.fn((...a) => { estado.nots.push([tabela, ...a]); return b; });
    b.upsert = jest.fn((l) => { b.op = 'upsert'; b.linha = l; return b; });
    b.update = jest.fn((l) => { b.op = 'update'; b.linha = l; return b; });
    b.insert = jest.fn((l) => { b.op = 'insert'; b.linha = l; return b; });
    const resolver = () => {
      if (b.op === 'upsert') { estado.upserts.push(b.linha); return { data: null, error: null }; }
      if (b.op === 'update') { estado.updates.push({ tabela, linha: b.linha }); return { data: { id: 'rv1', operator_id: 'op1', ...b.linha }, error: null }; }
      if (b.op === 'insert') return { data: null, error: null };
      if (tabela === 'reviews' && b.filtros.review_token) return { data: estado.review, error: null };
      if (tabela === 'reviews' && b.filtros.reservation_id) return { data: estado.existente, error: null };
      if (tabela === 'reviews') return { data: [], error: null };
      if (tabela === 'staff') return { data: estado.staff, error: null };
      return { data: null, error: null };
    };
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { criarLinkAvaliacao } = require('../messaging/context');
const { listar, submitReview } = require('../controllers/reviewController');

function resFalso() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
const daqui = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
const TOKEN = 'f'.repeat(40);

beforeEach(repor);

describe('link de avaliacao do WhatsApp', () => {
  it('whatsapp_nunca_apaga_avaliacao_dada', async () => {
    estado.existente = { id: 'rv1', rating: 5, review_token: null, token_expires_at: null };
    await expect(criarLinkAvaliacao('op1', { id: 'r1' })).rejects.toMatchObject({ status: 409, code: 'ALREADY_REVIEWED' });
    expect(estado.upserts).toHaveLength(0);
  });

  it('whatsapp_reaproveita_o_pedido_por_responder', async () => {
    estado.existente = { id: 'rv1', rating: null, review_token: TOKEN, token_expires_at: daqui(20) };
    const link = await criarLinkAvaliacao('op1', { id: 'r1' });
    expect(link).toBe(`https://app.saldesk.cv/review/${TOKEN}`);
    expect(estado.upserts).toHaveLength(0);
  });

  it('whatsapp_sem_pedido_cria_link_de_30_dias', async () => {
    const link = await criarLinkAvaliacao('op1', { id: 'r1', customer_id: 'c1' });
    expect(link).toMatch(/\/review\/[a-f0-9]{40}$/);
    const dias = (new Date(estado.upserts[0].token_expires_at) - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(29.9);
    expect(estado.upserts[0]).toMatchObject({ rating: null, is_public: false, reservation_id: 'r1' });
  });
});

describe('lista do operador', () => {
  it('lista_so_mostra_avaliacoes_dadas', async () => {
    const res = resFalso();
    await listar({ query: {}, operator: { id: 'op1' } }, res, jest.fn());
    expect(estado.nots).toContainEqual(['reviews', 'rating', 'is', null]);
  });
});

describe('envio publico da avaliacao', () => {
  beforeEach(() => { estado.review = { id: 'rv1', token_expires_at: daqui(5) }; });

  it('nota_tem_de_ser_inteiro_de_1_a_5', async () => {
    for (const rating of ['x', 0, 6, 3.5]) {
      const res = resFalso();
      await submitReview({ body: { token: TOKEN, rating } }, res, jest.fn());
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_RATING');
    }
    expect(estado.updates).toHaveLength(0);
  });

  it('comentario_com_mais_de_1000_caracteres_e_recusado', async () => {
    const res = resFalso();
    await submitReview({ body: { token: TOKEN, rating: 5, comment: 'a'.repeat(1001) } }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('COMMENT_TOO_LONG');
  });

  it('envio_publico_ignora_staff_id', async () => {
    estado.staff = { average_rating: 4, total_jobs_completed: 2 };
    const res = resFalso();
    await submitReview({ body: { token: TOKEN, rating: '4', comment: 'Bom', staff_id: 'staff-de-outra-conta' } }, res, jest.fn());
    expect(res.statusCode).toBe(200);
    const upd = estado.updates.find((u) => u.tabela === 'reviews');
    expect(upd.linha).toMatchObject({ rating: 4, comment: 'Bom', is_public: true });
    expect(upd.linha.staff_id ?? null).toBeNull();
    expect(estado.updates.some((u) => u.tabela === 'staff')).toBe(false);
  });
});
