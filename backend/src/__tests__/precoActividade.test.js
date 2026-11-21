/* precoActividade (preco partilhado de actividade) e o seu uso em criarReserva:
   o valor mostrado tem de ser igual ao valor cobrado. */
jest.mock('../helpers/bookingHelpers', () => ({
  ...jest.requireActual('../helpers/bookingHelpers'),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
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

const { precoActividade, verificarDisponibilidadeSlot } = require('../helpers/bookingHelpers');
const { criarReserva } = require('../controllers/publicController');

const TIERS = { price_tiers: [{ pax_min: 1, pax_max: 2, price: 120 }, { pax_min: 3, pax_max: 4, price: 150 }] };

describe('precoActividade', () => {
  it('por_pessoa_com_preco_de_crianca', () => {
    const r = precoActividade({ base_price: 40 }, { price_child: 25 }, { adults: 2, children: 1, mode: 'per_person' });
    expect(r.total).toBe(105);
    expect(r.error).toBeNull();
    expect(r.lines.find((l) => l.type === 'children').total).toBe(25);
  });

  it('por_pessoa_sem_preco_de_crianca', () => {
    const r = precoActividade({ base_price: 40 }, {}, { adults: 2, children: 1, mode: 'per_person' });
    expect(r.total).toBe(120);
  });

  it('privado_por_escalao', () => {
    const r = precoActividade({ base_price: 40 }, TIERS, { adults: 3, children: 0, mode: 'private' });
    expect(r.total).toBe(150);
    expect(r.error).toBeNull();
  });

  it('privado_fora_dos_escaloes_recusa', () => {
    const r = precoActividade({ base_price: 40 }, TIERS, { adults: 5, children: 0, mode: 'private' });
    expect(r.error.code).toBe('NO_PRICE_FOR_GROUP');
    expect(r.total).toBe(0);
  });

  it('capacidade_conta_criancas', () => {
    const r = precoActividade({ base_price: 40, capacity: 4 }, {}, { adults: 3, children: 2, mode: 'per_person' });
    expect(r.error.code).toBe('CAPACITY_EXCEEDED');
    expect(r.total).toBe(120 + 80);
  });

  it('sem_adultos_recusa', () => {
    for (const mode of ['per_person', 'private']) {
      const r = precoActividade({ base_price: 40 }, TIERS, { adults: 0, children: 2, mode });
      expect(r.error).toEqual({ code: 'MIN_ADULTS', message_pt: 'É preciso pelo menos 1 adulto', message_en: 'At least 1 adult is required' });
      expect(r.total).toBe(0);
      expect(r.lines).toEqual([]);
    }
  });
});

describe('criarReserva com actividade', () => {
  function resposta() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  async function reservar(corpo) {
    const res = resposta();
    const next = jest.fn();
    await criarReserva({
      params: { slug: 'demo' },
      body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv', check_in: '2026-12-01', ...corpo },
    }, res, next);
    expect(next).not.toHaveBeenCalled();
    return res;
  }

  beforeEach(() => {
    estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: false };
    estado.unidade = { id: 'u1', name: 'Volta a ilha', base_price: 40, capacity: 4, description: JSON.stringify({ price_child: 25 }), operator_id: 'op1', status: 'active', pricing_rules: [] };
    estado.inseridas = [];
  });

  it('post_sem_divisao_cobra_como_hoje', async () => {
    const res = await reservar({ party_size: 3 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Number(estado.inseridas[0].total_price)).toBe(120);
  });

  it('post_com_divisao_cobra_crianca', async () => {
    const res = await reservar({ party_size: 3, adults: 2, children: 1 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Number(estado.inseridas[0].total_price)).toBe(105);
  });

  it('post_divisao_sem_party_size_usa_adultos_mais_criancas', async () => {
    estado.unidade.description = JSON.stringify({ price_child: 25, time_slots: [{ time: '09:00', capacity: 10 }] });
    verificarDisponibilidadeSlot.mockClear();
    const res = await reservar({ adults: 2, children: 1, tour_time: '09:00' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].guests).toBe(3);
    expect(Number(estado.inseridas[0].total_price)).toBe(105);
    expect(verificarDisponibilidadeSlot.mock.calls[0][4]).toBe(3);
  });

  it('post_divisao_manda_sobre_party_size', async () => {
    const res = await reservar({ party_size: 1, adults: 2, children: 1 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].guests).toBe(3);
    expect(Number(estado.inseridas[0].total_price)).toBe(105);
  });

  it('post_acima_da_capacidade_400', async () => {
    const res = await reservar({ party_size: 6, adults: 4, children: 2 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual({ error: 'Este grupo excede a lotação desta actividade', code: 'CAPACITY_EXCEEDED' });
    expect(estado.inseridas).toHaveLength(0);
  });

  it('post_zero_adultos_400', async () => {
    const res = await reservar({ adults: 0, children: 2 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual({ error: 'É preciso pelo menos 1 adulto', code: 'MIN_ADULTS' });
    expect(estado.inseridas).toHaveLength(0);
  });

  it('post_antigo_so_com_guests_continua_a_funcionar', async () => {
    const res = await reservar({ guests: 2 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].guests).toBe(2);
    expect(Number(estado.inseridas[0].total_price)).toBe(80);
  });
});
