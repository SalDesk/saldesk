/* Horarios ja comecados (hora de Cabo Verde): deixam de se poder reservar e
   aparecem como indisponiveis em slot-availability. */
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

const estado = { operador: null, unidade: null, inseridas: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, linha: null };
    ['select', 'eq', 'order', 'in', 'limit', 'or', 'gte', 'lte', 'lt', 'gt', 'neq', 'not', 'ilike'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.insert = jest.fn((linha) => {
      b.linha = linha;
      if (tabela === 'reservations') estado.inseridas.push(linha);
      return b;
    });
    const resolver = () => {
      if (tabela === 'operators') return { data: estado.operador, error: null };
      if (tabela === 'units') return { data: estado.unidade, error: null };
      if (tabela === 'reservations') return b.linha ? { data: { id: 'r1', ...b.linha }, error: null } : { data: [], error: null };
      return { data: tabela === 'pricing_rules' ? [] : null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { slotJaComecou, hojeEHoraCaboVerde } = require('../helpers/bookingHelpers');
const { criarReserva, getSlotAvailability } = require('../controllers/publicController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

afterEach(() => {
  jest.useRealTimers();
});

describe('slotJaComecou', () => {
  it('comecado_usa_hora_de_cabo_verde', () => {
    // 00:30 UTC de 21 nov = 23:30 de 20 nov em Cabo Verde (UTC-1)
    const agora = new Date('2026-11-21T00:30:00Z');
    expect(hojeEHoraCaboVerde(agora)).toEqual({ hoje: '2026-11-20', hora: '23:30' });
    expect(slotJaComecou('2026-11-20', '23:00', agora)).toBe(true);
    expect(slotJaComecou('2026-11-21', '09:00', agora)).toBe(false);
  });

  it('dia_anterior_comecado_e_hora_igual_conta', () => {
    const agora = new Date('2026-11-20T10:00:00Z'); // 09:00 em Cabo Verde
    expect(slotJaComecou('2026-11-19', '23:59', agora)).toBe(true);
    expect(slotJaComecou('2026-11-20', '09:00', agora)).toBe(true);
    expect(slotJaComecou('2026-11-20', '09:00:00', agora)).toBe(true);
    expect(slotJaComecou('2026-11-20', '09:01', agora)).toBe(false);
  });
});

describe('slots e criarReserva', () => {
  beforeEach(() => {
    estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: false };
    estado.unidade = {
      id: 'u1', name: 'Volta a ilha', base_price: 40, capacity: 4, operator_id: 'op1', status: 'active', pricing_rules: [],
      description: JSON.stringify({ time_slots: [{ time: '09:00', capacity: 10 }, { time: '15:00', capacity: 10 }] }),
    };
    estado.inseridas = [];
  });

  it('slot_disponivel_marca_comecados', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-20T11:00:00Z')); // 10:00 em Cabo Verde
    const res = resposta();
    const next = jest.fn();
    await getSlotAvailability({ params: { slug: 'demo', unitId: 'u1' }, query: { date: '2026-11-20' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    const linhas = res.json.mock.calls[0][0].data;
    const nove = linhas.find((l) => l.time === '09:00');
    const quinze = linhas.find((l) => l.time === '15:00');
    expect(nove.started).toBe(true);
    expect(nove.remaining).toBe(0);
    expect(quinze.started).toBeUndefined();
    expect(quinze.remaining).toBe(10);
  });

  it('post_em_slot_comecado_409', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-20T11:00:00Z'));
    const res = resposta();
    const next = jest.fn();
    await criarReserva({
      params: { slug: 'demo' },
      body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', check_in: '2026-11-20', tour_time: '09:00', party_size: 2 },
    }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('UNAVAILABLE');
    expect(estado.inseridas).toHaveLength(0);
  });

  it('post_em_slot_futuro_do_mesmo_dia_passa', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-20T11:00:00Z'));
    const res = resposta();
    const next = jest.fn();
    await criarReserva({
      params: { slug: 'demo' },
      body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', check_in: '2026-11-20', tour_time: '15:00', party_size: 2 },
    }, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
