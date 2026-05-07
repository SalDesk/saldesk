const { calcularPreco } = require('../helpers/bookingHelpers');

const unitBase = { base_price: 100, pricing_rules: [] };

describe('calcularPreco', () => {
  describe('sem pricing_rules', () => {
    it('calcula 3 noites correctamente', () => {
      const { total, dias } = calcularPreco(unitBase, '2026-01-01', '2026-01-04');
      expect(total).toBe(300);
      expect(dias).toBe(3);
    });

    it('calcula 1 noite', () => {
      const { total, dias } = calcularPreco(unitBase, '2026-06-15', '2026-06-16');
      expect(total).toBe(100);
      expect(dias).toBe(1);
    });
  });

  describe('com regra de percentagem', () => {
    it('aplica acréscimo de 50%', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'percentage',
          price_modifier: 50,
          start_date: null,
          end_date: null,
          days_of_week: null
        }]
      };
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(450); // 3 × 150
    });

    it('aplica desconto de 20%', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'percentage',
          price_modifier: -20,
          start_date: null,
          end_date: null,
          days_of_week: null
        }]
      };
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(240); // 3 × 80
    });
  });

  describe('com regra de valor fixo', () => {
    it('aplica acréscimo fixo de 20 €', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'fixed',
          price_modifier: 20,
          start_date: null,
          end_date: null,
          days_of_week: null
        }]
      };
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(360); // 3 × 120
    });
  });

  describe('regras com filtros', () => {
    it('ignora regras inactivas', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: false,
          modifier_type: 'percentage',
          price_modifier: 100,
          start_date: null,
          end_date: null,
          days_of_week: null
        }]
      };
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(300);
    });

    it('aplica regra apenas no período especificado', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'fixed',
          price_modifier: 50,
          start_date: '2026-01-02',
          end_date: '2026-01-02', // só dia 2
          days_of_week: null
        }]
      };
      // Jan 1 = 100, Jan 2 = 150, Jan 3 = 100 → total = 350
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(350);
    });

    it('aplica regra apenas nos dias da semana especificados', () => {
      // 2026-01-03 = Sábado (6), 2026-01-04 = Domingo (0)
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'fixed',
          price_modifier: 50,
          start_date: null,
          end_date: null,
          days_of_week: [0, 6] // fim de semana
        }]
      };
      // Jan 1 (Qui) = 100, Jan 2 (Sex) = 100, Jan 3 (Sáb) = 150 → 350
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-04');
      expect(total).toBe(350);
    });

    it('não aplica preço negativo (mínimo 0)', () => {
      const unit = {
        base_price: 100,
        pricing_rules: [{
          active: true,
          modifier_type: 'fixed',
          price_modifier: -200, // desconto maior que o preço
          start_date: null,
          end_date: null,
          days_of_week: null
        }]
      };
      const { total } = calcularPreco(unit, '2026-01-01', '2026-01-03');
      expect(total).toBe(0);
    });
  });
});
