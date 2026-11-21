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
const { construirPedidoPagamento, validarResposta } = require('../services/sispService');
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
const CORPO_JA_PAGA = {
  error: 'Esta reserva já está paga. Não foi feita nenhuma nova cobrança.',
  error_en: 'This booking is already paid. You have not been charged again.',
  code: 'ALREADY_PAID',
};
const TEXTO_DUPLICADO = 'Pagamento em duplicado recebido — reembolsar';

/* Cada console.error tem de ser esperado pelo teste (esperarErro) e cada erro esperado tem de
   aparecer: a saida fica limpa e um erro inesperado faz o teste falhar. */
let errosEsperados;
let espiaErro;
const esperarErro = (re) => errosEsperados.push(re);

afterEach(() => {
  const mensagens = espiaErro.mock.calls.map((a) => String(a[0]));
  espiaErro.mockRestore();
  mensagens.forEach((m) => expect(errosEsperados.some((re) => re.test(m)) ? m : `inesperado: ${m}`).toBe(m));
  errosEsperados.forEach((re) => expect(mensagens.some((m) => re.test(m)) ? 'visto' : `em falta: ${re}`).toBe('visto'));
});

beforeEach(() => {
  jest.clearAllMocks();
  errosEsperados = [];
  espiaErro = jest.spyOn(console, 'error').mockImplementation(() => {});
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

  test('ja paga: ALREADY_PAID antes de qualquer outra regra', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid' });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: false, code: 'ALREADY_PAID' });
    Object.assign(reserva(), { status: 'checked_in' });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: false, code: 'ALREADY_PAID' });
    Object.assign(reserva(), { status: 'pending' });
    expect(await prepararPagamento(supabaseAdmin, 'r1', AGORA)).toEqual({ ok: false, code: 'ALREADY_PAID' });
    expect(reserva().hold_expires_at).toBe(PRAZO_ANTIGO);
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

  test('create-intent numa reserva ja paga: 409 ALREADY_PAID e nenhuma ordem', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP0' });
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'r1' } });
    expect(createOrder).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual(CORPO_JA_PAGA);
  });

  test('confirm numa reserva ja paga: 409 ALREADY_PAID e nenhuma captura', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP0' });
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER2' } });
    expect(captureOrder).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual(CORPO_JA_PAGA);
    expect(mockBD.notifications).toHaveLength(0);
  });

  test('duas ordens capturadas: a segunda avisa o operador e nao toca na reserva', async () => {
    // Outra confirmacao paga a reserva enquanto esta captura decorre.
    captureOrder.mockImplementation(async () => {
      Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP0', amount_paid: 200 });
      return capturaDe('200.00');
    });
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER2' } });
    await esperarPromessas();
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual({
      error: 'Este pagamento foi recebido em duplicado. O operador vai reembolsá-lo.',
      error_en: 'This payment was received twice. The operator will refund it.',
      code: 'DUPLICATE_PAYMENT',
    });
    expect(reserva()).toMatchObject({ status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP0', amount_paid: 200, cancel_reason: null });
    const notif = mockBD.notifications.find((n) => n.notification_type === 'duplicate_payment');
    expect(notif).toEqual(expect.objectContaining({
      operator_id: 'op1',
      content: `${TEXTO_DUPLICADO} — Ana Lopes — Passeio de barco (CAP1)`,
      link: '/reservas/r1',
    }));
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'op@x.cv', subject: TEXTO_DUPLICADO }));
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(mockBD.notifications).toHaveLength(1);
  });

  test('a mesma captura repetida fica em silencio', async () => {
    captureOrder.mockImplementation(async () => {
      Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP1', amount_paid: 200 });
      return capturaDe('200.00');
    });
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(res.statusCode).toBe(200);
    expect(mockBD.notifications).toHaveLength(0);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  test('confirmacao do operador numa reserva ja paga com outra captura avisa e mantem a resposta', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', paypal_capture_id: 'CAP0', amount_paid: 200 });
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    const res = await chamar(ctrl.confirmPayPalPayment, {
      operator: { id: 'op1' }, body: { reservation_id: 'r1', order_id: 'ORDER2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.corpo.data.paypal_capture_id).toBe('CAP0');
    expect(mockBD.notifications.map((n) => n.notification_type)).toEqual(['duplicate_payment']);
  });

  test('segunda captura abaixo do total numa reserva ja parcial avisa o operador', async () => {
    esperarErro(/\[PayPal\] Valor capturado abaixo do total/);
    Object.assign(reserva(), { payment_status: 'partial', paypal_capture_id: 'CAP0', amount_paid: 1 });
    captureOrder.mockResolvedValue(capturaDe('1.00'));
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER2' } });
    expect(res.statusCode).toBe(409);
    expect(res.corpo.code).toBe('DUPLICATE_PAYMENT');
    expect(reserva()).toMatchObject({ payment_status: 'partial', paypal_capture_id: 'CAP0', amount_paid: 1 });
    expect(mockBD.notifications.map((n) => n.content)).toEqual([`${TEXTO_DUPLICADO} — Ana Lopes — Passeio de barco (CAP1)`]);
  });

  test('create-intent com reserva inexistente: 404', async () => {
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'nada' } });
    expect(res.statusCode).toBe(404);
    expect(createOrder).not.toHaveBeenCalled();
  });

  test('confirm com 23P01 regista pago sem lugar', async () => {
    esperarErro(/\[PayPal\] Pago sem lugar/);
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    mockBD.falharUpdate = (tabela, d) => (d.status === 'confirmed' ? { code: '23P01', message: 'conflito' } : null);
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    await esperarPromessas();
    expect(reserva().payment_status).toBe('paid');
    expect(reserva().status).toBe('cancelled');
    expect(reserva().cancel_reason).toBe('paid_after_expiry');
    expect(reserva().paypal_capture_id).toBe('CAP1');
    // O cliente nao ve "confirmado": 409 a explicar que o operador o vai contactar.
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual({
      error: 'O pagamento foi recebido, mas o lugar já tinha sido ocupado. O operador vai contactá-lo para o reembolso ou uma nova data.',
      error_en: 'Your payment was received, but the place had already been taken. The operator will contact you about a refund or a new date.',
      code: 'PAID_AFTER_EXPIRY',
    });
    const notif = mockBD.notifications.find((n) => n.notification_type === 'paid_after_expiry');
    expect(notif).toBeDefined();
    expect(notif.content).toBe('Pagamento recebido mas o lugar já foi ocupado — reembolsar ou remarcar — Ana Lopes — Passeio de barco');
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'op@x.cv', subject: notif.content }));
    // Nenhum aviso de reserva nova nem recibo para um lugar que nao existe.
    expect(mockBD.notifications.some((n) => n.notification_type === 'new_booking')).toBe(false);
    expect(enviarEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@x.cv' }));
  });

  test('confirm sem linha devolvida (reserva expirou entretanto) regista pago sem lugar', async () => {
    esperarErro(/\[PayPal\] Pago sem lugar/);
    // O operador cancela entre a verificacao e a captura.
    captureOrder.mockImplementation(async () => {
      Object.assign(reserva(), { status: 'cancelled', cancel_reason: null });
      return capturaDe('200.00');
    });
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    expect(reserva().cancel_reason).toBe('paid_after_expiry');
    expect(reserva().payment_status).toBe('paid');
    expect(res.statusCode).toBe(409);
    expect(res.corpo.code).toBe('PAID_AFTER_EXPIRY');
  });

  test('confirmacao do operador com pago sem lugar mantem a resposta de sempre', async () => {
    esperarErro(/\[PayPal\] Pago sem lugar/);
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    mockBD.falharUpdate = (tabela, d) => (d.status === 'confirmed' ? { code: '23P01', message: 'conflito' } : null);
    const res = await chamar(ctrl.confirmPayPalPayment, {
      operator: { id: 'op1' }, body: { reservation_id: 'r1', order_id: 'ORDER1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.corpo.data.cancel_reason).toBe('paid_after_expiry');
  });

  test('captura numa reserva com check-in: fica paga e continua com check-in', async () => {
    Object.assign(reserva(), { status: 'checked_in' });
    captureOrder.mockResolvedValue(capturaDe('200.00'));
    const res = await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r1', order_id: 'ORDER1' } });
    expect(res.statusCode).toBe(200);
    expect(reserva().status).toBe('checked_in');
    expect(reserva().payment_status).toBe('paid');
    expect(reserva().cancel_reason).toBeNull();
    expect(reserva().paypal_capture_id).toBe('CAP1');
    expect(reserva().paypal_order_id).toBe('ORDER1');
    expect(reserva().amount_paid).toBe(200);
    expect(mockBD.notifications.some((n) => n.notification_type === 'paid_after_expiry')).toBe(false);
  });

  test('webhook depois de um pagamento abaixo do total nao confirma nem avisa', async () => {
    Object.assign(reserva(), { paypal_order_id: 'ORDER1', payment_status: 'partial', amount_paid: 1 });
    await chamar(ctrl.paypalWebhook, {
      body: { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { supplementary_data: { related_ids: { order_id: 'ORDER1' } } } },
    });
    await esperarPromessas();
    expect(reserva().payment_status).toBe('partial');
    expect(reserva().status).toBe('pending');
    expect(mockBD.notifications).toHaveLength(0);
    expect(enviarEmail).not.toHaveBeenCalled();
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
    esperarErro(/\[PayPal\] Valor capturado abaixo do total/);
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
    esperarErro(/\[SISP Callback\] Pago sem lugar/);
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

  test('pago numa reserva com check-in: fica paga e continua com check-in', async () => {
    Object.assign(reserva(), { status: 'checked_in' });
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    expect(res.destino).toContain('/book/success');
    expect(reserva().status).toBe('checked_in');
    expect(reserva().payment_status).toBe('paid');
    expect(reserva().cancel_reason).toBeNull();
    expect(reserva().sisp_transaction_id).toBe('T1');
    expect(reserva().amount_paid).toBe(22053);
  });

  test('iniciar pagamento com lugar perdido: 409 e nenhum pedido ao banco', async () => {
    Object.assign(reserva(), { status: 'cancelled', cancel_reason: 'payment_not_completed' });
    bh.verificarDisponibilidade.mockResolvedValue(false);
    const res = await chamar(ctrl.publicInitSisp, { body: { reservation_id: 'r1' } });
    expect(construirPedidoPagamento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual({
      error: 'Este lugar já não está disponível. Não foi feita nenhuma cobrança.',
      error_en: 'This place is no longer available. You have not been charged.',
      code: 'HOLD_EXPIRED',
    });
  });

  test('iniciar pagamento numa reserva ja paga: 409 ALREADY_PAID e nenhum pedido ao banco', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', sisp_transaction_id: 'T1' });
    const res = await chamar(ctrl.publicInitSisp, { body: { reservation_id: 'r1' } });
    expect(construirPedidoPagamento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.corpo).toEqual(CORPO_JA_PAGA);
  });

  test('segunda resposta paga com outra transaccao avisa o operador e nao toca na reserva', async () => {
    Object.assign(reserva(), { status: 'confirmed', payment_status: 'paid', sisp_transaction_id: 'T1', amount_paid: 22053 });
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T2', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    await esperarPromessas();
    expect(res.destino).toBe('https://app.saldesk.cv/book/success?res=r1');
    expect(reserva()).toMatchObject({ status: 'confirmed', payment_status: 'paid', sisp_transaction_id: 'T1', cancel_reason: null });
    expect(mockBD.notifications).toEqual([expect.objectContaining({
      notification_type: 'duplicate_payment',
      content: `${TEXTO_DUPLICADO} — Ana Lopes — Passeio de barco (T2)`,
      link: '/reservas/r1',
    })]);
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'op@x.cv', subject: TEXTO_DUPLICADO }));
  });

  test('pago sem lugar e depois outra transaccao: avisa em duplicado, sem novo pago sem lugar', async () => {
    Object.assign(reserva(), {
      status: 'cancelled', payment_status: 'paid', cancel_reason: 'paid_after_expiry', sisp_transaction_id: 'T1',
    });
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T2', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    expect(res.destino).toContain('erro=lugar');
    expect(reserva().sisp_transaction_id).toBe('T1');
    expect(mockBD.notifications.map((n) => n.notification_type)).toEqual(['duplicate_payment']);
  });

  test('segunda resposta abaixo do total com outra transaccao avisa o operador', async () => {
    esperarErro(/\[SISP Callback\] Valor pago abaixo do total/);
    Object.assign(reserva(), { payment_status: 'partial', sisp_transaction_id: 'T1', amount_paid: 100 });
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T2', amount: 100 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r1' }, body: {} });
    expect(res.destino).toContain('erro=valor');
    expect(reserva().sisp_transaction_id).toBe('T1');
    expect(mockBD.notifications.map((n) => n.notification_type)).toEqual(['duplicate_payment']);
  });

  test('iniciar pagamento com o lugar retido renova o prazo e prepara o pedido', async () => {
    const res = await chamar(ctrl.publicInitSisp, { body: { reservation_id: 'r1' } });
    expect(res.statusCode).toBe(200);
    expect(construirPedidoPagamento).toHaveBeenCalledTimes(1);
    expect(reserva().hold_expires_at).not.toBe(PRAZO_ANTIGO);
  });

  test('pago abaixo do total avisa o operador com Pagamento incompleto', async () => {
    esperarErro(/\[SISP Callback\] Valor pago abaixo do total/);
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
