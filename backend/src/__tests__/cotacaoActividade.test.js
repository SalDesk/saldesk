/* Cotacao de actividade (GET /:slug/units/:unitId/quote): o valor mostrado
   tem de ser igual ao valor cobrado por criarReserva. */
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
jest.mock('../controllers/vouchersController', () => ({
  validarVoucher: jest.fn((operatorId, code, unitId, total) => Promise.resolve(
    code === 'BEMVINDO'
      ? { valid: true, discount: Math.round(total * 0.1 * 100) / 100, voucherId: 'v1' }
      : { valid: false, error: 'Codigo invalido' }
  )),
  registarUsoVoucher: jest.fn(() => Promise.resolve()),
}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn(() => Promise.resolve()) }));

const estado = { operador: null, unidade: null, inseridas: [], construtores: [] };

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
    estado.construtores.push(b);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { criarReserva, cotarActividade, getUnit } = require('../controllers/publicController');

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function cotar(query) {
  const res = resposta();
  const next = jest.fn();
  await cotarActividade({ params: { slug: 'demo', unitId: 'u1' }, query }, res, next);
  expect(next).not.toHaveBeenCalled();
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

const META = {
  price_child: 25,
  price_tiers: [{ pax_min: 1, pax_max: 2, price: 120 }, { pax_min: 3, pax_max: 4, price: 150 }],
};

beforeEach(() => {
  estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: false, custom_faqs: [{ q: 'Pergunta', a: 'Resposta' }] };
  estado.unidade = { id: 'u1', name: 'Volta a ilha', base_price: 40, capacity: 4, description: JSON.stringify(META), operator_id: 'op1', status: 'active', pricing_rules: [] };
  estado.inseridas = [];
  estado.construtores = [];
});

describe('cotarActividade', () => {
  it('cotacao_igual_ao_cobrado', async () => {
    const casos = [
      { query: { adults: '2', children: '1', mode: 'per_person' }, corpo: { adults: 2, children: 1 } },
      { query: { adults: '3', children: '0', mode: 'private' }, corpo: { adults: 3, children: 0, booking_mode: 'private' } },
      { query: { adults: '2', children: '1', mode: 'per_person', voucher: 'BEMVINDO' }, corpo: { adults: 2, children: 1, voucher_code: 'BEMVINDO' } },
    ];
    for (const c of casos) {
      estado.inseridas = [];
      const q = (await cotar(c.query)).json.mock.calls[0][0].data;
      expect(q.error).toBeNull();
      const r = await reservar(c.corpo);
      expect(r.status).toHaveBeenCalledWith(201);
      expect(q.total).toBe(Number(estado.inseridas[0].total_price));
    }
    const comVoucher = (await cotar(casos[2].query)).json.mock.calls[0][0].data;
    expect(comVoucher.before).toBe(105);
    expect(comVoucher.total).toBe(94.5);
    expect(comVoucher.lines.find((l) => l.type === 'discount')).toEqual({ type: 'discount', source: 'voucher', description: 'Código BEMVINDO', quantity: 1, total: -10.5 });
    expect(comVoucher.voucher_ignored).toBe(false);
  });

  it('voucher_invalido_mantem_preco_e_avisa', async () => {
    const q = (await cotar({ adults: '2', children: '1', voucher: 'NAOEXISTE' })).json.mock.calls[0][0].data;
    expect(q.error.code).toBe('INVALID_VOUCHER');
    expect(q.error.message_pt).toBeTruthy();
    expect(q.error.message_en).toBeTruthy();
    expect(q.total).toBe(105);
    expect(q.before).toBeNull();
    expect(q.lines.some((l) => l.type === 'discount')).toBe(false);
    expect(q.lines.length).toBeGreaterThan(0);
  });

  it('capacidade_excedida_devolve_erro', async () => {
    const q = (await cotar({ adults: '4', children: '2' })).json.mock.calls[0][0].data;
    expect(q.error.code).toBe('CAPACITY_EXCEEDED');
    expect(q.total).toBe(0);
  });

  it('zero_adultos_devolve_min_adults', async () => {
    const res = await cotar({ adults: '0', children: '2' });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data).toEqual({
      lines: [], total: 0, before: null, voucher_ignored: false,
      error: { code: 'MIN_ADULTS', message_pt: 'É preciso pelo menos 1 adulto', message_en: 'At least 1 adult is required' },
    });
  });

  it('unidade_inexistente_404', async () => {
    estado.unidade = null;
    const res = await cotar({ adults: '2' });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sem_preco_nenhum_cota_zero_sem_erro', async () => {
    /* TourForm grava um preco em branco como 0; sem preco privado, reserva-se como pedido a 0 */
    estado.unidade = { ...estado.unidade, base_price: 0, description: JSON.stringify({}) };
    const q = (await cotar({ adults: '2', children: '1', mode: 'per_person' })).json.mock.calls[0][0].data;
    expect(q.error).toBeNull();
    expect(q.total).toBe(0);
    const r = await reservar({ adults: 2, children: 1 });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(Number(estado.inseridas[0].total_price)).toBe(0);
  });

  it('valores_em_falta_ou_invalidos_usam_predefinicoes', async () => {
    const q = (await cotar({ adults: 'abc', children: '-2', mode: 'xyz' })).json.mock.calls[0][0].data;
    expect(q.total).toBe(40);
    expect(q.error).toBeNull();
  });
});

describe('getUnit', () => {
  it('getunit_traz_faqs_do_operador', async () => {
    const res = resposta();
    const next = jest.fn();
    await getUnit({ params: { slug: 'demo', unitId: 'u1' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    const selOperadores = estado.construtores
      .filter((b) => b.tabela === 'operators')
      .flatMap((b) => b.select.mock.calls.map((c) => c[0]));
    expect(selOperadores.some((s) => /custom_faqs/.test(s))).toBe(true);
    expect(res.json.mock.calls[0][0].data.operator.custom_faqs).toEqual([{ q: 'Pergunta', a: 'Resposta' }]);
  });
});
