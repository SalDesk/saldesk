/* Pagamentos respeitam o lugar retido: um pagamento tardio nunca cobra um lugar perdido;
   os avisos adiados de uma reserva com cartao saem uma so vez, quando o pagamento entra. */
jest.mock('../services/paypalService', () => ({
  createOrder: jest.fn(async () => ({ id: 'ORDER1', status: 'CREATED' })),
  captureOrder: jest.fn(),
  refundCapture: jest.fn(),
  verifyWebhookSignature: jest.fn(async () => true),
}));
jest.mock('../services/sispService', () => ({
  construirPedidoPagamento: jest.fn(() => ({ postUrl: 'https://sisp.test', fields: {} })),
  validarResposta: jest.fn(),
}));
jest.mock('../utils/encrypt', () => ({ decrypt: (v) => `dec:${v}` }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn().mockResolvedValue() }));
jest.mock('../helpers/receiptPdf', () => ({ gerarReciboBuffer: jest.fn().mockResolvedValue(Buffer.from('')) }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn().mockResolvedValue({}) }));
jest.mock('../controllers/vouchersController', () => ({ registarUsoVoucher: jest.fn().mockResolvedValue() }));
// lugarAindaLivre decide pelo bookingHelpers: o lugar livre/ocupado controla-se aqui.
jest.mock('../helpers/bookingHelpers', () => ({
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeMesa: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
  parseUnitMeta: jest.fn(() => ({})),
  hojeEHoraCaboVerde: jest.fn(() => ({ hoje: '2026-12-01', hora: '10:00' })),
  slotJaComecou: jest.fn(() => false),
  normalizarHora: (t) => (typeof t === 'string' ? t.slice(0, 5) : t),
}));

// BD em memoria: filtros eq/in/neq/lt, update condicional, insert e joins units/operators.
const mockBD = { reservations: [], operators: [], units: [], notifications: [], falharUpdate: null };
jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const filtros = [];
    let actualizar = null;
    let inserir = null;
    const b = {};
    b.select = () => b;
    b.eq = (k, v) => { filtros.push((r) => r[k] === v); return b; };
    b.neq = (k, v) => { filtros.push((r) => r[k] !== v); return b; };
    b.in = (k, vs) => { filtros.push((r) => vs.includes(r[k])); return b; };
    b.lt = (k, v) => { filtros.push((r) => r[k] < v); return b; };
    b.update = (d) => { actualizar = d; return b; };
    b.insert = (d) => { inserir = d; return b; };
    const comJoins = (l) => {
      const op = mockBD.operators.find((o) => o.id === l.operator_id);
      const un = mockBD.units.find((u) => u.id === l.unit_id);
      return { ...l, operators: op ? { ...op } : null, units: un ? { ...un } : null };
    };
    const resolver = () => {
      if (inserir) {
        (mockBD[tabela] = mockBD[tabela] || []).push(...[].concat(inserir));
        return { data: null, error: null };
      }
      const alvo = (mockBD[tabela] || []).filter((r) => filtros.every((f) => f(r)));
      if (actualizar) {
        const erro = mockBD.falharUpdate && mockBD.falharUpdate(tabela, actualizar);
        if (erro) return { data: null, error: erro };
        alvo.forEach((r) => Object.assign(r, actualizar));
      }
      const l = alvo[0] || null;
      if (!l) return { data: null, error: null };
      return { data: comJoins(l), error: null };
    };
    b.single = async () => resolver();
    b.maybeSingle = async () => resolver();
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { createOrder, captureOrder } = require('../services/paypalService');
const { validarResposta } = require('../services/sispService');
const { enviarEmail } = require('../helpers/emailHelper');
const bh = require('../helpers/bookingHelpers');
const { supabaseAdmin } = require('../config/supabase');
const { prepararPagamento } = require('../helpers/lugarRetido');
const ctrl = require('../controllers/paymentController');

function resposta() {
  const res = { statusCode: 200, corpo: null, destino: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (j) => { res.corpo = j; return res; };
  res.redirect = (u) => { res.destino = u; return res; };
  return res;
}
async function chamar(fn, req) {
  const res = resposta(); const next = jest.fn();
  await fn({ body: {}, query: {}, params: {}, headers: {}, ...req }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
}
const esperarPromessas = () => new Promise((r) => setImmediate(r));
const reserva = () => mockBD.reservations.find((x) => x.id === 'r1');
const capturaDe = (valor) => ({ purchase_units: [{ payments: { captures: [{ id: 'CAP1', amount: { value: valor } }] } }] });

const AGORA = new Date('2026-12-01T10:00:00Z');
const PRAZO_ANTIGO = '2026-12-01T09:50:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  bh.verificarDisponibilidade.mockResolvedValue(true);
  mockBD.falharUpdate = null;
  mockBD.notifications = [];
  mockBD.units = [{ id: 'u1', name: 'Passeio de barco', description: null }];
  mockBD.operators = [{
    id: 'op1', name: 'Op EUR', slug: 'op-eur', email: 'op@x.cv', currency: 'EUR', language: 'pt',
    paypal_client_id_enc: 'id', paypal_client_secret_enc: 'sec', paypal_webhook_id_enc: 'wh',
    sisp_merchant_id_enc: 'm', sisp_api_key_enc: 'k',
  }];
  mockBD.reservations = [{
    id: 'r1', operator_id: 'op1', unit_id: 'u1', source: 'public',
    customer_name: 'Ana Lopes', customer_email: 'ana@x.cv', customer_country: 'CV',
    check_in: '2026-12-05', check_out: '2026-12-05', start_time: null, duration_minutes: null,
    guests: 2, is_group_booking: false, total_price: 200,
    status: 'pending', payment_status: 'pending', payment_method: 'paypal',
    cancel_reason: null, hold_expires_at: PRAZO_ANTIGO,
  }];
});

describe('prepararPagamento', () => {
  test('reserva inexistente: NOT_FOUND', async () => {
    expect(await prepararPagamento(supabaseAdmin, 'nada', AGORA)).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  test('pendente com lugar retido: ok e o prazo avanca', async () => {
    const r = await prepararPagamento(supabaseAdmin, 'r1', AGORA);
    expect(r).toEqual({ ok: true });
    expect(reserva().hold_expires_at).toBe('2026-12-01T10:30:00.000Z');
  });

  test('expirada por falta de pagamento com o lugar livre: volta a pendente', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    const r = await prepararPagamento(supabaseAdmin, 'r1', AGORA);
    expect(r).toEqual({ ok: true });
    expect(reserva().status).toBe('pending');
    expect(reserva().cancel_reason).toBeNull();
    expect(reserva().hold_expires_at).toBe('2026-12-01T10:30:00.000Z');
  });

  test('expirada com o lugar ocupado: HOLD_EXPIRED e a linha fica igual', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    bh.verificarDisponibilidade.mockResolvedValue(false);
    const antes = { ...reserva() };
    const r = await prepararPagamento(supabaseAdmin, 'r1', AGORA);
    expect(r).toEqual({ ok: false, code: 'HOLD_EXPIRED' });
    expect(reserva()).toEqual(antes);
  });

  test('reposicao recusada pela BD (23P01): HOLD_EXPIRED', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    mockBD.falharUpdate = () => ({ code: '23P01', message: 'conflito' });
    const r = await prepararPagamento(supabaseAdmin, 'r1', AGORA);
    expect(r).toEqual({ ok: false, code: 'HOLD_EXPIRED' });
    expect(reserva().status).toBe('cancelled');
  });

  test('substituida por uma reserva mais recente: HOLD_EXPIRED', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'replaced' });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: false, code: 'HOLD_EXPIRED' });
    expect(reserva().status).toBe('cancelled');
  });

  test('cancelada pelo operador: HOLD_EXPIRED', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: null });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: false, code: 'HOLD_EXPIRED' });
    expect(reserva().status).toBe('cancelled');
  });

  test('confirmada: ok', async () => {
    Object.assign(reserva(), { status: 'confirmed', hold_expires_at: null });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: true });
  });
});

describe('PayPal', () => {
  test('lugar perdido: recusa antes de capturar', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    bh.verificarDisponibilidade.mockResolvedValue(false);
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    expect(captureOrder).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo.code).toBe('HOLD_EXPIRED');
    expect(res.corpo.error).toBe('Este lugar já não está disponível. Não foi feita nenhuma cobrança.');
    expect(res.corpo.error_en).toBe('This place is no longer available. You have not been charged.');
  });

  test('create-intent com lugar perdido não cria ordem', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'replaced' });
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'r1' } });
    expect(createOrder).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo.code).toBe('HOLD_EXPIRED');
  });

  test('create-intent com reserva inexistente: 404', async () => {
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'nada' } });
    expect(res.statusCode).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('confirm com 23P01 regista pago sem lugar', async () => {
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    mockBD.falharUpdate = (tabela, d) => (d.status === 'confirmed' ? { code: '23P01', message: 'conflito' } : null);
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(reserva().payment_status).toBe('paid');
    expect(reserva().status).toBe('cancelled');
    expect(reserva().cancel_reason).toBe('paid_after_expiry');
    expect(reserva().paypal_capture_id).toBe('CAP1');
    expect(res.corpo.data.cancel_reason).toBe('paid_after_expiry');
    const notif = mockBD.notifications.find((n) => n.notification_type === 'paid_after_expiry');
    expect(notif).toBeDefined();
    expect(notif.content).toBe('Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar — Ana Lopes — Passeio de barco');
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'op@x.cv', subject: notif.content }));
    // Nenhum aviso de reserva nova nem recibo para um lugar que nao existe.
    expect(mockBD.notifications.some((n) => n.notification_type === 'new_booking')).toBe(false);
    expect(enviarEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@x.cv' }));
  });

  test('confirm sem linha devolvida (reserva expirou entretanto) regista pago sem lugar', async () => {
    // O operador cancela entre a verificacao e a captura.
    captureOrder.mockImplementation(async () => {
      Object.assign(reserva(), { status: 'cancelled', cancel_reason: null });
      return capturaDe('200.00');
    });
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    expect(reserva().cancel_reason).toBe('paid_after_expiry');
    expect(reserva().payment_status).toBe('paid');
  });

  test('confirmação envia os avisos adiados uma vez; webhook a seguir não repete', async () => {
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(reserva().status).toBe('confirmed');
    expect(reserva().payment_status).toBe('paid');
    // 2 avisos (cliente + operador) + o recibo
    expect(enviarEmail).toHaveBeenCalledTimes(3);
    expect(mockBD.notifications.filter((n) => n.notification_type === 'new_booking')).toHaveLength(1);

    await chamar(ctrl.paypalWebhook, {
      body: { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'ORDER1' } } } },
    });
    await esperarPromessas();
    expect(enviarEmail).toHaveBeenCalledTimes(3);
    expect(mockBD.notifications.filter((n) => n.notification_type === 'new_booking')).toHaveLength(1);
  });

  test('confirm de uma reserva sem avisos adiados nao envia avisos', async () => {
    reserva().hold_expires_at = null;
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(reserva().status).toBe('confirmed');
    expect(enviarEmail).toHaveBeenCalledTimes(1); // so o recibo
    expect(mockBD.notifications).toHaveLength(0);
  });

  test('pagamento abaixo do total avisa o operador com Pagamento incompleto', async () => {
    captureOrder.mockResolvedValue(capturaDe('1.00'));
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(reserva().payment_status).toBe('partial');
    expect(reserva().status).toBe('pending');
    const notif = mockBD.notifications.find((n) => n.notification_type === 'new_booking');
    expect(notif.content.endsWith('Pagamento incompleto — verificar')).toBe(true);
    expect(enviarEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@x.cv' }));
  });

  test('webhook com a reserva por pagar confirma e envia os avisos adiados', async () => {
    reserva().paypal_order_id = 'ORDER1';
    await chamar(ctrl.paypalWebhook, {
      body: { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'ORDER1' } } } },
    });
    await esperarPromessas();
    expect(reserva().status).toBe('confirmed');
    expect(mockBD.notifications.filter((n) => n.notification_type === 'new_booking')).toHaveLength(1);
  });

  test('webhook nao ressuscita uma reserva paga sem lugar', async () => {
    Object.assign(reserva(), {
      paypal_order_id: 'ORDER1', status: 'cancelled', payment_status: 'paid', cancel_reason: 'paid_after_expiry',
    });
    await chamar(ctrl.paypalWebhook, {
      body: { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'ORDER1' } } } },
    });
    await esperarPromessas();
    expect(reserva().status).toBe('cancelled');
    expect(mockBD.notifications).toHaveLength(0);
  });
});

describe('SISP', () => {
  beforeEach(() => { reserva().payment_method = 'sisp'; });

  test('pago com lugar perdido', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    bh.verificarDisponibilidade.mockResolvedValue(false);
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    await esperarPromessas();
    expect(res.destino).toContain('/book/cancel?res=r1&erro=lugar');
    expect(reserva().cancel_reason).toBe('paid_after_expiry');
    expect(reserva().payment_status).toBe('paid');
    expect(reserva().sisp_transaction_id).toBe('T1');
    expect(mockBD.notifications.some((n) => n.notification_type === 'paid_after_expiry')).toBe(true);
  });

  test('pago com o total confirma e envia os avisos adiados uma vez', async () => {
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    await esperarPromessas();
    expect(res.destino).toContain('/book/success');
    expect(reserva().status).toBe('confirmed');
    expect(enviarEmail).toHaveBeenCalledTimes(3);
    // A SISP volta a chamar: nada se repete.
    const res2 = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    await esperarPromessas();
    expect(res2.destino).toContain('/book/success');
    expect(enviarEmail).toHaveBeenCalledTimes(3);
    expect(mockBD.notifications.filter((n) => n.notification_type === 'new_booking')).toHaveLength(1);
  });

  test('pago abaixo do total avisa o operador com Pagamento incompleto', async () => {
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 100 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    await esperarPromessas();
    expect(res.destino).toContain('erro=valor');
    expect(reserva().payment_status).toBe('partial');
    const notif = mockBD.notifications.find((n) => n.notification_type === 'new_booking');
    expect(notif.content.endsWith('Pagamento incompleto — verificar')).toBe(true);
    expect(enviarEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@x.cv' }));
  });
});
