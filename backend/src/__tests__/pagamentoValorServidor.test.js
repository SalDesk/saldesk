/* Pagamento online da pagina publica: o valor a cobrar vem da reserva guardada no servidor
   (total_price na moeda do operador), nunca do browser; e um pagamento abaixo do total nao
   confirma a reserva. */
jest.mock('../services/paypalService', () => ({
  createOrder: jest.fn(async () => ({ id: 'ORDER1', status: 'CREATED' })),
  captureOrder: jest.fn(),
  refundCapture: jest.fn(),
  verifyWebhookSignature: jest.fn(),
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

const mockBD = { reservations: [], operators: [] };
jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const filtros = [];
    let actualizar = null;
    const b = {};
    b.select = () => b;
    b.eq = (k, v) => { filtros.push((r) => r[k] === v); return b; };
    b.neq = (k, v) => { filtros.push((r) => r[k] !== v); return b; };
    b.in = (k, vs) => { filtros.push((r) => vs.includes(r[k])); return b; };
    b.update = (d) => { actualizar = d; return b; };
    const linhas = () => (mockBD[tabela] || []).filter((r) => filtros.every((f) => f(r)));
    const resolver = () => {
      // Como o PostgREST: devolve as linhas que os filtros apanharam antes do update.
      const alvo = linhas();
      if (actualizar) alvo.forEach((r) => Object.assign(r, actualizar));
      const l = alvo[0] || null;
      if (!l) return { data: null, error: null };
      const op = mockBD.operators.find((o) => o.id === l.operator_id);
      return { data: { ...l, operators: op ? { ...op } : null }, error: null };
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
  await fn({ body: {}, query: {}, params: {}, ...req }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBD.operators = [
    { id: 'op-eur', name: 'Op EUR', currency: 'EUR', paypal_client_id_enc: 'id', paypal_client_secret_enc: 'sec', sisp_merchant_id_enc: 'm', sisp_api_key_enc: 'k' },
    { id: 'op-cve', name: 'Op CVE', currency: 'CVE', paypal_client_id_enc: 'id', paypal_client_secret_enc: 'sec', sisp_merchant_id_enc: 'm', sisp_api_key_enc: 'k' },
  ];
  mockBD.reservations = [
    { id: 'r-eur', operator_id: 'op-eur', total_price: 200, status: 'pending', payment_status: 'pending', customer_email: 'a@x.cv' },
    { id: 'r-cve', operator_id: 'op-cve', total_price: 11026.5, status: 'pending', payment_status: 'pending', customer_email: 'b@x.cv' },
  ];
});

describe('PayPal na pagina publica', () => {
  it('cobra o total da reserva em euros e ignora o valor do browser', async () => {
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'r-eur', amount: 1 } });
    expect(res.statusCode).toBe(200);
    // O id da reserva vai na ordem (custom_id) para o webhook a encontrar
    expect(createOrder).toHaveBeenCalledWith('dec:id', 'dec:sec', '200.00', 'EUR', expect.any(String), 'r-eur');
  });

  it('operador em escudos: converte o total para euros', async () => {
    await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'r-cve', amount: 1 } });
    expect(createOrder.mock.calls[0][2]).toBe('100.00');
  });

  it('o browser ja nao precisa de mandar o valor', async () => {
    const res = await chamar(ctrl.publicCreatePaypalIntent, { body: { reservation_id: 'r-eur' } });
    expect(res.statusCode).toBe(200);
    expect(createOrder.mock.calls[0][2]).toBe('200.00');
  });

  it('pagamento capturado abaixo do total nao confirma a reserva', async () => {
    captureOrder.mockResolvedValue({ purchase_units: [{ payments: { captures: [{ id: 'CAP', amount: { value: '1.00' } }] } }] });
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r-eur', order_id: 'ORDER1' } });
    const r = mockBD.reservations.find((x) => x.id === 'r-eur');
    expect(r.status).toBe('pending');
    expect(r.payment_status).toBe('partial');
    expect(r.amount_paid).toBe(1);
  });

  it('pagamento do total confirma a reserva', async () => {
    captureOrder.mockResolvedValue({ purchase_units: [{ payments: { captures: [{ id: 'CAP', amount: { value: '200.00' } }] } }] });
    await chamar(ctrl.publicConfirmPaypalPayment, { body: { reservation_id: 'r-eur', order_id: 'ORDER1' } });
    const r = mockBD.reservations.find((x) => x.id === 'r-eur');
    expect(r.status).toBe('confirmed');
    expect(r.payment_status).toBe('paid');
  });
});

describe('SISP na pagina publica', () => {
  it('cobra o total da reserva em escudos e ignora o valor do browser', async () => {
    await chamar(ctrl.publicInitSisp, { body: { reservation_id: 'r-eur', amount: 1 } });
    expect(construirPedidoPagamento.mock.calls[0][0].amount).toBe(22053);
    construirPedidoPagamento.mockClear();
    await chamar(ctrl.publicInitSisp, { body: { reservation_id: 'r-cve' } });
    expect(construirPedidoPagamento.mock.calls[0][0].amount).toBe(11027);
  });

  it('resposta paga abaixo do total nao confirma a reserva', async () => {
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 100 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r-eur' }, body: {} });
    const r = mockBD.reservations.find((x) => x.id === 'r-eur');
    expect(r.status).toBe('pending');
    expect(r.payment_status).toBe('partial');
    expect(res.destino).toContain('/book/cancel');
  });

  it('resposta paga com o total confirma a reserva', async () => {
    validarResposta.mockReturnValue({ status: 'paid', transactionID: 'T1', amount: 22053 });
    const res = await chamar(ctrl.sispCallback, { query: { res: 'r-eur' }, body: {} });
    const r = mockBD.reservations.find((x) => x.id === 'r-eur');
    expect(r.status).toBe('confirmed');
    expect(res.destino).toContain('/book/success');
  });
});
