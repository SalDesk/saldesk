/* Reservas criadas pelo operador (painel, calendario, venda de praia) numa actividade com
   opcoes: o preco vem da opcao escolhida (ou da mais barata, para clientes antigos), as notas
   levam a opcao e os veiculos, o modo segue a opcao e o operador nunca e recusado pelo preco.
   O suplemento de idioma nao se aplica nestes ecras (o operador escolhe o idioma a mao). */
jest.mock('../messaging/outbox', () => ({ cancelarPorReserva: jest.fn() }));
jest.mock('../helpers/bookingHelpers', () => ({
  ...jest.requireActual('../helpers/bookingHelpers'),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('../helpers/customerHelper', () => ({ obterOuCriarCliente: jest.fn(() => Promise.resolve({ id: 'cli1' })) }));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn(() => Promise.resolve()) }));
jest.mock('../helpers/emailTemplates', () => ({
  confirmacaoClienteEmail: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })),
  notificacaoOperadorEmail: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })),
}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn(() => Promise.resolve()) }));
jest.mock('../utils/urls', () => ({ frontendBase: jest.fn(() => 'https://app.saldesk.cv') }));

const estado = { unidade: null, inseridas: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, linha: null };
    ['select', 'eq', 'order', 'in', 'limit', 'or', 'gte', 'lte', 'lt', 'gt', 'neq', 'not'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.insert = jest.fn((linha) => {
      b.linha = linha;
      if (tabela === 'reservations') estado.inseridas.push(linha);
      return b;
    });
    const resolver = () => {
      if (tabela === 'units') return { data: estado.unidade, error: null };
      if (tabela === 'operators') return { data: { name: 'Sal Aventura', email: 'op@exemplo.cv', currency: 'EUR', language: 'pt' }, error: null };
      if (tabela === 'reservations') return b.linha ? { data: { id: 'r1', ...b.linha }, error: null } : { data: [], error: null };
      return { data: null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { criar } = require('../controllers/reservationsController');
const { verificarDisponibilidadeSlot } = require('../helpers/bookingHelpers');
const { notificacaoOperadorEmail } = require('../helpers/emailTemplates');

const META = {
  time_slots: [{ time: '09:00', capacity: 10 }],
  languages: ['ES'],
  language_surcharges: { ES: 20 },
  options: [
    { id: 'o1', name_pt: 'Por pessoa', name_en: 'Per person', type: 'per_person', price: 50, price_child: 30 },
    { id: 'o2', name_pt: 'Grupo privado', name_en: 'Private group', type: 'per_group', price: 200 },
    { id: 'o3', name_pt: 'Buggy 2h', name_en: 'Buggy 2h', type: 'per_vehicle', price: 90, seats: 2 },
  ],
};

function unidade(meta) {
  return {
    id: 'u1', name: 'Volta a ilha', base_price: 40, capacity: 10, description: JSON.stringify(meta),
    operator_id: 'op1', pricing_rules: [], operators: { operator_type: 'activity' },
  };
}

function resposta() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function reservar(corpo) {
  const res = resposta();
  const next = jest.fn();
  await criar({
    operator: { id: 'op1' },
    body: {
      unit_id: 'u1', customer_name: 'Ana', customer_email: 'ana@exemplo.cv',
      check_in: '2026-12-05', check_out: '2026-12-05', start_time: '09:00', ...corpo,
    },
  }, res, next);
  expect(next).not.toHaveBeenCalled();
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  estado.unidade = unidade(META);
  estado.inseridas = [];
});

describe('reserva do operador com opcoes', () => {
  it('opcao por veiculo: 5 pessoas e 2 lugares cobra 3 veiculos (270) e escreve Veículos: 3', async () => {
    const res = await reservar({ guests: 5, option_id: 'o3', vehicles: 1, notes: 'Hora: 09:00' });
    expect(res.status).toHaveBeenCalledWith(201);
    const linha = estado.inseridas[0];
    expect(linha.total_price).toBe(270);
    expect(linha.is_group_booking).toBe(false);
    expect(linha.notes).toBe('Hora: 09:00 | Opção: Buggy 2h | Veículos: 3');
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-05', '09:00', 5, 10, null, false);
  });

  it('veiculos pedidos dentro dos limites ficam como pedidos', async () => {
    await reservar({ guests: 5, option_id: 'o3', vehicles: 4 });
    expect(estado.inseridas[0].total_price).toBe(360);
    expect(estado.inseridas[0].notes).toBe('Opção: Buggy 2h | Veículos: 4');
  });

  it('sem option_id usa a opcao mais barata e nunca responde 4xx pelo preco', async () => {
    const res = await reservar({ guests: 2 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].total_price).toBe(100);
    expect(estado.inseridas[0].notes).toBe('Opção: Por pessoa');
    expect(estado.inseridas[0].is_group_booking).toBe(false);
  });

  it('option_id desconhecido tambem cai na opcao mais barata', async () => {
    const res = await reservar({ guests: 3, option_id: 'nao-existe' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].total_price).toBe(150);
    expect(estado.inseridas[0].notes).toBe('Opção: Por pessoa');
  });

  it('opcao por grupo grava is_group_booking true e ocupa o horario inteiro', async () => {
    const res = await reservar({ guests: 4, option_id: 'o2' });
    expect(res.status).toHaveBeenCalledWith(201);
    const linha = estado.inseridas[0];
    expect(linha.is_group_booking).toBe(true);
    expect(linha.total_price).toBe(200);
    expect(linha.notes).toBe('Opção: Grupo privado');
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-05', '09:00', 4, 10, null, true);
  });

  it('com opcoes o booking_mode private sem preco privado nao recusa: manda a opcao', async () => {
    const res = await reservar({ guests: 2, option_id: 'o1', booking_mode: 'private' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].is_group_booking).toBe(false);
    expect(estado.inseridas[0].total_price).toBe(100);
  });

  it('nunca acrescenta o suplemento de idioma (nem a lingua unica por defeito)', async () => {
    await reservar({ guests: 2, option_id: 'o1' });
    expect(estado.inseridas[0].total_price).toBe(100);
    expect(estado.inseridas[0].notes).not.toMatch(/Idioma:/);
  });

  it('o email ao operador leva as notas com a opcao', async () => {
    await reservar({ guests: 5, option_id: 'o3' });
    expect(notificacaoOperadorEmail).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Opção: Buggy 2h | Veículos: 3' }));
  });

  it('total_amount enviado continua a mandar', async () => {
    await reservar({ guests: 5, option_id: 'o3', total_amount: 123 });
    expect(estado.inseridas[0].total_price).toBe(123);
    expect(estado.inseridas[0].notes).toBe('Opção: Buggy 2h | Veículos: 3');
  });
});

describe('reserva do operador sem opcoes nada muda', () => {
  it('por pessoa: base_price * pessoas e notas tal como vieram', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }] });
    const res = await reservar({ guests: 2, notes: 'Hora: 09:00', option_id: 'o3', vehicles: 2 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(estado.inseridas[0].total_price).toBe(80);
    expect(estado.inseridas[0].notes).toBe('Hora: 09:00');
    expect(estado.inseridas[0].is_group_booking).toBe(false);
  });

  it('sem notas fica null', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }] });
    await reservar({ guests: 1 });
    expect(estado.inseridas[0].notes).toBeNull();
  });

  it('privado por escalao continua igual', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }], price_tiers: [{ pax_min: 1, pax_max: 4, price: 150 }] });
    await reservar({ guests: 3, booking_mode: 'private' });
    expect(estado.inseridas[0].total_price).toBe(150);
    expect(estado.inseridas[0].is_group_booking).toBe(true);
  });

  it('privado sem preco privado continua a recusar com INVALID_BOOKING_MODE', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }] });
    const res = await reservar({ guests: 3, booking_mode: 'private' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_BOOKING_MODE' }));
  });

  it('lingua unica com suplemento nao entra no preco do operador', async () => {
    estado.unidade = unidade({ time_slots: [{ time: '09:00', capacity: 10 }], languages: ['ES'], language_surcharges: { ES: 20 } });
    await reservar({ guests: 2 });
    expect(estado.inseridas[0].total_price).toBe(80);
  });
});
