/* Reserva publica (criarReserva): estado inicial pela confirmacao automatica do operador e
   o que acontece quando a reserva ja nasce confirmada (notificacao do viajante, aviso ao operador). */
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
jest.mock('../controllers/vouchersController', () => ({}));
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
const { criarNotificacaoViajante } = require('../helpers/travelerNotificationHelper');
const { notificacaoOperadorEmail } = require('../helpers/emailTemplates');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function reservar(pagamento) {
  const res = resposta();
  const next = jest.fn();
  await criarReserva({
    params: { slug: 'demo' },
    body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', check_in: '2026-12-01', guests: 2, payment_method: pagamento },
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

describe('criarReserva: confirmacao automatica', () => {
  it('pagar_no_local_com_confirmacao_ligada_fica_confirmada_e_avisa_o_viajante', async () => {
    const corpo = await reservar('cash');
    expect(estado.inseridas[0].status).toBe('confirmed');
    expect(corpo.data.status).toBe('confirmed');
    expect(criarNotificacaoViajante).toHaveBeenCalledWith(
      'ana@exemplo.cv', 'booking_confirmed', 'A sua reserva com Sal Aventura foi confirmada.', expect.stringMatching(/\/viajante$/),
    );
    expect(notificacaoOperadorEmail.mock.calls[0][0].confirmada).toBe(true);
    expect(estado.notificacoes[0].content).toBe('Nova reserva de Ana — Volta a ilha (já confirmada)');
  });

  it('pagamento_online_com_confirmacao_ligada_fica_pendente', async () => {
    await reservar('paypal');
    expect(estado.inseridas[0].status).toBe('pending');
    expect(criarNotificacaoViajante).not.toHaveBeenCalled();
    expect(notificacaoOperadorEmail.mock.calls[0][0].confirmada).toBe(false);
    expect(estado.notificacoes[0].content).toBe('Nova reserva de Ana — Volta a ilha');
  });

  it('confirmacao_desligada_fica_pendente_mesmo_a_pagar_no_local', async () => {
    estado.operador.auto_confirm_bookings = false;
    await reservar('cash');
    expect(estado.inseridas[0].status).toBe('pending');
    expect(criarNotificacaoViajante).not.toHaveBeenCalled();
  });

  it('sem_forma_de_pagamento_fica_pendente', async () => {
    await reservar(undefined);
    expect(estado.inseridas[0].status).toBe('pending');
  });
});
