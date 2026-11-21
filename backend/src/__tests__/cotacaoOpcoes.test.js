/* Opcoes, veiculos, idioma do guia e ofertas: a cotacao (GET /quote) e a reserva publica
   (criarReserva) dao sempre o mesmo valor. */
jest.mock('../helpers/bookingHelpers', () => ({
  ...jest.requireActual('../helpers/bookingHelpers'),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
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
    code === 'MENOS10' ? { valid: true, discount: Math.min(10, total), voucherId: 'v10' }
      : code === 'MENOS100' ? { valid: true, discount: Math.min(100, total), voucherId: 'v100' }
        : code === 'ESGOTADO' ? { valid: false, error: 'Codigo esgotado' }
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

const { criarReserva, cotarActividade } = require('../controllers/publicController');
const { verificarDisponibilidadeSlot } = require('../helpers/bookingHelpers');
const { registarUsoVoucher } = require('../controllers/vouchersController');

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
  return res.json.mock.calls[0][0].data;
}

async function reservar(corpo) {
  const res = resposta();
  const next = jest.fn();
  await criarReserva({
    params: { slug: 'demo' },
    body: {
      unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv',
      check_in: '2026-12-05', tour_time: '09:00', payment_method: 'cash', ...corpo,
    },
  }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res;
}

const META = {
  time_slots: [{ time: '09:00', capacity: 10 }],
  languages: ['PT', 'ES'],
  language_surcharges: { ES: 20 },
  options: [
    { id: 'o1', name_pt: 'Por pessoa', name_en: 'Per person', type: 'per_person', price: 50, price_child: 30 },
    { id: 'o2', name_pt: 'Grupo privado', name_en: 'Private group', type: 'per_group', price: 200 },
    { id: 'o3', name_pt: 'Buggy 2h', name_en: 'Buggy 2h', type: 'per_vehicle', price: 90, seats: 2 },
  ],
  offers: [{ percent: 25, from: '2026-12-01', to: '2026-12-15' }],
};

function unidade(meta, extra = {}) {
  return { id: 'u1', name: 'Volta a ilha', base_price: 40, capacity: 10, description: JSON.stringify(meta), operator_id: 'op1', status: 'active', pricing_rules: [], ...extra };
}

beforeEach(() => {
  jest.clearAllMocks();
  estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: false };
  estado.unidade = unidade(META);
  estado.inseridas = [];
});

describe('cotacao e reserva com opcoes', () => {
  it('quote igual ao cobrado com opcao, veiculos, idioma e oferta', async () => {
    const casos = [
      {
        query: { option: 'o1', adults: '2', children: '1', date: '2026-12-05' },
        corpo: { option_id: 'o1', adults: 2, children: 1 },
        total: 97.5, before: 130,
      },
      {
        query: { option: 'o2', adults: '3', children: '0', date: '2026-12-05' },
        corpo: { option_id: 'o2', adults: 3, children: 0 },
        total: 150, before: 200,
      },
      {
        query: { option: 'o3', adults: '5', children: '0', vehicles: '1', glang: 'ES', date: '2026-12-05' },
        corpo: { option_id: 'o3', adults: 5, children: 0, vehicles: 1, guide_language: 'ES' },
        total: 217.5, before: 290,
      },
    ];
    for (const c of casos) {
      estado.inseridas = [];
      const q = await cotar(c.query);
      expect(q.error).toBeNull();
      expect(q.total).toBe(c.total);
      expect(q.before).toBe(c.before);
      expect(q.voucher_ignored).toBe(false);
      const r = await reservar(c.corpo);
      expect(r.status).toHaveBeenCalledWith(201);
      expect(q.total).toBe(Number(estado.inseridas[0].total_price));
    }
    const veiculos = await cotar(casos[2].query);
    expect(veiculos.lines).toEqual([
      { type: 'vehicles', description: 'Buggy 2h', quantity: 3, total: 270 },
      { type: 'language', description: 'Suplemento de idioma (ES)', quantity: 1, total: 20 },
      { type: 'discount', source: 'offer', description: 'Oferta especial (-25%)', quantity: 1, total: -72.5 },
    ]);
  });

  it('sem data a oferta nao se aplica na cotacao', async () => {
    const q = await cotar({ option: 'o1', adults: '2', children: '1' });
    expect(q.total).toBe(130);
    expect(q.before).toBeNull();
    expect(q.lines.some((l) => l.type === 'discount')).toBe(false);
  });

  it('opcao por grupo ocupa o horario inteiro', async () => {
    const r = await reservar({ option_id: 'o2', adults: 3, children: 0 });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-05', '09:00', 3, 10, [], true);
    expect(estado.inseridas[0].is_group_booking).toBe(true);
  });

  it('opcao por pessoa com booking_mode private: nao e privada nem e recusada', async () => {
    const r = await reservar({ option_id: 'o1', adults: 2, children: 0, booking_mode: 'private' });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-05', '09:00', 2, 10, [], false);
    expect(estado.inseridas[0].is_group_booking).toBe(false);
  });

  it('por veiculo: as pessoas (nao os veiculos) contam nas vagas', async () => {
    const r = await reservar({ option_id: 'o3', adults: 5, children: 0, vehicles: 4 });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-05', '09:00', 5, 10, [], false);
  });

  it('post antigo continua igual', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }] });
    const r = await reservar({ guests: 3, notes: 'Pedido especial', payment_method: undefined });
    expect(r.status).toHaveBeenCalledWith(201);
    const linha = estado.inseridas[0];
    expect(linha.total_price).toBe(120);
    expect(linha.notes).toBe('Hora: 09:00 | Pedido especial');
    expect(linha.is_group_booking).toBe(false);
    expect(linha.guests).toBe(3);
    expect(linha.voucher_id).toBeNull();
  });

  it('codigo pior que a oferta e ignorado no POST', async () => {
    for (const codigo of ['ESGOTADO', 'MENOS10']) {
      jest.clearAllMocks();
      estado.inseridas = [];
      const q = await cotar({ option: 'o1', adults: '2', children: '1', date: '2026-12-05', voucher: codigo });
      expect(q.error).toBeNull();
      expect(q.voucher_ignored).toBe(true);
      expect(q.total).toBe(97.5);
      expect(q.lines.find((l) => l.type === 'discount').source).toBe('offer');

      const r = await reservar({ option_id: 'o1', adults: 2, children: 1, voucher_code: codigo });
      expect(r.status).toHaveBeenCalledWith(201);
      expect(estado.inseridas[0].voucher_id).toBeNull();
      expect(estado.inseridas[0].total_price).toBe(97.5);
      expect(registarUsoVoucher).not.toHaveBeenCalled();
    }
  });

  it('codigo melhor que a oferta ganha no POST e na cotacao', async () => {
    const q = await cotar({ option: 'o1', adults: '2', children: '1', date: '2026-12-05', voucher: 'MENOS100' });
    expect(q.voucher_ignored).toBe(false);
    expect(q.total).toBe(30);
    expect(q.before).toBe(130);
    expect(q.lines.find((l) => l.type === 'discount')).toEqual({ type: 'discount', source: 'voucher', description: 'Código MENOS100', quantity: 1, total: -100 });
    const r = await reservar({ option_id: 'o1', adults: 2, children: 1, voucher_code: 'MENOS100' });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].voucher_id).toBe('v100');
    expect(estado.inseridas[0].total_price).toBe(30);
    expect(registarUsoVoucher).toHaveBeenCalledWith('v100');
  });

  it('notas com opcao e veiculos', async () => {
    const r = await reservar({ option_id: 'o3', adults: 5, children: 0, vehicles: 1, notes: 'Idioma: ES' });
    expect(r.status).toHaveBeenCalledWith(201);
    const partes = estado.inseridas[0].notes.split(' | ');
    expect(partes).toContain('Opção: Buggy 2h');
    expect(partes).toContain('Veículos: 3');
  });

  it('opcao por pessoa: sem linha de veiculos nas notas', async () => {
    await reservar({ option_id: 'o1', adults: 2, children: 0 });
    const notas = estado.inseridas[0].notes;
    expect(notas.split(' | ')).toContain('Opção: Por pessoa');
    expect(notas).not.toMatch(/Veículos/);
  });

  it('idioma unico com suplemento: o servidor escolhe-o e escreve-o nas notas', async () => {
    estado.unidade = unidade({ ...META, languages: ['ES'] });
    const q = await cotar({ option: 'o1', adults: '2', children: '0' });
    expect(q.total).toBe(120);
    const r = await reservar({ option_id: 'o1', adults: 2, children: 0, check_in: '2026-12-20' });
    expect(r.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].total_price).toBe(120);
    expect(estado.inseridas[0].notes.split(' | ')).toContain('Idioma: ES');

    // Com o idioma ja nas notas da pagina nao se repete
    estado.inseridas = [];
    await reservar({ option_id: 'o1', adults: 2, children: 0, check_in: '2026-12-20', notes: 'Hora: 09:00. Idioma: ES' });
    expect(estado.inseridas[0].notes.match(/Idioma:/g)).toHaveLength(1);
  });

  it('OPTION_REQUIRED sem option_id numa actividade com opcoes', async () => {
    const r = await reservar({ adults: 2, children: 0 });
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith({ error: 'Escolha uma opção', code: 'OPTION_REQUIRED' });
    expect(estado.inseridas).toHaveLength(0);

    const q = await cotar({ adults: '2' });
    expect(q.error.code).toBe('OPTION_REQUIRED');
    expect(q.total).toBe(0);
    expect(q.voucher_ignored).toBe(false);
  });
});
