import { describe, expect, it } from 'vitest';
import { buildAttentionItems, unpaidReservations } from '../pages/dashboard/dashboardLogic';

const t = (key, vars) => (vars ? key + JSON.stringify(vars) : key);

const TODAY = '2026-11-02';
const YESTERDAY = '2026-11-01';
const TOMORROW = '2026-11-03';

describe('unpaidReservations', () => {
  it('inclui reserva confirmada com check_in passado e pagamento pendente', () => {
    const r = { id: 1, status: 'confirmed', check_in: YESTERDAY, payment_status: 'pending' };
    expect(unpaidReservations([r], TODAY)).toEqual([r]);
  });

  it('inclui pagamento parcial e os estados checked_in e checked_out', () => {
    const a = { id: 1, status: 'checked_in', check_in: TODAY, payment_status: 'partial' };
    const b = { id: 2, status: 'checked_out', check_in: YESTERDAY, payment_status: 'pending' };
    expect(unpaidReservations([a, b], TODAY)).toEqual([a, b]);
  });

  it('exclui paid, refunded, payment_status em falta, cancelled, pending e check_in futuro', () => {
    const list = [
      { id: 1, status: 'confirmed', check_in: YESTERDAY, payment_status: 'paid' },
      { id: 2, status: 'confirmed', check_in: YESTERDAY, payment_status: 'refunded' },
      { id: 3, status: 'confirmed', check_in: YESTERDAY },
      { id: 4, status: 'cancelled', check_in: YESTERDAY, payment_status: 'pending' },
      { id: 5, status: 'pending', check_in: YESTERDAY, payment_status: 'pending' },
      { id: 6, status: 'confirmed', check_in: TOMORROW, payment_status: 'pending' },
    ];
    expect(unpaidReservations(list, TODAY)).toEqual([]);
  });

  it('devolve [] para undefined', () => {
    expect(unpaidReservations(undefined, TODAY)).toEqual([]);
  });
});

describe('buildAttentionItems', () => {
  it('entrada vazia, {} e undefined devolvem []', () => {
    expect(buildAttentionItems({}, t)).toEqual([]);
    expect(buildAttentionItems(undefined, t)).toEqual([]);
    expect(
      buildAttentionItems(
        { pendingToday: [], unpaid: [], nearlyFull: [], weather: [], docAlerts: [], maintenance: [], unconfirmed: [], cleaning: 0 },
        t
      )
    ).toEqual([]);
  });

  it('weather gera item critico', () => {
    const items = buildAttentionItems(
      { weather: [{ date: '2026-11-03', label: 'Vento forte', toursCount: 2 }, { date: '2026-11-04', label: 'Chuva', toursCount: 1 }] },
      t
    );
    expect(items).toEqual([
      {
        id: 'weather',
        severity: 'critical',
        title: 'dashboard.attention.weather{"n":2}',
        detail: '2026-11-03 Vento forte',
        to: '/meteorologia',
      },
    ]);
  });

  it('docAlerts expirados geram um item critico por alerta', () => {
    const items = buildAttentionItems(
      { docAlerts: [{ type: 'expired', msg: 'Seguro expirado' }, { type: 'expired', msg: 'Licenca expirada' }] },
      t
    );
    expect(items).toEqual([
      { id: 'doc-expired-0', severity: 'critical', title: 'Seguro expirado', to: '/unidades' },
      { id: 'doc-expired-1', severity: 'critical', title: 'Licenca expirada', to: '/unidades' },
    ]);
  });

  it('docAlerts de aviso: com 5 avisos devolve so 3', () => {
    const docAlerts = Array.from({ length: 5 }, (_, i) => ({ type: 'warning', msg: 'Aviso ' + i }));
    const items = buildAttentionItems({ docAlerts }, t);
    expect(items.map((i) => i.id)).toEqual(['doc-warning-0', 'doc-warning-1', 'doc-warning-2']);
    expect(items.every((i) => i.severity === 'warning' && i.to === '/unidades')).toBe(true);
    expect(items[0].title).toBe('Aviso 0');
  });

  it('maintenance gera item de aviso com nomes', () => {
    const items = buildAttentionItems({ maintenance: [{ name: 'Quarto 1' }, { name: 'Quarto 2' }] }, t);
    expect(items).toEqual([
      {
        id: 'maintenance',
        severity: 'warning',
        title: 'dashboard.attention.maintenance{"n":2}',
        detail: 'Quarto 1, Quarto 2',
        to: '/unidades',
      },
    ]);
  });

  it('unconfirmed gera item de aviso', () => {
    const items = buildAttentionItems({ unconfirmed: [{}, {}, {}] }, t);
    expect(items).toEqual([
      { id: 'unconfirmed', severity: 'warning', title: 'dashboard.attention.unconfirmed{"n":3}', to: '/reservas' },
    ]);
  });

  it('pendingToday gera item de aviso', () => {
    const items = buildAttentionItems({ pendingToday: [{}, {}] }, t);
    expect(items).toEqual([
      { id: 'pending', severity: 'warning', title: 'dashboard.attention.pending{"n":2}', to: '/reservas' },
    ]);
  });

  it('unpaid gera item de aviso', () => {
    const items = buildAttentionItems({ unpaid: [{}] }, t);
    expect(items).toEqual([
      { id: 'unpaid', severity: 'warning', title: 'dashboard.attention.unpaid{"n":1}', to: '/reservas' },
    ]);
  });

  it('cleaning > 0 gera item de aviso; 0 nao gera', () => {
    expect(buildAttentionItems({ cleaning: 4 }, t)).toEqual([
      { id: 'cleaning', severity: 'warning', title: 'dashboard.attention.cleaning{"n":4}', to: '/housekeeping' },
    ]);
    expect(buildAttentionItems({ cleaning: 0 }, t)).toEqual([]);
  });

  it('nearlyFull gera item informativo com detalhe', () => {
    const items = buildAttentionItems(
      { nearlyFull: [{ name: 'Tour A', guests: 9, capacity: 10 }, { name: 'Tour B', guests: 7, capacity: 8 }] },
      t
    );
    expect(items).toEqual([
      {
        id: 'nearly-full',
        severity: 'info',
        title: 'dashboard.attention.nearlyFull{"n":2}',
        detail: 'Tour A 9/10; Tour B 7/8',
        to: '/calendario',
      },
    ]);
  });

  it('ordem: critical, warning, info', () => {
    const items = buildAttentionItems(
      {
        nearlyFull: [{ name: 'Tour A', guests: 9, capacity: 10 }],
        pendingToday: [{}],
        docAlerts: [{ type: 'expired', msg: 'Seguro expirado' }],
        weather: [{ date: '2026-11-03', label: 'Vento', toursCount: 1 }],
      },
      t
    );
    expect(items.map((i) => i.id)).toEqual(['weather', 'doc-expired-0', 'pending', 'nearly-full']);
  });

  it('ordem dentro do grupo warning segue a ordem das regras', () => {
    const items = buildAttentionItems(
      {
        cleaning: 1,
        unpaid: [{}],
        pendingToday: [{}],
        unconfirmed: [{}],
        maintenance: [{ name: 'X' }],
        docAlerts: [{ type: 'warning', msg: 'Aviso' }],
      },
      t
    );
    expect(items.map((i) => i.id)).toEqual([
      'doc-warning-0',
      'maintenance',
      'unconfirmed',
      'pending',
      'unpaid',
      'cleaning',
    ]);
  });

  it('nearlyFull sem capacity nao gera item', () => {
    expect(buildAttentionItems({ nearlyFull: [{ name: 'Tour A' }] }, t)).toEqual([]);
  });

  it('nearlyFull sem guests conta como 0', () => {
    const items = buildAttentionItems({ nearlyFull: [{ name: 'Tour A', capacity: 10 }] }, t);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('dashboard.attention.nearlyFull{"n":1}');
    expect(items[0].detail).toBe('Tour A 0/10');
  });

  it('nearlyFull ignora entradas nulas, sem nome ou com NaN', () => {
    const items = buildAttentionItems(
      {
        nearlyFull: [
          null,
          { guests: 5, capacity: 10 },
          { name: '', guests: 5, capacity: 10 },
          { name: 'C', guests: 5, capacity: NaN },
          { name: 'D', guests: NaN, capacity: 6 },
          { name: 'B', guests: 8, capacity: 10 },
        ],
      },
      t
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('dashboard.attention.nearlyFull{"n":2}');
    expect(items[0].detail).toBe('D 0/6; B 8/10');
  });

  it('nearlyFull [null, valida] tem n 1 e detalhe so da valida', () => {
    const items = buildAttentionItems({ nearlyFull: [null, { name: 'B', guests: 8, capacity: 10 }] }, t);
    expect(items[0].title).toBe('dashboard.attention.nearlyFull{"n":1}');
    expect(items[0].detail).toBe('B 8/10');
  });

  it('weather so com date usa so a data no detalhe', () => {
    const items = buildAttentionItems({ weather: [{ date: '2026-11-03' }] }, t);
    expect(items[0].detail).toBe('2026-11-03');
  });

  it('weather so com label usa so a etiqueta no detalhe', () => {
    const items = buildAttentionItems({ weather: [{ label: 'Chuva' }] }, t);
    expect(items[0].detail).toBe('Chuva');
  });

  it('weather [{}] gera item sem a chave detail', () => {
    const items = buildAttentionItems({ weather: [{}] }, t);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('dashboard.attention.weather{"n":1}');
    expect(items[0]).not.toHaveProperty('detail');
  });

  it('weather [null] nao gera item', () => {
    expect(buildAttentionItems({ weather: [null] }, t)).toEqual([]);
  });

  it('weather ignora nulos: n conta so as entradas validas e detalhe vem da primeira valida', () => {
    const items = buildAttentionItems(
      { weather: [null, { date: '2026-11-05', label: 'Vento', toursCount: 1 }, { date: '2026-11-06', label: 'Chuva' }] },
      t
    );
    expect(items[0].title).toBe('dashboard.attention.weather{"n":2}');
    expect(items[0].detail).toBe('2026-11-05 Vento');
  });

  it('maintenance [{ name }, {}] tem detalhe exatamente igual ao nome e n 2', () => {
    const items = buildAttentionItems({ maintenance: [{ name: 'Q1' }, {}] }, t);
    expect(items[0].title).toBe('dashboard.attention.maintenance{"n":2}');
    expect(items[0].detail).toBe('Q1');
  });

  it('maintenance sem nomes nao tem a chave detail', () => {
    const items = buildAttentionItems({ maintenance: [{}, null] }, t);
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('detail');
  });

  it('docAlerts mistos [warning, expired] usam o indice original nos ids', () => {
    const items = buildAttentionItems(
      { docAlerts: [{ type: 'warning', msg: 'W' }, { type: 'expired', msg: 'E' }] },
      t
    );
    expect(items.map((i) => i.id)).toEqual(['doc-expired-1', 'doc-warning-0']);
  });

  it('docAlerts expired seguido de 4 warning: avisos com ids 1, 2, 3 (limite de 3)', () => {
    const docAlerts = [{ type: 'expired', msg: 'E' }].concat(
      Array.from({ length: 4 }, (_, i) => ({ type: 'warning', msg: 'W' + i }))
    );
    const items = buildAttentionItems({ docAlerts }, t);
    expect(items.map((i) => i.id)).toEqual(['doc-expired-0', 'doc-warning-1', 'doc-warning-2', 'doc-warning-3']);
  });

  it('reservas incompletas: pendingToday [{}] gera item com n 1 e nao lanca', () => {
    let items;
    expect(() => {
      items = buildAttentionItems({ pendingToday: [{}] }, t);
    }).not.toThrow();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('dashboard.attention.pending{"n":1}');
  });
});
