/* A mesma reserva enviada duas vezes (duplo clique, voltar atras, rede lenta) devolve a primeira;
   um lugar retido antigo do mesmo cliente e substituido em vez de ficar a ocupar vagas. */
jest.mock('../helpers/bookingHelpers', () => ({
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeMesa: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
  slotJaComecou: jest.fn(() => false),
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
  validarVoucher: jest.fn(),
  registarUsoVoucher: jest.fn(() => Promise.resolve()),
}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn(() => Promise.resolve()) }));

const estado = { operador: null, recentes: [], ops: [], pratos: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = { tabela, tipo: 'select', payload: null, filtros: [] };
    ['eq', 'in', 'gte', 'ilike', 'order', 'limit', 'or', 'not', 'lt', 'gt', 'neq'].forEach((m) => {
      b[m] = jest.fn((...args) => { b.filtros.push([m, ...args]); return b; });
    });
    b.select = jest.fn(() => b);
    b.insert = jest.fn((linha) => { b.tipo = 'insert'; b.payload = linha; estado.ops.push(b); return b; });
    b.update = jest.fn((valores) => { b.tipo = 'update'; b.payload = valores; estado.ops.push(b); return b; });
    const resolver = () => {
      if (tabela === 'operators') return { data: estado.operador, error: null };
      // Pratos do pre-pedido (consulta com .in) ou a unidade reservada
      if (tabela === 'units' && b.filtros.some((f) => f[0] === 'in')) return { data: estado.pratos, error: null };
      if (tabela === 'units') return { data: { id: 'u1', name: 'Volta a ilha', base_price: 40, operator_id: 'op1', status: 'active' }, error: null };
      if (tabela === 'orders') return { data: { id: 'ped1' }, error: null };
      if (tabela === 'reservations') {
        if (b.tipo === 'insert') return { data: { id: 'nova', ...b.payload }, error: null };
        if (b.tipo === 'update') {
          const id = (b.filtros.find((f) => f[0] === 'eq' && f[1] === 'id') || [])[2];
          const linha = estado.recentes.find((r) => r.id === id);
          return { data: linha ? { ...linha, ...b.payload } : null, error: null };
        }
        return { data: estado.recentes, error: null };
      }
      return { data: null, error: null };
    };
    b.single = jest.fn(() => Promise.resolve(resolver()));
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});

const { classificarRecentes, reservasRecentesDoCliente } = require('../helpers/lugarRetido');
const { criarReserva } = require('../controllers/publicController');
const {
  verificarDisponibilidade, verificarDisponibilidadeMesa, verificarDisponibilidadeSlot, parseUnitMeta,
} = require('../helpers/bookingHelpers');
const { enviarEmail } = require('../helpers/emailHelper');
const { validarVoucher } = require('../controllers/vouchersController');
const { calcularPreco } = require('../helpers/bookingHelpers');

const AGORA = new Date('2026-11-21T10:00:00Z');
const FUTURO = '2026-11-21T10:20:00.000Z';
const PASSADO = '2026-11-21T09:50:00.000Z';

function linha(extra) {
  return {
    id: 'r1', status: 'pending', payment_status: 'pending', payment_method: null, hold_expires_at: null,
    check_in: '2026-12-01', check_out: '2026-12-01', start_time: '09:00', guests: 2, is_group_booking: false,
    total_price: 80, customer_email: 'ana@exemplo.cv', customer_name: 'Ana', driver_included: false,
    ...extra,
  };
}
const NOVA = {
  checkOut: '2026-12-01', startTime: '09:00', guests: 2, isGroupBooking: false, metodo: null,
  customerName: 'Ana', driverIncluded: false, temPedido: false,
};

describe('classificarRecentes', () => {
  it('uma reserva igual em dinheiro e igualSemCartao', () => {
    const r = linha({ status: 'confirmed', payment_method: 'cash' });
    const c = classificarRecentes([r], NOVA, AGORA);
    expect(c.igualSemCartao).toBe(r);
    expect(c.igualCartao).toBeUndefined();
    expect(c.retidosProprios).toEqual([]);
  });

  it('um lugar retido PayPal igual e com prazo e igualCartao e retido proprio', () => {
    const r = linha({ payment_method: 'paypal', hold_expires_at: FUTURO });
    const c = classificarRecentes([r], { ...NOVA, metodo: 'paypal' }, AGORA);
    expect(c.igualCartao).toBe(r);
    expect(c.igualSemCartao).toBeUndefined();
    expect(c.retidosProprios).toEqual([r]);
  });

  it('um lugar retido PayPal com o prazo vencido nao conta para nada', () => {
    const r = linha({ payment_method: 'paypal', hold_expires_at: PASSADO });
    const c = classificarRecentes([r], { ...NOVA, metodo: 'paypal' }, AGORA);
    expect(c.igualCartao).toBeUndefined();
    expect(c.igualSemCartao).toBeUndefined();
    expect(c.retidosProprios).toEqual([]);
  });

  it('outra hora nao e igual, mas o lugar retido continua a ser proprio', () => {
    const r = linha({ payment_method: 'paypal', hold_expires_at: FUTURO, start_time: '09:00' });
    const c = classificarRecentes([r], { ...NOVA, startTime: '14:00', metodo: 'paypal' }, AGORA);
    expect(c.igualCartao).toBeUndefined();
    expect(c.retidosProprios).toEqual([r]);
  });

  it('uma reserva PayPal ja paga nunca e retido proprio', () => {
    const r = linha({ payment_method: 'paypal', payment_status: 'paid', hold_expires_at: FUTURO });
    const c = classificarRecentes([r], { ...NOVA, metodo: 'paypal' }, AGORA);
    expect(c.retidosProprios).toEqual([]);
    expect(c.igualCartao).toBeUndefined();
  });

  it("'09:00:00' e igual a '09:00'", () => {
    const r = linha({ start_time: '09:00:00' });
    const c = classificarRecentes([r], NOVA, AGORA);
    expect(c.igualSemCartao).toBe(r);
  });

  it('o nome compara-se sem espacos nem maiusculas; outro nome nao e igual', () => {
    const r = linha({ customer_name: 'Ana' });
    expect(classificarRecentes([r], { ...NOVA, customerName: '  ANA ' }, AGORA).igualSemCartao).toBe(r);
    expect(classificarRecentes([r], { ...NOVA, customerName: 'Rui' }, AGORA).igualSemCartao).toBeUndefined();
  });

  it('com motorista nao e igual a sem motorista', () => {
    const r = linha({ driver_included: false });
    expect(classificarRecentes([r], { ...NOVA, driverIncluded: true }, AGORA).igualSemCartao).toBeUndefined();
    const cartao = linha({ payment_method: 'paypal', hold_expires_at: FUTURO, driver_included: true });
    expect(classificarRecentes([cartao], { ...NOVA, metodo: 'paypal', driverIncluded: false }, AGORA).igualCartao).toBeUndefined();
  });

  it('um pedido com pre-pedido nunca e repetido', () => {
    const r = linha({});
    const cartao = linha({ id: 'r2', payment_method: 'paypal', hold_expires_at: FUTURO });
    expect(classificarRecentes([r], { ...NOVA, temPedido: true }, AGORA).igualSemCartao).toBeUndefined();
    const c = classificarRecentes([cartao], { ...NOVA, metodo: 'paypal', temPedido: true }, AGORA);
    expect(c.igualCartao).toBeUndefined();
    expect(c.retidosProprios).toEqual([cartao]);
  });

  it('sem hora dos dois lados e igual', () => {
    const r = linha({ start_time: null });
    const c = classificarRecentes([r], { ...NOVA, startTime: null }, AGORA);
    expect(c.igualSemCartao).toBe(r);
  });

  it('um lugar retido com outro nome nao e retido proprio (outro casal no mesmo email)', () => {
    const r = linha({ payment_method: 'paypal', hold_expires_at: FUTURO, customer_name: 'Ana' });
    const c = classificarRecentes([r], { ...NOVA, metodo: 'paypal', customerName: 'Rui Lopes' }, AGORA);
    expect(c.retidosProprios).toEqual([]);
    expect(c.igualCartao).toBeUndefined();
  });

  it('um lugar retido com o mesmo nome noutras maiusculas e espacos continua a ser proprio', () => {
    const r = linha({ payment_method: 'paypal', hold_expires_at: FUTURO, customer_name: 'Ana Silva' });
    const c = classificarRecentes([r], { ...NOVA, metodo: 'paypal', guests: 3, customerName: '  ana SILVA ' }, AGORA);
    expect(c.retidosProprios).toEqual([r]);
  });
});

describe('reservasRecentesDoCliente', () => {
  function supabaseFalso(linhas) {
    const b = {};
    ['select', 'eq', 'in', 'gte', 'ilike'].forEach((m) => { b[m] = jest.fn(() => b); });
    b.then = (ok, ko) => Promise.resolve({ data: linhas, error: null }).then(ok, ko);
    return { from: jest.fn(() => b), b };
  }

  it('escapa os curingas do email e so guarda o mesmo email', async () => {
    const sb = supabaseFalso([
      { id: 'a', customer_email: 'anax1@x.cv' },
      { id: 'b', customer_email: 'Ana_1@X.cv' },
    ]);
    const linhas = await reservasRecentesDoCliente(sb, {
      operatorId: 'op1', unitId: 'u1', email: 'ana_1@x.cv', checkIn: '2026-12-01', agora: AGORA,
    });
    expect(sb.from).toHaveBeenCalledWith('reservations');
    expect(sb.b.ilike).toHaveBeenCalledWith('customer_email', 'ana\\_1@x.cv');
    expect(sb.b.eq).toHaveBeenCalledWith('operator_id', 'op1');
    expect(sb.b.eq).toHaveBeenCalledWith('unit_id', 'u1');
    expect(sb.b.eq).toHaveBeenCalledWith('check_in', '2026-12-01');
    expect(sb.b.eq).toHaveBeenCalledWith('source', 'public');
    expect(sb.b.in).toHaveBeenCalledWith('status', ['pending', 'confirmed']);
    expect(sb.b.gte).toHaveBeenCalledWith('created_at', '2026-11-21T09:30:00.000Z');
    expect(linhas.map((l) => l.id)).toEqual(['b']);
  });
});

describe('criarReserva: duplicados', () => {
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
      body: { unit_id: 'u1', customer_name: 'Ana', customer_email: 'Ana@Exemplo.cv', check_in: '2026-12-01', guests: 2, ...extra },
    }, res, next);
    expect(next).not.toHaveBeenCalled();
    return res;
  }

  const reservasOps = () => estado.ops.filter((o) => o.tabela === 'reservations');

  beforeEach(() => {
    jest.clearAllMocks();
    estado.operador = { id: 'op1', name: 'Sal Aventura', slug: 'demo', email: 'op@exemplo.cv', currency: 'EUR', operator_type: 'activity', auto_confirm_bookings: true };
    estado.recentes = [];
    estado.ops = [];
    estado.pratos = [];
    parseUnitMeta.mockImplementation(() => ({}));
  });

  it('devolve a reserva igual em dinheiro com 200 e não insere nada', async () => {
    const antiga = linha({ id: 'antiga', status: 'confirmed', start_time: null, customer_email: 'ana@exemplo.cv' });
    estado.recentes = [antiga];
    const res = await reservar({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: antiga, pre_order: null, message: 'Reserva confirmada.' });
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(0);
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(estado.ops.filter((o) => o.tabela === 'notifications')).toHaveLength(0);
  });

  it('devolve o lugar retido igual e renova o prazo', async () => {
    const antiga = linha({ id: 'antiga', start_time: null, payment_method: 'paypal', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
    estado.recentes = [antiga];
    const res = await reservar({ payment_method: 'paypal' });
    expect(res.status).toHaveBeenCalledWith(200);
    const updates = reservasOps().filter((o) => o.tipo === 'update');
    expect(updates).toHaveLength(1);
    const diff = new Date(updates[0].payload.hold_expires_at).getTime() - Date.now();
    expect(Math.abs(diff - 30 * 60 * 1000)).toBeLessThan(5000);
    expect(updates[0].filtros).toContainEqual(['eq', 'id', 'antiga']);
    const corpo = res.json.mock.calls[0][0];
    expect(corpo.data.id).toBe('antiga');
    expect(corpo.data.hold_expires_at).toBe(updates[0].payload.hold_expires_at);
    expect(corpo.pre_order).toBeNull();
    expect(corpo.message).toBe('Reserva submetida com sucesso. Aguarde confirmação.');
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(0);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it('substitui o lugar retido do mesmo cliente quando muda o grupo', async () => {
    const antiga = linha({ id: 'antiga', start_time: null, payment_method: 'paypal', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
    estado.recentes = [antiga];
    const res = await reservar({ payment_method: 'paypal', guests: 3 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-01', ['antiga']);
    const ops = reservasOps().filter((o) => o.tipo !== 'select');
    expect(ops.map((o) => o.tipo)).toEqual(['update', 'insert']);
    expect(ops[0].payload).toMatchObject({ status: 'cancelled', cancel_reason: 'replaced' });
    expect(ops[0].payload.updated_at).toBeDefined();
    expect(ops[0].filtros).toEqual(expect.arrayContaining([
      ['in', 'id', ['antiga']], ['eq', 'status', 'pending'], ['eq', 'payment_status', 'pending'],
    ]));
    expect(ops[1].payload.guests).toBe(3);
  });

  it('lugar retido de outro nome no mesmo email: nao e substituido e conta nas vagas', async () => {
    const casal1 = linha({ id: 'casal1', start_time: null, customer_name: 'Ana', payment_method: 'paypal', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
    estado.recentes = [casal1];
    const res = await reservar({ payment_method: 'paypal', customer_name: 'Rui Lopes' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-01', []);
    const ops = reservasOps().filter((o) => o.tipo !== 'select');
    expect(ops.map((o) => o.tipo)).toEqual(['insert']);
  });

  it('lugar retido com o mesmo nome noutras maiusculas e espacos: e substituido', async () => {
    const antiga = linha({ id: 'antiga', start_time: null, customer_name: 'Ana', payment_method: 'paypal', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
    estado.recentes = [antiga];
    const res = await reservar({ payment_method: 'paypal', guests: 3, customer_name: '  ANA ' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-01', ['antiga']);
    const ops = reservasOps().filter((o) => o.tipo !== 'select');
    expect(ops.map((o) => o.tipo)).toEqual(['update', 'insert']);
    expect(ops[0].payload.cancel_reason).toBe('replaced');
  });

  it('sem reservas recentes: cria como sempre e nao exclui nada', async () => {
    const res = await reservar({});
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-01', []);
    expect(reservasOps().filter((o) => o.tipo === 'update')).toHaveLength(0);
  });

  it('actividade com horarios: a mesma hora em dinheiro devolve-se; noutra hora o retido sai das vagas', async () => {
    parseUnitMeta.mockImplementation(() => ({ time_slots: [{ time: '09:00', capacity: 10 }, { time: '14:00', capacity: 10 }] }));
    estado.recentes = [linha({ id: 'dinheiro', start_time: '09:00:00' })];
    let res = await reservar({ tour_time: '09:00' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.id).toBe('dinheiro');
    // A reserva igual sai das vagas ate se comparar o valor.
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledTimes(1);
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '09:00', 2, 10, ['dinheiro'], false);
    verificarDisponibilidadeSlot.mockClear();

    estado.ops = [];
    estado.recentes = [linha({ id: 'retido', start_time: '09:00:00', payment_method: 'sisp', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() })];
    res = await reservar({ tour_time: '14:00', payment_method: 'sisp' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeSlot).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '14:00', 2, 10, ['retido'], false);
    expect(reservasOps().filter((o) => o.tipo !== 'select').map((o) => o.tipo)).toEqual(['update', 'insert']);
  });

  it('mesa de restaurante: o retido do mesmo cliente sai da verificacao da mesa', async () => {
    estado.operador = { ...estado.operador, operator_type: 'restaurant' };
    estado.recentes = [linha({ id: 'retido', guests: 1, start_time: '19:00:00', payment_method: 'paypal', hold_expires_at: new Date(Date.now() + 10 * 60000).toISOString() })];
    const res = await reservar({ guests: 1, reservation_time: '20:00' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeMesa).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '20:00', 90, ['retido']);
    const ops = reservasOps().filter((o) => o.tipo !== 'select');
    expect(ops.map((o) => o.tipo)).toEqual(['update', 'insert']);
    expect(ops[0].payload.cancel_reason).toBe('replaced');
  });

  it('mesa de restaurante: a mesma reserva em dinheiro devolve-se sem verificar a mesa', async () => {
    estado.operador = { ...estado.operador, operator_type: 'restaurant' };
    const antiga = linha({ id: 'mesa', guests: 1, start_time: '20:00:00', total_price: 0 });
    estado.recentes = [antiga];
    const res = await reservar({ guests: 1, reservation_time: '20:00' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: antiga, pre_order: null, message: 'Reserva submetida com sucesso. Aguarde confirmação.' });
    expect(verificarDisponibilidadeMesa).toHaveBeenCalledTimes(1);
    expect(verificarDisponibilidadeMesa).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '20:00', 90, ['mesa']);
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(0);
  });

  it('outro nome no mesmo email e no mesmo dia: cria outra reserva', async () => {
    estado.recentes = [linha({ id: 'casal1', status: 'confirmed', start_time: null, customer_name: 'Ana' })];
    const res = await reservar({ customer_name: 'Rui Lopes' });
    expect(res.status).toHaveBeenCalledWith(201);
    // Nao e a mesma reserva: a primeira conta nas vagas.
    expect(verificarDisponibilidade).toHaveBeenCalledTimes(1);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-01', []);
    const insert = reservasOps().find((o) => o.tipo === 'insert');
    expect(insert.payload.customer_name).toBe('Rui Lopes');
  });

  it('o mesmo nome com outras maiusculas e espacos devolve a reserva igual', async () => {
    const antiga = linha({ id: 'antiga', status: 'confirmed', start_time: null, customer_name: 'Ana' });
    estado.recentes = [antiga];
    const res = await reservar({ customer_name: ' ana ' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBe(antiga);
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(0);
  });

  it('outro total (voucher novo): cria outra reserva e volta a verificar as vagas com a primeira', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 20, voucherId: 'v1' });
    estado.recentes = [linha({ id: 'antiga', status: 'confirmed', start_time: null, total_price: 80 })];
    const res = await reservar({ voucher_code: 'MENOS20' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledTimes(2);
    expect(verificarDisponibilidade).toHaveBeenNthCalledWith(1, expect.anything(), 'u1', '2026-12-01', '2026-12-01', ['antiga']);
    expect(verificarDisponibilidade).toHaveBeenNthCalledWith(2, expect.anything(), 'u1', '2026-12-01', '2026-12-01', []);
    const insert = reservasOps().find((o) => o.tipo === 'insert');
    expect(insert.payload.total_price).toBe(60);
  });

  it('outro total e sem vagas com a primeira: 409 e nada se insere', async () => {
    validarVoucher.mockResolvedValue({ valid: true, discount: 20, voucherId: 'v1' });
    estado.recentes = [linha({ id: 'antiga', status: 'confirmed', start_time: null, total_price: 80 })];
    verificarDisponibilidade.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await reservar({ voucher_code: 'MENOS20' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unidade indisponível nas datas seleccionadas', code: 'UNAVAILABLE' });
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(0);
  });

  it('rent-a-car: pedir motorista depois de reservar sem motorista cria outra reserva', async () => {
    estado.operador = { ...estado.operador, operator_type: 'rentacar' };
    calcularPreco.mockReturnValue({ total: 100, dias: 2 });
    parseUnitMeta.mockImplementation(() => ({ chauffeur_daily_rate: 50 }));
    estado.recentes = [linha({
      id: 'sem-motorista', status: 'confirmed', start_time: null, check_out: '2026-12-03', guests: 1, total_price: 100,
    })];
    const res = await reservar({ check_out: '2026-12-03', guests: 1, driver_included: true });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidade).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '2026-12-03', []);
    const insert = reservasOps().find((o) => o.tipo === 'insert');
    expect(insert.payload).toMatchObject({ driver_included: true, total_price: 200 });
  });

  it('mesa com pre-pedido nunca se devolve como repetida', async () => {
    estado.operador = { ...estado.operador, operator_type: 'restaurant' };
    estado.pratos = [{ id: 'p1', name: 'Cachupa', base_price: 0, unit_type: 'menu_item', status: 'active', operator_id: 'op1' }];
    estado.recentes = [linha({ id: 'mesa', guests: 1, start_time: '20:00:00', total_price: 0 })];
    const res = await reservar({ guests: 1, reservation_time: '20:00', items: [{ unit_id: 'p1', quantity: 2 }] });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(verificarDisponibilidadeMesa).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-12-01', '20:00', 90, []);
    expect(reservasOps().filter((o) => o.tipo === 'insert')).toHaveLength(1);
    expect(estado.ops.some((o) => o.tabela === 'orders' && o.tipo === 'insert')).toBe(true);
  });
});
