/* Servico do pedido de avaliacao: tarefa diaria e pedido manual.
   Base de dados falsa por tabela; e-mail e lingua simulados. */
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/languageHelper', () => ({ detectarIdioma: jest.fn(() => 'pt') }));

const estado = {};
function repor() {
  Object.assign(estado, {
    reservas: [], operadores: [], reviews: [], modelo: null,
    upserts: [], deletes: 0,
  });
}

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, op: 'select', filtros: {}, linha: null };
    ['select', 'gte', 'lte', 'order', 'limit', 'not'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.eq = jest.fn((c, v) => { b.filtros[c] = v; return b; });
    b.in = jest.fn((c, v) => { b.filtros[c] = v; return b; });
    b.upsert = jest.fn((linha) => { b.op = 'upsert'; b.linha = linha; return b; });
    b.delete = jest.fn(() => { b.op = 'delete'; return b; });
    const resolver = () => {
      if (tabela === 'reservations') return { data: estado.reservas, error: null };
      if (tabela === 'operators') return { data: estado.operadores, error: null };
      if (tabela === 'review_request_templates') return { data: estado.modelo, error: null };
      if (tabela === 'reviews') {
        if (b.op === 'upsert') {
          estado.upserts.push(b.linha);
          estado.reviews = estado.reviews.filter((r) => r.reservation_id !== b.linha.reservation_id).concat([b.linha]);
          return { data: null, error: null };
        }
        if (b.op === 'delete') { estado.deletes += 1; return { data: null, error: null }; }
        if (b.filtros.reservation_id && !Array.isArray(b.filtros.reservation_id)) {
          return { data: estado.reviews.find((r) => r.reservation_id === b.filtros.reservation_id) || null, error: null };
        }
        const ids = b.filtros.reservation_id || [];
        return { data: estado.reviews.filter((r) => ids.includes(r.reservation_id)), error: null };
      }
      return { data: null, error: null };
    };
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { enviarEmail } = require('../helpers/emailHelper');
const { detectarIdioma } = require('../helpers/languageHelper');
const { enviarPedido, enviarPedidosAutomaticos } = require('../services/pedidoAvaliacaoService');

const AGORA = new Date('2026-11-19T00:30:00Z'); // 18 nov em Cabo Verde: janela 15..17
const OP = { id: 'op1', review_auto_request: true, is_demo: false, plan_status: 'active' };
const reserva = (o) => ({
  id: 'r1', operator_id: 'op1', status: 'confirmed', source: 'public', customer_name: 'Ana Silva',
  customer_email: 'ana@exemplo.cv', customer_id: null, customer_country: 'CV', check_out: '2026-11-17',
  units: { name: 'Buggy Tour' }, ...o,
});

beforeEach(() => {
  repor();
  enviarEmail.mockReset().mockResolvedValue({ ok: true });
  detectarIdioma.mockReset().mockReturnValue('pt');
  delete process.env.FRONTEND_URL;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => console.log.mockRestore());

test('envia_pedido_a_reserva_elegivel', async () => {
  estado.reservas = [reserva()];
  estado.operadores = [OP];
  const r = await enviarPedidosAutomaticos(AGORA);
  expect(r).toEqual({ enviados: 1, ignorados: 0 });
  expect(enviarEmail).toHaveBeenCalledTimes(1);
  const email = enviarEmail.mock.calls[0][0];
  expect(email.to).toBe('ana@exemplo.cv');
  expect(email.text).toContain('https://app.saldesk.cv/review/');
  expect(email.text).toContain('Ana Silva');
  expect(email.text).toContain('Buggy Tour');
  const linha = estado.upserts[0];
  expect(linha).toMatchObject({ operator_id: 'op1', reservation_id: 'r1', rating: null, is_public: false });
  const dias = (new Date(linha.token_expires_at) - Date.now()) / 86400000;
  expect(dias).toBeGreaterThan(29.9);
  expect(dias).toBeLessThan(30.1);
  expect(email.text).toContain(linha.review_token);
});

test('ignora_ota_operador_desligado_e_ja_pedidas', async () => {
  estado.reservas = [
    reserva({ id: 'r-ota', source: 'getyourguide' }),
    reserva({ id: 'r-off', operator_id: 'op2' }),
    reserva({ id: 'r-ja' }),
  ];
  estado.operadores = [OP, { ...OP, id: 'op2', review_auto_request: false }];
  estado.reviews = [{ reservation_id: 'r-ja', rating: null, review_token: 'x' }];
  const r = await enviarPedidosAutomaticos(AGORA);
  expect(r).toEqual({ enviados: 0, ignorados: 3 });
  expect(enviarEmail).not.toHaveBeenCalled();
  expect(estado.upserts).toHaveLength(0);
});

test('segunda_corrida_nao_reenvia', async () => {
  estado.reservas = [reserva()];
  estado.operadores = [OP];
  await enviarPedidosAutomaticos(AGORA);
  const r = await enviarPedidosAutomaticos(AGORA);
  expect(r).toEqual({ enviados: 0, ignorados: 1 });
  expect(enviarEmail).toHaveBeenCalledTimes(1);
});

test('pedido_manual_nao_apaga_avaliacao', async () => {
  estado.reviews = [{ reservation_id: 'r1', rating: 5, comment: 'Excelente' }];
  const r = await enviarPedido(reserva(), { operadorId: 'op1' });
  expect(r).toEqual({ ok: false, code: 'ALREADY_REVIEWED' });
  expect(estado.upserts).toHaveLength(0);
  expect(enviarEmail).not.toHaveBeenCalled();
  expect(estado.reviews[0]).toMatchObject({ rating: 5, comment: 'Excelente' });
});

test('pedido_manual_sem_email', async () => {
  const r = await enviarPedido(reserva({ customer_email: '' }), { operadorId: 'op1' });
  expect(r).toEqual({ ok: false, code: 'NO_EMAIL' });
});

test('falha_de_email_mantem_o_pedido', async () => {
  enviarEmail.mockRejectedValue(new Error('SendGrid em baixo'));
  estado.reservas = [reserva()];
  estado.operadores = [OP];
  const r = await enviarPedidosAutomaticos(AGORA);
  expect(r).toEqual({ enviados: 1, ignorados: 0 });
  expect(estado.upserts).toHaveLength(1);
  expect(estado.deletes).toBe(0);
});

test('cliente_em_ingles_recebe_modelo_en', async () => {
  detectarIdioma.mockReturnValue('en');
  const r = await enviarPedido(reserva({ customer_country: 'GB' }), { operadorId: 'op1' });
  expect(r.ok).toBe(true);
  expect(enviarEmail.mock.calls[0][0].subject).toBe('How was it? Leave your review');
  expect(enviarEmail.mock.calls[0][0].text).toContain('Thank you for choosing Buggy Tour');
});

test('modelo_do_operador_tem_prioridade_e_campo_vazio_usa_o_omissao', async () => {
  estado.modelo = { subject_pt: 'Diga-nos tudo', body_pt: '', subject_en: null, body_en: null };
  await enviarPedido(reserva(), { operadorId: 'op1' });
  const email = enviarEmail.mock.calls[0][0];
  expect(email.subject).toBe('Diga-nos tudo');
  expect(email.text).toContain('Obrigado por ter escolhido Buggy Tour');
});
