/* Dias livres do mes para o calendario de reserva: uma consulta ao mes inteiro. */
const estado = { unidade: null, reservas: [], bloqueados: [], consultas: [] };

jest.mock('../config/supabase', () => {
  function construir(tabela) {
    const b = {};
    ['select', 'eq', 'order', 'in', 'limit', 'gte', 'lte', 'lt', 'gt', 'neq', 'not'].forEach((m) => { b[m] = jest.fn(() => b); });
    const resolver = () => {
      estado.consultas.push(tabela);
      if (tabela === 'units') return { data: estado.unidade, error: null };
      if (tabela === 'reservations') return { data: estado.reservas, error: null };
      if (tabela === 'blocked_dates') return { data: estado.bloqueados, error: null };
      return { data: [], error: null };
    };
    b.maybeSingle = jest.fn(() => Promise.resolve(resolver()));
    b.then = (ok, ko) => Promise.resolve(resolver()).then(ok, ko);
    return b;
  }
  return { supabaseAdmin: { from: jest.fn((t) => construir(t)) } };
});
jest.mock('../helpers/customerHelper', () => ({}));
jest.mock('../helpers/emailHelper', () => ({ enviarEmail: jest.fn() }));
jest.mock('../helpers/languageHelper', () => ({ detectarIdioma: jest.fn(() => 'pt') }));
jest.mock('../helpers/emailTemplates', () => ({}));
jest.mock('../controllers/vouchersController', () => ({}));
jest.mock('../controllers/affiliatesController', () => ({}));
jest.mock('../helpers/otaSyncHelper', () => ({ dispararSyncImediato: jest.fn() }));
jest.mock('../services/discoverCatalogService', () => ({ getDiscoverCatalog: jest.fn() }));
jest.mock('../services/pushService', () => ({ notifyOperator: jest.fn() }));
jest.mock('../services/socketService', () => ({ emitToOperator: jest.fn() }));
jest.mock('../helpers/travelerNotificationHelper', () => ({ criarNotificacaoViajante: jest.fn() }));

const { supabaseAdmin } = require('../config/supabase');
const { diasLivresDoMes } = require('../helpers/bookingHelpers');
const { getAvailabilityMonth } = require('../controllers/publicController');

const AGORA = new Date('2026-11-20T10:00:00Z'); // 09:00 de 20 nov em Cabo Verde
const unit = { id: 'u1' };

beforeEach(() => {
  estado.unidade = null;
  estado.reservas = [];
  estado.bloqueados = [];
  estado.consultas = [];
});

describe('diasLivresDoMes', () => {
  it('dias_com_lugar_para_o_grupo', async () => {
    const meta = { time_slots: [{ time: '09:00', capacity: 4 }] };
    estado.reservas = [{ check_in: '2026-12-10', start_time: '09:00:00', guests: 3, is_group_booking: false }];
    const r = await diasLivresDoMes(supabaseAdmin, unit, meta, { month: '2026-12', pax: 2, mode: 'per_person', agora: AGORA });
    expect(r.month).toBe('2026-12');
    expect(r.days['2026-12-10']).toBeUndefined();
    expect(r.days['2026-12-11']).toBe(true);
    expect(r.days['2026-12-31']).toBe(true);
  });

  it('privado_precisa_de_slot_vazio', async () => {
    const meta = { time_slots: [{ time: '09:00', capacity: 10 }, { time: '15:00', capacity: 10 }] };
    estado.reservas = [
      { check_in: '2026-12-10', start_time: '09:00', guests: 1, is_group_booking: false },
      { check_in: '2026-12-10', start_time: '15:00', guests: 1, is_group_booking: false },
      { check_in: '2026-12-11', start_time: '09:00', guests: 2, is_group_booking: true },
    ];
    const r = await diasLivresDoMes(supabaseAdmin, unit, meta, { month: '2026-12', pax: 2, mode: 'private', agora: AGORA });
    expect(r.days['2026-12-10']).toBeUndefined();
    expect(r.days['2026-12-11']).toBe(true); // 15:00 continua vazio
    expect(r.days['2026-12-12']).toBe(true);
  });

  it('dia_bloqueado_fica_de_fora', async () => {
    const meta = { time_slots: [{ time: '09:00', capacity: 4 }] };
    estado.bloqueados = [{ date: '2026-12-15' }];
    const r = await diasLivresDoMes(supabaseAdmin, unit, meta, { month: '2026-12', pax: 1, mode: 'per_person', agora: AGORA });
    expect(r.days['2026-12-15']).toBeUndefined();
    expect(r.days['2026-12-16']).toBe(true);
  });

  it('sem_horarios_um_por_dia', async () => {
    estado.reservas = [{ check_in: '2026-12-12', start_time: null, guests: 2, is_group_booking: false }];
    estado.bloqueados = [{ date: '2026-12-13' }];
    const r = await diasLivresDoMes(supabaseAdmin, unit, {}, { month: '2026-12', pax: 1, mode: 'per_person', agora: AGORA });
    expect(r.days['2026-12-12']).toBeUndefined();
    expect(r.days['2026-12-13']).toBeUndefined();
    expect(r.days['2026-12-14']).toBe(true);
  });

  it('dias_passados_fora', async () => {
    const meta = { time_slots: [{ time: '15:00', capacity: 4 }] };
    const r = await diasLivresDoMes(supabaseAdmin, unit, meta, { month: '2026-11', pax: 1, mode: 'per_person', agora: AGORA });
    expect(r.days['2026-11-19']).toBeUndefined();
    expect(r.days['2026-11-20']).toBe(true); // 15:00 ainda nao comecou
    expect(r.days['2026-11-21']).toBe(true);
  });

  it('hoje_sem_slot_por_comecar_fica_de_fora', async () => {
    const meta = { time_slots: [{ time: '09:00', capacity: 4 }] };
    const r = await diasLivresDoMes(supabaseAdmin, unit, meta, { month: '2026-11', pax: 1, mode: 'per_person', agora: AGORA });
    expect(r.days['2026-11-20']).toBeUndefined();
    expect(r.days['2026-11-21']).toBe(true);
  });

  it('sem_horarios_passados_fora', async () => {
    const r = await diasLivresDoMes(supabaseAdmin, unit, {}, { month: '2026-11', pax: 1, mode: 'per_person', agora: AGORA });
    expect(r.days['2026-11-19']).toBeUndefined();
    expect(r.days['2026-11-20']).toBe(true);
  });
});

describe('getAvailabilityMonth', () => {
  function resposta() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  it('mes_invalido_400', async () => {
    const res = resposta();
    const next = jest.fn();
    await getAvailabilityMonth({ params: { unitId: 'u1' }, query: { month: '2026-13' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    await getAvailabilityMonth({ params: { unitId: 'u1' }, query: {} }, res, next);
    expect(res.status).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
  });

  it('unidade_inactiva_404', async () => {
    const res = resposta();
    await getAvailabilityMonth({ params: { unitId: 'u1' }, query: { month: '2026-12' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('devolve_data_com_dias', async () => {
    jest.useFakeTimers().setSystemTime(AGORA);
    estado.unidade = { id: 'u1', description: JSON.stringify({ time_slots: [{ time: '09:00', capacity: 4 }] }) };
    estado.reservas = [{ check_in: '2026-12-10', start_time: '09:00', guests: 4, is_group_booking: false }];
    const res = resposta();
    await getAvailabilityMonth({ params: { unitId: 'u1' }, query: { month: '2026-12', pax: 'x', mode: 'zzz' } }, res, jest.fn());
    jest.useRealTimers();
    const corpo = res.json.mock.calls[0][0];
    expect(corpo.data.month).toBe('2026-12');
    expect(corpo.data.days['2026-12-10']).toBeUndefined();
    expect(corpo.data.days['2026-12-11']).toBe(true);
    // 1 consulta a units, 2 em lote (reservations + holds) e 1 a blocked_dates
    expect(estado.consultas.filter((t) => t === 'blocked_dates')).toHaveLength(1);
  });
});
