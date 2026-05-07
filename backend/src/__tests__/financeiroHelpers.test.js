const { percentChange, calcularPeriodoAnterior, calcularMetricas } = require('../helpers/financeiroHelpers');

describe('percentChange', () => {
  it('calcula variação positiva', () => {
    expect(percentChange(150, 100)).toBe(50);
  });

  it('calcula variação negativa', () => {
    expect(percentChange(50, 100)).toBe(-50);
  });

  it('retorna 0 quando ambos são 0', () => {
    expect(percentChange(0, 0)).toBe(0);
  });

  it('retorna 100 quando anterior é 0 e atual é positivo', () => {
    expect(percentChange(100, 0)).toBe(100);
  });

  it('arredonda ao inteiro', () => {
    expect(percentChange(133, 100)).toBe(33);
    expect(percentChange(67, 100)).toBe(-33);
  });
});

describe('calcularPeriodoAnterior', () => {
  it('calcula o mês anterior para Janeiro', () => {
    const prev = calcularPeriodoAnterior('2026-01-01', '2026-01-31');
    expect(prev.inicio).toBe('2025-12-01');
    expect(prev.fim).toBe('2025-12-31');
  });

  it('calcula a semana anterior', () => {
    const prev = calcularPeriodoAnterior('2026-01-05', '2026-01-11');
    expect(prev.inicio).toBe('2025-12-29');
    expect(prev.fim).toBe('2026-01-04');
  });

  it('calcula período de 1 dia', () => {
    const prev = calcularPeriodoAnterior('2026-03-15', '2026-03-15');
    expect(prev.fim).toBe('2026-03-14');
    expect(prev.inicio).toBe('2026-03-14');
  });
});

describe('calcularMetricas', () => {
  describe('receita', () => {
    it('soma apenas reservas com status checked_out no período', () => {
      const reservas = [
        { unit_id: 'u1', status: 'checked_out', total_price: 300, check_in: '2026-01-01', check_out: '2026-01-04' },
        { unit_id: 'u2', status: 'confirmed',   total_price: 200, check_in: '2026-01-05', check_out: '2026-01-08' }
      ];
      const { receita } = calcularMetricas(reservas, 2, '2026-01-01', '2026-01-31');
      expect(receita).toBe(300);
    });

    it('exclui checked_out fora do período', () => {
      const reservas = [
        { unit_id: 'u1', status: 'checked_out', total_price: 500, check_in: '2025-12-28', check_out: '2026-01-02' },
        { unit_id: 'u1', status: 'checked_out', total_price: 200, check_in: '2026-01-10', check_out: '2026-01-15' }
      ];
      // Apenas a segunda tem check_out em Jan
      const { receita } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-31');
      expect(receita).toBe(200);
    });

    it('retorna 0 sem reservas checked_out', () => {
      const { receita } = calcularMetricas([], 1, '2026-01-01', '2026-01-31');
      expect(receita).toBe(0);
    });
  });

  describe('num_reservas', () => {
    it('conta todas as reservas não canceladas', () => {
      const reservas = [
        { unit_id: 'u1', status: 'confirmed',   total_price: 100, check_in: '2026-01-01', check_out: '2026-01-03' },
        { unit_id: 'u1', status: 'cancelled',   total_price: 100, check_in: '2026-01-05', check_out: '2026-01-07' },
        { unit_id: 'u1', status: 'checked_out', total_price: 100, check_in: '2026-01-10', check_out: '2026-01-12' }
      ];
      const { num_reservas } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-31');
      expect(num_reservas).toBe(2); // exclui a cancelada
    });
  });

  describe('taxa_ocupacao', () => {
    it('calcula 50% de ocupação para 2 dias de 4', () => {
      // Reserva: check_in Jan 1, check_out Jan 3 → ocupa Jan 1 e Jan 2
      // Período: Jan 1 a Jan 4 = 4 dias
      const reservas = [
        { unit_id: 'u1', status: 'confirmed', total_price: 200, check_in: '2026-01-01', check_out: '2026-01-03' }
      ];
      const { taxa_ocupacao } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-04');
      expect(taxa_ocupacao).toBe(50);
    });

    it('calcula 100% com unidade totalmente ocupada', () => {
      const reservas = [
        { unit_id: 'u1', status: 'confirmed', total_price: 300, check_in: '2026-01-01', check_out: '2026-01-04' }
      ];
      const { taxa_ocupacao } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-03');
      expect(taxa_ocupacao).toBe(100);
    });

    it('retorna 0 sem unidades', () => {
      const { taxa_ocupacao } = calcularMetricas([], 0, '2026-01-01', '2026-01-31');
      expect(taxa_ocupacao).toBe(0);
    });

    it('exclui reservas canceladas do cálculo de ocupação', () => {
      const reservas = [
        { unit_id: 'u1', status: 'cancelled', total_price: 100, check_in: '2026-01-01', check_out: '2026-01-04' }
      ];
      const { taxa_ocupacao } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-04');
      expect(taxa_ocupacao).toBe(0);
    });

    it('conta unidades únicas por dia (evita duplicados)', () => {
      // Mesma unidade com 2 reservas sobrepostas (não deve contar a dobrar)
      const reservas = [
        { unit_id: 'u1', status: 'confirmed', total_price: 100, check_in: '2026-01-01', check_out: '2026-01-03' },
        { unit_id: 'u1', status: 'confirmed', total_price: 100, check_in: '2026-01-01', check_out: '2026-01-03' }
      ];
      const { taxa_ocupacao } = calcularMetricas(reservas, 1, '2026-01-01', '2026-01-04');
      expect(taxa_ocupacao).toBe(50); // 2 dias de 4, não 4 de 4
    });
  });
});
