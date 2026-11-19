/* Prazo de cancelamento gratis e confirmacao automatica por operador. */
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/emailTemplates', () => ({ operatorWelcomeEmail: jest.fn() }));

const estado = { atualizacao: null };
jest.mock('../config/supabase', () => {
  const b = {};
  ['from', 'eq', 'select'].forEach((m) => { b[m] = jest.fn(() => b); });
  b.update = jest.fn((valores) => { estado.atualizacao = valores; return b; });
  b.single = jest.fn(() => Promise.resolve({ data: { id: 'op1', ...estado.atualizacao }, error: null }));
  return { supabaseAdmin: b };
});

const { supabaseAdmin } = require('../config/supabase');
const { updateOperator } = require('../controllers/onboardingController');
const { HORAS_CANCELAMENTO, validarHorasCancelamento, estadoInicialReserva } = require('../helpers/politicaOperador');

async function guardar(corpo) {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  await updateOperator({ operator: { id: 'op1', name: 'Sal Aventura', slug: 'sal-aventura' }, body: corpo }, res, jest.fn());
  return res;
}

beforeEach(() => { jest.clearAllMocks(); estado.atualizacao = null; });

test('prazos_validos', () => {
  expect(HORAS_CANCELAMENTO).toEqual([0, 24, 48, 72, 168]);
  [[null, null], ['', null], [0, 0], [24, 24], ['48', 48], [72, 72], [168, 168]]
    .forEach(([v, esperado]) => expect(validarHorasCancelamento(v)).toEqual({ ok: true, valor: esperado }));
});

test('prazo_invalido_e_recusado', () => {
  [36, -1, 'abc', 24.5, true, {}, []].forEach((v) => expect(validarHorasCancelamento(v)).toEqual({ ok: false }));
});

test('pagar_presencialmente_com_confirmacao_automatica_confirma', () => {
  expect(estadoInicialReserva({ autoConfirm: true, paymentMethod: 'cash' })).toBe('confirmed');
});

test('pagamento_online_nunca_confirma_sozinho', () => {
  ['paypal', 'sisp', undefined, 'outro'].forEach((m) => expect(estadoInicialReserva({ autoConfirm: true, paymentMethod: m })).toBe('pending'));
  [false, undefined, null].forEach((a) => expect(estadoInicialReserva({ autoConfirm: a, paymentMethod: 'cash' })).toBe('pending'));
});

test('perfil_grava_e_valida_os_campos_novos', async () => {
  let res = await guardar({ free_cancellation_hours: 48, auto_confirm_bookings: true });
  expect(res.status).not.toHaveBeenCalled();
  expect(estado.atualizacao).toMatchObject({ free_cancellation_hours: 48, auto_confirm_bookings: true });

  estado.atualizacao = null;
  await guardar({ free_cancellation_hours: null });
  expect(estado.atualizacao).toHaveProperty('free_cancellation_hours', null);

  supabaseAdmin.update.mockClear();
  res = await guardar({ free_cancellation_hours: 36 });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].code).toBe('INVALID_FREE_CANCELLATION');
  expect(supabaseAdmin.update).not.toHaveBeenCalled();

  res = await guardar({ auto_confirm_bookings: 'sim' });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].code).toBe('INVALID_AUTO_CONFIRM');
  expect(supabaseAdmin.update).not.toHaveBeenCalled();

  estado.atualizacao = null;
  await guardar({ tagline: 'Novo' });
  expect(estado.atualizacao).not.toHaveProperty('free_cancellation_hours');
  expect(estado.atualizacao).not.toHaveProperty('auto_confirm_bookings');
});
