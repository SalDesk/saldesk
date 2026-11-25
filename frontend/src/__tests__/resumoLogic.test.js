import { describe, expect, it } from 'vitest';
import {
  periodoResumo, preencherSerie, alinharSeries, melhorPonto, totalActual,
  deltaPercentual, deltaPontos, ocupacaoActividades,
} from '../pages/dashboard/resumoLogic';

describe('periodoResumo', () => {
  it('30 dias acaba hoje e o anterior acaba na vespera do inicio', () => {
    expect(periodoResumo('30d', '2026-11-25')).toEqual({
      inicio: '2026-10-27',
      fim: '2026-11-25',
      anteriorInicio: '2026-09-27',
      anteriorFim: '2026-10-26',
      granularidade: 'day',
    });
  });

  it('7 dias', () => {
    expect(periodoResumo('7d', '2026-11-25')).toMatchObject({
      inicio: '2026-11-19', fim: '2026-11-25', anteriorInicio: '2026-11-12', anteriorFim: '2026-11-18', granularidade: 'day',
    });
  });

  it('12 meses comeca no dia 1 do mes de ha 11 meses e e por mes', () => {
    const p = periodoResumo('12m', '2026-11-25');
    expect(p.inicio).toBe('2025-12-01');
    expect(p.fim).toBe('2026-11-25');
    expect(p.granularidade).toBe('month');
    expect(p.anteriorFim).toBe('2025-11-30');
  });

  it('12 meses atravessa o ano (hoje em fevereiro)', () => {
    expect(periodoResumo('12m', '2026-02-10').inicio).toBe('2025-03-01');
  });
});

describe('preencherSerie', () => {
  it('preenche os dias em falta com zero', () => {
    const s = preencherSerie([{ periodo: '2026-11-02', receita: 50 }], '2026-11-01', '2026-11-03', 'day');
    expect(s).toEqual([
      { periodo: '2026-11-01', valor: 0 },
      { periodo: '2026-11-02', valor: 50 },
      { periodo: '2026-11-03', valor: 0 },
    ]);
  });

  it('por mes tem uma posicao por mes, de 12 meses', () => {
    const p = periodoResumo('12m', '2026-11-25');
    const s = preencherSerie([{ periodo: '2026-03', receita: 10 }], p.inicio, p.fim, 'month');
    expect(s).toHaveLength(12);
    expect(s[0].periodo).toBe('2025-12');
    expect(s[11].periodo).toBe('2026-11');
    expect(s.find((x) => x.periodo === '2026-03').valor).toBe(10);
  });

  it('ignora a forma errada e valores invalidos', () => {
    expect(preencherSerie(null, '2026-11-01', '2026-11-01', 'day')).toEqual([{ periodo: '2026-11-01', valor: 0 }]);
    expect(preencherSerie([{ periodo: '2026-11-01', receita: 'x' }], '2026-11-01', '2026-11-01', 'day')[0].valor).toBe(0);
  });
});

describe('alinharSeries', () => {
  it('alinha por posicao e preenche a mais curta com null', () => {
    const r = alinharSeries(
      [{ rotulo: 'a', valor: 1 }, { rotulo: 'b', valor: 2 }, { rotulo: 'c', valor: 3 }],
      [{ rotulo: 'x', valor: 9 }],
    );
    expect(r).toEqual([
      { rotulo: 'a', actual: 1, anterior: 9 },
      { rotulo: 'b', actual: 2, anterior: null },
      { rotulo: 'c', actual: 3, anterior: null },
    ]);
    expect(alinharSeries([{ rotulo: 'a', valor: 1 }], [{ rotulo: 'x', valor: 9 }, { rotulo: 'y', valor: 8 }])[1])
      .toEqual({ rotulo: 'y', actual: null, anterior: 8 });
  });
});

describe('melhorPonto', () => {
  it('devolve o valor mais alto do periodo actual', () => {
    const s = [
      { rotulo: 'a', actual: 10, anterior: 99 },
      { rotulo: 'b', actual: 40, anterior: 1 },
      { rotulo: 'c', actual: 25, anterior: null },
    ];
    expect(melhorPonto(s)).toEqual({ indice: 1, rotulo: 'b', valor: 40 });
  });

  it('sem receita ou sem pontos, null', () => {
    expect(melhorPonto([{ rotulo: 'a', actual: 0, anterior: 5 }])).toBeNull();
    expect(melhorPonto([])).toBeNull();
  });

  it('total so do periodo actual', () => {
    expect(totalActual([{ actual: 1, anterior: 50 }, { actual: 2, anterior: null }])).toBe(3);
  });
});

describe('variacoes', () => {
  it('percentagem inteira com sinal; sem base nao ha variacao', () => {
    expect(deltaPercentual(120, 100)).toBe('+20%');
    expect(deltaPercentual(90, 100)).toBe('-10%');
    expect(deltaPercentual(100, 100)).toBe('0%');
    expect(deltaPercentual(50, 0)).toBeNull();
    expect(deltaPercentual(50, undefined)).toBeNull();
  });

  it('pontos percentuais inteiros; sem base nao ha variacao', () => {
    expect(deltaPontos(64, 60)).toBe(4);
    expect(deltaPontos(50.4, 60)).toBe(-10);
    expect(deltaPontos(50, 0)).toBeNull();
    expect(deltaPontos(50, null)).toBeNull();
    expect(deltaPontos(null, 50)).toBeNull();
  });
});

describe('ocupacaoActividades', () => {
  const tours = [
    { id: 't1', name: 'A', capacity: 10, status: 'active' },
    { id: 't2', name: 'B', capacity: 10, status: 'inactive' },
    { id: 't3', name: 'Sem capacidade', status: 'active' },
  ];

  it('pessoas das reservas validas sobre a capacidade dos tours activos nos dias', () => {
    const reservas = [
      { unit_id: 't1', check_in: '2026-11-02', guests: 5, status: 'confirmed' },
      { unit_id: 't1', check_in: '2026-11-03', guests: 5, status: 'checked_out' },
      { unit_id: 't1', check_in: '2026-11-03', guests: 9, status: 'cancelled' },
      { unit_id: 't1', check_in: '2026-12-01', guests: 9, status: 'confirmed' },
      { unit_id: 't2', check_in: '2026-11-02', guests: 9, status: 'confirmed' },
    ];
    /* 10 pessoas / (capacidade 10 x 2 dias) */
    expect(ocupacaoActividades(reservas, tours, '2026-11-02', '2026-11-03')).toBe(50);
  });

  it('sem capacidade, null', () => {
    expect(ocupacaoActividades([], [{ id: 't3', status: 'active' }], '2026-11-02', '2026-11-03')).toBeNull();
    expect(ocupacaoActividades([], [], '2026-11-02', '2026-11-03')).toBeNull();
  });

  it('nunca passa de 100', () => {
    const r = [{ unit_id: 't1', check_in: '2026-11-02', guests: 50, status: 'confirmed' }];
    expect(ocupacaoActividades(r, tours, '2026-11-02', '2026-11-02')).toBe(100);
  });
});
