const { lerFiltrosDeData, aplicarFiltrosDeData } = require('../helpers/reservationFilters');

// Builder falso que regista as chamadas e devolve-se a si proprio
function criarBuilder() {
  const chamadas = [];
  const q = {
    chamadas,
    gte: (col, v) => { chamadas.push(['gte', col, v]); return q; },
    lte: (col, v) => { chamadas.push(['lte', col, v]); return q; },
  };
  return q;
}

describe('lerFiltrosDeData', () => {
  it('sem parametros devolve objecto vazio e nao filtra nada', () => {
    const filtros = lerFiltrosDeData({});
    expect(filtros).toEqual({});
    const q = criarBuilder();
    expect(aplicarFiltrosDeData(q, filtros)).toBe(q);
    expect(q.chamadas).toEqual([]);
  });

  it('stay_from e stay_to aplicam lte(check_in) e gte(check_out)', () => {
    const q = criarBuilder();
    aplicarFiltrosDeData(q, lerFiltrosDeData({ stay_from: '2026-11-03', stay_to: '2026-11-03' }));
    expect(q.chamadas).toContainEqual(['lte', 'check_in', '2026-11-03']);
    expect(q.chamadas).toContainEqual(['gte', 'check_out', '2026-11-03']);
    expect(q.chamadas).toHaveLength(2);
  });

  it('so stay_from aplica apenas gte(check_out)', () => {
    const q = criarBuilder();
    aplicarFiltrosDeData(q, lerFiltrosDeData({ stay_from: '2026-11-03' }));
    expect(q.chamadas).toEqual([['gte', 'check_out', '2026-11-03']]);
  });

  it('so stay_to aplica apenas lte(check_in)', () => {
    const q = criarBuilder();
    aplicarFiltrosDeData(q, lerFiltrosDeData({ stay_to: '2026-11-03' }));
    expect(q.chamadas).toEqual([['lte', 'check_in', '2026-11-03']]);
  });

  it('check_in_from e check_in_to preservam o comportamento anterior', () => {
    const q = criarBuilder();
    aplicarFiltrosDeData(q, lerFiltrosDeData({ check_in_from: '2026-11-01', check_in_to: '2026-11-30' }));
    expect(q.chamadas).toContainEqual(['gte', 'check_in', '2026-11-01']);
    expect(q.chamadas).toContainEqual(['lte', 'check_in', '2026-11-30']);
    expect(q.chamadas).toHaveLength(2);
  });

  it('ignora from e to (nao sao aliases)', () => {
    expect(lerFiltrosDeData({ from: '2026-11-03', to: '2026-11-03' })).toEqual({});
  });

  it.each([
    ['stay_from', '2026-02-30'],
    ['stay_to', 'abc'],
    ['stay_from', '2026-13-01'],
    ['check_in_from', '2026-1-5'],
    ['check_in_to', '2027-02-29'],
  ])('data invalida em %s (%s) lanca erro 400 que nomeia o parametro', (param, valor) => {
    let erro;
    try { lerFiltrosDeData({ [param]: valor }); } catch (e) { erro = e; }
    expect(erro).toBeDefined();
    expect(erro.status).toBe(400);
    expect(erro.code).toBe('INVALID_DATE');
    expect(erro.message).toContain(param);
    expect(erro.message).toContain(valor);
  });

  it('string vazia conta como ausente', () => {
    expect(lerFiltrosDeData({ stay_from: '', stay_to: '' })).toEqual({});
  });

  it('intervalo invertido lanca 400', () => {
    let erro;
    try { lerFiltrosDeData({ stay_from: '2026-11-10', stay_to: '2026-11-03' }); } catch (e) { erro = e; }
    expect(erro.status).toBe(400);
    expect(erro.code).toBe('INVALID_RANGE');

    expect(() => lerFiltrosDeData({ check_in_from: '2026-11-10', check_in_to: '2026-11-03' })).toThrow();
  });

  it('intervalo de um dia (from igual a to) e valido', () => {
    expect(() => lerFiltrosDeData({ stay_from: '2026-11-03', stay_to: '2026-11-03' })).not.toThrow();
  });

  it('ano bissexto: 2028-02-29 valido, 2027-02-29 invalido', () => {
    expect(lerFiltrosDeData({ stay_from: '2028-02-29' })).toEqual({ stayFrom: '2028-02-29' });
    expect(() => lerFiltrosDeData({ stay_from: '2027-02-29' })).toThrow();
  });
});
