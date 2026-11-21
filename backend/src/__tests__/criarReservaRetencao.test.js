/* Reserva publica com cartao: guarda o lugar 30 minutos e so avisa depois do pagamento. */
jest.mock('../helpers/bookingHelpers', () => ({
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
  parseUnitMeta: jest.fn(() => ({})),
  calcularPreco: jest.fn(),
  DEFAULT_SEATING_MINUTES: 90,
  precoActividade: jest.requireActual('../helpers/bookingHelpers').precoActividade,
}));
jest.mock('../helpers/customerHelper', () => ({ obterOuCriarCliente: jest.fn(() => Promise.resolve({ id: 'cli1' })) }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn(() => Promise.resolve()) }));
jest.mock('../helpers/languageHelper', () => ({ detectarIdioma: jest.fn(() => 'pt') }));
jest.mock('../helpers/emailTemplates', () => ({
  confirmacaoClienteEmail: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })),
  notificacaoOperadorEmail: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })),
}));
jest.mock('../controllers/vouchersController', () => ({
  validarVoucher: jest.fn(() => Promise.resolve({ valid: true, discount: 10, voucherId: 'v1' })),
  registarUsoVoucher: jest.fn(() => Promise.resolve()),
}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn(() => Promise.resolve()) }));

const estado = { operador: null, inseridas: [], notificacoes: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, linha: null };
    ['select', 'eq', 'order', 'in', 'limit', 'or', 'gte', 'ilike'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.insert = jest.fn((linha) => {
      b.linha = linha;
      if (tabela === 'reservations') estado.inseridas.push(linha);
      if (tabela === 'notifications') estado.notificacoes.push(linha);
      return b;
    });
    const resolver = () => {
      if (tabela === 'operators') return { data: estado.operador, error: null };
      if (tabela === 'units') return { data: { id: 'u1', name: 'Volta a ilha', base_price: 40, operator_id: 'op1', status: 'active' }, error: null };
      if (tabela === 'reservations') return { data: { id: 'r1', ...b.linha }, error: null };
      return { data: null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { criarReserva } = require('../controllers/publicController');
const { concluirReservaPaga } = require('../helpers/avisosReserva');
const { enviarEmail } = require('../helpers/emailHelper');
const { registarUsoVoucher } = require('../controllers/vouchersController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function reservar(extra) {
  const res = resposta();
  const next = jest.fn();
  await criarReserva({
    params: { slug: 'demo' },
    body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', check_in: '2026-12-01', guests: 2, ...extra },
  }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(201);
  return res.json.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: true };
  estado.inseridas = [];
  estado.notificacoes = [];
});

function esperarComoDinheiro() {
  expect(estado.inseridas[0].hold_expires_at).toBeUndefined();
  expect(estado.inseridas[0].payment_method).toBeUndefined();
  expect(enviarEmail).toHaveBeenCalledTimes(2);
  expect(estado.notificacoes).toHaveLength(1);
}

describe('criarReserva: lugar retido', () => {
  it('PayPal com total: guarda o método e o prazo, e não avisa ninguém', async () => {
    await reservar({ payment_method: 'paypal' });
    const linha = estado.inseridas[0];
    expect(linha.payment_method).toBe('paypal');
    const diff = new Date(linha.hold_expires_at).getTime() - Date.now();
    expect(Math.abs(diff - 30 * 60 * 1000)).toBeLessThan(5000);
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(estado.notificacoes).toHaveLength(0);
  });

  it('SISP com voucher: guarda o voucher_id e não gasta o uso', async () => {
    await reservar({ payment_method: 'sisp', voucher_code: 'PROMO' });
    expect(registarUsoVoucher).not.toHaveBeenCalled();
    expect(estado.inseridas[0].voucher_id).toBe('v1');
    expect(estado.inseridas[0].hold_expires_at).toBeDefined();
  });

  it('dinheiro: tudo como hoje', async () => {
    await reservar({ payment_method: 'cash' });
    esperarComoDinheiro();
  });

  it('sem payment_method (página antiga): tratado como dinheiro', async () => {
    await reservar({});
    esperarComoDinheiro();
  });

  it('cartão com total 0: não adia', async () => {
    const { validarVoucher } = require('../controllers/vouchersController');
    validarVoucher.mockResolvedValueOnce({ valid: true, discount: 500, voucherId: 'v1' });
    await reservar({ payment_method: 'paypal', voucher_code: 'TUDO' });
    expect(estado.inseridas[0].hold_expires_at).toBeUndefined();
    expect(enviarEmail).toHaveBeenCalledTimes(2);
    expect(registarUsoVoucher).toHaveBeenCalledWith('v1');
  });
});

describe('concluirReservaPaga', () => {
  const reserva = {
    id: 'r9', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', customer_country: 'PT',
    check_in: '2026-12-01', check_out: '2026-12-01', guests: 2, total_price: 70, notes: null,
    status: 'pending', driver_included: false, voucher_id: 'v1',
    units: { name: 'Volta a ilha' },
    operators: { id: 'op1', name: 'Sal Aventura', email: 'op@exemplo.cv', currency: 'EUR' },
  };

  it('com voucher e pagamento completo: gasta o voucher e envia os dois emails', async () => {
    await concluirReservaPaga(reserva, {});
    expect(registarUsoVoucher).toHaveBeenCalledWith('v1');
    expect(enviarEmail).toHaveBeenCalledTimes(2);
    expect(estado.notificacoes).toHaveLength(1);
  });

  it('incompleto: sem voucher, sem email ao cliente, notificação com aviso', async () => {
    await concluirReservaPaga(reserva, { incompleto: true });
    expect(registarUsoVoucher).not.toHaveBeenCalled();
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('op@exemplo.cv');
    expect(estado.notificacoes[0].content.endsWith('Pagamento incompleto — verificar')).toBe(true);
  });
});
