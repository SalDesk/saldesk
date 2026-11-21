/* Lugar retido: constantes, verificacao de lugar livre e expiracao das reservas com cartao nao pagas. */
jest.mock('../helpers/bookingHelpers', () => ({
  verificarDisponibilidade: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeMesa: jest.fn(() => Promise.resolve(true)),
  verificarDisponibilidadeSlot: jest.fn(() => Promise.resolve(true)),
  parseUnitMeta: jest.fn(),
  hojeEHoraCaboVerde: jest.fn(() => ({ hoje: '2026-12-01', hora: '10:00' })),
  slotJaComecou: jest.fn(() => false),
  normalizarHora: (t) => (typeof t === 'string' ? t.slice(0, 5) : t),
}));

const bh = require('../helpers/bookingHelpers');
const {
  MINUTOS_RETENCAO, eMetodoCartao, fimDaRetencao, lugarAindaLivre, expirarReservasNaoPagas,
} = require('../helpers/lugarRetido');

// Supabase encadeavel que regista filtros, o update e os inserts de notificacoes.
function mockSupabase({ expiradas = [], unit = null } = {}) {
  const reg = { filtros: [], update: null, selectUpdate: null, notificacoes: [], consultas: 0 };
  const sb = {
    from: jest.fn((tabela) => {
      reg.consultas += 1;
      const b = { tabela };
      ['eq', 'in', 'lt'].forEach((m) => { b[m] = jest.fn((...a) => { reg.filtros.push([m, ...a]); return b; }); });
      b.update = jest.fn((v) => { reg.update = v; return b; });
      b.select = jest.fn((cols) => { if (reg.update) reg.selectUpdate = cols; return b; });
      b.insert = jest.fn((linhas) => { if (tabela === 'notifications') reg.notificacoes.push(linhas); return Promise.resolve({ error: null }); });
      b.single = jest.fn(() => Promise.resolve({ data: unit, error: null }));
      b.maybeSingle = b.single;
      b.then = (ok, ko) => Promise.resolve({ data: tabela === 'reservations' ? expiradas : null, error: null }).then(ok, ko);
      return b;
    }),
  };
  return { sb, reg };
}

beforeEach(() => { jest.clearAllMocks(); bh.slotJaComecou.mockReturnValue(false); });

describe('constantes e auxiliares', () => {
  test('MINUTOS_RETENCAO e 30', () => { expect(MINUTOS_RETENCAO).toBe(30); });

  test('fimDaRetencao soma 30 minutos', () => {
    expect(fimDaRetencao(new Date('2026-12-01T10:00:00Z'))).toBe('2026-12-01T10:30:00.000Z');
  });

  test('eMetodoCartao: so paypal e sisp', () => {
    expect(eMetodoCartao('paypal')).toBe(true);
    expect(eMetodoCartao('sisp')).toBe(true);
    expect(eMetodoCartao('cash')).toBe(false);
    expect(eMetodoCartao(null)).toBe(false);
    expect(eMetodoCartao(undefined)).toBe(false);
  });
});

describe('expirarReservasNaoPagas', () => {
  const agora = new Date('2026-12-01T10:00:00Z');

  test('expira so reservas publicas pendentes com cartao e prazo vencido', async () => {
    const { sb, reg } = mockSupabase({ expiradas: [] });
    await expirarReservasNaoPagas(sb, agora);
    expect(reg.filtros).toEqual([
      ['eq', 'source', 'public'],
      ['eq', 'status', 'pending'],
      ['eq', 'payment_status', 'pending'],
      ['in', 'payment_method', ['paypal', 'sisp']],
      ['lt', 'hold_expires_at', '2026-12-01T10:00:00.000Z'],
    ]);
    expect(reg.update).toMatchObject({ status: 'cancelled', cancel_reason: 'payment_not_completed' });
    expect(reg.update.updated_at).toBeDefined();
    expect(reg.selectUpdate).toBe('id, operator_id, customer_name, units(name)');
  });

  test('cria uma notificacao por reserva expirada', async () => {
    const { sb, reg } = mockSupabase({
      expiradas: [
        { id: 'r1', operator_id: 'op1', customer_name: 'Ana', units: { name: 'Volta à ilha' } },
        { id: 'r2', operator_id: 'op1', customer_name: 'Rui', units: { name: 'Volta à ilha' } },
      ],
    });
    const n = await expirarReservasNaoPagas(sb, agora);
    expect(n).toBe(2);
    expect(reg.notificacoes).toHaveLength(2);
    expect(reg.notificacoes[0]).toEqual({
      operator_id: 'op1',
      notification_type: 'payment_not_completed',
      content: 'Pagamento não concluído — Ana — Volta à ilha',
      link: '/reservas/r1',
    });
  });
});

describe('lugarAindaLivre', () => {
  const agora = new Date('2026-12-01T10:00:00Z');
  const base = { id: 'r1', unit_id: 'u1', check_in: '2026-12-05', check_out: '2026-12-05', start_time: null, duration_minutes: null, guests: 2, is_group_booking: false };

  test('check_in no passado: false e sem consultas', async () => {
    const { sb, reg } = mockSupabase();
    expect(await lugarAindaLivre(sb, { ...base, check_in: '2026-11-30' }, agora)).toBe(false);
    expect(reg.consultas).toBe(0);
    expect(bh.verificarDisponibilidade).not.toHaveBeenCalled();
  });

  test('mesa de restaurante usa verificarDisponibilidadeMesa excluindo a propria reserva', async () => {
    const { sb } = mockSupabase({ unit: { id: 'u1' } });
    const r = { ...base, start_time: '20:00', duration_minutes: 90 };
    expect(await lugarAindaLivre(sb, r, agora)).toBe(true);
    expect(bh.verificarDisponibilidadeMesa).toHaveBeenCalledWith(sb, 'u1', '2026-12-05', '20:00', 90, 'r1');
  });

  test('unidade com slots usa verificarDisponibilidadeSlot excluindo a propria reserva', async () => {
    const { sb } = mockSupabase({ unit: { id: 'u1' } });
    bh.parseUnitMeta.mockReturnValue({ time_slots: [{ time: '09:00', capacity: 8 }] });
    expect(await lugarAindaLivre(sb, { ...base, start_time: '09:00:00' }, agora)).toBe(true);
    expect(bh.verificarDisponibilidadeSlot).toHaveBeenCalledWith(sb, 'u1', '2026-12-05', '09:00', 2, 8, 'r1', false);
  });

  test('slot que ja comecou: false', async () => {
    const { sb } = mockSupabase({ unit: { id: 'u1' } });
    bh.parseUnitMeta.mockReturnValue({ time_slots: [{ time: '09:00', capacity: 8 }] });
    bh.slotJaComecou.mockReturnValue(true);
    expect(await lugarAindaLivre(sb, { ...base, start_time: '09:00' }, agora)).toBe(false);
    expect(bh.verificarDisponibilidadeSlot).not.toHaveBeenCalled();
  });

  test('slot que ja nao existe na unidade: false', async () => {
    const { sb } = mockSupabase({ unit: { id: 'u1' } });
    bh.parseUnitMeta.mockReturnValue({ time_slots: [{ time: '14:00', capacity: 8 }] });
    expect(await lugarAindaLivre(sb, { ...base, start_time: '09:00' }, agora)).toBe(false);
  });

  test('unidade sem slots usa verificarDisponibilidade excluindo a propria reserva', async () => {
    const { sb } = mockSupabase({ unit: { id: 'u1' } });
    bh.parseUnitMeta.mockReturnValue({});
    expect(await lugarAindaLivre(sb, base, agora)).toBe(true);
    expect(bh.verificarDisponibilidade).toHaveBeenCalledWith(sb, 'u1', '2026-12-05', '2026-12-05', 'r1');
  });
});
